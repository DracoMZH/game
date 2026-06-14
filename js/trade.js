// КРИПТОПОЛИС — торговый терминал.
// Несколько активов, японские свечи, ручное управление временем,
// ордер-тикет с вводом суммы, средняя цена входа и P&L по позициям.
// Учебная симуляция: цены — случайный процесс, не отражают реальные активы.

const Trade = (() => {
  const START_CASH = 10000;
  const DAYS = 90;
  const FEE = 0.001;       // комиссия 0.1%
  const VISIBLE = 60;      // сколько свечей показывать
  const AUTO_MS = 850;

  const ASSET_DEFS = [
    { sym: "BTC",  name: "Биткоин",     price: 42000, vol: 0.028, drift: 0.0006, color: "#f7931a" },
    { sym: "ETH",  name: "Эфир",        price: 2300,  vol: 0.038, drift: 0.0007, color: "#7b8cff" },
    { sym: "SOL",  name: "Альткоин",    price: 95,    vol: 0.055, drift: 0.0008, color: "#38d9a9" },
    { sym: "MEME", name: "Мемкоин",     price: 0.080, vol: 0.120, drift: 0.0,    color: "#ff6b6b" },
    { sym: "USDX", name: "Стейблкоин",  price: 1.00,  vol: 0.004, drift: 0.0,    color: "#9aa6c8", peg: 1 },
  ];

  const NEWS = [
    { t: "ALL",  txt: "Центробанк смягчил политику — аппетит к риску растёт", imp: +0.05 },
    { t: "ALL",  txt: "Регулятор грозит ужесточением — началась распродажа",  imp: -0.07 },
    { t: "ALL",  txt: "Взлом крупной биржи: на рынке паника",                 imp: -0.09 },
    { t: "BTC",  txt: "Крупный фонд добавил BTC в резервы",                   imp: +0.08 },
    { t: "BTC",  txt: "Страна признала BTC платёжным средством",             imp: +0.06 },
    { t: "ETH",  txt: "Обновление сети Эфира прошло успешно",                 imp: +0.06 },
    { t: "ETH",  txt: "Перегрузка сети: комиссии взлетели",                   imp: -0.05 },
    { t: "SOL",  txt: "Запуск популярного приложения на альткоине",          imp: +0.09 },
    { t: "SOL",  txt: "Сбой сети альткоина на 6 часов",                      imp: -0.11 },
    { t: "MEME", txt: "Инфлюэнсер запампил мемкоин 🚀",                       imp: +0.26 },
    { t: "MEME", txt: "Создатели мемкоина вывели ликвидность (rug pull)",     imp: -0.38 },
    { t: "USDX", txt: "Стейблкоин потерял привязку к доллару!",               imp: -0.09 },
  ];

  let S = null, ui = {}, sel = 0, side = "buy", onFinishCb = null, autoTimer = null;

  // ---------- математика рынка ----------

  function randn() {
    const u = Math.random() || 1e-9, v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function freshState() {
    const assets = ASSET_DEFS.map((d) => ({
      ...d, startPrice: d.price, regime: 0, shock: 0,
      candles: [{ o: d.price, h: d.price, l: d.price, c: d.price }],
      qty: 0, avgCost: 0,
    }));
    return {
      day: 0, cash: START_CASH, assets, news: [], log: [],
      realized: 0, trades: 0,
      idxPeak: 1, idxTrough: 1, hadCrash: false, heldThroughCrash: false,
      done: false,
    };
  }

  function nextCandle(a) {
    const open = a.price;
    let mu = a.drift * a.regime + a.shock;
    if (a.peg) mu += ((a.peg - open) / open) * 0.4; // притяжение к привязке
    a.shock = 0;
    let p = open, hi = open, lo = open;
    const ticks = 5;
    for (let i = 0; i < ticks; i++) {
      p = Math.max(1e-6, p * (1 + mu / ticks + randn() * a.vol / Math.sqrt(ticks)));
      if (p > hi) hi = p;
      if (p < lo) lo = p;
    }
    a.price = p;
    a.candles.push({ o: open, h: hi, l: lo, c: p });
  }

  function advanceDay() {
    if (S.done) return;
    S.day++;
    // смена режимов
    for (const a of S.assets) {
      if (a.peg) continue;
      if (Math.random() < 0.07) a.regime = [-1, 0, 1][Math.floor(Math.random() * 3)];
    }
    // новость
    if (Math.random() < 0.16) {
      const n = NEWS[Math.floor(Math.random() * NEWS.length)];
      const k = 0.7 + Math.random() * 0.6;
      if (n.t === "ALL") {
        for (const a of S.assets) a.shock += n.imp * k * (a.peg ? 0.2 : 1);
      } else {
        const a = S.assets.find((x) => x.sym === n.t);
        if (a) a.shock += n.imp * k;
      }
      pushNews(`Д${S.day}: ${n.txt}`, n.imp < 0);
    }
    for (const a of S.assets) nextCandle(a);

    // индекс рынка (без стейблкоина) для детекции обвала
    const risk = S.assets.filter((a) => !a.peg);
    const idx = risk.reduce((s, a) => s + a.price / a.startPrice, 0) / risk.length;
    if (idx > S.idxPeak) { S.idxPeak = idx; S.idxTrough = idx; }
    if (idx < S.idxTrough) {
      S.idxTrough = idx;
      if (idx <= S.idxPeak * 0.6 && !S.hadCrash) {
        S.hadCrash = true;
        if (holdingsValue() > 1) S.heldThroughCrash = true;
        pushNews(`Д${S.day}: рынок рухнул на 40%+ от пика. Проверка нервов.`, true);
      }
    }

    if (S.day >= DAYS) finish();
    else renderAll();
  }

  // ---------- сделки ----------

  function holdingsValue() {
    return S.assets.reduce((s, a) => s + a.qty * a.price, 0);
  }
  function portfolio() { return S.cash + holdingsValue(); }

  function execute(usd) {
    const a = S.assets[sel];
    msg("");
    if (!(usd > 0)) return msg("Введи сумму больше нуля.", true);
    if (side === "buy") {
      if (usd > S.cash + 1e-6) return msg("Недостаточно кэша.", true);
      const fee = usd * FEE;
      const units = (usd - fee) / a.price;
      a.avgCost = (a.avgCost * a.qty + (usd - fee)) / (a.qty + units);
      a.qty += units;
      S.cash -= usd;
      S.trades++;
      addLog(`Куплено ${fmtUnit(units)} ${a.sym} на $${fmtUsd(usd)}`);
    } else {
      const maxUsd = a.qty * a.price;
      if (a.qty <= 0) return msg(`Нет позиции по ${a.sym}.`, true);
      const realUsd = Math.min(usd, maxUsd);
      const units = realUsd / a.price;
      const fee = realUsd * FEE;
      S.cash += realUsd - fee;
      S.realized += (a.price - a.avgCost) * units;
      a.qty -= units;
      if (a.qty < 1e-9) { a.qty = 0; a.avgCost = 0; }
      S.trades++;
      addLog(`Продано ${fmtUnit(units)} ${a.sym} на $${fmtUsd(realUsd)}`);
    }
    Sound.coin();
    renderAll();
  }

  function addLog(text) { S.log.unshift(`Д${S.day}: ${text}`); S.log = S.log.slice(0, 30); }
  function pushNews(text, bad) { S.news.unshift({ text, bad }); S.news = S.news.slice(0, 6); }

  // ---------- форматирование ----------

  function fmtPrice(p) {
    if (p >= 1000) return p.toLocaleString("ru", { maximumFractionDigits: 0 });
    if (p >= 1) return p.toFixed(2);
    if (p >= 0.01) return p.toFixed(4);
    return p.toFixed(6);
  }
  function fmtUsd(v) {
    return Math.abs(v) >= 1000 ? v.toLocaleString("ru", { maximumFractionDigits: 0 }) : v.toFixed(2);
  }
  function fmtUnit(u) {
    if (u >= 1000) return u.toLocaleString("ru", { maximumFractionDigits: 0 });
    if (u >= 1) return u.toFixed(3);
    return u.toPrecision(3);
  }

  // ---------- отрисовка свечей ----------

  function drawChart() {
    const a = S.assets[sel];
    const cv = ui.chart;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = Math.max(300, cv.clientWidth) * dpr;
    const H = cv.height = 320 * dpr;
    const g = cv.getContext("2d");
    g.clearRect(0, 0, W, H);
    g.fillStyle = "#060910"; g.fillRect(0, 0, W, H);

    const all = a.candles;
    const data = all.slice(Math.max(0, all.length - VISIBLE));
    const padR = 70 * dpr, padT = 14 * dpr, padB = 16 * dpr;
    let hi = -Infinity, lo = Infinity;
    for (const c of data) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
    const range = (hi - lo) || hi * 0.01 || 1;
    hi += range * 0.08; lo -= range * 0.08;
    const plotW = W - padR, plotH = H - padT - padB;
    const y = (p) => padT + (1 - (p - lo) / (hi - lo)) * plotH;
    const n = data.length;
    const step = plotW / Math.max(VISIBLE, n);
    const bw = Math.max(2 * dpr, step * 0.62);

    // сетка + ценовые метки справа
    g.strokeStyle = "#131b30"; g.lineWidth = 1 * dpr;
    g.fillStyle = "#5a6885"; g.font = `${11 * dpr}px Consolas, monospace`; g.textAlign = "left";
    for (let i = 0; i <= 4; i++) {
      const yy = padT + (plotH / 4) * i;
      g.beginPath(); g.moveTo(0, yy); g.lineTo(plotW, yy); g.stroke();
      g.fillText("$" + fmtPrice(hi - ((hi - lo) / 4) * i), plotW + 6 * dpr, yy + 4 * dpr);
    }

    // скользящая средняя (SMA-7)
    const sma = [];
    for (let i = 0; i < n; i++) {
      if (i < 6) { sma.push(null); continue; }
      let s = 0; for (let j = i - 6; j <= i; j++) s += data[j].c;
      sma.push(s / 7);
    }
    g.strokeStyle = "rgba(245,197,66,0.55)"; g.lineWidth = 1.5 * dpr;
    g.beginPath(); let started = false;
    for (let i = 0; i < n; i++) {
      if (sma[i] == null) continue;
      const xx = i * step + step / 2;
      started ? g.lineTo(xx, y(sma[i])) : (g.moveTo(xx, y(sma[i])), started = true);
    }
    g.stroke();

    // свечи
    for (let i = 0; i < n; i++) {
      const c = data[i];
      const cx = i * step + step / 2;
      const up = c.c >= c.o;
      g.strokeStyle = g.fillStyle = up ? "#38d9a9" : "#ff6b6b";
      g.lineWidth = Math.max(1, dpr);
      g.beginPath(); g.moveTo(cx, y(c.h)); g.lineTo(cx, y(c.l)); g.stroke();
      const yo = y(c.o), yc = y(c.c);
      const top = Math.min(yo, yc), bh = Math.max(2 * dpr, Math.abs(yc - yo));
      g.fillRect(cx - bw / 2, top, bw, bh);
    }

    // линия последней цены
    g.strokeStyle = "rgba(215,225,243,0.35)"; g.setLineDash([4 * dpr, 4 * dpr]); g.lineWidth = 1 * dpr;
    g.beginPath(); g.moveTo(0, y(a.price)); g.lineTo(plotW, y(a.price)); g.stroke();
    g.setLineDash([]);
  }

  // ---------- рендер интерфейса ----------

  function dayChange(a) {
    const c = a.candles;
    if (c.length < 2) return 0;
    const prev = c[c.length - 2].c;
    return (a.price - prev) / prev * 100;
  }

  function renderAssets() {
    ui.assets.innerHTML = S.assets.map((a, i) => {
      const ch = dayChange(a);
      return `<button class="ts-tab ${i === sel ? "active" : ""}" data-i="${i}">
        <span class="ta-sym" style="color:${a.color}">${a.sym}</span>
        <span class="ta-price">$${fmtPrice(a.price)}</span>
        <span class="ta-ch ${ch >= 0 ? "pos" : "neg"}">${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%</span>
      </button>`;
    }).join("");
    ui.assets.querySelectorAll(".ts-tab").forEach((b) => {
      b.onclick = () => { sel = +b.dataset.i; side = "buy"; renderAll(); };
    });
  }

  function renderTicket() {
    const a = S.assets[sel];
    const pos = a.qty > 0
      ? `Позиция: <b>${fmtUnit(a.qty)} ${a.sym}</b> · средн. вход $${fmtPrice(a.avgCost)}`
      : `Позиции по ${a.sym} нет`;
    ui.ticket.innerHTML = `
      <div class="tk-side">
        <button class="tk-buy ${side === "buy" ? "active" : ""}">Купить</button>
        <button class="tk-sell ${side === "sell" ? "active" : ""}">Продать</button>
      </div>
      <div class="tk-head"><b style="color:${a.color}">${a.name} (${a.sym})</b> @ $${fmtPrice(a.price)}</div>
      <div class="tk-pos">${pos}</div>
      <label class="tk-amtl">Сумма, $ <input type="number" class="tk-amt" min="0" step="1" placeholder="0"></label>
      <div class="tk-quick">
        <button data-q="0.25">25%</button><button data-q="0.5">50%</button>
        <button data-q="0.75">75%</button><button data-q="1">100%</button>
      </div>
      <div class="tk-preview"></div>
      <button class="tk-exec ${side}">${side === "buy" ? "Купить" : "Продать"} ${a.sym}</button>
      <div class="tk-msg"></div>`;

    const amt = ui.ticket.querySelector(".tk-amt");
    const preview = ui.ticket.querySelector(".tk-preview");
    const updatePreview = () => {
      const v = parseFloat(amt.value);
      if (!(v > 0)) { preview.textContent = ""; return; }
      const fee = v * FEE;
      const units = (v - fee) / a.price;
      preview.innerHTML = `≈ <b>${fmtUnit(units)} ${a.sym}</b> · комиссия $${fmtUsd(fee)}`;
    };
    amt.oninput = updatePreview;
    ui.ticket.querySelector(".tk-buy").onclick = () => { side = "buy"; renderTicket(); };
    ui.ticket.querySelector(".tk-sell").onclick = () => { side = "sell"; renderTicket(); };
    ui.ticket.querySelectorAll(".tk-quick button").forEach((b) => {
      b.onclick = () => {
        const frac = parseFloat(b.dataset.q);
        const base = side === "buy" ? S.cash : a.qty * a.price;
        amt.value = (base * frac).toFixed(2);
        updatePreview();
      };
    });
    ui.ticket.querySelector(".tk-exec").onclick = () => {
      execute(parseFloat(amt.value));
    };
  }

  function msg(text, bad) {
    const el = ui.ticket && ui.ticket.querySelector(".tk-msg");
    if (el) { el.textContent = text; el.className = "tk-msg" + (bad ? " bad" : ""); }
  }

  function renderPortfolio() {
    const val = portfolio();
    const pnl = val - START_CASH;
    const hold = holdingsValue();
    ui.port.innerHTML = `
      <div class="pf-row"><span>Капитал</span><b class="${pnl >= 0 ? "pos" : "neg"}">$${fmtUsd(val)}</b></div>
      <div class="pf-row"><span>Кэш</span><b>$${fmtUsd(S.cash)}</b></div>
      <div class="pf-row"><span>В активах</span><b>$${fmtUsd(hold)}</b></div>
      <div class="pf-row"><span>P&L</span><b class="${pnl >= 0 ? "pos" : "neg"}">${pnl >= 0 ? "+" : ""}$${fmtUsd(pnl)} (${(pnl / START_CASH * 100).toFixed(1)}%)</b></div>
      <div class="pf-row sub"><span>Реализовано</span><b class="${S.realized >= 0 ? "pos" : "neg"}">${S.realized >= 0 ? "+" : ""}$${fmtUsd(S.realized)}</b></div>`;
  }

  function renderHoldings() {
    const rows = S.assets.filter((a) => a.qty > 0).map((a) => {
      const value = a.qty * a.price;
      const cost = a.avgCost * a.qty;
      const pnl = value - cost;
      const pct = cost > 0 ? pnl / cost * 100 : 0;
      return `<tr>
        <td style="color:${a.color}">${a.sym}</td>
        <td>${fmtUnit(a.qty)}</td>
        <td>$${fmtPrice(a.avgCost)}</td>
        <td>$${fmtPrice(a.price)}</td>
        <td>$${fmtUsd(value)}</td>
        <td class="${pnl >= 0 ? "pos" : "neg"}">${pnl >= 0 ? "+" : ""}${pct.toFixed(1)}%</td>
      </tr>`;
    }).join("");
    ui.holdings.innerHTML = rows
      ? `<table class="hold-table"><thead><tr><th>Актив</th><th>Кол-во</th><th>Вход</th><th>Цена</th><th>Стоим.</th><th>P&L</th></tr></thead><tbody>${rows}</tbody></table>`
      : `<div class="muted">Открытых позиций нет. Выбери актив и купи на вкладке выше.</div>`;
  }

  function renderFeed() {
    ui.news.innerHTML = S.news.length
      ? S.news.map((n) => `<div class="${n.bad ? "bad" : "ok"}">${n.text}</div>`).join("")
      : `<div class="muted">Лента новостей пуста. Жми «Следующий день».</div>`;
    ui.log.innerHTML = S.log.length
      ? S.log.map((l) => `<div>${l}</div>`).join("")
      : `<div class="muted">Сделок ещё не было.</div>`;
  }

  function renderClock() {
    ui.clock.innerHTML = `День <b>${S.day}</b> / ${DAYS}`;
  }

  function renderAll() {
    renderClock();
    renderAssets();
    renderTicket();
    renderPortfolio();
    renderHoldings();
    renderFeed();
    drawChart();
  }

  // ---------- авто-режим и финал ----------

  function toggleAuto() {
    if (autoTimer) { stopAuto(); return; }
    ui.auto.classList.add("active");
    ui.auto.textContent = "⏸ Пауза";
    const tick = () => {
      if (S.done) { stopAuto(); return; }
      advanceDay();
      autoTimer = setTimeout(tick, AUTO_MS);
    };
    autoTimer = setTimeout(tick, AUTO_MS);
  }
  function stopAuto() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (ui.auto) { ui.auto.classList.remove("active"); ui.auto.textContent = "▶ Авто"; }
  }

  function finish() {
    if (S.done) return;
    S.done = true;
    stopAuto();
    // принудительно ликвидируем для честного итога не нужно — считаем по рынку
    const val = portfolio();
    const profit = val - START_CASH;
    const hodl = START_CASH * (S.assets[0].price / S.assets[0].startPrice); // эталон: всё в BTC
    const beatHodl = val > hodl;
    ui.result.classList.remove("hidden");
    ui.result.innerHTML = `
      <h3>Сессия закрыта · ${DAYS} торговых дней</h3>
      <p>Итоговый капитал: <b class="${profit >= 0 ? "pos" : "neg"}">$${fmtUsd(val)}</b>
         из $${fmtUsd(START_CASH)} стартовых
         (${profit >= 0 ? "+" : ""}${(profit / START_CASH * 100).toFixed(1)}%).
         Сделок совершено: <b>${S.trades}</b>.</p>
      <p>Пассивная стратегия «всё в Биткоин и держать» дала бы <b>$${fmtUsd(hodl)}</b> —
         ты её ${beatHodl ? "обогнал. Это удаётся меньшинству активных трейдеров" : "не обогнал, как и большинство тех, кто торгует активно. Это честный и поучительный результат"}.</p>
      <p>${S.hadCrash
          ? (S.heldThroughCrash
              ? "Ты держал позиции в обвал рынка на 40%+ — алмазные руки."
              : "В обвал 40%+ ты был вне рынка. Иногда это спасает, иногда — упускает отскок.")
          : "Крупного обвала в этой сессии не случилось — за длинный горизонт он почти неизбежен."}</p>
      <p class="muted">Главный урок: на дистанции рынок переигрывает почти всех, кто пытается его переиграть.
         Комиссии и эмоции работают против частого трейдинга. Здесь нет настоящих денег — но именно так теряют настоящие.</p>
      <button class="ts-restart">Сыграть заново</button>`;
    ui.result.querySelector(".ts-restart").onclick = () => Trade.open(ui.root, onFinishCb);
    Sound.fanfare();
    if (onFinishCb) onFinishCb({ profit, beatHodl, survivedCrash: S.hadCrash && S.heldThroughCrash });
  }

  // ---------- публичный API ----------

  return {
    open(container, onFinish) {
      onFinishCb = onFinish;
      stopAuto();
      S = freshState();
      sel = 0; side = "buy";
      container.innerHTML = `
        <div class="ts">
          <p class="muted ts-intro">Виртуальные $${fmtUsd(START_CASH)}. Пять активов с разным характером:
            от спокойного стейблкоина до бешеного мемкоина. <b>Время не идёт само</b> — ты сам жмёшь
            «Следующий день», между ходами размещаешь ордера. Комиссия ${(FEE * 100).toFixed(1)}% за сделку.</p>
          <div class="ts-assets"></div>
          <div class="ts-grid">
            <div class="ts-left">
              <div class="ts-clockbar">
                <span class="ts-clock"></span>
                <span class="ts-clockbtns">
                  <button class="ts-next">Следующий день ▶</button>
                  <button class="ts-auto">▶ Авто</button>
                  <button class="ts-end">Закрыть сессию</button>
                </span>
              </div>
              <canvas class="ts-chart"></canvas>
              <div class="ts-feedwrap">
                <div class="ts-news"></div>
                <div class="ts-log"></div>
              </div>
            </div>
            <div class="ts-right">
              <div class="ts-ticket"></div>
              <div class="ts-port"></div>
              <div class="ts-holdings"></div>
            </div>
          </div>
          <div class="ts-result hidden"></div>
        </div>`;
      ui = {
        root: container,
        assets: container.querySelector(".ts-assets"),
        clock: container.querySelector(".ts-clock"),
        auto: container.querySelector(".ts-auto"),
        chart: container.querySelector(".ts-chart"),
        ticket: container.querySelector(".ts-ticket"),
        port: container.querySelector(".ts-port"),
        holdings: container.querySelector(".ts-holdings"),
        news: container.querySelector(".ts-news"),
        log: container.querySelector(".ts-log"),
        result: container.querySelector(".ts-result"),
      };
      container.querySelector(".ts-next").onclick = () => { stopAuto(); advanceDay(); };
      container.querySelector(".ts-auto").onclick = toggleAuto;
      container.querySelector(".ts-end").onclick = finish;
      // первый рендер — после того как канвас получил ширину
      renderAll();
      requestAnimationFrame(drawChart);
    },
    close() { stopAuto(); S = null; },
  };
})();
