const ticketsEl = document.getElementById("tickets");
const alertsEl = document.getElementById("alerts");
const composer = document.getElementById("composer");
const incoming = document.getElementById("incoming");
const clock = document.getElementById("clock");
const btnCritical = document.getElementById("btn-critical");
const btnAll = document.getElementById("btn-all");

const state = {
  tickets: [],
  events: [],
  criticalOnly: true,
  done: new Set(),
};

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

tickClock();
setInterval(tickClock, 1000);
loadState();
