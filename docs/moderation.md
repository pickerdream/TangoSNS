# モデレーション

このドキュメントでは、TangoSNSのモデレーション機能について説明します。

## モデレーターの役割

モデレーター（管理者）は以下の権限を持ちます：

- ユーザー管理（警告送信、BAN/UNBAN）
- システム統計の閲覧
- コンテンツの監視

## モデレーター権限の付与

### SQLでの権限付与

ユーザーをモデレーターにするには、以下のSQLを実行します：

```sql
UPDATE users SET is_admin = true WHERE id = [ユーザーID];
```

例：
```sql
UPDATE users SET is_admin = true WHERE username = 'moderator_user';
```

権限を剥奪するには：
```sql
UPDATE users SET is_admin = false WHERE id = [ユーザーID];
```

### 注意点

- 自分自身をBANすることはできません
- 他の管理者をBANすることはできません
- 管理者権限は慎重に付与してください

## 実装されている機能

### 1. 管理者ダッシュボード

- `/api/admin/stats`: システム統計（総ユーザー数、BANユーザー数、単語帳数、警告数）
- `/api/admin/users`: ユーザー一覧（IPアドレス、BAN状態、警告数を含む）

### 2. ユーザー管理

- `POST /api/admin/users/:id/warn`: 警告送信
  - user_warningsテーブルに記録
  - 通知としてユーザーに送信（type: 'warning'）
- `POST /api/admin/users/:id/ban`: ユーザーBAN
- `POST /api/admin/users/:id/unban`: BAN解除

### 3. 警告システム

- 警告はuser_warningsテーブルに記録
- 警告通知は確認されるまで通知一覧に固定表示
- 警告履歴は`/api/admin/users/:id/warnings`で閲覧可能

### 4. 通知システム

- 警告通知は特別扱いされ、赤く強調表示
- 確認ダイアログで既読化

### 5. IPアクティビティログ

登録・ログインのたびに接続元のIPアドレス、ポート番号、User-Agentを `user_ip_logs` テーブルに記録します。

#### 記録タイミング

| アクション | エンドポイント | 記録内容 |
|-----------|--------------|---------|
| ユーザー登録 | `POST /api/auth/register` | ip_address, port, action='register', user_agent |
| ログイン | `POST /api/auth/login` | ip_address, port, action='login', user_agent |

#### ポート番号の取得方法

```javascript
// src/routes/auth.js
const ip   = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
             || req.socket?.remoteAddress || null;
const port = req.socket?.remotePort || null;  // クライアントの送信元ポート
```

`port` はベストエフォートで取得します。プロキシ経由の場合などは `null` になることがあります。

#### 管理画面での表示

「IPアクティビティ」モーダルでは、ポートが記録されている場合にIPアドレスの右に `:ポート番号` を小さく表示します。

```
192.168.1.1 :54321
```

ポートが `null`（記録なし）の場合は何も表示しません。旧ログとの互換性は維持されます。

#### APIエンドポイント

- `GET /api/admin/users/:id/ip-logs` — ユーザーのIPログを最新50件取得（`port` フィールドを含む）
- `GET /api/admin/ip/:ip/users` — 同一IPから操作したユーザー一覧を取得

## データベース構造

### usersテーブル
- `is_admin`: boolean - 管理者フラグ
- `is_banned`: boolean - BANフラグ
- `ban_reason`: text - BAN理由

### user_warningsテーブル
- `user_id`: integer - 警告対象ユーザー
- `admin_id`: integer - 警告実行管理者
- `reason`: text - 警告理由
- `created_at`: timestamp - 警告日時

### user_ip_logsテーブル
- `user_id`: integer - ログ対象ユーザー
- `ip_address`: varchar(45) - 接続元IPアドレス（IPv6対応）
- `port`: integer - 接続元ポート番号（null可）
- `action`: varchar(20) - `'register'` または `'login'`
- `user_agent`: text - ブラウザ情報
- `created_at`: timestamp - 記録日時

### notificationsテーブル
- `type`: varchar(20) - 通知タイプ（'warning', 'comment'など）
- `user_id`: integer - 通知対象ユーザー
- `message`: text - 通知メッセージ
- `link`: text - リンク先
- `is_read`: boolean - 既読フラグ

## セキュリティ考慮

- 管理者権限はJWTトークンで検証
- 管理者専用エンドポイントは`requireAdmin`ミドルウェアで保護
- ログはuser_ip_logsテーブルに記録

## 運用ガイドライン

1. 警告は軽微な違反に対して使用
2. BANは重大な違反に対して使用
3. 常に理由を明記
4. 定期的に警告履歴を確認</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\moderation.md