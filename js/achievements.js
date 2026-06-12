// КРИПТОПОЛИС — достижения и тосты. Состояние хранит app.js;
// здесь — определения, проверка событий и всплывающие уведомления.

const ACHIEVEMENTS = [
  { id: "first_module",  icon: "📗", name: "Первые шаги",      desc: "Зачти первый модуль",                          ev: "module_done",  cond: (d, p) => true },
  { id: "perfect_quiz",  icon: "💯", name: "Без помарок",       desc: "Ответь 4/4 в проверке модуля",                 ev: "quiz_result",  cond: (d) => !d.exam && d.correct === d.total },
  { id: "first_block",   icon: "⛏", name: "Генезис",           desc: "Намайни блок в демонстрации",                  ev: "mined",        cond: () => true },
  { id: "signer",        icon: "🔏", name: "Криптограф",        desc: "Проверь настоящую цифровую подпись",           ev: "verified",     cond: () => true },
  { id: "all_modules",   icon: "🏙", name: "Весь город",        desc: "Зачти все 8 модулей",                          ev: "module_done",  cond: (d, p) => MODULES.every((m) => p.done[m.id]) },
  { id: "satoshi",       icon: "👑", name: "Сатоши",            desc: "Сдай финальный экзамен",                       ev: "exam_passed",  cond: () => true },
  { id: "trader_run",    icon: "📈", name: "Два года на рынке", desc: "Пройди торговый симулятор до конца",           ev: "trade_done",   cond: () => true },
  { id: "trader_profit", icon: "💰", name: "В плюсе",           desc: "Заверши симулятор с прибылью",                 ev: "trade_done",   cond: (d) => d.profit > 0 },
  { id: "diamond_hands", icon: "💎", name: "Алмазные руки",     desc: "Переживи обвал на 40%+, не продав всё",        ev: "trade_done",   cond: (d) => d.survivedCrash },
  { id: "scam_hunter",   icon: "🕵", name: "Охотник на скам",   desc: "Распознай все 10 сценариев фишинга",           ev: "phish_done",   cond: (d) => d.correct === d.total },
];

const Achievements = (() => {
  function toast(a) {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<span class="t-icon">${a.icon}</span><div><div class="t-name">Достижение: ${a.name}</div><div class="t-desc">${a.desc} · +10 XP</div></div>`;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 500); }, 4200);
  }

  // возвращает список новых достижений; отметку и XP начисляет вызывающий
  function check(event, data, progress) {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (a.ev !== event || progress.ach[a.id]) continue;
      if (a.cond(data || {}, progress)) fresh.push(a);
    }
    return fresh;
  }

  return { check, toast, list: ACHIEVEMENTS };
})();
