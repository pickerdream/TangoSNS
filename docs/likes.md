# いいね機能（Likes/Interactions）

## 概要

TangoSNSに実装されたいいね機能により、ユーザーが有用な単語帳に対して好意を示すことができます。これはコミュニティのエンゲージメント向上とコンテンツの質の向上につながります。

## データベーススキーマ

### `wordbook_likes` テーブル

```sql
CREATE TABLE wordbook_likes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(user_id, wordbook_id)  -- ユーザーごとに1いいね
);

CREATE INDEX idx_wordbook_likes_user_id ON wordbook_likes(user_id);
CREATE INDEX idx_wordbook_likes_wordbook_id ON wordbook_likes(wordbook_id);
```

**カラム説明：**
- `id`: 主キー
- `user_id`: いいねしたユーザーのID（外部キー）
- `wordbook_id`: いいねされた単語帳のID（外部キー）
- `created_at`: いいねした日時
- `UNIQUE(user_id, wordbook_id)`: ユーザーが同じ単語帳に複数回いいねできないようにする制約

## APIエンドポイント

### 1. 単語帳のいいね情報取得
```
GET /wordbooks/:id/likes
```

**レスポンス例：**
```json
{
  "like_count": 42,
  "liked_by_me": true,
  "like_id": 123
}
```

**パラメータ：**
- `:id` - 単語帳ID

**認証：**
- 不要（ゲストユーザーも利用可能、`liked_by_me` は常にfalse）

### 2. いいねを追加
```
POST /wordbooks/:id/likes
```

**認証：** 必須（JWT トークン）

**レスポンス例：**
```json
{
  "message": "いいねを追加しました",
  "like_id": 123
}
```

**エラー例：**
- `400`: 既にいいね済み
- `401`: 認証失敗
- `404`: 単語帳が見つからない

### 3. いいねを取消
```
DELETE /wordbooks/:id/likes/:likeId
```

**認証：** 必須（JWT トークン、本人確認）

**レスポンス例：**
```json
{
  "message": "いいねを取消しました"
}
```

**エラー例：**
- `403`: 権限なし（他人のいいねは削除不可）
- `404`: いいねが見つからない

## フロントエンド実装

### UIコンポーネント

#### ホームフィード内のいいねボタン

**HTML構造：**
```html
<span style="cursor:pointer" class="like-btn-home" data-wordbook-id="<id>">
  <span class="material-icons like-icon-home" style="...">favorite_border</span>
  <span class="like-count-home">0</span>
</span>
```

**クラス説明：**
- `like-btn-home`: ホームフィード内のいいねボタン
- `like-btn-detail`: 単語帳詳細ページのいいねボタン
- `like-icon-home` / `like-icon-detail`: アイコン要素
- `like-count-home` / `like-count-detail`: カウント表示

#### 単語帳詳細ページ側のいいねボタン

**HTML構造：**
```html
<span style="cursor:pointer" class="like-btn-detail" data-wordbook-id="<id>">
  <span class="material-icons like-icon-detail" style="...">favorite_border</span>
  <span class="like-count-detail">0</span>
</span>
```

### JavaScript関数

#### `loadLikeInfo(wordbookId, likeButton)`

いいね情報を非同期で読み込み、UIを更新する。

```javascript
async function loadLikeInfo(wordbookId, likeButton) {
  try {
    const data = await fetchAPI(`/wordbooks/${wordbookId}/likes`);
    const icon = likeButton.querySelector('.like-icon-home, .like-icon-detail');
    const count = likeButton.querySelector('.like-count-home, .like-count-detail');
    
    count.textContent = data.like_count;
    
    if (data.liked_by_me) {
      icon.textContent = 'favorite';  // 塗りつぶしハート
      icon.style.color = '#ef4444';
    } else {
      icon.textContent = 'favorite_border';  // 枠線ハート
      icon.style.color = 'unset';
    }
    
    // データをプロパティに保持
    likeButton.dataset.likeId = data.like_id || '';
    likeButton.dataset.liked = data.liked_by_me;
  } catch (err) {
    console.error('いいね情報の読み込みに失敗:', err);
  }
}
```

#### `toggleLikeHome(wordbookId, likeButton)`

ホームフィード内でいいねをトグル。

```javascript
async function toggleLikeHome(wordbookId, likeButton) {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  
  // ゲストユーザー警告
  if (!user) {
    alert('いいねするにはログインしてください');
    window.location.hash = '#/login';
    return;
  }
  
  const isLiked = likeButton.dataset.liked === 'true';
  
  try {
    if (isLiked) {
      // いいねを取消
      const likeId = likeButton.dataset.likeId;
      await fetchAPI(`/wordbooks/${wordbookId}/likes/${likeId}`, { 
        method: 'DELETE' 
      });
    } else {
      // いいねを追加
      await fetchAPI(`/wordbooks/${wordbookId}/likes`, { 
        method: 'POST' 
      });
    }
    
    // 情報を再読み込み
    loadLikeInfo(wordbookId, likeButton);
  } catch (err) {
    alert(err.message);
  }
}
```

