export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { thread_id, run_id } = req.body || {};
  if (!thread_id || !run_id) return res.status(400).json({ error: "Dados ausentes" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no ambiente" });

  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "OpenAI-Beta": "assistants=v2"
  };

  try {
    // 1) Checar status
    const runResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, { headers });
    const runData = await runResp.json();
    if (!runResp.ok) return res.status(500).json({ error: "Falha ao verificar run", detail: runData });

    if (runData.status !== "completed") {
      return res.status(200).json({ status: runData.status });
    }

    // 2) Buscar mensagens
    const msgsResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, { headers });
    const msgsData = await msgsResp.json();
    if (!msgsResp.ok) return res.status(500).json({ error: "Falha ao obter mensagens", detail: msgsData });

    const ultima = msgsData.data?.find(m => m.role === "assistant");
    const resposta = (ultima?.content?.[0]?.text?.value || "Sem conteúdo").replace(/【\d+:\d+†[^】]+】/g, "").trim();

    return res.status(200).json({ status: "completed", resposta });
  } catch (err) {
    console.error("Erro /proxy/check-run:", err);
    return res.status(500).json({ error: "Erro ao verificar status." });
  }
}
