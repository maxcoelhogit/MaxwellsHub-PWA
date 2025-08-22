export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    console.log("Método não permitido:", req.method);
    return res.status(405).json({ error: "Método não permitido" });
  }

  const { mensagem, thread_id } = req.body;

  if (!mensagem) {
    console.log("Mensagem não fornecida");
    return res.status(400).json({ error: "Mensagem não fornecida" });
  }

  try {
    let threadId = thread_id;

    // Etapa 1: Criar novo thread se não existir
    if (!threadId) {
      console.log("Criando novo thread...");
      const threadResponse = await fetch("https://api.openai.com/v1/threads", {
        method: "POST",
        headers: {
          "Authorization": "Bearer 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",
          "OpenAI-Beta": "assistants=v2",
          "Content-Type": "application/json"
        }
      });

      const threadData = await threadResponse.json();
      threadId = threadData.id;
      console.log("Thread criado:", threadId);
    }

    // Etapa 2: Enviar mensagem
    console.log("Enviando mensagem para thread:", threadId);
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ role: "user", content: mensagem })
    });

    // Etapa 3: Iniciar run
    console.log("Iniciando run...");
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: "POST",
      headers: {
        "Authorization": "Bearer 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",
        "OpenAI-Beta": "assistants=v2",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assistant_id: "asst_KMIWalVC23wmVvldvpuOVEv9" })
    });

    const runData = await runResponse.json();
    console.log("Run iniciado:", runData.id);

    // Etapa 4: Aguardar run concluir
    let status = "queued";
    console.log("Aguardando finalização do run...");
    while (status !== "completed") {
      await new Promise(resolve => setTimeout(resolve, 1500));

      const statusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runData.id}`, {
        headers: {
          "Authorization": "Bearer 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",
          "OpenAI-Beta": "assistants=v2"
        }
      });

      const statusData = await statusResponse.json();
      status = statusData.status;
      console.log("Status atual:", status);
    }

    // Etapa 5: Obter resposta
    console.log("Obtendo mensagens...");
    const mensagensResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        "Authorization": "Bearer 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",
        "OpenAI-Beta": "assistants=v2"
      }
    });

    const mensagensData = await mensagensResponse.json();
    const ultimaMensagem = mensagensData.data.find(msg => msg.role === "assistant");

    if (!ultimaMensagem) {
      console.log("Nenhuma resposta encontrada.");
      return res.status(500).json({ resposta: "Sem resposta gerada." });
    }

    console.log("Resposta obtida:", ultimaMensagem.content[0].text.value);
    return res.status(200).json({
      resposta: ultimaMensagem.content[0].text.value,
      thread_id: threadId
    });

  } catch (erro) {
    console.error("Erro geral:", erro);
    return res.status(500).json({ error: "Erro interno ao processar a requisição." });
  }
}
