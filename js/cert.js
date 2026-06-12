// КРИПТОПОЛИС — именной сертификат Сатоши (canvas → PNG).

const Cert = (() => {
  function download(name, xp, achCount) {
    const W = 1400, H = 990;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d");

    // фон
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0a1020");
    bg.addColorStop(1, "#070b14");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // сетка-подложка
    g.strokeStyle = "rgba(31,43,74,0.5)";
    g.lineWidth = 1;
    for (let x = 0; x < W; x += 46) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y < H; y += 46) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

    // двойная золотая рамка
    g.strokeStyle = "#f5c542";
    g.lineWidth = 5;
    g.strokeRect(40, 40, W - 80, H - 80);
    g.lineWidth = 1.5;
    g.strokeRect(58, 58, W - 116, H - 116);

    const center = (txt, y, font, color) => {
      g.font = font; g.fillStyle = color; g.textAlign = "center"; g.fillText(txt, W / 2, y);
    };

    center("К Р И П Т О П О Л И С", 165, "600 44px Georgia, serif", "#38d9a9");
    center("3D-академия криптовалют", 210, "italic 22px Georgia, serif", "#7e8db0");
    center("СЕРТИФИКАТ САТОШИ", 320, "700 64px Georgia, serif", "#f5c542");
    center("подтверждает, что", 395, "24px Georgia, serif", "#9aa6c8");
    center(name || "Аноним Накамото", 480, "600 56px Georgia, serif", "#d7e1f3");
    g.strokeStyle = "#2a3a5e"; g.lineWidth = 2;
    g.beginPath(); g.moveTo(W / 2 - 360, 505); g.lineTo(W / 2 + 360, 505); g.stroke();
    center("прошёл полный курс: блокчейн · криптография · кошельки · майнинг", 565, "23px Georgia, serif", "#9aa6c8");
    center("консенсус · смарт-контракты · DeFi · безопасность — и сдал финальный экзамен", 600, "23px Georgia, serif", "#9aa6c8");
    center(`${xp} XP  ·  достижений: ${achCount}  ·  звание: Сатоши`, 680, "600 28px Georgia, serif", "#38d9a9");

    const date = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    center(date, 790, "22px Georgia, serif", "#7e8db0");
    center("Not your keys — not your coins. Проверяй, а не доверяй.", 880, "italic 21px Georgia, serif", "#5a6885");
    // печать
    g.beginPath(); g.arc(W - 190, 800, 72, 0, Math.PI * 2);
    g.strokeStyle = "#f5c542"; g.lineWidth = 3; g.stroke();
    g.font = "30px Georgia, serif"; g.fillStyle = "#f5c542"; g.fillText("₿", W - 190, 790);
    g.font = "13px Georgia, serif"; g.fillText("ПРОВЕРЕНО УЗЛАМИ", W - 190, 825);

    const a = document.createElement("a");
    a.download = "cryptopolis-certificate.png";
    a.href = c.toDataURL("image/png");
    a.click();
  }

  return { download };
})();
