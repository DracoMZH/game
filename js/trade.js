// КРИПТОПОЛИС — торговый симулятор: два года рынка на виртуальные $1000.
// Цена генерируется со сменой режимов и новостными шоками — без предсказуемости.

const Trade = (() => {
  const DAYS = 730;
  const START_CASH = 1000;

  const NEWS_BAD = [
    ["Крупная биржа приостановила вывод средств", -0.28],
    ["Регулятор анонсировал жёсткие ограничения", -0.18],
    ["Взлом DeFi-протокола: украдено $600 млн", -0.15],
    ["Крах крупного стейблкоина тянет рынок вниз", -0.32],
    ["Известный фонд распродаёт позиции", -0.12],
  ];
  const NEWS_GOOD = [
    ["Крупный банк объявил о покупке биткоина", 0.2],
    ["Одобрен биржевой фонд на криптовалюту", 0.25],
    ["Платёжный гигант добавил крипто-оплату", 0.14],
    ["Халвинг прошёл — предложение сократилось", 0.12],
    ["Страна признала криптовалюту платёжным средством", 0.17],
  ];

  let S = null, ui = {}, raf = null, onFinishCb = null;

  function freshState() {
    return {
      day: 0, price: 100, cash: START_CASH, coins: 0,
      history: [100], speed: 0, regime: 0, // drift: -1 медведь, 0 боковик, 1 бык
      peak: 100, troughAfterPeak: 100, hadCrash: false, soldAllInCrash: false,
      news: [], done: false,
      hodlCoins: START_CASH / 100, // эталон «купил и держи»
    };
  }

  function step() {
    if (S.day >= DAYS) { finish(); return; }
    S.day++;
    // смена режима
    if (Math.random() < 0.012) S.regime = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const drift = S.regime * 0.0035;
    let change = drift + (Math.random() * 2 - 1) * 0.035;
    // новостной шок
    if (Math.random() < 0.018) {
      const pool = Math.random() < 0.5 ? NEWS_BAD : NEWS_GOOD;
      const [headline, impact] = pool[Math.floor(Math.random() * pool.length)];
      change += impact * (0.7 + Math.random() * 0.6);
      pushNews(`День ${S.day}: ${headline}`, impact < 0);
    }
    S.price = Math.max(1, S.price * (1 + change));
    S.history.push(S.price);

    // отслеживание обвала для «Алмазных рук»
    if (S.price > S.peak) { S.peak = S.price; S.troughAfterPeak = S.price; }
    if (S.price < S.troughAfterPeak) {
      S.troughAfterPeak = S.price;
      if (S.troughAfterPeak <= S.peak * 0.6) {
        if (!S.hadCrash) pushNews(`День ${S.day}: рынок просел на 40%+ от пика. Проверка нервов.`, true);
        S.hadCrash = true;
        if (S.coins <= 0.000001) S.soldAllInCrash = true;
      }
    }
  }

  function portfolio() { return S.cash + S.coins * S.price; }

  function buy(frac) {
    const spend = S.cash * frac;
    if (spend < 1) return;
    S.coins += (spend * 0.999) / S.price; // комиссия 0.1%
    S.cash -= spend;
    Sound.coin();
    refresh();
  }
  function sell(frac) {
    const amount = S.coins * frac;
    if (amount * S.price < 1) return;
    S.cash += amount * S.price * 0.999;
    S.coins -= amount;
    Sound.coin();
    refresh();
  }

  function pushNews(text, bad) {
    S.news.unshift({ text, bad });
    S.news = S.news.slice(0, 5);
    ui.news.innerHTML = S.news.map((n) =>
      `<div class="${n.bad ? "bad" : "ok"}">${n.text}</div>`).join("");
  }

  function drawChart() {
    const cv = ui.chart, g = cv.getContext("2d");
    const W = cv.width = cv.clientWidth * 2, H = cv.height = 360;
    g.fillStyle = "#060910"; g.fillRect(0, 0, W, H);
    const h = S.history;
    const min = Math.min(...h) * 0.95, max = Math.max(...h) * 1.05;
    const x = (i) => (i / Math.max(60, h.length - 1)) * (W - 20) + 10;
    const y = (p) => H - 14 - ((p - min) / (max - min)) * (H - 28);
    // сетка
    g.strokeStyle = "#131b30"; g.lineWidth = 1;
    for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(0, (H / 5) * i); g.lineTo(W, (H / 5) * i); g.stroke(); }
    // линия цены
    g.beginPath();
    h.forEach((p, i) => i ? g.lineTo(x(i), y(p)) : g.moveTo(x(0), y(p)));
    const up = h[h.length - 1] >= h[0];
    g.strokeStyle = up ? "#38d9a9" : "#ff6b6b";
    g.lineWidth = 2.5;
    g.stroke();
    // заливка
    g.lineTo(x(h.length - 1), H); g.lineTo(x(0), H); g.closePath();
    g.fillStyle = up ? "rgba(56,217,169,0.08)" : "rgba(255,107,107,0.08)";
    g.fill();
  }

  function refresh() {
    const val = portfolio();
    const hodl = S.hodlCoins * S.price;
    const pnl = val - START_CASH;
    ui.stats.innerHTML = `
      <span>День <b>${S.day}</b>/${DAYS}</span>
      <span>Цена <b>$${S.price.toFixed(2)}</b></span>
      <span>Кэш <b>$${S.cash.toFixed(0)}</b></span>
      <span>Монет <b>${S.coins.toFixed(3)}</b></span>
      <span>Портфель <b class="${pnl >= 0 ? "pos" : "neg"}">$${val.toFixed(0)} (${pnl >= 0 ? "+" : ""}${(pnl / START_CASH * 100).toFixed(1)}%)</b></span>
      <span>HODL-эталон <b>$${hodl.toFixed(0)}</b></span>`;
    drawChart();
  }

  function loop() {
    raf = requestAnimationFrame(loop);
    if (!S || S.done) return;
    for (let i = 0; i < S.speed; i++) { step(); if (S.done) return; }
    if (S.speed) refresh();
  }

  function finish() {
    if (S.done) return;
    S.done = true;
    S.speed = 0;
    const val = portfolio(), hodl = S.hodlCoins * S.price;
    const profit = val - START_CASH;
    const beatHodl = val > hodl;
    ui.box.querySelector(".trade-controls").innerHTML = "";
    ui.result.classList.remove("hidden");
    ui.result.innerHTML = `
      <h3>Итог двух лет</h3>
      <p>Портфель: <b class="${profit >= 0 ? "pos" : "neg"}">$${val.toFixed(0)}</b> из $${START_CASH} стартовых
         (${profit >= 0 ? "+" : ""}${(profit / START_CASH * 100).toFixed(1)}%).
         Стратегия «купил и держи» дала бы <b>$${hodl.toFixed(0)}</b> — ты её ${beatHodl ? "обогнал. Это редкость даже среди профессионалов" : "не обогнал — как и большинство активных трейдеров. Это нормальный, важный результат"}.</p>
      <p>${S.hadCrash ? (S.soldAllInCrash
          ? "В обвал 40%+ ты продал всё. Так делает большинство — и фиксирует дно."
          : "Ты пережил обвал 40%+, не распродав позицию полностью. Алмазные руки.")
        : "В этой симуляции крупного обвала не случилось — повезло. В реальности за два года он почти гарантирован."}</p>
      <p class="muted">Урок симулятора: волатильность — это не график, это твои решения на нём. Реальные деньги добавляют сюда страх, которого нет в игре.</p>`;
    Sound.fanfare();
    if (onFinishCb) onFinishCb({ profit, beatHodl, survivedCrash: S.hadCrash && !S.soldAllInCrash });
  }

  function setSpeed(s, btns) {
    S.speed = s;
    btns.forEach((b) => b.classList.remove("active"));
    btns[s === 0 ? 0 : s === 1 ? 1 : 2].classList.add("active");
  }

  return {
    open(container, onFinish) {
      onFinishCb = onFinish;
      S = freshState();
      container.innerHTML = `
        <div class="trade-box">
          <p class="muted">Виртуальные $${START_CASH}, два «года» рынка. Цена — случайный процесс с режимами
          и новостными шоками: предсказать её нельзя, можно только управлять риском. Комиссия сделки 0.1%.</p>
          <div class="trade-stats"></div>
          <canvas class="trade-chart"></canvas>
          <div class="trade-controls">
            <span class="grp">Время:
              <button data-sp="0">⏸</button><button data-sp="1">▶</button><button data-sp="6">▶▶</button>
            </span>
            <span class="grp">Купить:
              <button data-buy="0.25">25%</button><button data-buy="0.5">50%</button><button data-buy="1">всё</button>
            </span>
            <span class="grp">Продать:
              <button data-sell="0.25">25%</button><button data-sell="0.5">50%</button><button data-sell="1">всё</button>
            </span>
            <button class="finish">Завершить досрочно</button>
          </div>
          <div class="trade-news"></div>
          <div class="trade-result hidden"></div>
        </div>`;
      ui = {
        box: container.querySelector(".trade-box"),
        stats: container.querySelector(".trade-stats"),
        chart: container.querySelector(".trade-chart"),
        news: container.querySelector(".trade-news"),
        result: container.querySelector(".trade-result"),
      };
      const spBtns = [...container.querySelectorAll("[data-sp]")];
      spBtns.forEach((b) => { b.onclick = () => setSpeed(parseInt(b.dataset.sp, 10), spBtns); });
      container.querySelectorAll("[data-buy]").forEach((b) => { b.onclick = () => buy(parseFloat(b.dataset.buy)); });
      container.querySelectorAll("[data-sell]").forEach((b) => { b.onclick = () => sell(parseFloat(b.dataset.sell)); });
      container.querySelector(".finish").onclick = finish;
      setSpeed(1, spBtns);
      refresh();
      if (!raf) loop();
    },
    close() {
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      S = null;
    },
  };
})();
