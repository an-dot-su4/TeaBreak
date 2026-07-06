# TeaBreak（app）

「今の気分」をチャット風に選ぶと、おすすめの紅茶・ブランド・購入リンクを提案する PWA。
バックエンド・ビルド不要の静的サイトです。

## ローカルで動かす

```bash
cd app
python3 -m http.server 8000
# → ブラウザで http://localhost:8000/
```
※ `file://` でも一応動きますが、Service Worker（オフライン）を有効にするには上記のように HTTP で配信してください。

## 構成

| ファイル | 役割 |
|----------|------|
| `index.html` | チャットUIの器 |
| `styles.css` | デザイン（紅茶パレット＋シーン別アクセント、ライト/ダーク） |
| `data.js` | 質問／茶葉／ブランド／購入リンク生成（`window.TEABREAK_DATA`） |
| `app.js` | 会話フロー・レコメンド（`recommend()`）・描画・SW登録 |
| `manifest.webmanifest`, `sw.js` | PWA（インストール・オフライン） |
| `icons/` | アプリアイコン |

## データの追加・編集

茶葉やブランドは `data.js` の `TEAS` / `BRANDS` に追記するだけで増やせます。
購入リンクは「ブランド名＋茶葉名」の検索リンクを自動生成します（アフィリエイト無し）。

## 公開（GitHub Pages）

`main` に push すると `.github/workflows/pages.yml` が `app/` を Pages へ公開します。
**初回のみ**リポジトリの Settings → Pages → Source を「GitHub Actions」に設定してください。
公開URL（目安）：`https://an-dot-su4.github.io/teabreak/`

## 注意

提案は感覚的なものです（感じ方には個人差があります）。就寝前はカフェインにご注意ください（デカフェ／ノンカフェインを用意しています）。
