export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  try {
    const { mensagem, thread_id: recebidoThreadId } = req.body || {};
    if (!mensagem || typeof mensagem !== "string") {
      return res.status(400).json({ error: "Mensagem ausente ou inválida" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no ambiente" });

    // Resolve o assistente por ?bot=IMOVEIS / ?bot=LUCAS ... ou default
    const bot = getBotKey(req);
    const assistantEnvKey = `ASSISTANT_ID_${bot}`;
    const assistantId = process.env[assistantEnvKey] || process.env.ASSISTANT_ID_DEFAULT;
    if (!assistantId) {
      return res.status(500).json({ error: `Assistant ID não definido (${assistantEnvKey} / ASSISTANT_ID_DEFAULT)` });
    }

    const baseHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "OpenAI-Beta": "assistants=v2",
    };

    // 1) Criar thread se necessário
    let threadId = recebidoThreadId;
    if (!threadId) {
      const novaThread = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({}),
      });
      const novaThreadData = await novaThread.json();
      if (!novaThread.ok) return res.status(500).json({ error: "Falha ao criar thread", detail: novaThreadData });
      threadId = novaThreadData.id;
    }

    // 2) Enviar mensagem do usuário
    const addMsg = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ role: "user", content: mensagem }),
    });
    if (!addMsg.ok) {
      const d = await addMsg.json();
      return res.status(500).json({ error: "Falha ao enviar mensagem", detail: d });
    }

    // 3) Iniciar run
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ assistant_id: assistantId }),
    });
    const runData = await runRes.json();
    if (!runRes.ok) return res.status(500).json({ error: "Falha ao iniciar run", detail: runData });

    // 4) Aguardar conclusão (até 20 tentativas)
    const runId = runData.id;
    let status = runData.status || "queued";
    let attempts = 0;

    while (!["completed", "failed", "expired", "cancelled"].includes(status) && attempts < 20) {
      await new Promise(r => setTimeout(r, 1500));
      const st = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, { headers: baseHeaders });
      const stData = await st.json();
      if (!st.ok) return res.status(500).json({ error: "Falha ao checar status do run", detail: stData });
      status = stData.status;
      attempts++;
    }

    if (status !== "completed") {
      // Retorna parcial para o front fazer polling em /proxy/check-run
      return res.status(200).json({ status, thread_id: threadId, run_id: runId, bot });
    }

    // 5) Buscar resposta final
    const respostaRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, { headers: baseHeaders });
    const respostaData = await respostaRes.json();
    if (!respostaRes.ok) return res.status(500).json({ error: "Falha ao obter mensagens", detail: respostaData });

    const ultima = respostaData.data?.find(m => m.role === "assistant");
    let resposta = ultima?.content?.[0]?.text?.value || "Sem resposta.";

    // Limpa eventuais citações no formato 【x:y†...】
    resposta = resposta.replace(/【\d+:\d+†[^】]+】/g, "").trim();

    return res.status(200).json({ status: "completed", resposta, thread_id: threadId, run_id: runId, bot });
  } catch (erro) {
    console.error("❌ Erro no backend /proxy/index:", erro);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
}

function getBotKey(req) {
  const q = (req.query?.bot || "").toString();
  const b = (req.body?.bot || "").toString();
  const h = (req.headers["x-bot"] || "").toString();
  const raw = q || b || h || "DEFAULT";
  return raw.toUpperCase().replace(/[^A-Z0-9_]/g, "");
}
