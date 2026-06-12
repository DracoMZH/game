// КРИПТОПОЛИС — тренажёр фишинга: отличи настоящее от скама.
// 10 сценариев по мотивам реальных схем.

const PHISH_CASES = [
  {
    kind: "Письмо", from: "security@binance-secure-login.com",
    subject: "Срочно: подозрительный вход в ваш аккаунт",
    body: "Мы заблокировали вход с нового устройства. Подтвердите личность в течение 24 часов, иначе аккаунт будет удалён: <u>binance-secure-login.com/verify</u>",
    scam: true,
    why: "Домен <code>binance-secure-login.com</code> — не <code>binance.com</code>. Давление срочностью («24 часа», «будет удалён») — классический приём. Настоящая биржа не удаляет аккаунт за сутки.",
  },
  {
    kind: "Чат", from: "Поддержка MetaMask 🦊 (Telegram)",
    subject: "Ответ на вашу жалобу",
    body: "Здравствуйте! Для восстановления доступа к кошельку отправьте вашу сид-фразу из 12 слов — мы синхронизируем её с блокчейном.",
    scam: true,
    why: "Сид-фразу не просит никто и никогда. У MetaMask нет поддержки в Telegram, и «синхронизировать фразу с блокчейном» — бессмыслица.",
  },
  {
    kind: "Письмо", from: "no-reply@binance.com",
    subject: "Выполнен вход с нового устройства",
    body: "В ваш аккаунт выполнен вход: Chrome, Windows, IP 203.0.113.7. Если это были не вы — смените пароль в настройках безопасности на сайте или в приложении. Ссылок в письме нет намеренно.",
    scam: false,
    why: "Легитимное уведомление: корректный домен, нет ссылок «введите данные здесь», совет идти в настройки самостоятельно. Так и выглядят настоящие алерты.",
  },
  {
    kind: "Сайт", from: "vitalik-giveaway.org",
    subject: "ETH GIVEAWAY: отправь 0.5 ETH — получи 1 ETH обратно!",
    body: "Виталик Бутерин раздаёт 10 000 ETH в честь юбилея сети! Акция ограничена: первые 500 участников. Отправляй на адрес 0x4f3a… и получи удвоение!",
    scam: true,
    why: "«Отправь монету — получишь две» — старейший криптоскам. Никто не раздаёт деньги за перевод им денег. Подпись «Виталика» не значит ничего.",
  },
  {
    kind: "Сайт", from: "app.uniswap.org-claim.net",
    subject: "Вам начислен airdrop 3 200 UNI ($19 000)",
    body: "Подключите кошелёк и подпишите транзакцию, чтобы забрать токены. Окно закроется через 09:59.",
    scam: true,
    why: "Реальный домен — <code>org-claim.net</code>, а «app.uniswap» — поддомен-приманка. Подпись транзакции на таком сайте обычно даёт контракту доступ к вашим токенам. Плюс таймер-давление.",
  },
  {
    kind: "Сайт", from: "ledger.com",
    subject: "Доступно обновление прошивки Ledger Nano",
    body: "Обновите прошивку через приложение Ledger Live. Устройство само проверит подпись производителя перед установкой. Сид-фраза для обновления не нужна.",
    scam: false,
    why: "Официальный домен, обновление через фирменное приложение, явное «сид-фраза не нужна», проверка подписи прошивки. Всё корректно.",
  },
  {
    kind: "Чат", from: "Анна, личный брокер (WhatsApp)",
    subject: "Инвестиционное предложение",
    body: "Привет! Помню тебя с конференции 😊 Мой фонд делает 2% в день на арбитраже, гарантированно и без риска. Минимальный вход $500, вывод в любой момент. Заводить?",
    scam: true,
    why: "«Гарантированно», «без риска», «2% в день» (≈137 000% годовых) — арифметика пирамиды. Знакомство, которого ты не помнишь, — социальная инженерия.",
  },
  {
    kind: "Кошелёк", from: "запрос подписи от swap-bonus.io",
    subject: "Approve: USDT — UNLIMITED",
    body: "Сайт запрашивает разрешение тратить ваши USDT без ограничения суммы (unlimited approve). Сайт открыт по ссылке из рекламы в соцсети.",
    scam: true,
    why: "Безлимитный approve незнакомому контракту с рекламной ссылки — стандартная схема опустошения кошелька. Разрешения дают точной суммой и только проверенным протоколам.",
  },
  {
    kind: "Письмо", from: "noreply@github.com",
    subject: "Новый релиз кошелька, который вы отслеживаете",
    body: "Вышла версия 2.4.1 опенсорсного кошелька. Изменения: исправлена ошибка отображения комиссии. Скачать можно со страницы релизов репозитория, контрольные суммы приложены.",
    scam: false,
    why: "Уведомление с настоящего домена, без срочности и запроса данных, с контрольными суммами для проверки скачанного. Здоровая практика.",
  },
  {
    kind: "Сайт", from: "pancakeswap.finance (висит баннер)",
    subject: "⚠ Ваш кошелёк помечен как уязвимый",
    body: "Обнаружена уязвимость! Срочно перенесите средства: введите сид-фразу в форму «миграции», и мы автоматически переведём активы на безопасный адрес.",
    scam: true,
    why: "Каким бы ни был сайт, форма «введите сид-фразу» = кража. Даже настоящие сайты взламывают и вешают такие баннеры — фраза не вводится нигде, кроме самого кошелька.",
  },
];

