// КРИПТОПОЛИС — интерактивные 3D-демонстрации внутри уроков.
// Криптография настоящая: синхронный SHA-256 для майнинга и цепи,
// WebCrypto ECDSA P-256 для цифровых подписей.

// ---------- SHA-256 (компактная синхронная реализация) ----------

const sha256 = (() => {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const enc = new TextEncoder();
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));

  return function (str) {
    const msg = enc.encode(str);
    const l = msg.length;
    const padded = new Uint8Array((((l + 9) + 63) >> 6) << 6);
    padded.set(msg);
    padded[l] = 0x80;
    const dv = new DataView(padded.buffer);
    dv.setUint32(padded.length - 8, Math.floor((l * 8) / 0x100000000));
    dv.setUint32(padded.length - 4, (l * 8) >>> 0);

    let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a,
        h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    const w = new Uint32Array(64);

    for (let off = 0; off < padded.length; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    return [h0, h1, h2, h3, h4, h5, h6, h7].map((x) => x.toString(16).padStart(8, "0")).join("");
  };
})();

// ---------- каркас демо-сцен ----------

const Demos = (() => {
  let renderer = null, scene = null, camera = null;
  let rafId = null, updateFn = null, cleanupFn = null;

  const els = () => ({
    canvas: document.getElementById("demo-canvas"),
    controls: document.getElementById("demo-controls"),
    logBox: document.getElementById("demo-log"),
  });

  function log(html, cls) {
    const { logBox } = els();
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.innerHTML = html;
    logBox.appendChild(line);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function btn(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.onclick = onClick;
    els().controls.appendChild(b);
    return b;
  }

  function labelSprite(text, color = "#d7e1f3", w = 4.2) {
    const c = document.createElement("canvas");
    c.width = 384; c.height = 96;
    const g = c.getContext("2d");
    const draw = (t) => {
      g.clearRect(0, 0, 384, 96);
      g.font = "600 34px 'Segoe UI', Arial";
      g.textAlign = "center"; g.textBaseline = "middle";
      g.fillStyle = color;
      g.fillText(t, 192, 48);
      sprite.material.map.needsUpdate = true;
    };
    const tex = new THREE.CanvasTexture(c);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sprite.scale.set(w, w * 0.25, 1);
    sprite.setText = draw;
    draw(text);
    return sprite;
  }

  function freshScene(camZ = 9, camY = 3) {
    const { canvas } = els();
    if (!renderer) {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
    const w = canvas.clientWidth || 780, h = canvas.clientHeight || 280;
    renderer.setSize(w, h, false);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060910);
    camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, camY, camZ);
    camera.lookAt(0, 0.8, 0);
    scene.add(new THREE.AmbientLight(0x99aacc, 0.7));
    const d = new THREE.DirectionalLight(0xffffff, 1.2);
    d.position.set(4, 8, 6);
    scene.add(d);
    return scene;
  }

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (updateFn) updateFn(performance.now() * 0.001);
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  const stdMat = (color, intensity = 0.4) => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0.4,
  });

  // ---------- ДЕМО 1: подделай блокчейн ----------

  function demoChain() {
    freshScene(10, 3.4);
    const N = 5;
    const data = [
      "генезис: эмиссия 50",
      "Алиса → Боб: 5",
      "Боб → Кара: 2",
      "Кара → Дан: 1",
      "Дан → Алиса: 3",
    ];
    const stored = [];   // «записанные» хеши
    let prev = "0".repeat(64);
    for (let i = 0; i < N; i++) { prev = sha256(data[i] + prev); stored.push(prev); }

    const blocks = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), stdMat(0x38d9a9));
      m.position.set((i - (N - 1) / 2) * 2.3, 1.0, 0);
      scene.add(m);
      const lab = labelSprite("#" + i, "#7e8db0", 1.6);
      lab.position.set(m.position.x, 2.3, 0);
      scene.add(lab);
      blocks.push(m);
      if (i) {
        const link = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9), stdMat(0x4dabf7, 0.6));
        link.rotation.z = Math.PI / 2;
        link.position.set(m.position.x - 1.15, 1.0, 0);
        scene.add(link);
      }
    }

    function validate() {
      let p = "0".repeat(64), ok = true;
      for (let i = 0; i < N; i++) {
        p = sha256(data[i] + p);
        if (p !== stored[i]) ok = false;
        blocks[i].material.color.set(ok ? 0x38d9a9 : 0xff6b6b);
        blocks[i].material.emissive.set(ok ? 0x38d9a9 : 0xff6b6b);
      }
      return ok;
    }

    const tamperBtn = btn("Подделать блок #1: «Алиса → Боб: 500»", () => {
      data[1] = "Алиса → Боб: 500";
      const before = stored[1].slice(0, 12);
      const after = sha256(data[1] + stored[0]).slice(0, 12);
      validate();
      log(`Данные блока #1 изменены. Хеш был <code>${before}…</code>, стал бы <code>${after}…</code> — ссылки в блоках #2…#4 больше не сходятся.`, "bad");
      log("Вся цепь после подделки невалидна: любой узел отвергнет её за миллисекунды.");
      tamperBtn.disabled = true;
    });
    btn("Перемайнить всю цепь (скрыть подделку)", () => {
      let p = "0".repeat(64);
      for (let i = 0; i < N; i++) { p = sha256(data[i] + p); stored[i] = p; }
      validate();
      log("Ты пересчитал 4 блока. В реальной сети за это время честные майнеры добавили бы новые блоки — твоя версия осталась бы короче, и сеть бы её отвергла.", "gold");
      log("Подделка требует обгонять суммарную мощность всей сети. Это и есть защита блокчейна.", "ok");
    });
    btn("Сбросить демо", () => Demos.start("chain"));

    validate();
    log(`Цепь из ${N} блоков. Хеш каждого: <code>SHA-256(данные + хеш предыдущего)</code>. Зелёный — валиден.`, "ok");
    updateFn = (t) => blocks.forEach((b, i) => { b.rotation.y = Math.sin(t * 0.6 + i) * 0.18; });
  }

  // ---------- ДЕМО 2: настоящая цифровая подпись ----------

  function demoKeys() {
    freshScene(9, 2.6);
    const privKey = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 12, 26), stdMat(0xf5c542));
    privKey.position.set(-3, 1.4, 0);
    const pubKey = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.18, 12, 26), stdMat(0x4dabf7));
    pubKey.position.set(3, 1.4, 0);
    const msgBox = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.4), stdMat(0x748ffc, 0.3));
    msgBox.position.set(0, 1.2, 0);
    scene.add(privKey, pubKey, msgBox);
    const l1 = labelSprite("приватный", "#f5c542", 3); l1.position.set(-3, 2.6, 0);
    const l2 = labelSprite("публичный", "#4dabf7", 3); l2.position.set(3, 2.6, 0);
    const l3 = labelSprite("сообщение", "#9aa6c8", 3); l3.position.set(0, 2.3, 0);
    scene.add(l1, l2, l3);

    const S = { pair: null, msg: "Перевести 1 BTC Бобу", sig: null, signedMsg: null };
    const subtle = (window.crypto && crypto.subtle) ? crypto.subtle : null;
    const hex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    const ALG = { name: "ECDSA", namedCurve: "P-256" };
    const SIGALG = { name: "ECDSA", hash: "SHA-256" };

    if (!subtle) {
      log("WebCrypto недоступен в этом окружении (нужен https или localhost). Текстовая часть урока полна — демо опционально.", "bad");
    }
    log(`Сообщение: <code>${S.msg}</code>`);

    btn("1 · Сгенерировать пару ключей", async () => {
      if (!subtle) return;
      S.pair = await subtle.generateKey(ALG, true, ["sign", "verify"]);
      const raw = await subtle.exportKey("raw", S.pair.publicKey);
      log(`Ключи созданы (ECDSA P-256). Публичный: <code>${hex(raw).slice(0, 24)}…</code> — его можно показывать всем.`, "ok");
    });
    btn("2 · Подписать приватным", async () => {
      if (!subtle || !S.pair) return log("Сначала сгенерируй ключи.", "bad");
      S.sig = await subtle.sign(SIGALG, S.pair.privateKey, new TextEncoder().encode(S.msg));
      S.signedMsg = S.msg;
      log(`Подпись: <code>${hex(S.sig).slice(0, 32)}…</code> (вычислена из сообщения и приватного ключа).`, "gold");
    });
    btn("3 · Проверить публичным", async () => {
      if (!subtle || !S.sig) return log("Сначала подпиши сообщение.", "bad");
      const ok = await subtle.verify(SIGALG, S.pair.publicKey, S.sig, new TextEncoder().encode(S.msg));
      msgBox.material.color.set(ok ? 0x38d9a9 : 0xff6b6b);
      msgBox.material.emissive.set(ok ? 0x38d9a9 : 0xff6b6b);
      log(ok
        ? "✓ Подпись верна: сообщение подписал владелец приватного ключа и оно не менялось."
        : "✗ Подпись НЕ сходится: сообщение изменено после подписания!", ok ? "ok" : "bad");
    });
    btn("Подменить сообщение: 1 → 100 BTC", () => {
      S.msg = "Перевести 100 BTC Бобу";
      msgBox.material.color.set(0xf5c542);
      log(`Сообщение теперь: <code>${S.msg}</code>. Подпись осталась от старого. Нажми «Проверить».`, "gold");
    });

    updateFn = (t) => {
      privKey.rotation.y = t * 0.8;
      pubKey.rotation.y = -t * 0.8;
    };
  }

  // ---------- ДЕМО 3: транзакция через мемпул ----------

  function demoTx() {
    freshScene(10, 3.2);
    const balances = { a: 10.0, b: 2.0 };
    const alice = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), stdMat(0xf5c542));
    alice.position.set(-3.6, 1.1, 0);
    const bob = new THREE.Mesh(new THREE.SphereGeometry(0.8, 24, 18), stdMat(0x4dabf7));
    bob.position.set(3.6, 1.1, 0);
    const mempool = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.1, 10, 30), stdMat(0x9aa6c8, 0.5));
    mempool.position.set(0, 2.6, 0);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), stdMat(0x38d9a9, 0.3));
    block.position.set(0, 0.8, 0);
    scene.add(alice, bob, mempool, block);

    const la = labelSprite("", "#f5c542", 3.6); la.position.set(-3.6, 2.5, 0);
    const lb = labelSprite("", "#4dabf7", 3.6); lb.position.set(3.6, 2.5, 0);
    const lm = labelSprite("мемпул", "#9aa6c8", 2.4); lm.position.set(0, 3.6, 0);
    const lk = labelSprite("блок", "#38d9a9", 2); lk.position.set(0, -0.2, 0);
    scene.add(la, lb, lm, lk);
    const refresh = () => { la.setText(`Алиса: ${balances.a.toFixed(2)}`); lb.setText(`Боб: ${balances.b.toFixed(2)}`); };
    refresh();

    const coin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), stdMat(0xffd43b, 1.0));
    coin.visible = false;
    scene.add(coin);

    const { controls } = els();
    const lbl = document.createElement("label");
    lbl.innerHTML = 'Сумма: <input id="tx-amt" type="range" min="0.5" max="3" step="0.5" value="1.5"> <span id="tx-amt-v">1.5</span>';
    controls.appendChild(lbl);
    const feeLbl = document.createElement("label");
    feeLbl.innerHTML = ' Комиссия: <select id="tx-fee"><option value="0.05">низкая (медленно)</option><option value="0.15" selected>средняя</option><option value="0.4">высокая (быстро)</option></select>';
    controls.appendChild(feeLbl);
    controls.querySelector("#tx-amt").oninput = (e) => { controls.querySelector("#tx-amt-v").textContent = e.target.value; };

    let anim = null;
    btn("Отправить и подписать", () => {
      if (anim) return;
      const amt = parseFloat(controls.querySelector("#tx-amt").value);
      const fee = parseFloat(controls.querySelector("#tx-fee").value);
      if (balances.a < amt + fee) return log("Недостаточно средств с учётом комиссии.", "bad");
      const wait = fee >= 0.4 ? 1.0 : fee >= 0.15 ? 2.2 : 4.0;
      log(`Транзакция подписана: Алиса → Боб ${amt} (комиссия ${fee}). Уходит в мемпул…`);
      anim = { phase: 0, t0: performance.now() * 0.001, amt, fee, wait };
      coin.visible = true;
    });

    updateFn = (t) => {
      mempool.rotation.x = t * 0.9;
      block.rotation.y = t * 0.5;
      if (!anim) return;
      const dt = t - anim.t0;
      if (anim.phase === 0) { // к мемпулу
        const k = Math.min(1, dt / 1.2);
        coin.position.lerpVectors(alice.position, mempool.position, k);
        if (k >= 1) { anim.phase = 1; anim.t0 = t; log(`В мемпуле. Ожидание включения в блок (комиссия ${anim.fee})…`); }
      } else if (anim.phase === 1) { // ждём в мемпуле
        coin.position.x = Math.cos(t * 3) * 0.8;
        coin.position.y = 2.6 + Math.sin(t * 3) * 0.3;
        if (dt > anim.wait) { anim.phase = 2; anim.t0 = t; log("Майнер включил транзакцию в блок!", "gold"); }
      } else if (anim.phase === 2) { // в блок
        const k = Math.min(1, dt / 0.8);
        coin.position.lerpVectors(mempool.position, block.position, k);
        if (k >= 1) {
          anim.phase = 3; anim.t0 = t;
          balances.a -= anim.amt + anim.fee; balances.b += anim.amt;
          refresh();
          coin.visible = false;
          log(`Блок добавлен в цепь. Балансы обновлены (комиссия ${anim.fee} ушла майнеру).`, "ok");
        }
      } else if (anim.phase === 3) { // подтверждения
        const conf = Math.floor(dt / 0.9);
        if (conf > (anim.conf || 0)) {
          anim.conf = conf;
          log(`Подтверждений: ${conf} — поверх вырос ещё один блок.`);
          if (conf >= 3) { log("3+ подтверждения: транзакцию уже практически невозможно отменить.", "ok"); anim = null; }
        }
      }
    };
  }

  // ---------- ДЕМО 4: майнинг с настоящим SHA-256 ----------

  function demoMine() {
    freshScene(8, 2.6);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), stdMat(0xff922b, 0.4));
    block.position.y = 1.3;
    scene.add(block);
    const status = labelSprite("nonce: 0", "#d7e1f3", 6.4);
    status.position.set(0, 3.2, 0);
    scene.add(status);

    const S = { n: 1, prev: "0".repeat(64), nonce: 0, running: false, tries: 0, t0: 0, found: null };
    const header = () => `блок #${S.n}|Алиса→Боб:5|prev:${S.prev.slice(0, 16)}|nonce:`;

    const { controls } = els();
    const diffLbl = document.createElement("label");
    diffLbl.innerHTML = 'Сложность: <select id="mine-diff"><option value="3">3 нуля (легко)</option><option value="4" selected>4 нуля (средне)</option><option value="5">5 нулей (тяжело)</option></select>';
    controls.appendChild(diffLbl);

    let startBtn;
    startBtn = btn("⛏ Старт майнинга", () => {
      if (S.found) { // следующий блок
        S.n++; S.prev = S.found; S.found = null; S.nonce = 0; S.tries = 0;
        block.material.color.set(0xff922b); block.material.emissive.set(0xff922b);
        startBtn.textContent = "⛏ Старт майнинга";
        log(`Готов блок #${S.n}. prev = <code>${S.prev.slice(0, 16)}…</code>`);
        return;
      }
      S.running = !S.running;
      if (S.running && !S.t0) S.t0 = performance.now();
      startBtn.textContent = S.running ? "⏸ Пауза" : "⛏ Продолжить";
    });

    log("Задача: найти nonce, при котором SHA-256 заголовка начинается с нужного числа нулей. Только перебор.");

    updateFn = (t) => {
      block.rotation.y = t * 0.6;
      if (!S.running || S.found) return;
      const target = "0".repeat(parseInt(controls.querySelector("#mine-diff").value, 10));
      const deadline = performance.now() + 12; // бюджет кадра
      let h = "";
      while (performance.now() < deadline) {
        h = sha256(header() + S.nonce);
        S.tries++;
        if (h.startsWith(target)) {
          S.found = h;
          S.running = false;
          const secs = ((performance.now() - S.t0) / 1000).toFixed(1);
          block.material.color.set(0xf5c542);
          block.material.emissive.set(0xf5c542);
          block.material.emissiveIntensity = 1.0;
          status.setText(`НАЙДЕН! nonce=${S.nonce}`);
          log(`✓ Блок #${S.n} найден! nonce = <code>${S.nonce}</code>, попыток: ${S.tries.toLocaleString("ru")}, время: ${secs} c`, "gold");
          log(`Хеш: <code>${h.slice(0, 28)}…</code> — любой узел проверит это одним вычислением.`, "ok");
          log("Добавь ещё один ноль сложности — и попыток станет в ~16 раз больше. Так сеть управляет темпом блоков.");
          startBtn.textContent = "→ Следующий блок";
          return;
        }
        S.nonce++;
      }
      if (S.tries % 3 === 0) {
        const rate = Math.round(S.tries / Math.max(0.001, (performance.now() - S.t0) / 1000));
        status.setText(`nonce: ${S.nonce} | ${rate.toLocaleString("ru")} H/s`);
      }
    };
  }

  // ---------- ДЕМО 5: выбор валидатора в PoS ----------

  function demoPos() {
    freshScene(11, 4);
    const stakes = [32, 16, 8, 8, 4, 2, 1, 1];
    const total = stakes.reduce((s, x) => s + x, 0);
    const wins = stakes.map(() => 0);
    let rounds = 0;
    const cols = stakes.map((st, i) => {
      const h = 0.4 + st * 0.09;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, h, 18), stdMat(0xbe4bdb, 0.3));
      m.position.set((i - 3.5) * 1.5, h / 2 + 0.2, 0);
      scene.add(m);
      const lab = labelSprite(`${st}`, "#9aa6c8", 1.2);
      lab.position.set(m.position.x, h + 0.8, 0);
      scene.add(lab);
      return m;
    });
    log(`8 валидаторов, стейки: ${stakes.join(", ")} (всего ${total}). Шанс каждого = его доля стейка.`);

    let spin = null;
    function weightedPick() {
      let r = Math.random() * total;
      for (let i = 0; i < stakes.length; i++) { r -= stakes[i]; if (r <= 0) return i; }
      return stakes.length - 1;
    }
    function highlight(idx) {
      cols.forEach((c, i) => {
        const on = i === idx;
        c.material.emissiveIntensity = on ? 1.0 : 0.3;
        c.material.color.set(on ? 0x38d9a9 : 0xbe4bdb);
        c.material.emissive.set(on ? 0x38d9a9 : 0xbe4bdb);
      });
    }
    function report() {
      const lines = stakes.map((st, i) =>
        `В${i + 1}: стейк ${(st / total * 100).toFixed(0)}% → побед ${rounds ? (wins[i] / rounds * 100).toFixed(0) : 0}%`);
      log(`Раундов: ${rounds}. ${lines.slice(0, 4).join(" · ")}`, "ok");
    }

    btn("Провести раунд", () => {
      if (spin) return;
      spin = { t0: performance.now() * 0.001, winner: weightedPick(), cur: 0, last: 0 };
    });
    btn("×20 раундов мгновенно", () => {
      for (let i = 0; i < 20; i++) { wins[weightedPick()]++; rounds++; }
      report();
    });

    updateFn = (t) => {
      if (!spin) return;
      const dt = t - spin.t0;
      const speed = Math.max(0.03, 0.25 - dt * 0.06); // замедление рулетки
      if (t - spin.last > speed) {
        spin.last = t;
        spin.cur = (spin.cur + 1) % cols.length;
        highlight(spin.cur);
      }
      if (dt > 2.2 && spin.cur === spin.winner) {
        highlight(spin.winner);
        wins[spin.winner]++; rounds++;
        log(`Выбран валидатор В${spin.winner + 1} (стейк ${stakes[spin.winner]}). Он предлагает блок и получает награду; за обман — слэшинг.`, "gold");
        report();
        spin = null;
      }
    };
  }

  const BUILDERS = { chain: demoChain, keys: demoKeys, tx: demoTx, mine: demoMine, pos: demoPos };

  return {
    start(name) {
      this.stop();
      const { controls, logBox } = els();
      controls.innerHTML = "";
      logBox.innerHTML = "";
      if (!BUILDERS[name]) return;
      BUILDERS[name]();
      if (!rafId) loop();
    },
    stop() {
      updateFn = null;
      if (cleanupFn) { cleanupFn(); cleanupFn = null; }
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      scene = null;
    },
    sha256,
  };
})();
