# 完了システムの詳細

TangoSNSでは、ユーザーが単語帳を学習完了としてマークできる機能を備えています。

## 完了機能の目的

- 学習進捗の可視化
- 完了済み単語帳のフィルタリング
- 学習モチベーションの維持

## バックエンド実装 (`src/routes/completions.js`)

### データ構造
```sql
CREATE TABLE wordbook_completions (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  wordbook_id INTEGER REFERENCES wordbooks(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, wordbook_id)
);
```

### APIエンドポイント
- **完了設定 (`POST /api/completions`)**:
  - リクエスト: `{ wordbookId }`
  - 所有者以外のみ許可（自分の単語帳は完了できない）
- **完了解除 (`DELETE /api/completions/:wordbookId`)**:
  - 指定単語帳の完了を解除

## フロントエンド実装 (`public/app.js`)

### 完了ボタン (`renderWordbookDetail`)
- 単語帳所有者以外に完了ボタンを表示
- 完了状態に応じてボタンのスタイル変更
- クリックで完了/解除をトグル

### 完了バッジ
- 単語帳カードに完了済みバッジを表示
- ホームフィードで完了状態を視覚的に示す

## 完了状態の活用

### 単語帳一覧での表示
```sql
EXISTS(
  SELECT 1 FROM wordbook_completions c
  WHERE c.wordbook_id = w.id AND c.user_id = $currentUserId
) AS is_completed
```

### 学習履歴との連携
- 完了済み単語帳は学習履歴で特別表示
- 完了状態は学習進捗の指標として使用

## ビジネスロジック

- **所有者制限**: 自分の単語帳は完了できない
- **一意性**: ユーザー×単語帳の組み合わせで一意
- **永続性**: 完了状態は維持される

## UI/UX考慮

- 完了ボタンは学習ボタンの近くに配置
- 完了済みバッジは緑色で目立つデザイン
- 完了解除は確認ダイアログなしで即時実行</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\completions.md