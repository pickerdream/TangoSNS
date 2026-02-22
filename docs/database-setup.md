# データベースセットアップガイド

このドキュメントでは、TangoSNSの初回データベース作成とマイグレーションの手順について説明します。

## 前提条件

- Node.js 18以上
- PostgreSQL 12以上
- npmまたはyarn

## PostgreSQLのインストール

### Windowsの場合
1. [PostgreSQL公式サイト](https://www.postgresql.org/download/windows/)からインストーラーをダウンロード
2. インストーラーを実行し、以下の設定でインストール：
   - ポート: 5432 (デフォルト)
   - パスワード: 任意（後で.envに設定）
   - その他の設定はデフォルトでOK

### macOSの場合
```bash
brew install postgresql
brew services start postgresql
```

### Linux (Ubuntu/Debian)の場合
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## データベースの作成

PostgreSQLに接続してデータベースを作成します。

### コマンドラインから作成
```bash
# PostgreSQLに接続（パスワードを入力）
psql -U postgres

# データベース作成
CREATE DATABASE tangosns;

# ユーザー作成（任意）
CREATE USER tangosns_user WITH PASSWORD 'your_password';

# 権限付与
GRANT ALL PRIVILEGES ON DATABASE tangosns TO tangosns_user;

# 終了
\q
```

### pgAdminを使用する場合
1. pgAdminを起動
2. サーバーに接続
3. Databasesを右クリック → Create → Database
4. Database name: `tangosns`
5. Owner: `postgres` または作成したユーザー

## 環境変数の設定

プロジェクトルートに`.env`ファイルを作成し、データベース接続情報を設定します。

```env
# データベース設定
DATABASE_URL=postgresql://username:password@localhost:5432/tangosns

# JWT設定
JWT_SECRET=your_super_secret_jwt_key_here

# サーバーポート
PORT=3000
```

### 設定値の説明
- `DATABASE_URL`: PostgreSQL接続文字列
  - 形式: `postgresql://[ユーザー名]:[パスワード]@[ホスト]:[ポート]/[データベース名]`
  - 例: `postgresql://postgres:mypassword@localhost:5432/tangosns`
- `JWT_SECRET`: JWTトークン署名用の秘密鍵（ランダムな文字列を推奨）
- `PORT`: サーバーがリッスンするポート番号（デフォルト: 3000）

## 依存関係のインストール

```bash
npm install
```

## マイグレーションの実行

データベーススキーマを作成するためにマイグレーションを実行します。

```bash
# マイグレーション実行
npm run migrate

# または直接実行
npx node-pg-migrate up
```

### マイグレーションの実行結果例
```
> dotenv -- node-pg-migrate up
[dotenv@17.3.1] injecting env (5) from .env
### MIGRATION 1771738551846_create-users-table (UP) ###
CREATE TABLE
ALTER TABLE
INSERT 0 1
### MIGRATION 1771738607333_create-wordbooks-words-comments-tables (UP) ###
CREATE TABLE
...
```

## 初期データの投入（任意）

### 管理者ユーザーの作成

開発・テスト用に管理者ユーザーを作成できます。

```sql
-- PostgreSQLに接続
psql -U postgres -d tangosns

-- 管理者ユーザー作成
INSERT INTO users (username, password, is_admin, created_at)
VALUES ('admin', '$2a$10$...', true, CURRENT_TIMESTAMP);
```

パスワードはbcryptでハッシュ化する必要があります。以下のNode.jsスクリプトで生成できます：

```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('admin_password', 10));
```

### サンプルデータの投入

開発用にサンプル単語帳を作成する場合：

```sql
-- サンプルユーザー作成
INSERT INTO users (username, password, created_at)
VALUES ('testuser', '$2a$10$...', CURRENT_TIMESTAMP);

-- サンプル単語帳作成
INSERT INTO wordbooks (user_id, title, description, created_at)
VALUES (1, 'TOEIC基本単語', 'TOEIC試験でよく出る基本単語集', CURRENT_TIMESTAMP);

-- サンプル単語追加
INSERT INTO words (wordbook_id, word, meaning, created_at)
VALUES (1, 'apple', 'りんご', CURRENT_TIMESTAMP);
```

## 動作確認

### データベース接続確認
```bash
node check-db.js
```

成功すると以下のように表示されます：
```
データベースへの接続に成功しました。
テーブル一覧:
- pgmigrations
- users
- wordbooks
- words
- comments
...
```

### サーバー起動確認
```bash
npm start
```

ブラウザで `http://localhost:3000` にアクセスし、ログイン画面が表示されることを確認します。

## トラブルシューティング

### マイグレーションエラー
- `.env`ファイルのDATABASE_URLが正しいか確認
- PostgreSQLが起動しているか確認
- データベースが存在するか確認

### 接続エラー
- PostgreSQLのポート（デフォルト5432）が開放されているか確認
- ファイアウォール設定を確認
- ユーザー名/パスワードが正しいか確認

### マイグレーションのロールバック
```bash
# 最新のマイグレーションをロールバック
npx node-pg-migrate down

# 全てのマイグレーションをロールバック
npx node-pg-migrate down [マイグレーション数]
```

## マイグレーションの追加

新しいスキーマ変更が必要な場合は、[マイグレーションガイド](./migrations.md)を参照してください。

## 本番環境での注意

- パスワードは強力なものを設定
- JWT_SECRETは環境ごとに異なるものを設定
- データベースバックアップを定期的に実行
- SSL接続を有効化</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\database-setup.md