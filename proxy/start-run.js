export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido" });

  const { mensagem, thread_id } = req.body;
  if (!mensagem) return res.status(400).json({ error: "Mensagem ausente" });

  const headers = {
    "Authorization": "Bearer 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",
    "OpenAI-Beta": "assistants=v2",
    "Content-Type": "application/json"
  };

  try {
    let threadId = thread_id;

    if (!threadId) {
      const r = await fetch("https://api.openai.com/v1/threads", { method: "POST", headers });
      const d = await r.json();
      threadId = d.id;
    }

    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ role: "user", content: mensagem })
    });

    const runResp = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ assistant_id: "asst_dk7R5Q7jPZSSB1imMz2NtfTY" })
    });

    const runData = await runResp.json();

    return res.status(200).json({ thread_id: threadId, run_id: runData.id });

  } catch (err) {
    console.error("Erro /ask:", err);
    return res.status(500).json({ error: "Erro interno." });
  }
}
