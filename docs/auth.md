# ユーザー認証とプロフィール管理の詳細

TangoSNSは、JWT（JSON Web Token）を使用したステートレスな認証システムを採用しています。

## ログイン・ユーザー登録フロー

### バックエンド (`src/routes/auth.js`)
- **ユーザー登録 (`/api/auth/register`)**:
  - `bcryptjs` を使用してパスワードをソルト付きハッシュ化（ストレングス10）。
  - PostgreSQLの `users` テーブルに保存。
  - 成功時にJWTを発行し、ユーザー情報とトークンを返却。
- **ログイン (`/api/auth/login`)**:
  - ユーザー名でDBを検索し、`bcrypt.compare` でパスワードを検証。
  - 正当な場合にJWT（有効期限7日間）を発行。

### フロントエンド (`public/app.js`)
- `renderLogin`, `renderRegister` 関数でフォームを表示し、APIを叩く。
- 取得したトークンを `localStorage.setItem('token', ...)` で保存。
- 以降のAPIリクエストでは、`fetchAPI` ラッパーが自動的に `Authorization: Bearer <token>` ヘッダーを付与する。

## 認証ミドルウェア (`src/middleware/auth.js`)

`authenticate` ミドルウェアが、保護されたルートへのアクセスを制御します。
- `req.headers.authorization` からトークンを抽出。
- `jwt.verify` で署名を検証し、デコードされたユーザー情報を `req.user` にセット。
- トークンが無効または欠落している場合は 401 Unauthorized を返す。

## プロフィール編集 (`src/routes/users.js`)

ユーザーは自身のプロフィール（ユーザー名、パスワード）を更新できます。
- パスワード変更時は、セキュリティのため現在のパスワードの再検証を必須としています。
- 更新後、フロントエンドは `localStorage` のユーザー情報を同期します。
