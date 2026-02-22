# タグシステムの詳細

TangoSNSでは、単語帳をカテゴライズするためのタグ機能を備えています。

## タグの役割

- 単語帳の分類と検索性の向上
- 人気タグの表示によるトレンド把握
- ユーザー間のコンテンツ発見を促進

## バックエンド実装

### データ構造
```sql
-- タグマスターテーブル
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 単語帳-タグ関連テーブル
CREATE TABLE wordbook_tags (
  wordbook_id INTEGER REFERENCES wordbooks(id) ON DELETE CASCADE,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (wordbook_id, tag_id)
);
```

### APIエンドポイント (`src/routes/tags.js`)

- **人気タグ取得 (`GET /api/tags/popular`)**:
  - 最も使用されているタグをカウントして返却
  - フロントエンドの右サイドバーに表示

### 単語帳作成時のタグ処理 (`src/routes/wordbooks.js`)

1. **タグの正規化**: 入力タグを小文字化・トリム
2. **タグの作成/取得**: `INSERT ... ON CONFLICT DO NOTHING` で重複回避
3. **関連付け**: `wordbook_tags`テーブルにレコード挿入

## フロントエンド実装 (`public/app.js`)

### タグ入力UI
- 単語帳作成モーダルでカンマ区切りでタグ入力
- 既存タグのサジェスト表示（未実装）

### タグ表示
- 単語帳カードにタグチップとして表示
- クリックでタグ検索に遷移

### 人気タグ表示 (`loadPopularTags`)
- 右サイドバーに人気タグを動的に表示
- クリックでタグフィルタ適用

## 検索機能との連携

### タグ検索 (`GET /api/wordbooks?tag=タグ名`)
```sql
EXISTS(
  SELECT 1 FROM wordbook_tags wt
  JOIN tags t ON t.id = wt.tag_id
  WHERE wt.wordbook_id = w.id AND t.name = $tag
)
```

## パフォーマンス最適化

- タグ名は小文字統一で重複防止
- インデックス: `tags(name)`, `wordbook_tags(wordbook_id, tag_id)`
- 人気タグはカウントクエリで集計

## 運用上の注意

- タグ名の文字数制限（50文字）
- 単語帳あたりのタグ数制限（未実装）
- タグの削除機能（未実装：使用中のタグは残す）</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\tags.md