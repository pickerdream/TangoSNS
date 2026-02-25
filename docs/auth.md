# ユーザー認証とプロフィール管理の詳細

TangoSNSは、JWT（JSON Web Token）を使用したステートレスな認証システムを採用しています。パスワード認証に加え、Googleアカウントによるログインにも対応しています。

## アカウントID（ハンドル）と表示名

TangoSNSでは、ユーザー識別に2つの名前を使用します。

| 項目 | カラム | 制約 | 用途 |
|------|--------|------|------|
| アカウントID | `username` | 半角英数字・アンダースコアのみ、30文字以内、一意 | URL・@メンション・ログイン |
| 表示名 | `display_name` | 任意の文字（日本語OK）、50文字以内、必須 | UI上の表示名 |

### 表示の使い分け

- **プロフィール名・作者名・コメント投稿者名**: `display_name` を表示
- **ハンドル（@名）**: `@username` を表示
- **URL・ナビゲーション**: `username` を使用
- **アバターの代替文字**: `display_name` の頭文字を使用
- **ログイン**: `username` で認証

### マイグレーション

`1772000000009_add-display-name.js` で `display_name` カラムを追加しました。

- 既存ユーザーの `display_name` には `username` の値をコピー
- 非ASCII文字を含む既存の `username` は `user_<id>` に自動変換

---

## ログイン・ユーザー登録フロー

### パスワード認証

#### バックエンド (`src/routes/auth.js`)
- **ユーザー登録 (`POST /api/auth/register`)**:
  - `username`（アカウントID）、`display_name`（表示名）、`password` を受け取る
  - `username` は半角英数字・アンダースコアのみ許可（`/^[a-zA-Z0-9_]+$/`）
  - `display_name` 未指定時は `username` を代用
  - `bcryptjs` を使用してパスワードをソルト付きハッシュ化（ストレングス10）
  - 成功時にJWT（有効期限7日間）を発行し、ユーザー情報とトークンを返却
- **ログイン (`POST /api/auth/login`)**:
  - `username` でDBを検索し、`bcrypt.compare` でパスワードを検証
  - パスワード未設定（Googleのみ）のユーザーは401を返す
  - BAN済みユーザーは403を返す
  - 正当な場合にJWT（有効期限7日間）を発行

#### フロントエンド (`public/app.js`)
- `renderLogin`, `renderRegister` 関数でフォームを表示し、APIを叩く
- 登録フォームには「表示名」と「アカウントID（英数字）」の2つのフィールドがある
- 取得したトークンを `localStorage.setItem('token', ...)` で保存
- 以降のAPIリクエストでは、`fetchAPI` ラッパーが自動的に `Authorization: Bearer <token>` ヘッダーを付与する

---

## Google認証

### 概要

Google Identity Services (GSI) を使用したクライアントサイド認証を採用しています。サーバーサイドリダイレクト方式ではなく、フロントエンドでGoogleのポップアップを表示し、取得したIDトークンをサーバーで検証する方式です。

### 前提条件

