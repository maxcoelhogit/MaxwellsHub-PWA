export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { thread_id, run_id } = req.body;
  if (!thread_id || !run_id) return res.status(400).json({ error: "Dados ausentes" });

  const headers = {
    "Authorization": "Bearer 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",
    "OpenAI-Beta": "assistants=v2"
  };

  try {
    const runResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/runs/${run_id}`, {
      headers
    });

    const runData = await runResp.json();

    if (runData.status !== "completed") {
      return res.status(200).json({ status: runData.status });
    }

    const mensagensResp = await fetch(`https://api.openai.com/v1/threads/${thread_id}/messages`, {
      headers
    });

    const mensagensData = await mensagensResp.json();
    const ultima = mensagensData.data.find(msg => msg.role === "assistant");

    return res.status(200).json({
      status: "completed",
      resposta: ultima?.content?.[0]?.text?.value || "Sem conteúdo"
    });

  } catch (err) {
    console.error("Erro /check:", err);
    return res.status(500).json({ error: "Erro ao verificar status." });
  }
}
