// /proxy/check-run.js  (exemplo)
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { thread_id, run_id } = req.body || {};
  if (!thread_id || !run_id) return res.status(400).json({ error: "Dados ausentes" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no ambiente" });

  // opcional: manter consistência com /start-run (?bot=IMOVEIS etc.)
  const bot = (req.query?.bot || "DEFAULT").toUpperCase().replace(/[^A-Z0-9_]/g, "");

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "OpenAI-Beta": "assistants=v2"
  };

  try {
    // 1) Checar status do run
    const runResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, { headers });
    const runData = await runResp.json();
    if (!runResp.ok) return res.status(500).json({ error: "Falha ao verificar run", detail: runData });

    if (runData.status !== "completed") {
      return res.status(200).json({ status: runData.status, bot });
    }

    // 2) Buscar mensagens e extrair a última do assistente
    const msgsResp = await fetch(`https://api.op
