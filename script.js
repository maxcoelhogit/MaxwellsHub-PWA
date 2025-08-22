// ====== Config ======
const form = document.getElementById("pergunta-form");
const input = document.getElementById("pergunta");
const respostaDiv = document.getElementById("resposta");
let thread_id = null;

// Se o front estiver no GitHub Pages, use URL absoluta da Vercel; senão, caminho relativo
const API_BASE = location.hostname.endsWith("github.io")
  ? "https://maxwells-hub-pwa.vercel.app"
  : "";

// Bot por query (?bot=LUCAS) ou padrão LUCAS
const BOT = (new URLSearchParams(location.search).get("bot") || "LUCAS")
  .toUpperCase()
  .replace(/[^A-Z0-9_]/g, "");

const withBot = (path) =>
  `${API_BASE}${path}${path.includes("?") ? "&" : "?"}bot=${encodeURIComponent(BOT)}`;

// ====== UI Helpers ======
function adicionarMensagem(remetente, mensagem, tipo) {
  const div = document.createElement("div");
  div.classList.add("mensagem");

  if (tipo === "user") {
    // Segurança: não renderizar HTML vindo do usuário
    div.classList.add("mensagem-usuario");
    div.innerHTML = `<strong>${remetente}:</strong> `;
    const span = document.createElement("span");
    span.textContent = mensagem;
    div.appendChild(span);
  } else if (tipo === "bot") {
    div.classList.add("mensagem-bot");
    div.innerHTML = `<strong>${remetente}:</strong> ${transformarLinksEmCliqueAqui(mensagem)}`;
  } else {
    div.classList.add("mensagem-erro");
    div.innerHTML = `<strong>${remetente}:</strong> ${transformarLinksEmCliqueAqui(mensagem)}`;
  }

  respostaDiv.appendChild(div);
  respostaDiv.scrollTop = respostaDiv.scrollHeight;
}

function transformarLinksEmCliqueAqui(texto) {
  // Corrige escapes do Markdown
  texto = texto.replace(/\\([\[\]\(\)])/g, "$1");
  // [Texto](https://...) → link
  texto = texto.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${t}</a>`
  );
  // URLs soltas → "Clique aqui"
  texto = texto.replace(/(?<!href=")(https?:\/\/[^\s]+)/g, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">Clique aqui</a>`
  );
  return texto.replace(/\n/g, "<br>");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ====== Saudação inicial ======
window.onload = () => {
  adicionarMensagem(
    "MaxwellsHub",
    "👋 Olá! Sou o Lucas, assistente do MaxwellsHub. Estou aqui para te ajudar com dúvidas e muito mais. Digite sua mensagem abaixo e veja como posso ajudar. 😊",
    "bot"
  );
};

// ====== Envio da pergunta ======
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const pergunta = input.value.trim();
  if (!pergunta) return;

  adicionarMensagem("Você", pergunta, "user");
  input.value = "";

  const digitando = document.createElement("div");
  digitando.classList.add("mensagem-bot");
  digitando.textContent = "Lucas está digitando...";
  respostaDiv.appendChild(digitando);
  respostaDiv.scrollTop = respostaDiv.scrollHeight;

  try {
    // Rota unificada do backend
    const resp = await fetch(withBot("/proxy/index"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: pergunta, thread_id })
    });

    console.log("Request URL:", resp.url, "Status:", resp.status);
    const data = await resp.json().catch(() => ({}));

    if (digitando.parentNode) respostaDiv.removeChild(digitando);

    if (!resp.ok) {
      console.error("Erro backend:", data);
      adicionarMensagem("Erro", data?.error || "Erro ao processar a solicitação.", "erro");
      return;
    }

    thread_id = data.thread_id || thread_id;

    if (data.resposta) {
      adicionarMensagem("Lucas", data.resposta, "bot");
      return;
    }

    if (data.run_id) {
      const respostaFinal = await aguardarResposta(thread_id, data.run_id);
      adicionarMensagem("Lucas", respostaFinal, "bot");
      return;
    }

    adicionarMensagem("Erro", "Não houve resposta do assistente.", "erro");

  } catch (erro) {
    if (digitando.parentNode) respostaDiv.removeChild(digitando);
    console.error("Erro ao enviar pergunta:", erro);
    adicionarMensagem("Erro", "Erro ao se conectar ao servidor.", "erro");
  }
});

// ====== Polling /proxy/check-run (caso necessário) ======
async function aguardarResposta(threadId, runId, maxTentativas = 20) {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
    await sleep(1500);

    const r = await fetch(withBot("/proxy/check-run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thread_id: threadId, run_id: runId })
    });

    const d = await r.json().catch(() => ({}));

    if (!r.ok) {
      console.error("Falha no check-run:", d);
      throw new Error(d?.error || "Falha ao verificar status.");
    }

    if (d.status === "completed") {
      return d.resposta || "Sem resposta.";
    }
    if (["failed", "expired", "cancelled"].includes(d.status)) {
      throw new Error(`Execução ${d.status}.`);
    }
  }
  throw new Error("Tempo excedido aguardando resposta.");
}
