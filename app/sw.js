/* TeaBreak Service Worker
 * 方針：同一オリジンの GET は「ネットワーク優先」（オンライン時は常に最新を取得し
 * キャッシュも更新／オフライン時はキャッシュへフォールバック）。
 * これにより更新が確実に反映される。外部（Amazon/楽天等）は素通し。
 * キャッシュ名を変えると旧キャッシュは activate 時に破棄される。
 */
var CACHE = "teabreak-v2";
var ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./data.js",
  "./app.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(ASSETS); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  // 同一オリジンの GET のみ扱う。外部（購入サイト等）は素通し。
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      // 取得成功 → キャッシュを更新して返す（最新を反映）
      if (res && res.status === 200) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      // オフライン等 → キャッシュへフォールバック（無ければトップ）
      return caches.match(req).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
