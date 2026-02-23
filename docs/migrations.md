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

### 手動実行

`package.json` に設定されたスクリプトを使用して実行します。

```bash
npm run migrate
```

内部的には `dotenv -- node-pg-migrate up` が実行され、環境変数 `.env` を読み込んだ上で未適用のマイグレーションが順次適用されます。

### オートマイグレーション（サーバー起動時の自動実行）

`npm start` でサーバーを起動すると、**リクエストを受け付ける前に**未適用のマイグレーションが自動で実行されます。

#### 仕組み

`src/migrate.js` に定義された `runMigrations()` 関数が、`node-pg-migrate` のプログラマティックAPIを呼び出します。

```javascript
// src/migrate.js
const { runner } = await import('node-pg-migrate');

await runner({
  databaseUrl,        // 環境変数から構築した接続URL
  dir: '…/migrations', // マイグレーションディレクトリ
  direction: 'up',
  migrationsTable: 'pgmigrations',
  count: Infinity,    // 未適用のものをすべて実行
});
```

`src/index.js` では `app.listen()` の前に `runMigrations()` を呼び出しており、マイグレーションが完了するまでサーバーは起動しません。

```javascript
// src/index.js（起動部分）
(async () => {
  try {
    await runMigrations();          // ← 先にマイグレーション
    app.listen(port, () => { … });  // ← 成功後にサーバー起動
  } catch (err) {
    console.error('マイグレーション失敗:', err.message);
    process.exit(1);                // ← 失敗時は起動しない
  }
})();
```

#### 動作パターン

| 状態 | 動作 |
|------|------|
| 未適用のマイグレーションあり | 順次適用してからサーバー起動 |
| すべて適用済み | スキップして即座にサーバー起動 |
| マイグレーション失敗 | エラー出力後 `process.exit(1)` で終了 |

#### 注意点

- `node-pg-migrate` v8 は ESM パッケージのため、`require()` ではなく動的 `import()` で読み込んでいます。
- `npm run migrate`（手動実行）は CI/CD やマイグレーションのみ実行したい場合に引き続き使用できます。
