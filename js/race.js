// КРИПТОПОЛИС — гонка майнинга против ботов.
// Ты и три ИИ-майнера ищете блок (хеш с нужным числом нулей).
// Твой перебор — настоящий SHA-256; разгон даёт скорость, но греет риг.

const Race = (() => {
  const ZEROS = 4;                 // целевое число ведущих нулей
  const P = Math.pow(16, -ZEROS);  // вероятность успеха одного хеша

  const RIGS = [
    { name: "Ноутбук", budget: 5, color: "#9aa6c8" },
    { name: "Игровой ПК", budget: 9, color: "#4dabf7" },
    { name: "Майнинг-ферма", budget: 14, color: "#38d9a9" },
  ];

  let S = null, ui = {}, raf = null, onFinishCb = null;

  function freshState(rig) {
    return {
      rig,
      you: { hashes: 0, nonce: 0, rate: 0, found: false },
      bots: [
        { name: "Бот «Хешер»", rate: 95000, attempts: 0, found: false, color: "#f5c542" },
        { name: "Бот «Нонс»", rate: 120000, attempts: 0, found: false, color: "#be4bdb" },
        { name: "Бот «Кило»", rate: 70000, attempts: 0, found: false, color: "#ff8787" },
      ],
      heat: 0, overclock: false, cooling: false,
      running: false, done: false, last: 0,
      header: `блок|Алиса→Боб:6|prev:${Math.random().toString(16).slice(2, 10)}|nonce:`,
    };
  }

  function expected() { return 1 / P; }

  function pct(attempts) {
    return Math.min(99, (attempts / expected()) * 100);
  }

  function win(who) {
    if (S.done) return;
    S.done = true;
    S.running = false;
    stopLoop();
    const youWon = who === "you";
    ui.result.classList.remove("hidden");
    ui.result.innerHTML = `
      <h3>${youWon ? "🏁 Ты нашёл блок первым!" : "Блок забрал " + who + "."}</h3>
      <p>${youWon
        ? `Твой риг перебрал <b>${S.you.hashes.toLocaleString("ru")}</b> хешей и нашёл nonce <code>${S.you.nonce}</code> с ${ZEROS} нулями раньше ботов. Награда — твоя.`
        : `Соперник оказался быстрее. Твой риг успел перебрать ${S.you.hashes.toLocaleString("ru")} хешей. Возьми риг помощнее или рискни разгоном.`}</p>
      <p class="muted">Так и работает PoW: все майнеры наперегонки перебирают нонсы, побеждает тот, кто первым угадал. Чем больше суммарная мощность сети — тем она безопаснее, ведь обогнать её всё дороже.</p>
      <button class="primary rc-again">Новая гонка</button>`;
    ui.result.querySelector(".rc-again").onclick = () => Race.open(ui.root, onFinishCb);
    youWon ? Sound.fanfare() : Sound.bad();
    if (onFinishCb) onFinishCb({ won: youWon });
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!S || !S.running || S.done) return;
    const dt = Math.min(0.05, (now - S.last) / 1000) || 0.016;
    S.last = now;

    // нагрев/охлаждение
    if (S.overclock && !S.cooling) {
      S.heat = Math.min(1, S.heat + dt * 0.45);
      if (S.heat >= 1) { S.cooling = true; S.overclock = false; }
    } else {
      S.heat = Math.max(0, S.heat - dt * 0.4);
      if (S.cooling && S.heat <= 0.25) S.cooling = false;
    }

    // твой настоящий перебор SHA-256 в рамках бюджета кадра
    if (!S.cooling) {
      const budget = S.rig.budget * (S.overclock ? 2 : 1);
      const deadline = performance.now() + budget;
      let did = 0;
      const sha = Demos.sha256;
      const target = "0".repeat(ZEROS);
      while (performance.now() < deadline) {
        const h = sha(S.header + S.you.nonce);
        S.you.nonce++; S.you.hashes++; did++;
        if (h.startsWith(target)) { win("you"); return; }
      }
      S.you.rate = Math.round(did / (budget / 1000));
    } else {
      S.you.rate = 0;
    }

    // боты: вероятностный перебор
    for (const b of S.bots) {
      if (b.found) continue;
      const attempts = b.rate * dt;
      b.attempts += attempts;
      const pFound = 1 - Math.pow(1 - P, attempts);
      if (Math.random() < pFound) { win(b.name); return; }
    }

    render();
  }

  function render() {
    ui.you.style.width = pct(S.you.hashes) + "%";
    ui.youInfo.textContent = S.cooling
      ? `перегрев — охлаждаюсь · ${S.you.hashes.toLocaleString("ru")} хешей`
      : `${S.you.rate.toLocaleString("ru")} H/s · ${S.you.hashes.toLocaleString("ru")} хешей · nonce ${S.you.nonce}`;
    ui.heat.style.width = (S.heat * 100) + "%";
    ui.heat.style.background = S.heat > 0.7 ? "var(--red)" : "var(--gold)";
    S.bots.forEach((b, i) => {
      ui.bots[i].style.width = pct(b.attempts) + "%";
    });
  }

  function startRace() {
    if (S.running) return;
    S.running = true;
    S.last = performance.now();
    ui.start.disabled = true;
    ui.rigsel.querySelectorAll("button").forEach((b) => b.disabled = true);
  }

  function buildUI(container) {
    container.innerHTML = `
      <p class="muted">Найди блок раньше трёх ботов: первый хеш с ${ZEROS} нулями в начале забирает награду.
      Твой перебор — настоящий SHA-256. Выбери риг, по желанию жми разгон (быстрее, но греется).</p>
      <div class="rc-rigsel"></div>
      <div class="rc-track">
        <div class="rc-lane"><span class="rc-name you-name">Ты</span>
          <div class="rc-bar"><div class="rc-fill you"></div></div></div>
        <div class="rc-you-info"></div>
        <div class="rc-heatwrap"><span>Нагрев</span><div class="rc-bar small"><div class="rc-fill heat"></div></div></div>
      </div>
      <div class="rc-bots"></div>
      <div class="rc-controls">
        <button class="rc-start primary">Старт гонки</button>
        <button class="rc-oc">⚡ Разгон (зажать)</button>
      </div>
      <div class="rc-result hidden"></div>`;

    const rigsel = container.querySelector(".rc-rigsel");
    RIGS.forEach((r, i) => {
      const b = document.createElement("button");
      b.className = "rc-rig" + (i === 1 ? " active" : "");
      b.innerHTML = `<b style="color:${r.color}">${r.name}</b><span>скорость ${"▮".repeat(i + 1)}</span>`;
      b.onclick = () => {
        S.rig = RIGS[i];
        rigsel.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
      };
      rigsel.appendChild(b);
    });

    const botsEl = container.querySelector(".rc-bots");
    botsEl.innerHTML = S.bots.map((b, i) =>
      `<div class="rc-lane"><span class="rc-name" style="color:${b.color}">${b.name}</span>
        <div class="rc-bar"><div class="rc-fill bot" data-b="${i}"></div></div></div>`).join("");

    ui = {
      root: container,
      rigsel,
      start: container.querySelector(".rc-start"),
      oc: container.querySelector(".rc-oc"),
      you: container.querySelector(".rc-fill.you"),
      youInfo: container.querySelector(".rc-you-info"),
      heat: container.querySelector(".rc-fill.heat"),
      bots: [...container.querySelectorAll(".rc-fill.bot")],
      result: container.querySelector(".rc-result"),
    };

    ui.start.onclick = startRace;
    const ocDown = () => { if (S.running && !S.cooling) S.overclock = true; };
    const ocUp = () => { S.overclock = false; };
    ui.oc.addEventListener("pointerdown", ocDown);
    ui.oc.addEventListener("pointerup", ocUp);
    ui.oc.addEventListener("pointerleave", ocUp);
    render();
  }

  function stopLoop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  return {
    open(container, onFinish) {
      onFinishCb = onFinish;
      stopLoop();
      S = freshState(RIGS[1]);
      buildUI(container);
      raf = requestAnimationFrame(frame);
    },
    close() { stopLoop(); S = null; },
  };
})();
