# データベース・マイグレーションの詳細

TangoSNSでは、スキーマ管理に `node-pg-migrate` を使用しています。

## ファイルの命名規則

マイグレーションファイルは `migrations/` ディレクトリに配置され、以下の命名規則に従います。

`[UNIXタイムスタンプ]_[変更内容の概要].js`

例: `1771738551846_create-users-table.js`

このタイムスタンプにより、適用順序が一意に決定されます。

## マイグレーションの記述方法

各ファイルは `up` （適用時）と `down` （ロールバック時）の関数をエクスポートします。これらの関数は `pgm` (MigrationBuilder) オブジェクトを受け取り、それを通じてSQL操作を定義します。

### 基本的なテンプレート

```javascript
exports.up = (pgm) => {
  // テーブル作成、カラム追加などの処理
};

exports.down = (pgm) => {
  // upの内容を打ち消す処理（テーブル削除、カラム削除など）
};
```

### よく使われる操作

#### テーブルの作成 (`createTable`)
```javascript
pgm.createTable('users', {
  id: 'id', // シリアルIDのエイリアス
  username: { type: 'varchar(100)', notNull: true, unique: true },
  created_at: {
    type: 'timestamp',
    notNull: true,
    default: pgm.func('current_timestamp'),
  },
});
```

#### カラムの追加 (`addColumn`)
```javascript
pgm.addColumn('users', {
  avatar_url: { type: 'text' }
});
```

#### インデックスの作成 (`createIndex`)
```javascript
pgm.createIndex('comments', 'wordbook_id');
```

## マイグレーションの実行

`package.json` に設定されたスクリプトを使用して実行します。

```bash
npm run migrate
```

内部的には `dotenv -- node-pg-migrate up` が実行され、環境変数 `.env` を読み込んだ上で未適用のマイグレーションが順次適用されます。