const Phish = (() => {
  let idx = 0, correct = 0, onFinishCb = null, box = null;

  function renderCase() {
    const c = PHISH_CASES[idx];
    box.innerHTML = `
      <div class="phish-progress">Сценарий ${idx + 1} из ${PHISH_CASES.length} · распознано: ${correct}</div>
      <div class="phish-card">
        <div class="phish-meta"><span class="phish-kind">${c.kind}</span><span class="phish-from">${c.from}</span></div>
        <div class="phish-subject">${c.subject}</div>
        <div class="phish-body">${c.body}</div>
      </div>
      <div class="phish-actions">
        <button class="trust">✓ Можно доверять</button>
        <button class="scam">⚠ Это скам</button>
      </div>
      <div class="phish-verdict"></div>`;
    box.querySelector(".trust").onclick = () => answer(false);
    box.querySelector(".scam").onclick = () => answer(true);
  }

  function answer(saidScam) {
    const c = PHISH_CASES[idx];
    const ok = saidScam === c.scam;
    if (ok) correct++;
    ok ? Sound.good() : Sound.bad();
    box.querySelectorAll(".phish-actions button").forEach((b) => b.disabled = true);
    const v = box.querySelector(".phish-verdict");
    v.innerHTML = `
      <div class="${ok ? "v-ok" : "v-bad"}">${ok ? "✓ Верно" : "✗ Мимо"}: это ${c.scam ? "СКАМ" : "легитимное сообщение"}.</div>
      <div class="why">${c.why}</div>`;
    const next = document.createElement("button");
    next.className = "primary";
    next.textContent = idx + 1 < PHISH_CASES.length ? "Следующий сценарий →" : "Результат →";
    next.onclick = () => { idx++; idx < PHISH_CASES.length ? renderCase() : finish(); };
    v.appendChild(next);
  }

  function finish() {
    const total = PHISH_CASES.length;
    const passed = correct >= 8;
    box.innerHTML = `
      <div class="result">
        <div>Распознано верно</div><div class="score">${correct} / ${total}</div>
        <p>${correct === total
          ? "Идеально. Тебя не возьмёт ни поддельный домен, ни «личный брокер»."
          : passed
            ? "Хороший результат. Перечитай разборы промахов — в жизни пересдачи может не быть."
            : "Меньше 8 — в реальности это потерянный кошелёк. Пройди ещё раз: сценарии того стоят."}</p>
        <p class="muted">Главные маркеры: чужой домен, просьба сид-фразы, гарантированная доходность, срочность, unlimited approve.</p>
      </div>`;
    if (passed) Sound.fanfare();
    if (onFinishCb) onFinishCb({ correct, total, passed });
  }

  return {
    open(container, onFinish) {
      onFinishCb = onFinish;
      idx = 0; correct = 0;
      box = container;
      renderCase();
    },
  };
})();
