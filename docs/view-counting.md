# ビュー数制限と管理（View Counting）

## 概要

TangoSNSでは、単語帳の閲覧数（ビュー数）を正確にカウントするため、同一ユーザー・同一クライアントによる重複カウントを防ぐ機構が実装されています。

- **ログイン済みユーザー**: ユーザーIDをベースに、1時間ごとに1回のみカウント
- **ゲストユーザー**: IPアドレス + ポート番号 + 単語帳IDをベースに、1時間ごとに1回のみカウント

## データベーススキーマ

### `wordbook_views` テーブル（ログイン済みユーザー用）

```sql
CREATE TABLE wordbook_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, wordbook_id)
);

CREATE INDEX idx_wordbook_views_wordbook_id ON wordbook_views(wordbook_id);
CREATE INDEX idx_wordbook_views_last_viewed_at ON wordbook_views(last_viewed_at);
```

**カラム説明：**
- `id`: 主キー
- `user_id`: ビューしたユーザーID
- `wordbook_id`: ビューされた単語帳ID
- `last_viewed_at`: 最後にビューた日時（1時間ごとの制限チェックに使用）

### `guest_wordbook_views` テーブル（ゲストユーザー用）

```sql
CREATE TABLE guest_wordbook_views (
  id SERIAL PRIMARY KEY,
  ip_address VARCHAR(45),           -- IPv4 / IPv6 対応
  port INTEGER,
  wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
  last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(ip_address, port, wordbook_id)
);

CREATE INDEX idx_guest_wordbook_views_wordbook_id ON guest_wordbook_views(wordbook_id);
CREATE INDEX idx_guest_wordbook_views_last_viewed_at ON guest_wordbook_views(last_viewed_at);
```

**カラム説明：**
- `id`: 主キー
- `ip_address`: クライアントのIPアドレス
- `port`: クライアントのポート番号（異なるポートからのアクセスは別カウント）
- `wordbook_id`: ビューされた単語帳ID
- `last_viewed_at`: 最後にビューした日時

## APIエンドポイント

### `GET /wordbooks/:id` - 単語帳詳細取得（ビューカウント付き）

**ルート：**
```javascript
app.get('/:id', async (req, res) => {
  try {
    const wbId = req.params.id;
    const userId = req.user?.id || null;
    
    // 1. 単語帳情報を取得
    const wb = await db.query(
      `SELECT * FROM wordbooks WHERE id = $1`,
      [wbId]
    );
    if (wb.rows.length === 0) {
      return res.status(404).json({ error: '単語帳が見つかりません' });
    }
    
    // 2. ビュー数をカウント（重複防止ロジック）
    const canCountView = await checkAndCountView(userId, wbId, req.ip);
    if (canCountView) {
      await db.query(
        `UPDATE wordbooks SET view_count = view_count + 1 WHERE id = $1`,
        [wbId]
      );
    }
    
    // 3. 最新のビュー数を取得して返信
    const updated = await db.query(
      `SELECT * FROM wordbooks WHERE id = $1`,
      [wbId]
    );
    
    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});
```

## ビュー数カウントのロジック

### `checkAndCountView(userId, wordbook_id, ipAddress)` 関数

