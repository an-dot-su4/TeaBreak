/*
 * TeaBreak アプリ本体
 * - チャット風フローの制御
 * - recommend()：回答から紅茶をスコアリングして上位を返す純粋関数
 * - 結果カードの描画・購入リンク生成
 * - Service Worker 登録
 */
(function () {
  "use strict";

  var D = window.TEABREAK_DATA;
  var SCENES = D.SCENES, QUESTIONS = D.QUESTIONS, TEAS = D.TEAS;

  /* ====== レコメンドロジック（純粋関数・テスト対象） ====== */

  function milkScore(pref, teaMilk) {
    // ミルクを入れる → ミルク向きを加点、ストレート専用は減点
    if (pref === "yes") return teaMilk === "good" ? 4 : (teaMilk === "ok" ? 2 : -3);
    // ミルクを入れない → ストレート向きを加点、ミルク向き（濃く渋い）は減点
    if (pref === "no") return teaMilk === "no" ? 3 : (teaMilk === "ok" ? 1 : -3);
    return 0; // どちらでも（ミルク適性でバイアスをかけない）
  }

  function flavorScore(pref, teaFlavor) {
    if (pref === "flavored") return (teaFlavor === "flavored" || teaFlavor === "spiced") ? 3 : -2;
    if (pref === "plain") return teaFlavor === "plain" ? 2 : -3;
    return 0; // any
  }

  // answers: { scene, temp, milk, flavor, caffeine }
  function recommend(answers, teas) {
    teas = teas || TEAS;
    var pass = teas.filter(function (t) {
      if (answers.caffeine === "avoid" && t.caffeine !== "none") return false;
      if (answers.temp === "iced" && !t.iced) return false;
      if (answers.temp === "hot" && !t.hot) return false;
      return true;
    });

    var scored = pass.map(function (t) {
      var s = 0;
      if (t.scenes.indexOf(answers.scene) !== -1) s += 5;
      s += milkScore(answers.milk, t.milk);
      if ((answers.temp === "iced" && t.iced) || (answers.temp === "hot" && t.hot)) s += 1;
      s += flavorScore(answers.flavor, t.flavor);
      if (answers.scene === "bedtime" && t.caffeine === "none") s += 2;
      return { tea: t, score: s };
    });

    scored.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.tea.id < b.tea.id ? -1 : 1; // 安定化
    });

    var positive = scored.filter(function (x) { return x.score > 0; });
    var fallback = false;
    var top;
    if (positive.length > 0) {
      // B: 上位と乖離した“弱い候補”は出さない（無理に3件にしない）。
      // 最高スコアから離れすぎたもの・低すぎるものは除外し、1〜3件に絞る。
      var topScore = positive[0].score;
      var floor = Math.max(2, topScore - 6);
      top = positive.filter(function (x) { return x.score >= floor; }).slice(0, 3);
      if (top.length === 0) top = positive.slice(0, 1); // 全て弱くても最低1件は出す
    } else {
      // スコアが振るわない場合でも、ハード条件（カフェイン・温度）は必ず維持する。
      // scored は既にハードフィルタ済みなので、そのまま上位を採用する。
      fallback = true;
      top = scored.slice(0, 3);
    }
    return { items: top.map(function (x) { return x.tea; }), fallback: fallback };
  }

  // 公開（テスト・将来のAI連携用）
  window.TeaBreak = { recommend: recommend, milkScore: milkScore, flavorScore: flavorScore };

  /* ====== ここから DOM 制御（ブラウザ内でのみ実行） ====== */
  if (typeof document === "undefined") return;

  var log, chips, restartBtn;
  var state = { step: 0, answers: {} };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function scrollToBottom() {
    window.requestAnimationFrame(function () {
      log.scrollTop = log.scrollHeight;
    });
  }

  function addBot(text) {
    var m = el("div", "msg bot");
    m.appendChild(el("span", "avatar", "🫖"));
    m.appendChild(el("div", "bubble", text));
    log.appendChild(m);
    scrollToBottom();
  }

  function addUser(text) {
    var m = el("div", "msg user");
    m.appendChild(el("div", "bubble", text));
    log.appendChild(m);
    scrollToBottom();
  }

  function clearChips() { chips.innerHTML = ""; }

  function renderChips(options, onPick, accentVar) {
    clearChips();
    options.forEach(function (opt) {
      var b = el("button", "chip");
      b.type = "button";
      if (accentVar) b.style.setProperty("--chip-accent", "var(" + accentVar + ")");
      b.innerHTML = "";
      if (opt.emoji) b.appendChild(el("span", "chip-emoji", opt.emoji));
      b.appendChild(el("span", "chip-label", opt.label));
      if (opt.recommended) b.appendChild(el("span", "chip-badge", "おすすめ"));
      b.addEventListener("click", function () { onPick(opt); });
      chips.appendChild(b);
    });
  }

  function currentQuestion() { return QUESTIONS[state.step]; }

  function askQuestion() {
    var q = currentQuestion();
    if (!q) { showResult(); return; }
    addBot(q.text);

    if (q.type === "scene") {
      var opts = SCENES.map(function (s) {
        return { label: s.label, value: s.id, emoji: s.emoji, accent: s.accent };
      });
      renderChips(opts, function (opt) { pick(q, opt, opt.value, opt.accent); });
      return;
    }

    // 就寝前のときカフェイン質問に「おすすめ」バッジを付ける
    var options = q.options.map(function (o) { return Object.assign({}, o); });
    if (q.defaultWhen && state.answers.scene === q.defaultWhen.scene) {
      options.forEach(function (o) { if (o.value === q.defaultWhen.value) o.recommended = true; });
    }
    var accentVar = sceneAccent();
    renderChips(options, function (opt) { pick(q, opt, opt.value, accentVar); });
  }

  function sceneAccent() {
    var sid = state.answers.scene;
    for (var i = 0; i < SCENES.length; i++) if (SCENES[i].id === sid) return SCENES[i].accent;
    return "--accent";
  }

  function pick(q, opt, value, accentVar) {
    addUser(opt.label);
    state.answers[q.id] = value;
    state.step += 1;
    clearChips();
    window.setTimeout(askQuestion, 240);
  }

  function showResult() {
    var res = recommend(state.answers, TEAS);
    var accentVar = sceneAccent();

    if (res.fallback) {
      addBot("ぴったりの条件が少なかったので、近いものをご提案しますね。");
    } else {
      addBot("あなたの気分にはこんな紅茶がおすすめです！");
    }

    res.items.forEach(function (tea) {
      log.appendChild(buildResultCard(tea, accentVar));
    });
    scrollToBottom();

    addBot("☕ これは感覚的な提案です。感じ方には個人差があります。もう一度試すこともできます。");

    clearChips();
    var again = el("button", "chip primary");
    again.type = "button";
    again.style.setProperty("--chip-accent", "var(" + accentVar + ")");
    again.appendChild(el("span", "chip-emoji", "🔄"));
    again.appendChild(el("span", "chip-label", "もう一度選ぶ"));
    again.addEventListener("click", restart);
    chips.appendChild(again);
  }

  function buildResultCard(tea, accentVar) {
    var card = el("article", "result-card");
    card.style.setProperty("--card-accent", "var(" + accentVar + ")");

    var head = el("div", "rc-head");
    head.appendChild(el("h3", "rc-name", tea.name));
    head.appendChild(el("span", "rc-origin", tea.origin));
    card.appendChild(head);

    card.appendChild(el("p", "rc-profile", tea.profile));

    var brew = el("p", "rc-brew");
    brew.appendChild(el("span", "rc-brew-label", "淹れ方"));
    brew.appendChild(document.createTextNode(" " + tea.brew));
    card.appendChild(brew);

    if (tea.caffeine === "none") {
      card.appendChild(el("p", "rc-tag-caffeine", "ノンカフェイン／デカフェ"));
    }

    var shopWrap = el("div", "rc-shops");
    shopWrap.appendChild(el("p", "rc-shops-label", "買えるお店（検索リンク）"));

    tea.brandIds.forEach(function (bid) {
      var brand = D.getBrand(bid);
      if (!brand) return;
      var brandName = brand.name || "";
      var links = D.buildLinks(brandName, tea.name, brand);

      var row = el("div", "brand-row");
      var label = el("span", "brand-name", brandName || "銘柄おまかせ");
      row.appendChild(label);

      var linkWrap = el("span", "brand-links");
      linkWrap.appendChild(shopLink(links.amazon, "Amazon"));
      linkWrap.appendChild(shopLink(links.rakuten, "楽天"));
      linkWrap.appendChild(shopLink(links.official, brand.officialSearch ? "公式" : "検索"));
      row.appendChild(linkWrap);

      shopWrap.appendChild(row);
    });

    card.appendChild(shopWrap);
    return card;
  }

  function shopLink(href, label) {
    var a = el("a", "shop-link", label);
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }

  function restart() {
    state = { step: 0, answers: {} };
    log.innerHTML = "";
    addBot("こんにちは！ TeaBreak です🫖 いくつか質問して、今の気分に合う紅茶を提案します。");
    askQuestion();
  }

  function registerSW() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function () { /* オフライン非対応環境は無視 */ });
      });
    }
  }

  function init() {
    log = document.getElementById("chat-log");
    chips = document.getElementById("chips");
    restartBtn = document.getElementById("restart");
    if (restartBtn) restartBtn.addEventListener("click", restart);
    restart();
    registerSW();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
