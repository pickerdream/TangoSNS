# データベースセットアップ

TangoSNS が使用する PostgreSQL の準備手順を説明します。

サーバー全体のセットアップ（Node.js のインストール、依存関係、起動方法）は [サーバーセットアップ](./setup.md) を参照してください。

---

## 前提条件

- PostgreSQL 12 以上

---

## PostgreSQL のインストール

### Windows

1. [PostgreSQL 公式サイト](https://www.postgresql.org/download/windows/) からインストーラーをダウンロード
2. インストール時の設定:
   - ポート: `5432`（デフォルト）
   - パスワード: 任意（後で `.env` に設定）
   - その他はデフォルトでOK

### macOS

```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## データベースとユーザーの作成

```bash
psql -U postgres
```

```sql
-- データベース作成
CREATE DATABASE tangosns;

-- ユーザー作成
CREATE USER tangosns_user WITH PASSWORD 'your_password';

-- 権限付与
GRANT ALL PRIVILEGES ON DATABASE tangosns TO tangosns_user;

\q
```

pgAdmin を使用する場合は「Databases → Create → Database」からデータベース名 `tangosns` で作成してください。

---

## 環境変数（DB関連）

プロジェクトルートの `.env` にデータベース接続情報を設定します。

```env
PGUSER=tangosns_user
PGHOST=localhost
PGDATABASE=tangosns
PGPASSWORD=your_password
PGPORT=5432
```

JWT_SECRET や PORT などのサーバー設定は [サーバーセットアップ](./setup.md) を参照してください。

---

## マイグレーション

マイグレーションはサーバー起動時に **自動で実行**されます。`npm start` を実行するだけでスキーマが最新状態になります。

手動で実行したい場合（CI/CD など）:

```bash
npm run migrate
```

マイグレーションの仕組みや追加方法は [マイグレーションガイド](./migrations.md) を参照してください。

---

## 接続確認

```bash
node check-db.js
```

成功すると以下のように表示されます:

```
データベースへの接続に成功しました。
テーブル一覧:
- pgmigrations
- users
- wordbooks
- words
...
```

---

## 初期データの投入（任意）

### 管理者ユーザーの作成

アプリ経由で登録したユーザーを管理者に昇格させます:

```sql
psql -U tangosns_user -d tangosns

UPDATE users SET is_admin = true WHERE username = 'your_username';
```

パスワード付きで直接INSERTする場合、パスワードは bcrypt ハッシュが必要です:

```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your_password', 10));
```

### サンプルデータ

```sql
INSERT INTO wordbooks (user_id, title, description, created_at)
VALUES (1, 'TOEIC基本単語', 'TOEIC試験でよく出る基本単語集', CURRENT_TIMESTAMP);

INSERT INTO words (wordbook_id, word, meaning, created_at)
VALUES (1, 'apple', 'りんご', CURRENT_TIMESTAMP);
```

---

## トラブルシューティング

| 症状 | 確認事項 |
|------|---------|
| 接続エラー | `.env` の `PGHOST` / `PGPORT` / `PGUSER` / `PGPASSWORD` が正しいか確認 |
| データベースが存在しない | `CREATE DATABASE` が実行済みか確認 |
| 権限エラー | `GRANT ALL PRIVILEGES` が実行済みか確認 |
| PostgreSQL が起動していない | `brew services start postgresql` / `systemctl start postgresql` で起動 |

### マイグレーションのロールバック

```bash
# 最新1件をロールバック
npx node-pg-migrate down

# N件ロールバック
npx node-pg-migrate down N
```

---

[ホームへ戻る](./README.md)
