# 通知システムの詳細

TangoSNSでは、ユーザー間のインタラクションを促進するための通知機能を備えています。

## 通知の種類

### コメント通知
- **トリガー**: 単語帳にコメントが投稿されたとき
- **対象**: 単語帳の所有者（コメント投稿者以外）
- **メッセージ**: `@[ユーザー名]さんが単語帳「[タイトル]」にコメントしました`
- **リンク**: 単語帳の詳細ページ

### 警告通知
- **トリガー**: 管理者からの警告
- **対象**: 警告対象ユーザー
- **メッセージ**: `⚠️ 管理者から警告を受けました: [理由]`
- **特徴**: 確認されるまで通知一覧に固定表示

## バックエンド実装 (`src/routes/notifications.js`)

### データ構造
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL, -- 'comment', 'warning' など
  message TEXT NOT NULL,
  link TEXT, -- 遷移先URL
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
```

### APIエンドポイント
- **一覧取得 (`GET /api/notifications`)**:
  - 警告通知を優先的に表示（`ORDER BY (type = 'warning') DESC, created_at DESC`）
  - 最新50件を取得
- **既読化 (`PUT /api/notifications/:id/read`)**:
  - 指定通知を既読に
- **全既読化 (`PUT /api/notifications/read-all`)**:
  - ユーザーの全通知を既読に

### 通知作成の流れ
1. イベント発生（コメント投稿、警告送信）
2. `notifications`テーブルにレコード挿入
3. フロントエンドで未読バッジ更新

## フロントエンド実装 (`public/app.js`)

### 通知一覧 (`renderNotifications`)
- 通知をクリックで既読化 + リンク遷移
- 警告通知は赤く強調表示
- 警告通知は確認ダイアログを表示

### 未読バッジ (`updateUnreadBadge`)
- 通知APIを定期的にポーリング
- 未読数をサイドバーの通知アイコンに表示

### リアルタイム更新
- 通知作成時に即時反映（ポーリングベース）

## 通知の優先順位

1. **警告通知**: 赤色表示、確認必須
2. **コメント通知**: 通常表示
3. **その他**: 拡張可能

## パフォーマンス考慮

- 通知は最新50件のみ表示
- 既読化は個別/一括で効率的に処理
- ポーリング間隔は適切に設定（現在はイベント駆動）</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\notifications.md