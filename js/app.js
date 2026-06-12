// КРИПТОПОЛИС — приложение: прогресс, панель уроков, проверки знаний, экзамен.

(() => {
  const SAVE_KEY = "cryptopolis_v1";
  const PASS = 3;            // порог зачёта модуля (из 4)
  const XP_PER_CORRECT = 10;
  const XP_EXAM_CORRECT = 15;

  const $ = (id) => document.getElementById(id);

  let progress = loadProgress();
  let current = null;        // индекс открытого модуля или 'exam'

  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (p && p.done) return p;
    } catch (e) { /* нет сохранения */ }
    return { done: {}, xp: 0, examPassed: false, seenIntro: false };
  }
  function saveProgress() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); } catch (e) { /* приватный режим */ }
  }

  // ---------- состояние модулей ----------

  const isUnlocked = (i) => i === 0 || !!progress.done[MODULES[i - 1].id];
  const allDone = () => MODULES.every((m) => progress.done[m.id]);
  const states = () => MODULES.map((m, i) =>
    progress.done[m.id] ? "done" : isUnlocked(i) ? "open" : "locked");

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
    MODULES.forEach((m, i) => {
      const b = document.createElement("button");
      b.textContent = (progress.done[m.id] ? "✓ " : "") + m.short;
      b.disabled = !isUnlocked(i);
      if (progress.done[m.id]) b.classList.add("done");
      b.onclick = () => openModule(i);
      bar.appendChild(b);
    });
    const ex = document.createElement("button");
    ex.textContent = (progress.examPassed ? "✓ " : "★ ") + "Экзамен";
    ex.classList.add("exam");
    ex.disabled = !allDone();
    ex.onclick = () => openExam();
    bar.appendChild(ex);
  }

  // ---------- панель урока ----------

  function openModule(i) {
    if (!isUnlocked(i)) return;
    current = i;
    const m = MODULES[i];
    $("panel-title").textContent = m.title;
    $("lesson").innerHTML = m.sections.map((s) => `<h3>${s.h}</h3><p>${s.p}</p>`).join("");
    $("lesson").classList.remove("hidden");
    $("quiz").classList.add("hidden");
    $("quiz").innerHTML = "";
    $("btn-quiz").textContent = progress.done[m.id]
      ? "Пройти проверку ещё раз →" : "Пройти проверку знаний →";
    $("btn-quiz").classList.remove("hidden");

    if (m.demo) {
      $("demo-wrap").classList.remove("hidden");
      $("demo-title").textContent = m.demoTitle || "Демонстрация";
      $("panel").classList.remove("hidden");
      // канвас должен получить размеры до создания рендера
      requestAnimationFrame(() => Demos.start(m.demo));
    } else {
      $("demo-wrap").classList.add("hidden");
      Demos.stop();
      $("panel").classList.remove("hidden");
    }
    $("panel-body").scrollTop = 0;
  }

  function openExam() {
    if (!allDone()) return;
    current = "exam";
    $("panel-title").textContent = EXAM.title;
    $("demo-wrap").classList.add("hidden");
    Demos.stop();
    $("lesson").innerHTML = `
      <h3>Финальное испытание</h3>
      <p>10 случайных вопросов по всем модулям города. Зачёт — ${EXAM.passScore} и больше правильных.
      Сдашь — получишь звание <strong>Сатоши</strong>, высшее в Криптополисе.</p>
      <p>Без подсказок и повторных попыток внутри сессии вопроса: как в блокчейне — ответ необратим.</p>`;
    $("lesson").classList.remove("hidden");
    $("quiz").classList.add("hidden");
    $("quiz").innerHTML = "";
    $("btn-quiz").textContent = "Начать экзамен →";
    $("btn-quiz").classList.remove("hidden");
    $("panel").classList.remove("hidden");
    $("panel-body").scrollTop = 0;
  }

  function closePanel() {
    $("panel").classList.add("hidden");
    Demos.stop();
    current = null;
  }

  // ---------- квиз ----------

  function startQuiz() {
    let questions, isExam = current === "exam";
    if (isExam) {
      questions = [...EXAM.questions].sort(() => Math.random() - 0.5).slice(0, 10);
    } else {
      questions = MODULES[current].quiz;
    }
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
      if (isExam) {
        const passed = correct >= EXAM.passScore;
        if (passed && !progress.examPassed) {
          progress.examPassed = true;
          progress.xp += correct * XP_EXAM_CORRECT;
        }
        html += passed
          ? `<p>Экзамен сдан. Звание <strong style="color:var(--gold)">Сатоши</strong> — твоё.
             Ты прошёл путь от «что такое блок» до устройства DeFi и цифровой самообороны.
             Теперь главное правило: проверяй, а не доверяй — и не вкладывай то, что не готов потерять.</p>`
          : `<p>Для зачёта нужно ${EXAM.passScore}+. Вернись в районы, освежи знания — экзамен можно пересдать.</p>`;
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
      $("quiz").innerHTML = html;
      const back = document.createElement("button");
      back.className = "primary";
      back.textContent = "Вернуться в город";
      back.onclick = closePanel;
      $("quiz").querySelector(".result").appendChild(back);
      saveProgress();
      refreshHUD();
    }

    renderQuestion();
  }

  // ---------- запуск ----------

  document.addEventListener("DOMContentLoaded", () => {
    World.init($("scene"), MODULES, (idx) => {
      if (idx === "exam") openExam();
      else openModule(idx);
    });

    $("panel-close").onclick = closePanel;
    $("btn-quiz").onclick = startQuiz;
    $("btn-start").onclick = () => {
      $("intro").classList.add("hidden");
      progress.seenIntro = true;
      saveProgress();
    };
    if (progress.seenIntro) $("intro").classList.add("hidden");

    refreshHUD();
  });
})();
