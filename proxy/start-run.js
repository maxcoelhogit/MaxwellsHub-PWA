// /proxy/start-run.js (ou o arquivo equivalente ao seu exemplo)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { mensagem, thread_id } = req.body || {};
  if (!mensagem) return res.status(400).json({ error: "Mensagem ausente" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no ambiente" });

  // Permite escolher assistente por ?bot=IMOVEIS, ?bot=CONDOVALE, etc.
  const bot = (req.query?.bot || "DEFAULT").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const assistantEnvKey = `ASSISTANT_ID_${bot}`;
  const assistantId = process.env[assistantEnvKey] || process.env.ASSISTANT_ID_MAXWELLSHUB;
  if (!assistantId) {
    return res.status(500).json({ error: `Assistant ID não definido (checado: ${assistantEnvKey} e ASSISTANT_ID_MAXWELLSHUB)` });
  }

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "OpenAI-Beta": "assistants=v2",
    "Content-Type": "application/json"
  };

  try {
    let threadId = thread_id;

    // Criar thread se necessário
    if (!threadId) {
      const r = await fetch("https://api.openai.com/v1/threads", { method: "POST", headers, body: JSON.stringify({}) });
      const d = await r.json();
      if (!r.ok) return res.status(500).json({ error: "Falha ao criar thread", detail: d });
      threadId = d.id;
    }

    // Enviar mensagem do usuário
    const m = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: "user", content: mensagem })
    });
    if (!m.ok) {
      const d = await m.json();
      return res.status(500).json({ error: "Falha ao enviar mensagem", detail: d });
    }

    // Iniciar run com o assistente selecionado
    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: assistantId })
    });
    const runData = await runResp.json();
    if (!runResp.ok) return res.status(500).json({ error: "Falha ao iniciar run", detail: runData });

    return res.status(200).json({ thread_id: threadId, run_id: runData.id, bot });

  } catch (err) {
    console.error("Erro /ask:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
