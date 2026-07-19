/* 化合物ラボ — A/B選択タイムアタック */
(function () {
  "use strict";

  const TIME_LIMIT = 10;
  const BEST_KEY_PREFIX = "compound-lab-best-";

  const TITLES = [
    { min: 0, name: "見習い錬成士", msg: "実験は始まったばかり！もう一回ふるえば、きっと見える世界が変わるぞ。" },
    { min: 3, name: "ラボ見習い助手", msg: "いい感じ！ビーカーが君を呼んでいる。続けて称号を伸ばそう！" },
    { min: 5, name: "ボイル級の探究者", msg: "気体の法則を愛したボイルに近づいた！あと少しで偉人街道だ。" },
    { min: 10, name: "ラボアジエ級の測定士", msg: "質量保存の人・ラボアジエ級！10連続、堂々の称号だ！！" },
    { min: 15, name: "アボガドロ級の分子使い", msg: "15連続！分子の数を見抜くアボガドロ級のセンスだ。" },
    { min: 20, name: "メンデレーエフ級の予言者", msg: "20連続！周期表を組み立てたメンデレーエフ級、未来が見えてるぞ。" },
    { min: 25, name: "キュリー級の開拓者", msg: "25連続…！放射線を切り拓いたキュリー夫妻級。その集中力、本物だ。" },
    { min: 30, name: "超すごい人・ノーベル級", msg: "30連続は伝説級！！君はもう、教科書に載る側の人間だ。お、超すごい人だ！！" },
  ];

  const VOICE = {
    startA: ["まず問題を読もう。A列を選ぶとタイマー開始！", "問題を理解してからA列を選ぼう！"],
    startB: ["10秒スタート！次はB列！", "ここから10秒！組み合わせを決めろ！"],
    correct: ["ピンポン！正解！", "いいぞ！その調子！", "反応成功！"],
    wrong: ["ドカーン！失敗だ！", "爆発したな！", "惜しい！やり直しだ！"],
    timeout: ["時間切れ！爆発！", "遅いぞ！ドカーン！"],
  };

  // DOM
  const el = {
    title: document.getElementById("screen-title"),
    play: document.getElementById("screen-play"),
    result: document.getElementById("screen-result"),
    mute: document.getElementById("mute-btn"),
    streak: document.getElementById("streak-label"),
    titleChip: document.getElementById("title-chip"),
    bestLabel: document.getElementById("best-label"),
    countdown: document.getElementById("countdown"),
    prompt: document.getElementById("prompt"),
    phaseTag: document.getElementById("phase-tag"),
    slotA: document.getElementById("slot-a"),
    slotB: document.getElementById("slot-b"),
    slotTarget: document.getElementById("slot-target"),
    jan: document.getElementById("jan-banner"),
    choices: document.getElementById("choices"),
    check: document.getElementById("check-btn"),
    feedback: document.getElementById("feedback"),
    explain: document.getElementById("explain"),
    next: document.getElementById("next-btn"),
    resultStreak: document.getElementById("result-streak"),
    resultBest: document.getElementById("result-best"),
    resultTitle: document.getElementById("result-title"),
    resultMsg: document.getElementById("result-msg"),
    retryMiss: document.getElementById("retry-miss-btn"),
    retry: document.getElementById("retry-btn"),
    home: document.getElementById("home-btn"),
    boom: document.getElementById("boom-layer"),
    boomCanvas: document.getElementById("boom-canvas"),
    popFx: document.getElementById("pop-fx"),
  };

  let level = "elementary";
  let deck = [];
  let deckIndex = 0;
  let streak = 0;
  let savedBest = 0;
  let isNewRecord = false;
  let missed = [];
  let missOnlyMode = false;
  let current = null;
  let selectedA = null;
  let selectedB = null;
  let phase = "idle"; // a | b | check | feedback
  let timerId = null;
  let timeLeft = TIME_LIMIT;
  let locked = false;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function pickVoice(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function titleFor(n) {
    let t = TITLES[0];
    for (const row of TITLES) {
      if (n >= row.min) t = row;
    }
    return t;
  }

  function updateHud() {
    el.streak.textContent = `連続 ${streak}`;
    el.titleChip.textContent = titleFor(streak).name;
    el.bestLabel.textContent = `最高 ${Math.max(savedBest, streak)}`;
  }

  function bestKey() {
    return `${BEST_KEY_PREFIX}${level}`;
  }

  function loadBest() {
    const value = Number.parseInt(localStorage.getItem(bestKey()) || "0", 10);
    savedBest = Number.isFinite(value) ? Math.max(0, value) : 0;
  }

  function saveBestIfNeeded() {
    if (streak <= savedBest) return false;
    savedBest = streak;
    localStorage.setItem(bestKey(), String(savedBest));
    isNewRecord = true;
    return true;
  }

  function showScreen(name) {
    el.title.hidden = name !== "title";
    el.play.hidden = name !== "play";
    el.result.hidden = name !== "result";
  }

  function clearTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function setCountdown(n, mode) {
    el.countdown.textContent = String(n);
    el.countdown.classList.toggle("warn", mode === "warn");
    el.countdown.classList.toggle("idle", mode === "idle");
  }

  function startTimer(onTimeout) {
    clearTimer();
    timeLeft = TIME_LIMIT;
    setCountdown(timeLeft, "warn");
    timerId = setInterval(() => {
      timeLeft -= 1;
      setCountdown(Math.max(0, timeLeft), "warn");
      if (timeLeft <= 3 && timeLeft > 0) Sound.tick();
      if (timeLeft <= 0) {
        clearTimer();
        onTimeout();
      }
    }, 1000);
  }

  function buildChoices(correct, distractors) {
    return shuffle([correct, ...distractors.slice(0, 3)]);
  }

  function showJan() {
    el.jan.hidden = false;
    Sound.jan();
    setTimeout(() => { el.jan.hidden = true; }, 500);
  }

  /** ポチッ：視覚＋触覚＋音 */
  function pochitt(btn) {
    if (btn) {
      btn.classList.add("is-press");
      setTimeout(() => btn.classList.remove("is-press"), 120);
    }
    if (el.popFx) {
      el.popFx.hidden = false;
      el.popFx.classList.remove("show");
      // reflow でアニメ再発火
      void el.popFx.offsetWidth;
      el.popFx.classList.add("show");
      clearTimeout(pochitt._t);
      pochitt._t = setTimeout(() => {
        el.popFx.classList.remove("show");
        el.popFx.hidden = true;
      }, 400);
    }
    Sound.tap();
    if (navigator.vibrate) navigator.vibrate(14);
  }

  function renderChoices(items, onPick) {
    el.choices.replaceChildren();
    items.forEach((text) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice game-btn";
      btn.textContent = text;
      btn.addEventListener("pointerdown", () => {
        if (locked || btn.disabled) return;
        pochitt(btn);
      });
      btn.addEventListener("click", () => {
        if (locked || btn.disabled) return;
        onPick(text, btn);
      });
      el.choices.appendChild(btn);
    });
  }

  function disableChoices() {
    el.choices.querySelectorAll(".choice").forEach((b) => { b.disabled = true; });
  }

  function resetSlots() {
    selectedA = null;
    selectedB = null;
    el.slotA.textContent = "？";
    el.slotB.textContent = "？";
    el.slotA.classList.remove("filled");
    el.slotB.classList.remove("filled");
    el.slotTarget.textContent = current ? current.target : "？";
    el.check.hidden = true;
    el.check.disabled = true;
    el.feedback.hidden = true;
    el.explain.hidden = true;
    el.next.hidden = true;
  }

  function beginQuestion() {
    if (deckIndex >= deck.length) {
      // デッキ尽きたらシャッフルして継続（連続型）
      const bank = missOnlyMode
        ? missed.slice()
        : getQuizBank(level).map((q, i) => ({ ...q, _id: `${level}-${i}-${q.target}` }));
      if (!bank.length) {
        endRun(false);
        return;
      }
      deck = shuffle(bank);
      deckIndex = 0;
      if (missOnlyMode && !deck.length) {
        endRun(false);
        return;
      }
    }

    current = deck[deckIndex];
    locked = false;
    phase = "a";
    resetSlots();
    el.prompt.textContent = `${current.target}を作れ！`;
    el.phaseTag.textContent = "問題を読んでA列を選ぼう — 選ぶと10秒スタート";
    setCountdown("準備", "idle");
    updateHud();
    showJan();
    Sound.speak(pickVoice(VOICE.startA));

    const opts = buildChoices(current.a, current.distractorsA);
    renderChoices(opts, (text, btn) => {
      if (phase !== "a") return;
      selectedA = text;
      el.slotA.textContent = text;
      el.slotA.classList.add("filled");
      el.choices.querySelectorAll(".choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      disableChoices();
      setTimeout(beginPhaseB, 280);
    });
  }

  function beginPhaseB() {
    if (locked) return;
    phase = "b";
    el.phaseTag.textContent = "B列 — 残り10秒以内に選べ";
    showJan();
    Sound.speak(pickVoice(VOICE.startB));

    const opts = buildChoices(current.b, current.distractorsB);
    renderChoices(opts, (text, btn) => {
      if (phase !== "b") return;
      selectedB = text;
      el.slotB.textContent = text;
      el.slotB.classList.add("filled");
      el.choices.querySelectorAll(".choice").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      disableChoices();
      clearTimer();
      setCountdown("✓", "idle");
      phase = "check";
      el.phaseTag.textContent = "CHECKで反応させろ！";
      el.check.hidden = false;
      el.check.disabled = false;
    });
    startTimer(() => failRound("timeout"));
  }

  function isCorrectCombo(a, b) {
    return (a === current.a && b === current.b) || (a === current.b && b === current.a);
  }

  function onCheck() {
    if (phase !== "check" || locked) return;
    locked = true;
    el.check.disabled = true;
    clearTimer();

    if (isCorrectCombo(selectedA, selectedB)) {
      succeedRound();
    } else {
      failRound("wrong");
    }
  }

  function succeedRound() {
    phase = "feedback";
    streak += 1;
    saveBestIfNeeded();
    updateHud();
    Sound.pinpon();
    Sound.speak(pickVoice(VOICE.correct));
    document.body.classList.add("flash-ok");
    setTimeout(() => document.body.classList.remove("flash-ok"), 350);

    el.feedback.hidden = false;
    el.feedback.className = "feedback ok";
    el.feedback.textContent = "正解！ピンポンピンポン♪";
    el.explain.hidden = false;
    el.explain.textContent = current.explanation;
    el.choices.replaceChildren();
    el.check.hidden = true;
    el.next.hidden = false;
    el.next.textContent = "次の実験へ";
    setCountdown("♪", "idle");
  }

  function failRound(reason) {
    if (phase === "feedback") return;
    locked = true;
    phase = "feedback";
    clearTimer();
    disableChoices();
    el.check.hidden = true;

    if (current) {
      const id = current._id || current.target;
      if (!missed.some((m) => (m._id || m.target) === id)) {
        missed.push(current);
      }
    }

    Sound.explode();
    Sound.speak(reason === "timeout" ? pickVoice(VOICE.timeout) : pickVoice(VOICE.wrong), 1.05);
    runBoomEffect();

    el.feedback.hidden = false;
    el.feedback.className = "feedback ng";
    el.feedback.textContent = reason === "timeout"
      ? "時間切れ！ドカーン！！"
      : "反応失敗！ドカーン！！";
    el.explain.hidden = false;
    const correctLine = `正解は ${current.a} ＋ ${current.b}`;
    el.explain.textContent = `${correctLine}\n${current.explanation}`;
    el.choices.replaceChildren();
    el.next.hidden = false;
    el.next.textContent = "結果を見る";
    setCountdown("💥", "idle");
  }

  function goNextFromFeedback() {
    if (el.feedback.classList.contains("ok")) {
      deckIndex += 1;
      beginQuestion();
    } else {
      endRun(true);
    }
  }

  function endRun() {
    clearTimer();
    const t = titleFor(streak);
    showScreen("result");
    el.resultStreak.textContent = `連続正解 ${streak}`;
    el.resultBest.textContent = isNewRecord
      ? `🏆 NEW RECORD！最高記録 ${savedBest}`
      : `最高記録 ${savedBest}`;
    el.resultTitle.textContent = `君は【${t.name}】だ！`;
    el.resultMsg.textContent = t.msg + (streak >= 30
      ? ""
      : `（次の称号まであと${nextTitleGap(streak)}連続）`);
    el.retryMiss.hidden = missed.length === 0;
    Sound.speak(`連続${streak}問正解。君は${t.name}だ！`);
  }

  function nextTitleGap(n) {
    const next = TITLES.find((row) => row.min > n);
    if (!next) return 0;
    return next.min - n;
  }

  function runBoomEffect() {
    el.boom.hidden = false;
    const canvas = el.boomCanvas;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const W = window.innerWidth;
    const H = window.innerHeight;
    const cx = W / 2;
    const cy = H * 0.42;
    const particles = [];
    for (let i = 0; i < 90; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = 3 + Math.random() * 14;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 2,
        life: 1,
        r: 3 + Math.random() * 8,
        color: Math.random() > 0.5 ? "#ffeb3b" : (Math.random() > 0.5 ? "#ff5722" : "#fff")
      });
    }

    let frames = 0;
    function frame() {
      frames += 1;
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.life -= 0.02;
        p.vx *= 0.98;
        if (p.life <= 0) return;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
      if (frames < 55) requestAnimationFrame(frame);
      else {
        ctx.clearRect(0, 0, W, H);
        el.boom.hidden = true;
      }
    }
    requestAnimationFrame(frame);
    if (navigator.vibrate) navigator.vibrate([40, 30, 80, 30, 120]);
  }

  function startGame(lv, onlyMiss) {
    level = lv;
    missOnlyMode = !!onlyMiss;
    streak = 0;
    isNewRecord = false;
    loadBest();
    if (!onlyMiss) missed = [];

    const source = onlyMiss
      ? missed.slice()
      : getQuizBank(level).map((q, i) => ({ ...q, _id: `${level}-${i}-${q.target}` }));

    if (!source.length) {
      alert("問題がありません");
      return;
    }

    // ミス再挑戦時は missed を消費用にコピーして空に近い運用：失敗したらまた積む
    if (onlyMiss) {
      missed = [];
    }

    deck = shuffle(source);
    deckIndex = 0;
    showScreen("play");
    updateHud();
    beginQuestion();
  }

  // —— イベント（ポチッ付き） ——
  function bindPochittClick(node, handler) {
    if (!node) return;
    node.addEventListener("pointerdown", () => {
      if (node.disabled) return;
      pochitt(node);
    });
    node.addEventListener("click", async () => {
      if (node.disabled) return;
      await handler();
    });
  }

  document.querySelectorAll(".level-btn").forEach((btn) => {
    bindPochittClick(btn, async () => {
      await Sound.unlock();
      startGame(btn.dataset.level, false);
    });
  });

  bindPochittClick(el.check, () => { onCheck(); });
  bindPochittClick(el.next, () => { goNextFromFeedback(); });
  bindPochittClick(el.retry, async () => {
    await Sound.unlock();
    startGame(level, false);
  });
  bindPochittClick(el.retryMiss, async () => {
    await Sound.unlock();
    if (!missed.length) return;
    startGame(level, true);
  });
  bindPochittClick(el.home, () => {
    clearTimer();
    showScreen("title");
  });
  bindPochittClick(el.mute, () => {
    const next = !Sound.isMuted();
    Sound.setMuted(next);
    el.mute.textContent = next ? "🔇" : "🔊";
  });
  el.mute.textContent = Sound.isMuted() ? "🔇" : "🔊";

  // iOS 対策：ダブルタップズーム / 長押し選択 / ピンチ / スクロールバウンス
  let lastTap = 0;
  document.addEventListener("touchstart", (e) => {
    const now = Date.now();
    if (now - lastTap < 300) e.preventDefault();
    lastTap = now;
  }, { passive: false });

  document.addEventListener("touchmove", (e) => {
    const scrollable = e.target.closest(".explain, .screen-result");
    if (scrollable) return;
    e.preventDefault();
  }, { passive: false });

  document.addEventListener("gesturestart", (e) => e.preventDefault());
  document.addEventListener("gesturechange", (e) => e.preventDefault());
  document.addEventListener("gestureend", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => e.preventDefault());
  document.addEventListener("dragstart", (e) => e.preventDefault());

  // フォーカス時のキーボードズーム予防（入力欄なしだが念のため）
  document.addEventListener("focusin", (e) => {
    if (e.target && e.target.blur && e.target.tagName !== "BUTTON") {
      e.target.blur();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") Sound.unlock();
  });
})();