#### `toggleLikeDetail(wordbookId, likeButton)`

単語帳詳細ページでいいねをトグル（`toggleLikeHome`と同様）。

### CSSスタイル

```css
.like-btn-home,
.like-btn-detail {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}

.like-icon-home,
.like-icon-detail {
  font-size: 16px;
  vertical-align: middle;
  transition: color 0.2s ease;
}

.like-btn-home:hover .like-icon-home,
.like-btn-detail:hover .like-icon-detail {
  color: #ef4444;
}

.like-count-home,
.like-count-detail {
  font-size: 14px;
  margin-right: 4px;
}
```

## バックエンド実装

### ルート処理（`src/routes/wordbooks.js`）

#### `GET /wordbooks/:id` - 単語帳詳細（いいね情報付き）

```javascript
app.get('/:id', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    
    const wb = await db.query(
      `SELECT w.*, u.username, u.avatar_url, u.bio,
              COUNT(DISTINCT l.id) as like_count,
              EXISTS(SELECT 1 FROM wordbook_likes WHERE wordbook_id = w.id AND user_id = $1) as liked_by_me
       FROM wordbooks w
       JOIN users u ON w.user_id = u.id
       LEFT JOIN wordbook_likes l ON w.id = l.wordbook_id
       WHERE w.id = $2
       GROUP BY w.id, u.id`,
      [userId, req.params.id]
    );
    
    if (wb.rows.length === 0) {
      return res.status(404).json({ error: '単語帳が見つかりません' });
    }
    
    res.json(wb.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});
```

#### `GET /wordbooks/:id/likes` - いいね情報取得

```javascript
app.get('/:id/likes', async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const { rows } = await db.query(
      `SELECT COUNT(*) as like_count,
              EXISTS(SELECT 1 FROM wordbook_likes WHERE wordbook_id = $1 AND user_id = $2) as liked_by_me,
              (SELECT id FROM wordbook_likes WHERE wordbook_id = $1 AND user_id = $2) as like_id
       FROM wordbook_likes
       WHERE wordbook_id = $1`,
      [req.params.id, userId]
    );
    
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});
```

#### `POST /wordbooks/:id/likes` - いいね追加

```javascript
app.post('/:id/likes', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const wbId = req.params.id;
    
    // 既にいいね済みかチェック
    const existing = await db.query(
      'SELECT id FROM wordbook_likes WHERE user_id = $1 AND wordbook_id = $2',
      [userId, wbId]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '既にいいね済みです' });
    }
    
    // いいねを追加
    const { rows } = await db.query(
      'INSERT INTO wordbook_likes (user_id, wordbook_id) VALUES ($1, $2) RETURNING id',
      [userId, wbId]
    );
    
    res.json({ message: 'いいねを追加しました', like_id: rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});
```

#### `DELETE /wordbooks/:id/likes/:likeId` - いいね削除

```javascript
app.delete('/:id/likes/:likeId', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const likeId = req.params.likeId;
    
    // 権限確認
    const like = await db.query(
      'SELECT user_id FROM wordbook_likes WHERE id = $1',
      [likeId]
    );
    
    if (like.rows.length === 0) {
      return res.status(404).json({ error: 'いいねが見つかりません' });
    }
    
    if (like.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '権限がありません' });
    }
    
    await db.query('DELETE FROM wordbook_likes WHERE id = $1', [likeId]);
    res.json({ message: 'いいねを取消しました' });
  } catch (err) {
    res.status(500).json({ error: 'サーバーエラー' });
  }
});
```

## マイグレーション

```javascript
// migrations/1772000000001_create-wordbook-likes.js
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS wordbook_likes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        wordbook_id INTEGER NOT NULL REFERENCES wordbooks(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, wordbook_id)
      )
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_wordbook_likes_user_id ON wordbook_likes(user_id)
    `);
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_wordbook_likes_wordbook_id ON wordbook_likes(wordbook_id)
    `);
  },
  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS wordbook_likes CASCADE');
  }
};
```

## UX/DX考慮事項

1. **即座なフィードバック**: クリック時に直ちにUIが変わり、その後APIリクエストが送信される
2. **オフライン対応検討**: ネットワーク遅延時の表示切り替えは慎重に
3. **ゲスト対応**: ログインなしでいいね情報は見られるが、操作時にはログイン画面にリダイレクト
4. **ランキング活用**: いいね数が多い単語帳は急上昇機能に反映される可能性

---

[ホームへ戻る](./README.md)
