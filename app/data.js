/*
 * TeaBreak データ層
 * SCENES / QUESTIONS / TEAS / BRANDS と、購入リンク生成関数を提供する。
 * ビルド不要で動くよう、グローバル window.TEABREAK_DATA に公開する。
 * データは claude-library の紅茶資料（black-tea-guide.md / tea-by-mood.md）に基づく。
 */
(function (global) {
  "use strict";

  /* ---- シーン（気分の入口・8種） ---- */
  var SCENES = [
    { id: "focus",     label: "集中したい",       emoji: "🎯", accent: "--s-focus" },
    { id: "relax",     label: "リラックスしたい", emoji: "🌿", accent: "--s-relax" },
    { id: "morning",   label: "朝・目覚めに",     emoji: "🌅", accent: "--s-morning" },
    { id: "afterMeal", label: "食後・口直しに",   emoji: "🍋", accent: "--s-meal" },
    { id: "refresh",   label: "気分転換したい",   emoji: "💫", accent: "--s-refresh" },
    { id: "warm",      label: "温まりたい",       emoji: "🔥", accent: "--s-warm" },
    { id: "bedtime",   label: "就寝前・夜に",     emoji: "🌙", accent: "--s-bed" },
    { id: "special",   label: "おもてなし・特別", emoji: "🎁", accent: "--s-special" }
  ];

  /* ---- 質問フロー（5問） ---- */
  var QUESTIONS = [
    { id: "scene", text: "今の気分・シーンは？", type: "scene" },
    {
      id: "temp", text: "ホット？ アイス？",
      options: [
        { label: "ホット", value: "hot", emoji: "♨️" },
        { label: "アイス", value: "iced", emoji: "🧊" }
      ]
    },
    {
      id: "milk", text: "ミルクは入れる？",
      options: [
        { label: "入れる", value: "yes", emoji: "🥛" },
        { label: "入れない", value: "no", emoji: "🚫" },
        { label: "どちらでも", value: "either", emoji: "🤷" }
      ]
    },
    {
      id: "flavor", text: "フレーバー（香り付き）は好き？",
      options: [
        { label: "おまかせ", value: "any", emoji: "✨" },
        { label: "香り付きがいい", value: "flavored", emoji: "🌸" },
        { label: "茶葉そのもの", value: "plain", emoji: "🍃" }
      ]
    },
    {
      id: "caffeine", text: "カフェインは控えたい？",
      options: [
        { label: "控えたい", value: "avoid", emoji: "🌙" },
        { label: "気にしない", value: "ok", emoji: "👍" }
      ],
      // 就寝前を選んだときは既定で「控えたい」を推奨（UIでハイライト）
      defaultWhen: { scene: "bedtime", value: "avoid" }
    }
  ];

  /* ---- ブランド ---- */
  var BRANDS = [
    { id: "lupicia",   name: "ルピシア",             country: "日本",     officialSearch: "https://www.lupicia.com/" },
    { id: "nittoh",    name: "日東紅茶",             country: "日本",     officialSearch: "https://www.nittoh-tea.com/" },
    { id: "twinings",  name: "トワイニング",         country: "イギリス", officialSearch: "https://twinings.jp/" },
    { id: "fortnum",   name: "フォートナム&メイソン", country: "イギリス", officialSearch: "https://www.fortnumandmason.com/" },
    { id: "mariage",   name: "マリアージュフレール",   country: "フランス", officialSearch: "https://www.mariagefreres.com/" },
    { id: "kusmi",     name: "クスミティー",         country: "フランス", officialSearch: "https://www.kusmitea.com/" },
    { id: "dilmah",    name: "ディルマ",             country: "スリランカ", officialSearch: "https://www.dilmahtea.com/" },
    { id: "waghbakri", name: "ワグバクリ",           country: "インド",   officialSearch: "https://www.waghbakritea.com/" },
    { id: "generic",   name: "",                     country: "",         officialSearch: null }
  ];

  /* ---- 茶葉カタログ ---- */
  var TEAS = [
    {
      id: "darjeeling-1st", name: "ダージリン ファーストフラッシュ", origin: "インド",
      profile: "若々しく爽やか。緑茶に近い軽やかな渋み。",
      caffeine: "medium", hot: true, iced: true, milk: "no", flavor: "plain",
      scenes: ["focus", "refresh", "special", "morning"], brew: "ストレートでやや薄めに。香りを楽しんで。",
      brandIds: ["lupicia", "mariage", "twinings"]
    },
    {
      id: "darjeeling-2nd", name: "ダージリン セカンドフラッシュ", origin: "インド",
      profile: "マスカットのような芳醇な香り（マスカテル）。クリアで華やか。",
      caffeine: "medium", hot: true, iced: true, milk: "no", flavor: "plain",
      scenes: ["focus", "special"], brew: "ストレートで。カップを温めて丁寧に。",
      brandIds: ["lupicia", "mariage", "fortnum"]
    },
    {
      id: "assam", name: "アッサム", origin: "インド",
      profile: "濃厚で力強くコクがある。水色が濃い。",
      caffeine: "high", hot: true, iced: true, milk: "good", flavor: "plain",
      scenes: ["morning", "warm"], brew: "濃いめに抽出してミルクティーに。",
      brandIds: ["twinings", "nittoh", "lupicia"]
    },
    {
      id: "nilgiri", name: "ニルギリ", origin: "インド",
      profile: "クセが少なく爽やか。アイスにも向く万能タイプ。",
      caffeine: "medium", hot: true, iced: true, milk: "ok", flavor: "plain",
      scenes: ["refresh", "afterMeal", "focus", "morning"], brew: "ストレートやアイスで軽やかに。",
      brandIds: ["lupicia", "dilmah"]
    },
    {
      id: "uva", name: "ウバ", origin: "スリランカ",
      profile: "メントール様の香りと強い渋み。世界三大銘茶のひとつ。",
      caffeine: "high", hot: true, iced: true, milk: "good", flavor: "plain",
      scenes: ["warm", "afterMeal"], brew: "ミルクティーで渋みをまろやかに。",
      brandIds: ["dilmah", "lupicia"]
    },
    {
      id: "dimbula", name: "ディンブラ", origin: "スリランカ",
      profile: "バランス良く飲みやすい。花のような香り。",
      caffeine: "medium", hot: true, iced: true, milk: "ok", flavor: "plain",
      scenes: ["afterMeal", "refresh", "relax"], brew: "ストレートでもアイスでも。",
      brandIds: ["dilmah", "lupicia"]
    },
    {
      id: "nuwara", name: "ヌワラエリヤ", origin: "スリランカ",
      profile: "軽やかで華やか。「セイロンのシャンパン」。",
      caffeine: "medium", hot: true, iced: true, milk: "no", flavor: "plain",
      scenes: ["focus", "special", "refresh", "morning"], brew: "ストレートで繊細な香りを。",
      brandIds: ["dilmah", "lupicia"]
    },
    {
      id: "keemun", name: "キーモン（祁門）", origin: "中国",
      profile: "スモーキーで蘭・バラを思わせる香り。世界三大銘茶。",
      caffeine: "medium", hot: true, iced: false, milk: "ok", flavor: "plain",
      scenes: ["special", "relax"], brew: "ストレートで香りをじっくり。",
      brandIds: ["twinings", "lupicia"]
    },
    {
      id: "yunnan", name: "雲南（滇紅）", origin: "中国",
      profile: "黄金のティップ、甘く濃厚。",
      caffeine: "medium", hot: true, iced: false, milk: "good", flavor: "plain",
      scenes: ["morning", "warm", "special"], brew: "ストレートまたはミルクで。",
      brandIds: ["lupicia", "mariage"]
    },
    {
      id: "kenya-ctc", name: "ケニア（CTC）", origin: "ケニア",
      profile: "力強く濃い。ティーバッグの定番、ミルクによく合う。",
      caffeine: "high", hot: true, iced: true, milk: "good", flavor: "plain",
      scenes: ["morning", "warm"], brew: "濃いめ＋ミルクでしっかり。",
      brandIds: ["twinings", "generic"]
    },
    {
      id: "english-breakfast", name: "イングリッシュブレックファスト", origin: "ブレンド",
      profile: "アッサム・セイロン等をブレンドした濃いめの朝用。",
      caffeine: "high", hot: true, iced: true, milk: "good", flavor: "plain",
      scenes: ["morning", "warm"], brew: "濃いめに淹れてミルクティーに。",
      brandIds: ["twinings", "fortnum"]
    },
    {
      id: "earl-grey", name: "アールグレイ", origin: "フレーバード",
      profile: "ベルガモット（柑橘）の香り。気持ちをほどく定番フレーバー。",
      caffeine: "medium", hot: true, iced: true, milk: "ok", flavor: "flavored",
      scenes: ["relax", "refresh", "special"], brew: "ストレートやアイス、ミルクでも。",
      brandIds: ["twinings", "mariage", "fortnum"]
    },
    {
      id: "caramel", name: "キャラメルティー", origin: "フレーバード",
      profile: "甘いキャラメルの香り。ほっと安らぐデザート感覚。",
      caffeine: "medium", hot: true, iced: true, milk: "good", flavor: "flavored",
      scenes: ["relax", "warm"], brew: "ミルクを少し落としてまろやかに。",
      brandIds: ["lupicia", "kusmi"]
    },
    {
      id: "fruit", name: "フルーツフレーバー（アップル等）", origin: "フレーバード",
      profile: "果実の甘い香り。アイスでも華やかでリフレッシュに。",
      caffeine: "medium", hot: true, iced: true, milk: "no", flavor: "flavored",
      scenes: ["refresh", "relax"], brew: "アイスティーで香りを開かせて。",
      brandIds: ["lupicia", "kusmi"]
    },
    {
      id: "marco-polo", name: "フレーバード紅茶（マルコポーロ系）", origin: "フレーバード",
      profile: "花と果実の優雅な香り。おもてなしにも映える一杯。",
      caffeine: "medium", hot: true, iced: true, milk: "ok", flavor: "flavored",
      scenes: ["special", "relax"], brew: "ストレートで香りを主役に。",
      brandIds: ["mariage", "kusmi"]
    },
    {
      id: "lapsang", name: "ラプサンスーチョン（正山小種）", origin: "中国",
      profile: "松の煙で燻した強いスモーキー香。個性派。",
      caffeine: "medium", hot: true, iced: false, milk: "ok", flavor: "flavored",
      scenes: ["special", "warm"], brew: "ストレートで独特の香りを。",
      brandIds: ["twinings", "mariage"]
    },
    {
      id: "masala-chai", name: "マサラチャイ", origin: "インド（スパイス）",
      profile: "スパイスとミルクの温もり。体の芯からじんわり。",
      caffeine: "high", hot: true, iced: false, milk: "good", flavor: "spiced",
      scenes: ["warm"], brew: "鍋で茶葉・ミルク・スパイスを煮出して。",
      brandIds: ["waghbakri", "lupicia"]
    },
    {
      id: "decaf", name: "デカフェ紅茶（カフェインレス）", origin: "各種",
      profile: "カフェインを大幅にカット。夜でも安心の紅茶。",
      caffeine: "none", hot: true, iced: true, milk: "ok", flavor: "plain",
      scenes: ["bedtime", "relax"], brew: "ミルクを少し落として寝る前に。",
      brandIds: ["twinings", "lupicia"]
    },
    {
      id: "rooibos", name: "ルイボスティー（ノンカフェイン）", origin: "南アフリカ",
      profile: "ノンカフェインで香ばしく甘い。就寝前にも。",
      caffeine: "none", hot: true, iced: true, milk: "ok", flavor: "plain",
      scenes: ["bedtime", "relax", "refresh"], brew: "しっかり煮出すと風味が増す。",
      brandIds: ["lupicia", "generic"]
    },
    {
      id: "chamomile", name: "カモミール（ノンカフェイン）", origin: "ハーブ",
      profile: "りんごのような優しい香り。夜のくつろぎに。",
      caffeine: "none", hot: true, iced: false, milk: "no", flavor: "flavored",
      scenes: ["bedtime", "relax"], brew: "ふたをして蒸らし香りを閉じ込めて。",
      brandIds: ["lupicia", "generic"]
    }
  ];

  /* ---- 購入リンク生成（純粋関数） ---- */
  function buildLinks(brandName, teaName, brand) {
    var keyword = (String(brandName || "").trim() + " " + String(teaName || "").trim()).trim();
    var q = encodeURIComponent(keyword);
    return {
      amazon: "https://www.amazon.co.jp/s?k=" + q,
      rakuten: "https://search.rakuten.co.jp/search/mall/" + q + "/",
      official: (brand && brand.officialSearch)
        ? brand.officialSearch
        : "https://www.google.com/search?q=" + q + "%20%E5%85%AC%E5%BC%8F"
    };
  }

  function getBrand(id) {
    for (var i = 0; i < BRANDS.length; i++) {
      if (BRANDS[i].id === id) return BRANDS[i];
    }
    return null;
  }

  global.TEABREAK_DATA = {
    SCENES: SCENES,
    QUESTIONS: QUESTIONS,
    TEAS: TEAS,
    BRANDS: BRANDS,
    buildLinks: buildLinks,
    getBrand: getBrand
  };
})(window);
