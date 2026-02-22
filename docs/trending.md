# 急上昇・トレンド機能の詳細

TangoSNSでは、人気コンテンツを発見するための急上昇機能を備えています。

## 急上昇機能の概要

- 学習回数が多い単語帳の単語を表示
- 右サイドバーの検索バー下に固定表示
- 人気コンテンツの発見を促進

## バックエンド実装 (`src/routes/trending.js`)

### APIエンドポイント
- **急上昇単語取得 (`GET /api/trending/words`)**:
  - 単語帳の学習回数が多い順に単語を5件取得
  - 学習回数 = `study_history`テーブルのカウント

### クエリロジック
```sql
SELECT w.id, w.word, w.meaning, w.view_count,
       wb.title AS wordbook_title, wb.id AS wordbook_id,
       u.username,
       COALESCE((SELECT COUNT(*) FROM study_history sh
                WHERE sh.wordbook_id = wb.id), 0) AS study_count
FROM words w
JOIN wordbooks wb ON w.wordbook_id = wb.id
JOIN users u ON wb.user_id = u.id
ORDER BY study_count DESC, w.view_count DESC
LIMIT 5
```

## フロントエンド実装 (`public/app.js`)

### 急上昇表示 (`loadTrendingWords`)
- ページロード時にAPIを呼び出し
- 右サイドバーに単語リストを表示
- クリックで該当単語帳に遷移

### UIデザイン
- 単語 + 意味 + 学習回数 + ユーザー名
- コンパクトなカード形式
- スクロール可能なリスト

## 更新タイミング

- ページロード時のみ更新（リアルタイム性は低め）
- 学習完了時にデータが更新されるため、反映までタイムラグあり

## パフォーマンス考慮

- LIMIT 5で表示件数を制限
- JOINクエリで必要な情報のみ取得
- キャッシュは未実装（必要に応じて追加）

## 拡張可能性

- 時間ベースのトレンド（直近1週間の学習回数）
- カテゴリ別トレンド（タグ別）
- ユーザー別トレンド（フォロー中ユーザーの人気単語）

## ビジネス的価値

- コンテンツの発見機会を増大
- 学習意欲の喚起
- プラットフォームのエンゲージメント向上</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\trending.md