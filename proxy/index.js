// /proxy/index.js  (handler POST)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { mensagem, thread_id } = req.body || {};
  if (!mensagem) return res.status(400).json({ error: "Mensagem não fornecida" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no ambiente" });

  // Suporte a múltiplos assistentes via ?bot=IMOVEIS, ?bot=CONDOVALE, etc.
  const bot = (req.query?.bot || "DEFAULT").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const assistantEnvKey = `ASSISTANT_ID_${bot}`;
  const assistantId = process.env[assistantEnvKey] || process.env.ASSISTANT_ID_MAXWELLSHUB;

  if (!assistantId) {
    return res.status(500).json({ error: `Assistant ID não definido (checado: ${assistantEnvKey} e ASSISTANT_ID_MAXWELLSHUB)` });
  }

  const baseHeaders = {
    "Authorization": `Bearer ${apiKey}`,
    "OpenAI-Beta": "assistants=v2",
    "Content-Type": "application/json",
  };

  try {
    // 1) Criar thread (se não veio)
    let threadId = thread_id;
    if (!threadId) {
      const threadResp = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: baseHeaders,
        body: JSON.stringify({}),
      });
      const threadData = await threadResp.json();
      if (!threadResp.ok) return res.status(500).json({ error: "Falha ao criar thread", detail: threadData });
      threadId = threadData.id;
    }

    // 2) Enviar mensagem do usuário
    const msgResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ role: "user", content: mensagem }),
    });
    if (!msgResp.ok) {
      const d = await msgResp.json();
      return res.status(500).json({ error: "Falha ao enviar mensagem", detail: d });
    }

    // 3) Iniciar run
    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: baseHeaders,
      body: JSON.stringify({ assistant_id: assistantId }),
    });
    const runData = await runResp.json();
    if (!runResp.ok) return res.status(500).json({ error: "Falha ao iniciar run", detail: runData });

    // 4) Aguardar run concluir
    let status = runData.status || "queued";
    let runId = runData.id;
    while (status !== "completed" && status !== "failed" && status !== "expired" && status !== "cancelled") {
      await new Promise(r => setTimeout(r, 1500));
      const st = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, { headers: baseHeaders });
      const stData = await st.json();
      if (!st.ok) return res.status(500).json({ error: "Falha ao checar run", detail: stData });
      status = stData.status;
    }
    if (status !== "completed") return res.status(500).json({ error: `Run terminou com status ${status}` });

    // 5) Buscar resposta
    const msgsResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, { headers: baseHeaders });
    const msgsData = await msgsResp.json();
    if (!msgsResp.ok) return res.status(500).json({ error: "Falha ao obter mensagens", detail: msgsData });

    const ultima = msgsData.data?.find(m => m.role === "assistant");
    const texto = ultima?.content?.[0]?.text?.value || "Sem resposta gerada.";

    return res.status(200).json({ resposta: texto, thread_id: threadId, bot });
  } catch (e) {
    console.error("Erro geral:", e);
    return res.status(500).json({ error: "Erro interno ao processar a requisição." });
  }
}
