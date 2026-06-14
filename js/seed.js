// КРИПТОПОЛИС — сид-фраза и проверка бэкапа.
// Генерируем мнемонику из учебного набора слов BIP39, выводим адрес
// настоящим SHA-256 и заставляем восстановить фразу по памяти.

const Seed = (() => {
  // подмножество реального списка BIP39 (для игры; полный список — 2048 слов)
  const WORDS = (
    "abandon ability able about above absent absorb abstract absurd abuse access accident " +
    "account accuse achieve acid acoustic acquire across action actor actual adapt add " +
    "address adjust admit adult advance advice aerobic affair afford afraid again agent " +
    "agree ahead aim air airport aisle alarm album alcohol alert alien alley allow almost " +
    "alone alpha already also alter always amateur amazing among amount amused anchor " +
    "ancient anger angle angry animal ankle announce annual another answer antenna antique " +
    "anxiety apart apology appear apple approve april arch arctic area arena argue armor " +
    "army around arrange arrest arrive arrow artist artwork ask aspect asset assist assume " +
    "athlete atom attack attend attitude attract auction audit august aunt author auto " +
    "autumn average avocado avoid awake aware away awesome awful awkward axis"
  ).split(" ");

  let mnemonic = [], stage = "intro", recovered = [], pool = [], errors = 0;
  let box = null, onFinishCb = null;

  function genMnemonic() {
    const chosen = [];
    const used = new Set();
    while (chosen.length < 12) {
      const w = WORDS[Math.floor(Math.random() * WORDS.length)];
      if (!used.has(w)) { used.add(w); chosen.push(w); }
    }
    return chosen;
  }

  function address(words) {
    const h = (window.Demos && Demos.sha256) ? Demos.sha256(words.join(" ")) : "0".repeat(64);
    return "0x" + h.slice(0, 40);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- экраны ----------

  function renderIntro() {
    box.innerHTML = `
      <p class="muted">Сид-фраза (мнемоника) — человекочитаемая форма мастер-ключа. Из неё выводятся
      все адреса кошелька. Кто знает эти слова — владеет всеми монетами. Порядок слов важен.</p>
      <button class="primary sd-gen">Создать кошелёк</button>`;
    box.querySelector(".sd-gen").onclick = () => {
      mnemonic = genMnemonic();
      Sound.coin();
      renderShow();
    };
  }

  function renderShow() {
    stage = "show";
    const addr = address(mnemonic);
    box.innerHTML = `
      <p class="muted">Твоя сид-фраза из 12 слов. В реальности её <b>никогда</b> не вводят на сайтах и не
      хранят в облаке — только офлайн, на бумаге или металле, в двух местах.</p>
      <div class="sd-words">${mnemonic.map((w, i) =>
        `<span class="sd-word"><i>${i + 1}</i>${w}</span>`).join("")}</div>
      <div class="sd-addr">Адрес кошелька (выведен из фразы через SHA-256):<br><code>${addr}</code></div>
      <p class="muted">Запомни порядок — сейчас проверим бэкап, как это стоит делать <b>до</b> внесения денег.</p>
      <button class="primary sd-test">Я запомнил — проверить бэкап</button>`;
    box.querySelector(".sd-test").onclick = () => renderTest();
  }

  function renderTest() {
    stage = "test";
    recovered = [];
    errors = 0;
    pool = shuffle(mnemonic);
    drawTest();
  }

  function drawTest() {
    const next = recovered.length + 1;
    box.innerHTML = `
      <p class="muted">Собери фразу в правильном порядке. Сейчас нужно слово <b>№${next}</b>.
      Ошибки считаются — как в жизни, где неверный бэкап = потерянный кошелёк.</p>
      <div class="sd-slots">${mnemonic.map((w, i) =>
        `<span class="sd-slot ${i < recovered.length ? "filled" : i === recovered.length ? "active" : ""}">
          <i>${i + 1}</i>${i < recovered.length ? recovered[i] : "····"}</span>`).join("")}</div>
      <div class="sd-pool"></div>
      <div class="sd-status">Ошибок: ${errors}</div>`;
    const poolEl = box.querySelector(".sd-pool");
    pool.forEach((w) => {
      const b = document.createElement("button");
      b.className = "sd-chip";
      b.textContent = w;
      b.disabled = recovered.includes(w);
      b.onclick = () => pick(w, b);
      poolEl.appendChild(b);
    });
  }

  function pick(w, btn) {
    const correct = mnemonic[recovered.length];
    if (w === correct) {
      recovered.push(w);
      Sound.click();
      if (recovered.length === mnemonic.length) finish();
      else drawTest();
    } else {
      errors++;
      Sound.bad();
      btn.classList.add("wrong");
      const st = box.querySelector(".sd-status");
      if (st) st.textContent = `Ошибок: ${errors} · «${w}» — не слово №${recovered.length + 1}`;
      setTimeout(() => btn.classList.remove("wrong"), 350);
    }
  }

  function finish() {
    stage = "done";
    const ok = errors === 0;
    box.innerHTML = `
      <div class="result">
        <div>${ok ? "Бэкап восстановлен безупречно" : "Фраза собрана, но с ошибками"}</div>
        <div class="score">${ok ? "✓ 0 ошибок" : errors + " ошиб."}</div>
        <p>${ok
          ? "Идеально. Именно так проверяют бэкап до того, как заводить на кошелёк деньги."
          : "В реальности ошибки при восстановлении означают безвозвратную потерю доступа. Поэтому бэкап проверяют заранее и хранят аккуратно."}</p>
        <p class="muted">Запомни: сид-фраза = полный контроль над кошельком. Не фото, не облако, не чат поддержки — только офлайн и только ты.</p>
        <button class="primary sd-again">Сгенерировать заново</button>
      </div>`;
    box.querySelector(".sd-again").onclick = () => renderIntro();
    if (ok) Sound.fanfare();
    if (onFinishCb) onFinishCb({ ok, errors });
  }

  return {
    open(container, onFinish) {
      onFinishCb = onFinish;
      box = container;
      stage = "intro";
      renderIntro();
    },
    close() {},
  };
})();
