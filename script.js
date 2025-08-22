// ===== Build/debug =====
const BUILD = "2025-08-21-03";
console.log("SCRIPT BUILD:", BUILD);

// ===== Referências DOM =====
const form = document.getElementById("pergunta-form");
const input = document.getElementById("pergunta");
const respostaDiv = document.getElementById("resposta");
let thread_id = null;

// ===== Backend absoluto na Vercel (front roda no GitHub Pages) =====
const API_BASE = "https://maxwells-hub-pwa.vercel.app";

// Bot por query (?bot=LUCAS) ou padrão LUCAS
const BOT = (new URLSearchParams(location.search).get("bot") || "LUCAS")
  .toUpperCase()
  .replace(/[^A-Z0-9_]/g, "");

// Monta URL SEMPRE apontando para a função correta
const withBot = (path) =>
  `${API_BASE}${path}${path.includes("?") ? "&" : "?"}bot=${encodeURIComponent(BOT)}`;

// ===== Helpers UI =====
function adicionarMensagem(remetente, mensagem, tipo) {
  const div = document.createElement("div");
  div.classList.add("mensagem");

  if (tipo === "user") {
    div.classList.add("mensagem-usuario");
    div.innerHTML = `<strong>${remetente}:</strong> `;
    const span = document.createElement("span");
    span.textContent = mensagem; // evita HTML injection do usuário
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
  texto = texto.replace(/\\([\[\]\(\)])/g, "$1");
  texto = texto.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, t, url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${t}</a>`
  );
  texto = texto.replace(/(?<!href=")(https?:\/\/[^\s]+)/g, (url) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">Clique aqui</a>`
  );
  return texto.replace(/\n/g, "<br>");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ===== Saudação ===
