// ПЕРЕПИСЬ — движок. Состояние, рендер, цены, концовки.

const SAVE_KEY = "perepis_save_v1";
const THINNING_START = 18;
const THINNING_DEFAULT_STEP = 4;

let state = null;
let pendingChoice = null; // выбор, ждущий оплаты воспоминанием

const $ = (id) => document.getElementById(id);

function newState() {
  return {
    scene: "start",
    thinning: THINNING_START,
    memories: INITIAL_MEMORIES.map((m) => ({ ...m })),
    spent: [],
    inventory: INVENTORY_START.map((i) => ({ ...i })),
    flags: {},
    shownEvents: [],
  };
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !SCENES[s.scene]) return null;
    return s;
  } catch (e) { return null; }
}

function sceneText(scene) {
  return typeof scene.text === "function" ? scene.text(state) : scene.text;
}

function availableChoices(scene) {
  return (scene.choices || []).filter((c) => !c.condition || c.condition(state));
}

// ---------- рендер ----------

function render() {
  const scene = SCENES[state.scene];
  const story = $("story");

  $("scene-title").textContent = scene.title;
  $("scene-text").innerHTML = sceneText(scene);
  story.classList.toggle("ending", !!scene.ending);

  renderSidebar();
  renderWorldEvent();

  const box = $("choices");
  box.innerHTML = "";

  if (scene.ending) {
    $("scene-text").insertAdjacentHTML("beforeend", epilogueHTML());
    const btn = document.createElement("button");
    btn.textContent = "Начать новую перепись";
    btn.onclick = restart;
    box.appendChild(btn);
    save();
    return;
  }

  for (const choice of availableChoices(scene)) {
    const wrap = document.createElement("div");
    wrap.className = "choice-wrap";

    const btn = document.createElement("button");
    btn.innerHTML = choice.text +
      (choice.cost === "memory" ? ' <span class="cost-tag">— цена: воспоминание</span>' : "");
    btn.onclick = () => attempt(choice);
    wrap.appendChild(btn);

    if (choice.warn) {
      const w = document.createElement("div");
      w.className = "warn";
      w.textContent = "⚠ " + choice.warn;
      wrap.appendChild(w);
    }
    box.appendChild(wrap);
  }

  save();
}

function renderSidebar() {
  const pct = Math.min(100, state.thinning);
  $("thinning-fill").style.width = pct + "%";
  $("thinning-label").textContent =
    pct < 35 ? "Город держится." :
    pct < 60 ? "Окраины выцветают." :
    pct < 85 ? "Глаза людей соскальзывают с улиц." :
    "Сверка почти не учтена.";

  const mem = $("memories");
  mem.innerHTML = "";
  for (const m of state.memories) {
    const li = document.createElement("li");
    li.textContent = (m.gained ? "✦ " : "") + m.name;
    mem.appendChild(li);
  }
  for (const name of state.spent) {
    const li = document.createElement("li");
    li.className = "spent";
    li.textContent = name;
    mem.appendChild(li);
  }

  const inv = $("inventory");
  inv.innerHTML = "";
  for (const i of state.inventory) {
    const li = document.createElement("li");
    li.textContent = i.name;
    inv.appendChild(li);
  }
  if (!state.inventory.length) inv.innerHTML = "<li>— пусто —</li>";
}

function renderWorldEvent() {
  // показываем самое свежее событие мира, до которого дотянулось истончение
  let latest = null;
  for (const ev of WORLD_EVENTS) {
    if (state.thinning >= ev.min) latest = ev;
  }
  $("world-event").textContent = latest ? "Пока ты решаешь: " + latest.text : "";
}

// ---------- эпилог ----------

function epilogueHTML() {
  const parts = [];

  if (state.spent.length) {
    parts.push("Чернила взяли своё. Ты больше не помнишь: " +
      state.spent.map((n) => "«" + n.toLowerCase() + "»").join(", ") + ".");
  } else {
    parts.push("Ты не отдал чернилам ни одного воспоминания. В этом мире это почти неприлично.");
  }

  const f = state.flags;
  if (f.betrayed) parts.push("Девятая Контора знает свои караулы хуже, чем гильдия. Однажды ночью это станет видно с любой крыши города.");
  if (f.debt) parts.push("Где-то в вычеркнутом переулке Грай пережёвывает твой долг. Он придёт за страницей из Реестра — в самый неудобный из дней.");
  if (f.lied_to_guild) parts.push("В переулки Неучтённых тебе больше нет хода — ни за какую память.");
  if (f.remembered_man) {
    if (state.spent.includes("Имя стеклодува Айвена")) {
      parts.push("Ты обещал стеклодуву помнить его имя — и отдал имя в чернила. Где-то в Сверке стало одним пустым фартуком больше.");
    } else {
      parts.push("Стеклодув Айвен жив, пока ты держишь его имя. Ты держишь.");
    }
  }
  if (f.passed_by) parts.push("Стеклодув закончился на углу, где ты не остановился. Этого нет ни в одном реестре, кроме твоего.");
  if (f.against_will) parts.push("Ты слышал «нет» брата — и пошёл дальше. Чем бы это ни кончилось, это сделано через его волю.");

  return '<div class="epilogue-block"><p>' + parts.join("</p><p>") + "</p></div>";
}

// ---------- выборы ----------

function attempt(choice) {
  if (choice.cost === "memory") {
    if (!state.memories.length) {
      alert("Тебе нечем платить: память пуста. Этот путь закрыт.");
      return;
    }
    pendingChoice = choice;
    openMemoryModal(choice.costText);
    return;
  }
  commit(choice);
}

function commit(choice) {
  if (choice.effect) choice.effect(state);
  state.thinning += choice.thinning != null ? choice.thinning : THINNING_DEFAULT_STEP;

  let next = choice.to;
  const target = SCENES[next];
  if (state.thinning >= 100 && !(target && target.ending)) {
    next = "end_thinning";
  }

  state.scene = next;
  const scene = SCENES[next];
  if (scene.onEnter) scene.onEnter(state);
  render();
  $("story").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- модалка памяти ----------

function openMemoryModal(costText) {
  $("memory-modal-text").textContent =
    (costText ? costText.charAt(0).toUpperCase() + costText.slice(1) + ". " : "") +
    "Выбери, что отдать. Ты забудешь это навсегда.";
  const list = $("memory-options");
  list.innerHTML = "";
  for (const m of state.memories) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = m.name;
    btn.onclick = () => spendMemory(m.id);
    li.appendChild(btn);
    list.appendChild(li);
  }
  $("memory-modal").classList.remove("hidden");
}

function spendMemory(id) {
  const idx = state.memories.findIndex((m) => m.id === id);
  if (idx === -1) return;
  state.spent.push(state.memories[idx].name);
  state.memories.splice(idx, 1);
  closeMemoryModal();
  const c = pendingChoice;
  pendingChoice = null;
  commit(c);
}

function closeMemoryModal() {
  $("memory-modal").classList.add("hidden");
}

// ---------- запуск ----------

function restart() {
  state = newState();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ничего */ }
  render();
}

document.addEventListener("DOMContentLoaded", () => {
  $("btn-restart").onclick = () => {
    if (confirm("Начать заново? Текущая перепись будет стёрта.")) restart();
  };
  $("memory-cancel").onclick = () => { pendingChoice = null; closeMemoryModal(); };

  state = load() || newState();
  render();
});
