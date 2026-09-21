const ticketsEl = document.getElementById("tickets");
const alertsEl = document.getElementById("alerts");
const composer = document.getElementById("composer");
const incoming = document.getElementById("incoming");
const clock = document.getElementById("clock");
const btnCritical = document.getElementById("btn-critical");
const btnAll = document.getElementById("btn-all");
const btnSim = document.getElementById("btn-sim");
const dutyEl = document.getElementById("duty");
const dutyFace = document.getElementById("duty-face");
const dutyText = document.getElementById("duty-text");
const sirenOverlay = document.getElementById("siren-overlay");
const confettiCanvas = document.getElementById("confetti-canvas");
const shiftComplete = document.getElementById("shift-complete");
const shiftStats = document.getElementById("shift-stats");
const shiftDismiss = document.getElementById("shift-dismiss");

const state = {
  tickets: [],
  events: [],
  criticalOnly: true,
  done: new Set(),
  celebrated: false,
};

// --- звук: два синтезированных тона, без файлов и внешних библиотек ---
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freqStart, freqEnd, duration, type, gainValue) {
  try {
    const ctx = getAudio();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (err) {
    // звук — бонус, тишина в неподдерживаемом браузере не должна ломать интерфейс
  }
}

function playSiren() {
  playTone(440, 880, 0.18, "sawtooth", 0.06);
  setTimeout(() => playTone(880, 440, 0.18, "sawtooth", 0.06), 190);
}

function playFanfare() {
  [523, 659, 784, 1047].forEach((freq, i) => {
    setTimeout(() => playTone(freq, freq, 0.16, "triangle", 0.05), i * 90);
  });
}

function updateDuty(criticalCount) {
  let face = "🐈";
  let text = "дежурный спокоен";
  let mood = "calm";
  if (criticalCount >= 3) {
    face = "🙀";
    text = "дежурный в тревоге";
    mood = "alarm";
  } else if (criticalCount >= 1) {
    face = "🐈‍⬛";
    text = "дежурный насторожен";
    mood = "alert";
  }
  dutyFace.textContent = face;
  dutyText.textContent = text;
  dutyEl.className = `duty ${mood}`;
}

function launchConfetti() {
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  confettiCanvas.classList.remove("hidden");
  const ctx = confettiCanvas.getContext("2d");
  const colors = ["#e24b32", "#d4a017", "#8fb39a", "#c4b48a", "#e7eadf"];
  const particles = Array.from({ length: 140 }, () => ({
    x: Math.random() * confettiCanvas.width,
    y: -20 - Math.random() * confettiCanvas.height * 0.5,
    r: 4 + Math.random() * 5,
    vy: 2 + Math.random() * 3,
    vx: -1.5 + Math.random() * 3,
    color: colors[Math.floor(Math.random() * colors.length)],
    rot: Math.random() * 360,
    vr: -6 + Math.random() * 12,
  }));
  let frame = 0;
  const maxFrames = 220;

  function tick() {
    frame += 1;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
    });
    if (frame < maxFrames) {
      requestAnimationFrame(tick);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.classList.add("hidden");
    }
  }
  requestAnimationFrame(tick);
}

function celebrateShiftComplete() {
  const total = state.tickets.length;
  const complaints = state.tickets.filter((t) => t.category === "жалоба").length;
  const critical = state.events.filter((e) => e.level === "critical").length;
  shiftStats.textContent =
    `Обработано обращений: ${total} · жалоб: ${complaints} · критичных поймано: ${critical}`;
  shiftComplete.classList.remove("hidden");
  playFanfare();
  launchConfetti();
}

function tickClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("ru-RU", { hour12: false });
  clock.dateTime = now.toISOString();
}

function counts() {
  const open = state.tickets.filter((ticket) => !state.done.has(ticket.id));
  const complaints = open.filter((ticket) => ticket.category === "жалоба").length;
  const critical = state.events.filter((event) => event.level === "critical").length;
  document.getElementById("stat-queue").textContent = String(open.length);
  document.getElementById("stat-complaints").textContent = String(complaints);
  document.getElementById("stat-critical").textContent = String(critical);
  document.getElementById("stat-noise").textContent = String(state.events.length - critical);
  document.getElementById("alert-summary").textContent = `критичных ${critical}`;
  updateDuty(critical);

  if (state.tickets.length > 0 && open.length === 0 && !state.celebrated) {
    state.celebrated = true;
    celebrateShiftComplete();
  } else if (open.length > 0) {
    state.celebrated = false;
  }
}