```javascript
async function checkAndCountView(userId, wordbook_id, ipAddress) {
  const onHourAgo = new Date(Date.now() - 60 * 60 * 1000);  // 1時間前
  
  if (userId) {
    // ログイン済みユーザーの場合
    const { rows } = await db.query(
      `SELECT id, last_viewed_at FROM wordbook_views
       WHERE user_id = $1 AND wordbook_id = $2`,
      [userId, wordbook_id]
    );
    
    if (rows.length === 0) {
      // 初めての閲覧 → 記録を作成
      await db.query(
        `INSERT INTO wordbook_views (user_id, wordbook_id, last_viewed_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, wordbook_id)
         DO UPDATE SET last_viewed_at = CURRENT_TIMESTAMP`,
        [userId, wordbook_id]
      );
      return true;  // カウント
    } else if (rows[0].last_viewed_at < onHourAgo) {
      // 1時間以上前の閲覧 → カウント
      await db.query(
        `UPDATE wordbook_views
         SET last_viewed_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND wordbook_id = $2`,
        [userId, wordbook_id]
      );
      return true;
    } else {
      // 1時間以内の閲覧 → カウントなし
      return false;
    }
  } else {
    // ゲストユーザーの場合
    const port = parseInt(ipAddress.split(':')[1]) || 0;  // ポート番号を抽出
    const ip = ipAddress.split(':')[0];
    
    const { rows } = await db.query(
      `SELECT id, last_viewed_at FROM guest_wordbook_views
       WHERE ip_address = $1 AND port = $2 AND wordbook_id = $3`,
      [ip, port, wordbook_id]
    );
    
    if (rows.length === 0) {
      // 初めての閲覧 → 記録を作成
      await db.query(
        `INSERT INTO guest_wordbook_views (ip_address, port, wordbook_id, last_viewed_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [ip, port, wordbook_id]
      );
      return true;
    } else if (rows[0].last_viewed_at < onHourAgo) {
      // 1時間以上前の閲覧 → カウント
      await db.query(
        `UPDATE guest_wordbook_views
         SET last_viewed_at = CURRENT_TIMESTAMP
         WHERE ip_address = $1 AND port = $2 AND wordbook_id = $3`,
        [ip, port, wordbook_id]
      );
      return true;
    } else {
      // 1時間以内の閲覧 → カウントなし
      return false;
    }
  }
}
```

## カウント制御のルール

| ユーザー種別 | 識別方法 | カウント頻度 | 理由 |
|-------------|---------|------------|------|
| ロ ソイン済み | ユーザーID | 1時間ごと | サーバーで認証済みユーザーを一意に特定できるため |
| ゲスト | IP + ポート + 単語帳ID | 1時間ごと | IPアドレスはネットワークを超えてユーザーを追跡するため、VPN/プロキシ使用時の対応 |

### 1時間制限の根拠

- **短すぎる（数分）**: 誤操作やリロードを繰り返すユーザーがカウントされやすい
- **長すぎる（1日）**: ビュー数の更新頻度が低くなり、トレンド判定に遅延が生じる
- **1時間**: バランスが取れた設定で、ユーザーが同じ単語帳を継続的に学習する場合もカウント

## マイグレーション

### `migrations/1772000000002_create-wordbook-views.js`

```javascript
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wordbook_views (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
        last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, wordbook_id)
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_wordbook_views_wordbook_id 
      ON wordbook_views(wordbook_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_wordbook_views_last_viewed_at 
      ON wordbook_views(last_viewed_at)
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS wordbook_views CASCADE');
  }
};
```

### `migrations/1772000000003_create-guest-wordbook-views.js`

```javascript
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS guest_wordbook_views (
        id SERIAL PRIMARY KEY,
        ip_address VARCHAR(45),
        port INTEGER,
        wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
        last_viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(ip_address, port, wordbook_id)
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_guest_wordbook_views_wordbook_id 
      ON guest_wordbook_views(wordbook_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_guest_wordbook_views_last_viewed_at 
      ON guest_wordbook_views(last_viewed_at)
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS guest_wordbook_views CASCADE');
  }
};
```

## クライアント側での処理

ビュー数カウントは自動的にバックエンドで行われため、フロントエンドでの特別な処理は不要です。

単語帳詳細ページを読み込む際、バックエンドが自動的に:
1. ードイン状態を判定
2. ビュー数をカウント可能か確認
3. 可能であれば`wordbooks`テーブルの`view_count`をインクリメント

その後、更新されたビュー数を含む単語帳データをレスポンスします。

## トラブルシューティング

### ビュー数が増えない

1. **ログイン状態を確認**: APIが認証ユーザーと判定しているか
2. **1時間制限をチェック**: 前回のビュー記録が1時間以内か
3. **ブラウザキャッシュを確認**: 古いビュー数が表示されていないか

### ゲストユーザーのIPが正しく取得されない

1. **VPN/プロキシ使用状況**: ユーザーがVPNを使用している場合、複数のゲストが同じIPに見える可能性
2. **X-Forwarded-For ヘッダー確認**: リバースプロキシ環境では`req.headers['x-forwarded-for']`を使用

```javascript
const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
```

## パフォーマンス最適化

### クエリ最適化

```javascript
// ❌ 非効率: 毎回2つのクエリ
const existing = await db.query(...);
const update = await db.query(...);

// ✅ 効率的: ON CONFLICT を使用
await db.query(`
  INSERT INTO wordbook_views (user_id, wordbook_id, last_viewed_at)
  VALUES ($1, $2, CURRENT_TIMESTAMP)
  ON CONFLICT (user_id, wordbook_id)
  DO UPDATE SET last_viewed_at = CURRENT_TIMESTAMP
  WHERE (SELECT last_viewed_at) < NOW() - INTERVAL '1 hour'
`);
```

### インデックス戦略

- `wordbook_id`: 単語帳ごとのビュー集計時に使用
- `last_viewed_at`: 定期的な古いレコード削除の際に使用

## プライバシー考慮

- ゲストユーザーのIPは一時的に保存され、定期的な削除対象
- ユーザーが登録時に個人情報保護方針に同意することで、ビュー数追跡の透明性を確保

---

[ホームへ戻る](./README.md)
