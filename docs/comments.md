# コメントシステム（ソーシャル機能）の詳細

TangoSNSでは、各単語帳に対してユーザーがフィードバックや意見を投稿できるコメント機能を備えています。

## バックエンド実装 (`src/routes/comments.js`)

### エンドポイント
- **一覧取得 (`GET /api/wordbooks/:id/comments`)**:
  - 最新順ではなく、古い順 (`ASC`) に取得してチャット形式の表示を容易にしています。
  - `JOIN users` により、投稿者のユーザー名を表示用に取得。
- **投稿 (`POST /api/wordbooks/:id/comments`)**:
  - 認証済みユーザーのみ許可。
  - `comment.trim()` で空文字の投稿を防止。
- **削除 (`DELETE /api/wordbooks/:id/comments/:commentId`)**:
  - コメント自体の `user_id` とリクエストユーザーを照合し、本人以外が削除できないよう制限。

## フロントエンド実装 (`public/app.js`)

- `renderWordbookDetail` 内で `commentList` 要素に動的に追加されます。
- 返信ボタン（投稿フォーム）が最下部に配置され、投稿後にリストが自動更新（再描画）されます。
- `deleteComment` 関数により、自身のコメントであれば削除アイコンが表示されます。
