# 統計・分析機能の詳細

TangoSNSでは、管理者向けのプラットフォーム統計機能を備えています。

## 統計機能の概要

- ユーザー数、単語帳数、警告数の集計
- 管理者ダッシュボードでの表示
- プラットフォームの健全性監視

## バックエンド実装 (`src/routes/admin.js`)

### 統計API (`GET /api/admin/stats`)
```javascript
const totalUsers = await db.query('SELECT COUNT(*) FROM users');
const bannedUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_banned = true');
const totalWordbooks = await db.query('SELECT COUNT(*) FROM wordbooks');
const totalWarnings = await db.query('SELECT COUNT(*) FROM user_warnings');
```

### 返却データ
```json
{
  "totalUsers": 100,
  "bannedUsers": 5,
  "totalWordbooks": 50,
  "totalWarnings": 10
}
```

## フロントエンド実装 (`public/app.js`)

### 管理者ダッシュボード (`renderAdminDashboard`)
- 統計カードをグリッドレイアウトで表示
- 各メトリクスにアイコンと数値を表示
- 自動更新なし（ページリロード時更新）

### UIデザイン
- レスポンシブなカードグリッド
- 視覚的にわかりやすいアイコン
- 管理者専用ページ

## 拡張可能な統計項目

### ユーザー関連
- アクティブユーザー数（直近30日）
- 新規登録者数
- 管理者数

### コンテンツ関連
- 総単語数
- 平均単語帳サイズ
- 人気タグランキング

### 学習関連
- 総学習回数
- 完了単語帳数
- 平均学習時間

### システム関連
- 総コメント数
- 通知送信数
- IPログ件数

## データ収集の考慮

- **リアルタイム性**: 現在の実装は即時集計
- **パフォーマンス**: COUNTクエリで高速
- **キャッシュ**: 未実装（必要に応じてRedisなど導入）

## 運用活用

- **健全性監視**: 異常な数値変動の検知
- **成長指標**: ユーザー/コンテンツ増加の追跡
- **モデレーション指標**: 警告数の推移分析

## セキュリティ

- 管理者権限でのみアクセス可能
- 機密情報の漏洩防止
- ログ収集なし（直接クエリ）

## 将来的拡張

- 時系列グラフの追加
- エクスポート機能
- アラート機能（閾値超過時）</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\analytics.md