1. [Google Cloud Console](https://console.cloud.google.com/) でOAuth 2.0クライアントIDを作成
2. 「承認済みのJavaScriptオリジン」にサーバーのURLを追加（例: `http://localhost:3000`）
3. `.env` に `GOOGLE_CLIENT_ID` を設定

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
```

`GOOGLE_CLIENT_ID` が未設定の場合、Google認証関連のUI要素は自動的に非表示になります。サーバーは正常に起動し、パスワード認証のみで動作します。

### 認証フロー

```
1. ブラウザ: GSI ライブラリ読み込み (index.html の <script> タグ)
2. ブラウザ: google.accounts.id.initialize() でGSI初期化
3. ユーザー: 「Googleでログイン」ボタンをクリック
4. Google: ポップアップ表示 → ユーザーがアカウント選択
5. Google: IDトークン (credential) をコールバックに返却
6. ブラウザ: POST /api/auth/google に credential を送信
7. サーバー: google-auth-library で IDトークンを検証
8. サーバー: google_id で既存ユーザーを検索
   - 既存 → ログイン処理
   - 新規 → ユーザー自動作成（display_name = Google名, username = 英数字化したGoogle名）
9. サーバー: JWT を発行してレスポンス
```

### GSI 初期化の注意点

`google.accounts.id.initialize()` はページ内で **1回だけ** 呼び出す必要があります。複数回呼び出すとGSIの内部状態が壊れ、認証が動作しなくなります。

TangoSNSでは、ディスパッチャーパターンで1つの `initialize()` を共有しています:

```javascript
let _googleCallbackMode = 'login'; // 'login' or 'link'

function _googleDispatchCallback(response) {
  if (_googleCallbackMode === 'link') {
    handleGoogleLinkCredential(response);
  } else {
    handleGoogleCredential(response);
  }
}
```

- ログイン/登録ページ: `_googleCallbackMode = 'login'` → `handleGoogleCredential` が処理
- 設定ページ（連携）: `_googleCallbackMode = 'link'` → `handleGoogleLinkCredential` が処理

### APIエンドポイント

#### `GET /api/auth/config`
フロントエンドで必要な認証設定を返します。

```json
{ "googleClientId": "xxxx.apps.googleusercontent.com" }
```

`GOOGLE_CLIENT_ID` が未設定の場合は `null` を返し、フロントエンドはGoogleボタンを非表示にします。

#### `POST /api/auth/google`
Googleログイン / 新規登録を処理します。

- **リクエスト**: `{ "credential": "<Google IDトークン>" }`
- **処理**:
  1. `google-auth-library` の `OAuth2Client.verifyIdToken()` でトークンを検証
  2. `google_id` (GoogleのSUB値) で既存ユーザーを検索
  3. 新規ユーザーの場合:
     - `display_name`: Googleアカウントの名前（50文字まで）
     - `username`: Google名から非英数字を除去（重複時は `_<乱数>` を付与）
     - `password`: NULL（パスワード未設定）
  4. BAN済みユーザーは403を返す
  5. JWT（有効期限7日間）を発行

#### `POST /api/auth/google/link`
既存アカウントにGoogleアカウントを連携します。認証必須。

- 既に他のアカウントに紐づいたGoogleアカウントは連携不可（409）
- 既にGoogle連携済みのアカウントは再連携不可（409）

#### `DELETE /api/auth/google/link`
Googleアカウントの連携を解除します。認証必須。

- **パスワード未設定のユーザーは解除不可**（ログイン手段がなくなるため、400を返す）
- 先にパスワードを設定してから解除する必要がある

### DB スキーマ

`1772000000008_add-google-oauth.js` で以下を変更:

- `users` テーブルに `google_id VARCHAR(255) UNIQUE` カラムを追加
- `password` カラムを `NOT NULL` から `NULL許可` に変更（Googleのみユーザー対応）

---

## 認証ミドルウェア (`src/middleware/auth.js`)

`authenticate` ミドルウェアが、保護されたルートへのアクセスを制御します。
- `req.headers.authorization` からトークンを抽出
- `jwt.verify` で署名を検証し、デコードされたユーザー情報を `req.user` にセット
- トークンが無効または欠落している場合は 401 Unauthorized を返す

### JWT_SECRET の必須設定

`JWT_SECRET` 環境変数が未設定の場合、**サーバーは起動時に即座に終了**します。

```
[FATAL] JWT_SECRET 環境変数が設定されていません。サーバーを終了します。
```

`.env` に必ず設定してください（詳細は [データベースセットアップ](./database-setup.md) を参照）。

---

## 入力バリデーション（サーバー側）

ユーザー登録・ログイン・プロフィール更新時に以下のバリデーションが適用されます。

| フィールド | 制限 | 備考 |
|-----------|------|------|
| アカウントID (`username`) | 1〜30文字、`/^[a-zA-Z0-9_]+$/` | 半角英数字とアンダースコアのみ |
| 表示名 (`display_name`) | 1〜50文字 | 任意の文字使用可 |
| パスワード | 6〜128文字 | Google認証のみの場合は未設定可 |

フロントエンドのバリデーションに依存せず、API への直接呼び出しに対してもサーバー側で検証します。

---

## プロフィール編集 (`src/routes/users.js`)

### `GET /api/users/me`
自分のプロフィールを取得します。以下のフィールドを返します:

| フィールド | 説明 |
|-----------|------|
| `has_password` | パスワードが設定済みか（`true`/`false`） |
| `has_google` | Googleアカウントが連携済みか（`true`/`false`） |
| `display_name` | 表示名 |
| `username` | アカウントID |

### `PUT /api/users/me`
プロフィールを更新します。更新可能なフィールド:

- `username` (アカウントID): 英数字・アンダースコアのみ、重複不可
- `display_name` (表示名): 任意の文字、1〜50文字
- `avatar_url`, `bio`, `theme`
- `newPassword` (パスワード変更):
  - パスワード設定済みの場合: `currentPassword` が必須
  - パスワード未設定（Googleのみユーザー）: `currentPassword` 不要で新規設定可能

---

[ホームへ戻る](./README.md)
