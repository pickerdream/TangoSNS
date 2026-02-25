# サーバーセットアップ

TangoSNS サーバーを起動するまでの手順を説明します。

---

## 前提条件

- Node.js 20 以上
- npm
- PostgreSQL 12 以上（→ [データベースセットアップ](./database-setup.md)）

---

## 手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

プロジェクトルートに `.env` ファイルを作成します（`.env.example` をコピーして編集）。

```env
# データベース接続（詳細は database-setup.md を参照）
PGUSER=tangosns_user
PGHOST=localhost
PGDATABASE=tangosns
PGPASSWORD=your_password
PGPORT=5432

# JWT 秘密鍵（必須・未設定時はサーバーが起動しません）
JWT_SECRET=your_super_secret_key_here

# Google認証（省略可・未設定時はパスワード認証のみ）
GOOGLE_CLIENT_ID=your_google_client_id_here

# サーバーポート（省略時: 3000）
PORT=3000
```

#### JWT_SECRET の生成

最低32文字以上のランダムな文字列を設定してください:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### GOOGLE_CLIENT_ID の設定（任意）

Googleアカウントでのログイン機能を有効にする場合に設定します。未設定でもサーバーは正常に動作し、パスワード認証のみで利用できます。

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「認証情報」→「OAuth 2.0 クライアントID」を作成
3. アプリケーションの種類: 「ウェブ アプリケーション」
4. 「承認済みのJavaScriptオリジン」にサーバーのURLを追加（例: `http://localhost:3000`）
5. 作成されたクライアントIDを `.env` の `GOOGLE_CLIENT_ID` に設定

詳細は [ユーザー認証](./auth.md) を参照してください。

### 3. サーバーの起動

```bash
npm start
```

起動時に未適用のマイグレーションが**自動で実行**されてからサーバーが立ち上がります（オートマイグレーション）。

```
マイグレーション実行中...
マイグレーション完了
🚀 サーバー起動中: http://localhost:3000
```

2回目以降の起動では、適用済みのマイグレーションはスキップされて即座に起動します。

---

## 動作確認

ブラウザで `http://localhost:3000` にアクセスし、ログイン画面が表示されることを確認します。

---

## トラブルシューティング

| 症状 | 確認事項 |
|------|---------|
| `JWT_SECRET 環境変数が設定されていません` | `.env` に `JWT_SECRET` を設定する |
| Googleログインボタンが表示されない | `.env` に `GOOGLE_CLIENT_ID` を設定する（→ [認証](./auth.md)） |
| `マイグレーション失敗` | `.env` のDB接続情報と PostgreSQL の起動状態を確認する（→ [データベースセットアップ](./database-setup.md)） |
| ポート競合 (`EADDRINUSE`) | `.env` の `PORT` を変更するか、使用中のプロセスを停止する |
| `Cannot find module` | `npm install` を再実行する |

---

## 本番環境での注意

- `JWT_SECRET` は環境ごとに異なるランダム値を設定してください
- `.env` ファイルは `.gitignore` に追加してリポジトリに含めないようにしてください
- データベースのパスワードは強力なものを設定してください
- 必要に応じて PostgreSQL の SSL 接続を有効にしてください

---

[ホームへ戻る](./README.md)
