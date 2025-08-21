export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const { mensagem, thread_id: recebidoThreadId } = req.body;
    console.log("📥 Mensagem recebida:", mensagem);
    console.log("📎 Thread ID recebido:", recebidoThreadId);

    const openaiKey = process.env.OPENAI_API_KEY;
    const assistantId = "asst_9yJA8VVqi07ykPqfUxJ3RY5G"; // Novo ID do MaxBot

    let threadId = recebidoThreadId;

    // Cria nova thread se necessário
    if (!threadId) {
      const novaThread = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${openaiKey}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });

      const novaThreadData = await novaThread.json();
      threadId = novaThreadData.id;
      console.log("🧵 Nova thread criada:", threadId);
    }

    // Adiciona mensagem do usuário à thread
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        role: "user",
        content: mensagem
      })
    });

    // Cria execução
    const runRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiKey}`,
        "OpenAI-Beta": "assistants=v2"
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });

    const runData = await runRes.json();
    const runId = runData.id;
    console.log("🏃 Run iniciada:", runId);

    // Aguarda execução até finalizar
    let status = "queued";
    let attempts = 0;
    let statusData = {};

    while (status !== "completed" && status !== "failed" && attempts < 20) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const statusRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "OpenAI-Beta": "assistants=v2"
        }
      });
      statusData = await statusRes.json();
      status = statusData.status;
      console.log(`⏳ Tentativa ${attempts + 1}: status = ${status}`);
      attempts++;
    }

    if (status !== "completed") {
      console.warn("⚠️ A execução não foi concluída a tempo. Status final:", status);
    }

    // Busca resposta final
    const respostaRes = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "OpenAI-Beta": "assistants=v2"
      }
    });

    const respostaData = await respostaRes.json();
    const ultima = respostaData.data?.find(m => m.role === "assistant");
    let resposta = ultima?.content?.[0]?.text?.value || "Sem resposta.";

    // ✅ Remove citações de fontes, se houver
    const respostaLimpa = resposta.replace(/【\d+:\d+†[^】]+】/g, "").trim();

    console.log("✅ Resposta final:", respostaLimpa);

    res.status(200).json({ resposta: respostaLimpa, thread_id: threadId });

  } catch (erro) {
    console.error("❌ Erro no backend:", erro);
    res.status(500).json({ erro: "Erro interno no servidor" });
  }
}
