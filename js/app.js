// КРИПТОПОЛИС — приложение: прогресс, панель уроков, симуляторы,
// достижения, сертификат, звук.

(() => {
  const SAVE_KEY = "cryptopolis_v1";
  const PASS = 3;
  const XP_PER_CORRECT = 10;
  const XP_EXAM_CORRECT = 15;
  const XP_ACHIEVEMENT = 10;
  const XP_TRADE = 30;
  const XP_PHISH = 40;

  // бонусные районы (симуляторы) — в общем кольце после модулей
  const EXTRAS = [
    { id: "trade", short: "📈 Трейдинг", color: 0x51cf66, shape: "chart",
      needs: "blockchain", needsLabel: "модуль 1" },
    { id: "phish", short: "🕵 Кибер-полигон", color: 0xff8787, shape: "hook",
      needs: "wallets", needsLabel: "модуль 3" },
  ];

  const $ = (id) => document.getElementById(id);
  let progress = loadProgress();
  let current = null; // индекс модуля | 'exam' | 'trade' | 'phish' | 'ach'

  function loadProgress() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { /* нет сохранения */ }
    if (!p || !p.done) p = { done: {}, xp: 0, examPassed: false, seenIntro: false };
    if (!p.ach) p.ach = {};
    return p;
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* приватный режим */ }
  }

  // ---------- события и достижения ----------

  function emit(event, data) {
    const fresh = Achievements.check(event, data, progress);
    for (const a of fresh) {
      progress.ach[a.id] = true;
      progress.xp += XP_ACHIEVEMENT;
      Achievements.toast(a);
      Sound.achieve();
    }
    if (fresh.length) { save(); refreshHUD(); }
  }
  window.GameBus = { emit }; // хуки из демо (майнинг, подпись)

  // ---------- состояния ----------

  const isUnlocked = (i) => i === 0 || !!progress.done[MODULES[i - 1].id];
  const allDone = () => MODULES.every((m) => progress.done[m.id]);
  const extraUnlocked = (e) => !!progress.done[e.needs];
  const extraDone = (e) => (e.id === "trade" ? !!progress.simTrade : !!progress.simPhish);

  function states() {
    const mods = MODULES.map((m, i) => progress.done[m.id] ? "done" : isUnlocked(i) ? "open" : "locked");
    const ext = EXTRAS.map((e) => extraDone(e) ? "done" : extraUnlocked(e) ? "open" : "locked");
    return mods.concat(ext);
  }

  function rankFor(xp) {
    let r = RANKS[0].name;
    for (const rk of RANKS) if (xp >= rk.xp) r = rk.name;
    return r;
  }

  function refreshHUD() {
    const maxXp = RANKS[RANKS.length - 1].xp;
    $("xp-fill").style.width = Math.min(100, (progress.xp / maxXp) * 100) + "%";
    $("xp-label").textContent = progress.xp + " XP";
    $("rank").textContent = progress.examPassed ? "Сатоши ✓" : rankFor(progress.xp);
    World.setStates(states(), progress.examPassed ? "done" : allDone() ? "open" : "locked");
    renderBar();
  }

  function renderBar() {
    const bar = $("module-bar");
    bar.innerHTML = "";
    const mk = (text, disabled, cls, onclick, title) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.disabled = disabled;
      if (cls) b.classList.add(cls);
      if (title) b.title = title;
      b.onclick = () => { Sound.click(); onclick(); };
      bar.appendChild(b);
    };
    MODULES.forEach((m, i) =>
      mk((progress.done[m.id] ? "✓ " : "") + m.short, !isUnlocked(i),
        progress.done[m.id] ? "done" : null, () => openModule(i)));
    EXTRAS.forEach((e) =>
      mk((extraDone(e) ? "✓ " : "") + e.short, !extraUnlocked(e),
        extraDone(e) ? "done" : null, () => openSim(e.id),
        extraUnlocked(e) ? "" : `Откроется после: ${e.needsLabel}`));
    mk((progress.examPassed ? "✓ " : "★ ") + "Экзамен", !allDone(), "exam", openExam);
    const achCount = Object.keys(progress.ach).length;
    mk(`🏆 ${achCount}/${Achievements.list.length}`, false, null, openAchievements, "Достижения");
  }

  // ---------- панель: общие режимы ----------

  function panelMode({ title, lesson, demo, quizBtn, sim }) {
    $("panel-title").textContent = title;
    $("lesson").classList.toggle("hidden", !lesson);
    if (lesson) $("lesson").innerHTML = lesson;
    $("demo-wrap").classList.toggle("hidden", !demo);
    $("quiz").classList.add("hidden");
    $("quiz").innerHTML = "";
    $("sim").classList.toggle("hidden", !sim);
    if (!sim) $("sim").innerHTML = "";
    $("btn-quiz").classList.toggle("hidden", !quizBtn);
    if (quizBtn) $("btn-quiz").textContent = quizBtn;
    if (!demo) Demos.stop();
    $("panel").classList.remove("hidden");
    $("panel-body").scrollTop = 0;
  }

  function closePanel() {
    $("panel").classList.add("hidden");
    Demos.stop();
    Trade.close();
    current = null;
  }

  // ---------- модули, экзамен, достижения ----------

  function openModule(i) {
    if (!isUnlocked(i)) return;
    current = i;
    const m = MODULES[i];
    panelMode({
      title: m.title,
      lesson: m.sections.map((s) => `<h3>${s.h}</h3><p>${s.p}</p>`).join(""),
      demo: !!m.demo,
      quizBtn: progress.done[m.id] ? "Пройти проверку ещё раз →" : "Пройти проверку знаний →",
    });
    if (m.demo) {
      $("demo-title").textContent = m.demoTitle || "Демонстрация";
      requestAnimationFrame(() => Demos.start(m.demo));
    }
  }

  function openExam() {
    if (!allDone()) return;
    current = "exam";
    panelMode({
      title: EXAM.title,
      lesson: `
        <h3>Финальное испытание</h3>
        <p>10 случайных вопросов по всем модулям города. Зачёт — ${EXAM.passScore} и больше правильных.
        Сдашь — получишь звание <strong>Сатоши</strong> и именной сертификат.</p>
        <p>Как в блокчейне — ответ необратим.</p>`,
      quizBtn: "Начать экзамен →",
    });
  }

  function openAchievements() {
    current = "ach";
    const rows = Achievements.list.map((a) => {
      const got = progress.ach[a.id];
      return `<div class="ach-row ${got ? "got" : ""}">
        <span class="t-icon">${a.icon}</span>
        <div><div class="t-name">${a.name}</div><div class="t-desc">${a.desc}</div></div>
        <span class="ach-mark">${got ? "✓" : "·"}</span></div>`;
    }).join("");
    panelMode({
      title: `Достижения — ${Object.keys(progress.ach).length} из ${Achievements.list.length}`,
      lesson: `<div class="ach-list">${rows}</div>`,
    });
  }

  // ---------- симуляторы ----------

  function openSim(id) {
    const e = EXTRAS.find((x) => x.id === id);
    if (!extraUnlocked(e)) return;
    current = id;
    if (id === "trade") {
      panelMode({ title: "Торговый симулятор: два года рынка", sim: true });
      Trade.open($("sim"), (res) => {
        if (!progress.simTrade) { progress.simTrade = true; progress.xp += XP_TRADE; }
        emit("trade_done", res);
        save(); refreshHUD();
      });
    } else {
      panelMode({ title: "Кибер-полигон: распознай скам", sim: true });
      Phish.open($("sim"), (res) => {
        if (res.passed && !progress.simPhish) { progress.simPhish = true; progress.xp += XP_PHISH; }
        emit("phish_done", res);
        save(); refreshHUD();
      });
    }
  }

  // ---------- квиз ----------

  function startQuiz() {
    const isExam = current === "exam";
    const questions = isExam
      ? [...EXAM.questions].sort(() => Math.random() - 0.5).slice(0, 10)
      : MODULES[current].quiz;
    $("lesson").classList.add("hidden");
    $("demo-wrap").classList.add("hidden");
    Demos.stop();
    $("btn-quiz").classList.add("hidden");
    const quiz = $("quiz");
    quiz.classList.remove("hidden");

    let idx = 0, correct = 0;

    function renderQuestion() {
      const q = questions[idx];
      quiz.innerHTML = `
        <div class="q-num">Вопрос ${idx + 1} из ${questions.length}</div>
        <p class="q-text">${q.q}</p>
        <div class="options"></div>
        <div class="after"></div>`;
      const opts = quiz.querySelector(".options");
      q.o.forEach((opt, oi) => {
        const b = document.createElement("button");
        b.textContent = opt;
        b.onclick = () => answer(b, oi);
        opts.appendChild(b);
      });

      function answer(btnEl, oi) {
        opts.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        const ok = oi === q.a;
        if (ok) correct++;
        ok ? Sound.good() : Sound.bad();
        btnEl.classList.add(ok ? "correct" : "wrong");
        opts.children[q.a].classList.add("correct");
        const after = quiz.querySelector(".after");
        after.innerHTML = `<div class="why">${ok ? "✓ Верно. " : "✗ Неверно. "}${q.why}</div>`;
        const next = document.createElement("button");
        next.className = "primary";
        next.style.marginTop = "0.9rem";
        next.textContent = idx + 1 < questions.length ? "Дальше →" : "Результат →";
        next.onclick = () => { idx++; idx < questions.length ? renderQuestion() : finish(); };
        after.appendChild(next);
      }
    }

    function finish() {
      const total = questions.length;
      let html = `<div class="result"><div>Правильных ответов</div><div class="score">${correct} / ${total}</div>`;
      let showCert = false;
      if (isExam) {
        const passed = correct >= EXAM.passScore;
        if (passed && !progress.examPassed) {
          progress.examPassed = true;
          progress.xp += correct * XP_EXAM_CORRECT;
        }
        if (passed) {
          showCert = true;
          html += `<p>Экзамен сдан. Звание <strong style="color:var(--gold)">Сатоши</strong> — твоё.
            Главное правило выпускника: проверяй, а не доверяй — и не вкладывай то, что не готов потерять.</p>`;
        } else {
          html += `<p>Для зачёта нужно ${EXAM.passScore}+. Вернись в районы и пересдай — материал никуда не уходит.</p>`;
        }
      } else {
        const m = MODULES[current];
        const passed = correct >= PASS;
        if (passed && !progress.done[m.id]) {
          progress.done[m.id] = true;
          progress.xp += correct * XP_PER_CORRECT;
          html += `<p>Модуль зачтён! +${correct * XP_PER_CORRECT} XP. Открыт следующий район города.</p>`;
        } else if (passed) {
          html += `<p>Модуль уже был зачтён — повторение засчитано, XP не дублируется.</p>`;
        } else {
          html += `<p>Нужно ${PASS} из ${m.quiz.length}. Перечитай урок — материал никуда не уходит.</p>`;
        }
      }
      html += `</div>`;
      quiz.innerHTML = html;
      const box = quiz.querySelector(".result");
      if (showCert) {
        const cert = document.createElement("button");
        cert.className = "primary";
        cert.style.marginRight = "0.6rem";
        cert.textContent = "🎓 Скачать именной сертификат";
        cert.onclick = () => {
          const name = prompt("Имя на сертификате:", "") || "Аноним Накамото";
          Cert.download(name, progress.xp, Object.keys(progress.ach).length);
        };
        box.appendChild(cert);
        Sound.fanfare();
      } else if (correct >= (isExam ? EXAM.passScore : PASS)) {
        Sound.fanfare();
      }
      const back = document.createElement("button");
      back.className = "primary";
      back.textContent = "Вернуться в город";
      back.onclick = closePanel;
      box.appendChild(back);

      save();
      // события — после сохранения базового прогресса
      emit("quiz_result", { correct, total, exam: isExam });
      if (!isExam && correct >= PASS) emit("module_done", { id: MODULES[current].id });
      if (isExam && correct >= EXAM.passScore) emit("exam_passed", {});
      refreshHUD();
    }

    renderQuestion();
  }

  // ---------- запуск ----------

  document.addEventListener("DOMContentLoaded", () => {
    World.init($("scene"), MODULES.concat(EXTRAS), (idx) => {
      Sound.click();
      if (idx === "exam") openExam();
      else if (idx <= 7) openModule(idx);
      else openSim(EXTRAS[idx - MODULES.length].id);
    });

    $("panel-close").onclick = () => { Sound.click(); closePanel(); };
    $("btn-quiz").onclick = () => { Sound.click(); startQuiz(); };
    $("btn-start").onclick = () => {
      Sound.click();
      $("intro").classList.add("hidden");
      progress.seenIntro = true;
      save();
    };
    if (progress.seenIntro) $("intro").classList.add("hidden");

    const sb = $("btn-sound");
    const sLabel = () => { sb.textContent = Sound.isEnabled() ? "🔊" : "🔇"; };
    sb.onclick = () => { Sound.toggle(); sLabel(); };
    sLabel();
    Sound.armOnFirstGesture();

    refreshHUD();
  });
})();
