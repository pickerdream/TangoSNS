# 単語帳と単語の管理機能の詳細

単語帳（Wordbook）は、ユーザーが作成し共有できるコンテンツの核となります。

## 単語帳 (Wordbook) の実装

### データ構造
- `wordbooks` テーブル: タイトル、説明、作成者ID、作成日時を保持。

### 主要なAPI (`src/routes/wordbooks.js`)
- **一覧取得 (`GET /api/wordbooks`)**:
  - ページネーションなしの全取得（または検索フィルタ）。
  - `ILIKE` を使用したタイトルおよび説明のキーワード検索に対応。
  - `EXISTS` サブクエリを使用して、ログイン中ユーザーがその単語帳をクリア済みかどうかのフラグ (`is_completed`) を取得。
- **詳細取得 (`GET /api/wordbooks/:id`)**:
  - `JOIN` を使用して単語数とコメント数を集計して返す。

## 単語 (Word) の実装

### API (`src/routes/words.js`)
- `mergeParams: true` を設定したネストされたルーターとして実装。
- **所有者検証**:
  - 単語の追加 (`POST`)、更新 (`PUT`)、削除 (`DELETE`) は、単語帳の `user_id` と `req.user.id` が一致する場合のみ許可。

## フロントエンドのUI操作 (`public/app.js`)
- `renderWordbookDetail`: 単語帳のメタ情報、単語リスト、追加フォーム（所有者のみ）を動的に描画。
- `openCreateModal`: モーダル経由での新規作成（タイトル・説明入力）。

## ブックマーク機能とフィルタリング (`src/routes/wordbooks.js`)

### ブックマーク一覧取得 (`GET /api/wordbooks/bookmarked`)
ブックマークした単語帳の一覧を取得する際、以下のパラメータによる高度なフィルタリングに対応しています：
- `uncompleted=true`: 完了ボタン（`wordbook_completions`）が押されていない単語帳を抽出。
- `unstudied=true`: 一度も学習履歴（`study_history`）がない単語帳を抽出。
- `mistakes=true`: 克服していない間違い（`study_mistakes`）が残っている単語帳を抽出。

### UIの標準化
- 単語帳のフィード表示には `.feed-card` クラスを統一して使用し、ホームフィード、ブックマーク、学習履歴で一貫した余白とデザインを提供します。
