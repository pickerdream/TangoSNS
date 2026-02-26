# デプロイガイド

TangoSNS の本番環境へのデプロイ手順と、過去に発生した障害の教訓をまとめたドキュメントです。

---

## アーキテクチャ

```
ブラウザ (HTTPS)
  ↓
Cloudflare Edge（SSL終端・キャッシュ・WAF）
  ↓
cloudflared (Cloudflare Tunnel)
  ↓
Nginx Ingress Controller (HTTP)
  ↓
Express.js Pod (HTTP, port 3000)
  ↓
PostgreSQL Pod
```

### ポイント

- **SSL終端は Cloudflare Edge** で行われる。バックエンド間の通信はすべて HTTP。
- Express は `trust proxy: true` を設定し、`X-Forwarded-*` ヘッダーを信頼する。
- `cf-connecting-ip` ヘッダーの有無で Cloudflare 経由かを判定できる。

---

## デプロイ手順

### 1. Docker イメージのビルド & プッシュ

```bash
docker build -t kouta2133/tangosns:latest .
docker push kouta2133/tangosns:latest
```

### 2. Kubernetes への適用

```bash
kubectl apply -f k8s/
```

### 3. Pod の再起動（イメージ更新の反映）

```bash
kubectl rollout restart deployment tangosns-app -n tangosns
```

### 4. Cloudflare キャッシュのパージ

**デプロイ後は必ず実行すること。** 理由は後述の「障害記録」を参照。

```bash
# Cloudflare Dashboard から:
# Caching → Configuration → Purge Everything

# または API:
curl -X POST "https://api.cloudflare.com/client/v4/zones/{ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer {API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything":true}'
```

---

## Cloudflare に関する注意事項

### HTTPS リダイレクトはサーバー側でやらない

Cloudflare Edge が HTTPS を強制しているため、Express 側で HTTP→HTTPS リダイレクトを行うと**リダイレクトループ**が発生する。

```
[NG] サーバー側で 301 リダイレクト
  → Cloudflare が HTTP でバックエンドに転送
  → サーバーが HTTPS にリダイレクト
  → Cloudflare が再び HTTP で転送
  → 無限ループ
```

現在の正しい実装:

```js
// X-Forwarded-Proto を正しく設定するだけ（リダイレクトはしない）
app.use((req, _res, next) => {
  if (req.headers['cf-connecting-ip']) {
    req.headers['x-forwarded-proto'] = 'https';
  }
  next();
});
```

### 301 レスポンスは Cloudflare にキャッシュされる

- `301 Moved Permanently` は CDN にキャッシュされる（デフォルト4時間）。
- 誤った 301 を返してしまった場合、**コード修正だけでは直らない**。Cloudflare のキャッシュパージが必要。
- やむを得ずリダイレクトが必要な場合は `302`（一時的）を使うこと。

### キャッシュパージの確認方法

```bash
# キャッシュ状態を確認（cf-cache-status ヘッダー）
curl -sI "https://tangosns.kouta2133.work/app.js" | grep -i "cf-cache-status"

# HIT  = キャッシュから配信されている
# MISS = オリジンから取得した（パージ成功）
# DYNAMIC = キャッシュ対象外

# キャッシュをバイパスしてオリジンの応答を確認
curl -sI "https://tangosns.kouta2133.work/app.js?_=$(date +%s)"
```

---

## OGP (Open Graph Protocol)

### 仕組み

SPA（ハッシュルーティング）ではSNSクローラーが動的コンテンツを取得できないため、サーバーサイドで動的OGPを生成している。

| URL | 処理 |
|-----|------|
| `/#/wordbook/123` | SPA内部ルート（クローラーはハッシュ以降を無視） |
| `/wordbook/123` | サーバーが動的OGP付きHTMLを返す |

### 共有リンクのフロー

```
SNSクローラー → /wordbook/123 → サーバーがDBからタイトル・説明を取得 → OGP付きHTML返却
実ユーザー   → /wordbook/123 → HTML受信 → app.js がハッシュルートに変換 → SPA描画
```

### キャッシュ

- サーバー内にインメモリキャッシュ（5分TTL、最大500件）を保持。
- 単語帳のタイトルや説明を変更した場合、最大5分で反映される。

---

## 障害記録

### 2026-02-26: 全ページ白画面（リダイレクトループ）

**症状**: デプロイ後、全ページが白画面。ブラウザコンソールに `app.js の読み込みに失敗しました` エラー。

**原因**:
1. 旧コードの HTTP→HTTPS `301` リダイレクトミドルウェアが、Cloudflare Tunnel 環境で無限ループを引き起こしていた
2. Cloudflare CDN が `301` レスポンスをキャッシュ（`max-age: 14400`）
3. コードを修正してデプロイしても、CDN が古い `301` を返し続けた

**対処**:
1. リダイレクトミドルウェアを `X-Forwarded-Proto` 設定に変更
2. Cloudflare Dashboard から **Purge Everything** を実行
3. `curl -sI` でキャッシュ状態（`cf-cache-status`）を確認して解消を確認

**教訓**:
- Cloudflare 背後でサーバー側 HTTPS リダイレクトは不要（エッジが処理する）
- `301` は CDN・ブラウザ両方にキャッシュされるため、安易に使わない
- デプロイ後は必ず Cloudflare キャッシュをパージする
- `curl -sI` で実際のレスポンスヘッダーを確認する習慣をつける

---

## トラブルシューティング

| 症状 | 確認すること |
|------|-------------|
| 白画面 | `curl -sI https://domain/app.js` でステータスコードと `cf-cache-status` を確認 |
| リダイレクトループ | サーバー側で 301/302 リダイレクトを返していないか確認 |
| OGPが反映されない | `/wordbook/:id` に直接アクセスしてHTMLソースのメタタグを確認 |
| デプロイが反映されない | Pod が再起動しているか（`kubectl rollout status`）、CDN キャッシュが残っていないか |
| DB接続エラー | ConfigMap/Secret の `PGHOST`/`PGPASSWORD` を確認 |

```bash
# Pod のステータス確認
kubectl get pods -n tangosns

# Pod のログ確認
kubectl logs -n tangosns deployment/tangosns-app --tail=50

# Pod の再起動
kubectl rollout restart deployment tangosns-app -n tangosns
```

---

[ホームへ戻る](./README.md)
