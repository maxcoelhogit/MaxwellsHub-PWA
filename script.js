const form = document.getElementById("pergunta-form");
const input = document.getElementById("pergunta");
const respostaDiv = document.getElementById("resposta");
let thread_id = null;

// Detecta onde o front está hospedado
const API_BASE = location.hostname.endsWith("github.io")
  ? "https://maxwells-hub-pwa.vercel.app" // backend na Vercel
  : ""; // se o front também estiver na Vercel, caminhos relativos funcionam

// Qual bot usar (pega da URL ?bot=LUCAS ou cai no LUCAS)
const BOT = (new URLSearchParams(location.search).get("bot") || "LUCAS")
  .toUpperCase()
  .replace(/[^A-Z0-9_]/g, "");

const withBot = (path) =>
  `${API_BASE}${path}${path.includes("?") ? "&" : "?"}bot=${encodeURIComponent(BOT)}`;

// Saudação inicial
window.onload = () => {
  adicionarMensagem(
    "MaxwellsHub",
    transformarLinksEmCliqueAqui("👋 Olá! Sou o Lucas, assistende do MaxwellsHub. Estou aqui para te ajudar com dúvidas e muito mais. Digite sua mensagem abaixo e veja como posso ajudar. 😊"),
    "bot"
  );
};

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
    // 🔧 Chame sua função serverless unificada
    // Se o seu backend usa start-run/check-run separados, troque para '/proxy/start-run' e depois faça o polling em '/proxy/check-run'
    const resp = await fetch(withBot("/proxy/index"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: pergunta, thread_id })
    });

    // Debug útil no console
    console.log("Request URL:", resp.url, "Status:", resp.status);

    const data = await resp.json().catch(() => ({}));
    respostaDiv.removeChild(digitando);

    if (!resp.ok) {
      console.error("Erro backend:", data);
      adicionarMensagem("Erro", data?.error || "Erro ao processar a solicitação.", "erro");
      return;
    }

    thread_id = data.thread_id || thread_id;

    if (data.resposta) {
      adicionarMensagem("Lucas", transformarLinksEmCliqueAqui(data.resposta), "bot");
    } else if (data.status && data.status !== "completed") {
      adicionarMensagem("Lucas", `Status: ${data.status}. Tente novamente em instantes.`, "bot");
    } else {
      adicionarMensagem("Erro", "Não houve resposta do assistente.", "erro");
    }
  } catch (erro) {
    respostaDiv.removeChild(digitando);
    console.error("Erro ao enviar pergunta:", erro);
    adicionarMensagem("Erro", "Erro ao se conectar ao servidor.", "erro");
  }
});

function adicionarMensagem(remetente, mensagem, tipo) {
  const div = document.createElement("div");
  div.classList.add("mensagem");

  if (tipo === "user") {
    div.classList.add("mensagem-usuario");
    div.innerHTML = `<strong>${remetente}:</strong> ${mensagem}`;
  } else if (tipo === "bot") {
    div.classList.add("mensagem-bot");
    div.innerHTML = `<strong>${remetente}:</strong> ${mensagem}`;
  } else {
    div.classList.add("mensagem-erro");
    div.innerHTML = `<strong>${remetente}:</strong> ${mensagem}`;
  }

  respostaDiv.appendChild(div);
  respostaDiv.scrollTop = respostaDiv.scrollHeight;
}

function transformarLinksEmCliqueAqui(texto) {
  // Corrige escape Markdown vindo do backend
  texto = texto.replace(/\\([\[\]\(\)])/g, "$1");
  // [Texto](https://...) → link clicável
  texto = texto.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${t}</a>`
  );
  // URLs soltas → "Clique aqui"
  texto = texto.replace(/(?<!href=")(https?:\/\/[^\s]+)/g, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">Clique aqui</a>`
  );
  return texto.replace(/\n/g, "<br>");
}
