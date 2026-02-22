# 検索機能の詳細

TangoSNSでは、単語帳を効率的に見つけるための検索機能を備えています。

## 検索機能の概要

- 単語帳のタイトル・説明文のキーワード検索
- タグによるフィルタリング
- ユーザー名によるフィルタリング
- 並び替え（最新順/人気順）

## バックエンド実装 (`src/routes/wordbooks.js`)

### 検索API (`GET /api/wordbooks`)
- **クエリパラメータ**:
  - `q`: キーワード検索（タイトル・説明）
  - `tag`: タグフィルタ
  - `username`: ユーザー名フィルタ
  - `sort`: 並び替え（'latest' or 'popular'）

### 検索クエリ例
```sql
SELECT w.id, w.title, w.description, w.created_at, w.view_count,
       u.id AS user_id, u.username, u.avatar_url,
       EXISTS(SELECT 1 FROM wordbook_completions c
              WHERE c.wordbook_id = w.id AND c.user_id = $1) AS is_completed,
       COALESCE((SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                FROM wordbook_tags wt JOIN tags t ON t.id = wt.tag_id
                WHERE wt.wordbook_id = w.id), '[]') AS tags
FROM wordbooks w
JOIN users u ON w.user_id = u.id
WHERE (w.title ILIKE $2 OR w.description ILIKE $2)  -- キーワード検索
  AND (u.username = $3)  -- ユーザー名フィルタ
  AND EXISTS(SELECT 1 FROM wordbook_tags wt JOIN tags t ON t.id = wt.tag_id
            WHERE wt.wordbook_id = w.id AND t.name = $4)  -- タグフィルタ
ORDER BY w.created_at DESC  -- または w.view_count DESC
```

## フロントエンド実装 (`public/app.js`)

### 検索UI
- 右サイドバーの検索バー（`#searchInput`）
- Enterキーまたは検索アイコンクリックで実行
- URLハッシュで検索状態を保持

### 検索結果表示 (`renderHomeFeed`)
- 検索結果時はヘッダーに「検索結果: [キーワード]」を表示
- クリアリンクで検索解除
- 検索時は並び替えドロップダウンを表示

### URLベースの検索
- `/?q=キーワード`
- `/?tag=タグ名`
- `/?q=キーワード&tag=タグ名&sort=popular`

## 検索ロジックの詳細

### キーワード検索
- PostgreSQLの`ILIKE`演算子を使用
- 大文字小文字を区別しない
- 部分一致検索

### タグ検索
- EXISTSサブクエリで関連付けを確認
- タグ名は完全一致

### ユーザー検索
- ユーザー名は完全一致

### 並び替え
- `latest`: `created_at DESC`
- `popular`: `view_count DESC`

## パフォーマンス最適化

- インデックス: `wordbooks(title)`, `wordbooks(description)`, `users(username)`
- タグ検索はwordbook_tagsテーブルのインデックス利用
- 結果件数制限なし（全件表示）

## UI/UX考慮

- 検索バーは常に表示
- 検索結果時はURLに状態を反映
- クリア機能で簡単に検索解除
- 並び替えは検索時のみ表示

## 拡張可能性

- 単語レベル検索
- 高度なフィルタ（作成日範囲など）
- 検索サジェスト
- 検索履歴</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\search.md