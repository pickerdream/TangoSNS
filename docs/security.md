# セキュリティ対策

TangoSNS で実施しているセキュリティ対策と、各脆弱性に対する実装方針をまとめます。

---

## XSS（クロスサイトスクリプティング）対策

### escapeHtml 関数

`public/app.js` の先頭で定義し、ユーザー入力をすべてHTMLエスケープしてから `innerHTML` に埋め込みます。

```javascript
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**適用対象フィールド（全箇所）:**

| データ | 変数 |
|--------|------|
| 単語帳タイトル | `wb.title` |
| 単語帳説明 | `wb.description` |
| 作成者表示名 | `wb.display_name` |
| 作成者ユーザー名 | `wb.username` |
| 作成者の自己紹介 | `wb.bio` |
| 単語 | `w.word` |
| 意味 | `w.meaning` |
| コメント | `c.comment` |
| コメント投稿者名 | `c.username` |
| 通知メッセージ | `n.message` |
| プロフィール表示名・bio | `user.display_name`, `user.bio` |
| 通報理由（管理者画面） | `r.reason` |
| 管理者画面ユーザー名 | `u.username` |

### onclick ハンドラ内のユーザー名

onclick 属性内のユーザー名も `escapeHtml()` でエスケープします。HTMLアトリビュートはブラウザがデコードしてからJSに渡すため、`&#039;` → `'` となり、JS文字列として正しく機能します。

```javascript
// NG: ユーザー名にシングルクォートが含まれるとJSコードとして解釈される
onclick="viewFollowers(${user.id}, '${user.username}')"

// OK: escapeHtml でシングルクォートを &#039; に変換
onclick="viewFollowers(${user.id}, '${escapeHtml(user.username)}')"
```

### safeAvatarUrl 関数

`<img src="...">` に `javascript:` プロトコルが埋め込まれることを防ぎます。

```javascript
function safeAvatarUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : null;
  } catch { return null; }
}
```

`http:` / `https:` 以外のURLは `null` を返し、代わりにユーザー名の頭文字を表示します。

---

## JWT 秘密鍵の管理

### 必須環境変数

`src/middleware/auth.js` で `JWT_SECRET` 環境変数が設定されていない場合、**サーバーが起動時に終了**します。

```javascript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 環境変数が設定されていません。サーバーを終了します。');
  process.exit(1);
}
```

**設定方法:** プロジェクトルートの `.env` ファイルに設定します。

```env
JWT_SECRET=（最低32文字以上のランダムな文字列）
```

ランダム文字列の生成例:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### JWT の保存場所

現在、フロントエンドは JWT を `localStorage` に保存しています。XSS が発生した場合にトークンが盗まれるリスクがあります。より安全な実装は `httpOnly` Cookie への移行ですが、現時点では XSS 対策（escapeHtml の適用）で攻撃面を最小化しています。

---

## 入力バリデーション（サーバー側）

### 各フィールドの制限値

| フィールド | 最小 | 最大 | ファイル |
|-----------|------|------|---------|
| アカウントID (`username`) | 1文字 | 30文字 | `src/routes/auth.js` |
| 表示名 (`display_name`) | 1文字 | 50文字 | `src/routes/auth.js` |
| パスワード | 6文字 | 128文字 | `src/routes/auth.js` |
| 単語帳タイトル | 1文字 | 100文字 | `src/routes/wordbooks.js` |
| 単語帳説明 | 0文字 | 1000文字 | `src/routes/wordbooks.js` |
| 単語 | 1文字 | 200文字 | `src/routes/words.js` |
| 意味 | 1文字 | 500文字 | `src/routes/words.js` |
| コメント | 1文字 | 1000文字 | `src/routes/comments.js` |

---

## BAN情報の非漏洩

ログイン時に BAN されたユーザーに対して返すエラーメッセージから、BAN 理由を除外しています。

```javascript
// NG: BAN理由が外部に漏れる
return res.status(403).json({ error: 'このアカウントはBANされています。理由: ' + user.ban_reason });

// OK: 汎用メッセージのみ返す
return res.status(403).json({ error: 'このアカウントは利用停止されています。詳細はお問い合わせください。' });
```

BAN 理由は管理者画面でのみ確認できます。

---

## Notifications ルート定義順序

Express では `/read-all` よりも `/:id/read` を先に定義すると、`/read-all` の `read-all` が `:id` パラメータにマッチしてしまいます。`/read-all` を先に定義することで正しくルーティングされます。

```javascript
// OK: 具体的なパスを先に定義
router.put('/read-all', ...);   // 先
router.put('/:id/read', ...);   // 後
```

---

## SQLインジェクション

**問題なし。** 全クエリでプレースホルダ（`$1, $2` 形式）を使用したパラメータ化クエリを実装しています。文字列結合によるクエリ構築は行っていません。

---

## Google認証のセキュリティ

### IDトークンの検証

Google認証では、フロントエンドから送信されたIDトークンをサーバー側で `google-auth-library` を使って検証しています。クライアントの自己申告を信用せず、Googleの公開鍵で署名を検証し、`audience` がサーバーの `GOOGLE_CLIENT_ID` と一致することを確認します。

### パスワード未設定ユーザーの保護

Googleのみで登録したユーザーは `password = NULL` です。パスワードログイン時に `bcrypt.compare(password, null)` が実行されないよう、NULLチェックを行い401を返します。

### Google連携解除の安全策

パスワード未設定のユーザーがGoogle連携を解除するとログイン手段がなくなるため、連携解除前にパスワード設定を必須としています。

---

## 既知の制限事項（未対応）

| 項目 | 現状 | より安全な実装 |
|------|------|--------------|
| JWTの保存場所 | `localStorage` | `httpOnly` Cookie |
| CSRF対策 | なし | CSRFトークン or `SameSite=Strict` Cookie |

---

[ホームへ戻る](./README.md)
