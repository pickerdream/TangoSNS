# テーマシステムの詳細

TangoSNSでは、ユーザーの視覚的快適性を高めるためのテーマ切り替え機能を備えています。

## テーマ機能の概要

- ライトモード/ダークモード/システム設定に従う
- ユーザー設定の永続化
- CSS変数ベースの実装

## バックエンド実装 (`src/routes/users.js`)

### データ構造
```sql
-- usersテーブルにthemeカラムを追加
ALTER TABLE users ADD COLUMN theme VARCHAR(20) DEFAULT 'system';
```

### APIエンドポイント
- **テーマ更新 (`PUT /api/users/theme`)**:
  - リクエスト: `{ theme: 'light' | 'dark' | 'system' }`
  - ユーザーテーブルのthemeカラムを更新

## フロントエンド実装 (`public/app.js`)

### テーマ適用関数 (`applyTheme`)
```javascript
function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    html.removeAttribute('data-theme'); // system
  }
}
```

### 初期ロード時の適用
```javascript
(function () {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (user && user.theme) {
    applyTheme(user.theme);
  }
})();
```

### 設定UI (`renderSettings`)
- テーマ選択ドロップダウン
- 選択変更時にAPI更新 + 即時適用

## CSS実装 (`public/styles.css`)

### デザイントークン
```css
:root,
[data-theme="light"] {
  --bg-color: #ffffff;
  --bg-secondary: #f7f9f9;
  --text-primary: #0f1419;
  --text-secondary: #536471;
  --accent-color: #00ba7c;
}

[data-theme="dark"] {
  --bg-color: #000000;
  --bg-secondary: #16181c;
  --text-primary: #e7e9ea;
  --text-secondary: #71767b;
  --accent-color: #00ba7c;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg-color: #000000;
    --bg-secondary: #16181c;
    --text-primary: #e7e9ea;
    --text-secondary: #71767b;
  }
}
```

### システム設定の検知
- `prefers-color-scheme`メディアクエリでOS設定を検知
- `data-theme`属性がない場合に適用

## テーマの種類

1. **light**: 明色テーマ
2. **dark**: 暗色テーマ  
3. **system**: OS設定に従う（デフォルト）

## 実装の利点

- **CSS変数**: テーマ切り替えが即時反映
- **OS連携**: システム設定を尊重
- **永続化**: ユーザー設定を保存
- **パフォーマンス**: JavaScriptでのクラス切り替え不要

## アクセシビリティ

- 高コントラスト比の維持
- 色覚障害者への配慮
- フォーカスインジケーターの視認性確保</content>
<parameter name="filePath">c:\Users\kouta\Documents\tangosns\docs\theme.md