function renderTickets() {
  ticketsEl.innerHTML = state.tickets
    .map((ticket) => {
      const done = state.done.has(ticket.id);
      return `
        <article class="card ${done ? "done" : ""}" data-id="${ticket.id}">
          <div class="card-top">
            <span class="badge ${ticket.category}">${ticket.category}</span>
            <span class="meta">#${String(ticket.id).padStart(2, "0")}</span>
          </div>
          <p class="text">${escapeHtml(ticket.text)}</p>
          <p class="draft">${escapeHtml(ticket.draft)}</p>
          <div class="actions">
            <button type="button" data-copy="${ticket.id}">Скопировать ответ</button>
            <button type="button" data-done="${ticket.id}">${done ? "Вернуть" : "Закрыть"}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAlerts() {
  alertsEl.innerHTML = state.events
    .map((event) => {
      const hidden = state.criticalOnly && event.level !== "critical";
      return `
        <article class="alert ${event.level} ${hidden ? "hidden" : ""}">
          <div class="alert-top">
            <span class="badge ${event.level}">${event.level}</span>
            <span class="meta">${escapeHtml(event.service)}</span>
          </div>
          <p class="text">${escapeHtml(event.title)}</p>
          <p class="host">${escapeHtml(event.host)} · ${escapeHtml(event.message)}</p>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setFilter(criticalOnly) {
  state.criticalOnly = criticalOnly;
  btnCritical.classList.toggle("on", criticalOnly);
  btnAll.classList.toggle("on", !criticalOnly);
  btnCritical.setAttribute("aria-pressed", String(criticalOnly));
  btnAll.setAttribute("aria-pressed", String(!criticalOnly));
  renderAlerts();
}

async function loadState() {
  const response = await fetch("/api/state");
  const data = await response.json();
  state.tickets = data.tickets;
  state.events = data.events;
  renderTickets();
  renderAlerts();
  counts();
}

composer.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = incoming.value.trim();
  if (!text) return;
  const response = await fetch("/api/classify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const ticket = await response.json();
  if (ticket.error) {
    incoming.setCustomValidity(ticket.error);
    incoming.reportValidity();
    return;
  }
  state.tickets.unshift(ticket);
  incoming.value = "";
  renderTickets();
  counts();
});

incoming.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    composer.requestSubmit();
  }
});

ticketsEl.addEventListener("click", async (event) => {
  const copyId = event.target.dataset.copy;
  const doneId = event.target.dataset.done;
  if (copyId) {
    const ticket = state.tickets.find((item) => String(item.id) === copyId);
    if (ticket) {
      await navigator.clipboard.writeText(ticket.draft);
      event.target.textContent = "Скопировано";
      setTimeout(() => {
        event.target.textContent = "Скопировать ответ";
      }, 1200);
    }
  }
  if (doneId) {
    const id = Number(doneId);
    if (state.done.has(id)) state.done.delete(id);
    else state.done.add(id);
    renderTickets();
    counts();
  }
});

btnCritical.addEventListener("click", () => setFilter(true));
btnAll.addEventListener("click", () => setFilter(false));

btnSim.addEventListener("click", async () => {
  btnSim.disabled = true;
  try {
    const response = await fetch("/api/simulate", { method: "POST" });
    const event = await response.json();
    state.events.unshift(event);
    renderAlerts();
    counts();
    const firstCard = alertsEl.querySelector(".alert");
    if (firstCard) {
      firstCard.classList.add("new");
      setTimeout(() => firstCard.classList.remove("new"), 1300);
    }
    if (event.level === "critical") {
      sirenOverlay.classList.add("active");
      playSiren();
      setTimeout(() => sirenOverlay.classList.remove("active"), 700);
    }
  } finally {
    btnSim.disabled = false;
  }
});

shiftDismiss.addEventListener("click", () => {
  shiftComplete.classList.add("hidden");
});

tickClock();
setInterval(tickClock, 1000);
loadState();
