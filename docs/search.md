# 検索機能の詳細

TangoSNSでは、単語帳とユーザーを効率的に見つけるための検索機能を備えています。

## 検索機能の概要

- 単語帳のタイトル・説明文のキーワード検索
- **ユーザーの表示名・アカウントIDによるユーザー検索**
- タグによるフィルタリング
- ユーザー名によるフィルタリング
- 並び替え（最新順/人気順）

## バックエンド実装

### 単語帳検索 (`GET /api/wordbooks`)

`src/routes/wordbooks.js` で実装。

- **クエリパラメータ**:
  - `q`: キーワード検索（タイトル・説明）
  - `tag`: タグフィルタ
  - `username`: ユーザー名フィルタ
  - `sort`: 並び替え（'latest' or 'popular'）
  - `following_only`: フォロー中のみ
  - `uncompleted`: 未完了のみ
  - `unstudied`: 未学習のみ
  - `mistakes`: 間違えありのみ

### ユーザー検索 (`GET /api/users/search`)

`src/routes/users.js` で実装。

- **クエリパラメータ**:
  - `q`: 検索キーワード（必須）

- **検索対象**: `username`（アカウントID）と `display_name`（表示名）の両方を `ILIKE` で部分一致検索

- **ソート順**: 前方一致する結果を優先
  1. `username` が前方一致 → 最優先
  2. `display_name` が前方一致 → 次に優先
  3. 部分一致のみ → 最後

- **上限**: 最大20件

```sql
SELECT id, username, display_name, avatar_url, bio,
       (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count
FROM users
WHERE username ILIKE '%keyword%' OR display_name ILIKE '%keyword%'
ORDER BY
  CASE WHEN username ILIKE 'keyword%' THEN 0
       WHEN display_name ILIKE 'keyword%' THEN 1
       ELSE 2 END,
  username
LIMIT 20
```

**ルート定義順序の注意**: `/search` は `/:username` より前に定義する必要があります。そうしないと `search` が `:username` パラメータにマッチしてしまいます。

## フロントエンド実装 (`public/app.js`)

### 検索UI
- **デスクトップ**: 右サイドバーの検索バー（`#searchInput`）
- **タブレット・スマートフォン**: メインエリア上部のモバイル検索バー（`.mobile-search-bar`）
- Enterキーで実行
- URLハッシュで検索状態を保持

### 検索結果表示 (`renderHomeFeed`)

検索キーワード (`q`) がある場合、2つのセクションが表示されます:

1. **ユーザー検索結果** (`#userSearchResults`):
   - `GET /api/users/search?q=...` を非同期で取得
   - 該当ユーザーがいる場合、単語帳結果の上に表示
   - アバター、表示名、@ハンドル、フォロワー数を表示
   - 初期表示は最大10件。11件以上ある場合は「残りN件を表示」ボタンで展開
   - クリックでユーザープロフィールに遷移

2. **単語帳検索結果** (`#feedList`):
   - ヘッダーに「検索結果: [キーワード]」を表示
   - クリアリンクで検索解除
   - 並び替えドロップダウン（最新順/閲覧回数順）
   - フィルタ（未完了/未学習/間違えあり）

### URLベースの検索
- `/?q=キーワード`
- `/?tag=タグ名`
- `/?q=キーワード&tag=タグ名&sort=popular`

## 検索ロジックの詳細

### キーワード検索（単語帳）
- PostgreSQLの`ILIKE`演算子を使用
- 大文字小文字を区別しない
- 部分一致検索

### ユーザー検索
- `username` と `display_name` の両方を対象
- `ILIKE` 部分一致検索（大文字小文字不問）
- 前方一致する結果を優先ソート

### タグ検索
- EXISTSサブクエリで関連付けを確認
- タグ名は完全一致

### 並び替え
- `latest`: `created_at DESC`
- `popular`: `view_count DESC`

---

[ホームへ戻る](./README.md)
