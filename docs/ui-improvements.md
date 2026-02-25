# UI改善と表示最適化

## 概要

TangoSNSでは、ユーザー体験を向上させるため、様々なUI改善が実装されています。このドキュメントでは、特に単語表示、トグルメニュー、レイアウト最適化について説明します。

## 単語表示の改善

### テーブル形式での単語表示

従来の縦型アイテム表示ではなく、テーブル形式（表組み）で単語を表示することで、ユーザーが複数の単語を一覧でき、スキャンしやすくなります。

#### HTML構造

```html
<div style="padding:16px; border-bottom:1px solid var(--border-color)">
  <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px">
    <h3 style="margin:0; flex:1">登録された単語</h3>
    <button type="button" id="toggleWordsBtn" class="btn-primary" 
            style="background:transparent; border:1px solid var(--border-color); 
                   color:var(--text-primary); padding:8px 16px">
      <span class="material-icons" style="vertical-align:middle; font-size:18px">
        expand_more
      </span>
    </button>
  </div>
  
  <table style="width:100%; border-collapse:collapse; font-size:14px">
    <thead>
      <tr style="border-bottom:2px solid var(--border-color)">
        <th style="text-align:left; padding:12px; font-weight:bold; 
                   color:var(--text-secondary)">単語</th>
        <th style="text-align:left; padding:12px; font-weight:bold; 
                   color:var(--text-secondary)">意味</th>
        <th style="text-align:center; padding:12px; font-weight:bold; 
                   color:var(--text-secondary); width:50px">削除</th>
      </tr>
    </thead>
    <tbody id="wordTableBody">
      <!-- 行は動的に生成 -->
    </tbody>
  </table>
</div>
```

#### テーブル行の生成

各単語は`<tr>`要素として生成されます。ログイン中のユーザーには「状況」列が追加されます：

```html
<!-- ログイン済みユーザー (所有者) の場合 -->
<tr style="border-bottom:1px solid var(--border-color)">
  <td style="padding:12px; color:var(--text-primary)">単語</td>
  <td style="padding:12px; color:var(--text-primary)">意味</td>
  <!-- 状況列: 間違えた単語は赤✗、正解は緑✓、未学習は空 -->
  <td style="padding:12px; text-align:center">
    <span class="material-icons" style="font-size:18px; color:var(--error-color)"
          title="直近の学習で間違えた単語">close</span>
  </td>
  <td style="padding:12px; text-align:center">
    <button class="delete-btn" onclick="deleteWord(...)">
      <span class="material-icons" style="font-size:18px">delete</span>
    </button>
  </td>
</tr>
```

**「状況」列の表示ルール:**
- `mistakeWordIds`（`GET /api/study/mistakes/:id` で取得）が空でない → 学習済みと判定。間違い単語に `close`（赤）、それ以外に `check`（緑）を表示。
- `mistakeWordIds` が空 → 未学習とみなしてアイコンを非表示。
- ゲストユーザー → 列自体を非表示。

### トグルメニュー機能

#### 初期状態

- 最大**10行**までを表示
- 11行以上の場合、「展開」ボタン（`expand_more` アイコン）が有効化
- 10行以下の場合、ボタンは無効化（`opacity: 0.5; cursor: not-allowed`）

#### 展開時

- すべての行を表示
- ボタンアイコンが `expand_less` に変更
- ボタンをクリックで再度折り畳み可能

#### JavaScript実装

```javascript
const maxRows = 10;
let isExpanded = false;

function renderWordTable() {
  wordTableBody.innerHTML = '';
  const visibleWords = isExpanded ? words : words.slice(0, maxRows);

  visibleWords.forEach(w => {
    const row = document.createElement('tr');
    row.style.borderBottom = '1px solid var(--border-color)';
    const isMistake = mistakeWordIds.has(w.id);
    const statusCell = !isGuest
      ? `<td style="padding:12px; text-align:center">
           ${mistakeWordIds.size > 0 || isMistake
             ? isMistake
               ? `<span class="material-icons" style="font-size:18px; color:var(--error-color)" title="直近の学習で間違えた単語">close</span>`
               : `<span class="material-icons" style="font-size:18px; color:#00ba7c" title="直近の学習で正解した単語">check</span>`
             : ''}
         </td>`
      : '';
    row.innerHTML = `
      <td style="padding:12px; color:var(--text-primary)">${w.word}</td>
      <td style="padding:12px; color:var(--text-primary)">${w.meaning}</td>
      ${statusCell}
      ${isOwner ? `
        <td style="padding:12px; text-align:center">
          <button class="delete-btn" onclick="deleteWord(${wbId}, ${w.id})">
            <span class="material-icons" style="font-size:18px">delete</span>
          </button>
        </td>
      ` : ''}
    `;
    wordTableBody.appendChild(row);
  });
}

// トグルボタンのイベントリスナー
const toggleWordsBtn = document.getElementById('toggleWordsBtn');
if (toggleWordsBtn && words.length > maxRows) {
  toggleWordsBtn.onclick = () => {
    isExpanded = !isExpanded;
    renderWordTable();
    toggleWordsBtn.innerHTML = isExpanded 
      ? '<span class="material-icons" style="vertical-align:middle; font-size:18px">expand_less</span>'
      : '<span class="material-icons" style="vertical-align:middle; font-size:18px">expand_more</span>';
  };
} else if (toggleWordsBtn && words.length <= maxRows) {
  // 単語数が少ない場合はボタンを不可にする
  toggleWordsBtn.disabled = true;
  toggleWordsBtn.style.opacity = '0.5';
  toggleWordsBtn.style.cursor = 'not-allowed';
}

// 初期描画
renderWordTable();
```

## レイアウト最適化

### ゲストユーザー向けシンプルレイアウト

ゲストユーザー（未ログイン）の場合、以下のシンプルなレイアウトが表示されます：

**左サイドバー（デスクトップのみ）:**
- ロゴ・ホームリンク
- ログインボタン
- 登録ボタン

**右サイドバー（デスクトップのみ）:**
- 検索ボックス
- 急上昇
- 人気タグ

**モバイルボトムナビ（スマートフォンのみ）:**
- ホーム / ログイン / 登録

### ログイン済みユーザー向け完全レイアウト

**左サイドバー（デスクトップのみ）:**
- ロゴ・ホームリンク
- 学習履歴
- 通知（未読バッジ付き）
- プロフィール
- ブックマーク
- 設定
- 管理者パネル（管理者のみ）
- 単語帳作成ボタン
- ユーザーメニュー（プロフィール・アバター・ログアウト）

**右サイドバー（デスクトップのみ）:**
- 検索ボックス
- 急上昇
- 人気タグ

**モバイルボトムナビ（スマートフォンのみ）:**
- ホーム / 通知（バッジ付き）/ 作成 / 保存済 / マイページ

### フィードカードの共通化 (.feed-card)

単語帳を一覧表示するコンポーネントは `.feed-card` クラスに集約されています。これにより、ホーム、ブックマーク、学習履歴などのすべてのフィードページで一貫した余白（`padding: 16px`）とボーダーが維持されます。

#### 主要な要素:
- `.card-header`: 作者情報、アバター、完了バッジを横並びに配置。
- `.card-title`: 視認性の高い太字タイトル。
- `.card-desc`: 説明文（ある場合のみ表示）。
- `.card-tags`: タグチップのリスト。
- `.card-stats`: 閲覧数や単語数などの統計情報。
- `like-btn` / `bookmark-btn`: インタラクティブなアクションボタン。

## アイコン使用ガイドライン

TangoSNSで使用される主なMaterial Iconsアイコン：

| アイコン | 名称 | 用途 |
|---------|------|------|
| `expand_more` | 展開 | 非表示状態→展開時 |
| `expand_less` | 折り畳み | 表示状態→折り畳み時 |
| `favorite` | 塗りつぶしハート | いいね済み |
| `favorite_border` | 枠線ハート | いいね未実施 |
| `delete` | ゴミ箱 | 削除ボタン |
| `edit` | 編集 | 編集ボタン |
| `arrow_back` | 戻る | 戻るボタン |
| `home` | ホーム | ホームリンク |
| `history` | 履歴 | 学習履歴 |
| `notifications` | ベル | 通知 |
| `person` | 人物 | プロフィール |
| `settings` | 設定 | 設定 |
| `school` | 帽子 | 学習 |
| `check_circle` | チェック付き円 | 完了済み |
| `radio_button_unchecked` | 未チェック円 | 未完了 |
| `comment` | コメント吹き出し | コメント |

## CSS変数（テーマ対応）

すべてのUIコンポーネントはCSS変数を使用してスタイリングされ、ライト/ダークモード対応を実現しています：

```css
:root {
  --bg-color: #ffffff;
  --bg-secondary: #f7f9f9;
  --bg-hover: #f0f3f4;
  --bg-input: #f7f9f9;
  --text-primary: #0f1419;
  --text-secondary: #536471;
  --accent-color: #00ba7c;
  --accent-hover: #00a26b;
  --border-color: #eff3f4;
  --error-color: #f4212e;
  --header-bg: rgba(255, 255, 255, 0.85);
}

[data-theme="dark"] {
  --bg-color: #000000;
  --bg-secondary: #16181c;
  --bg-hover: #eff3f41a;
  --bg-input: #202327;
  --text-primary: #e7e9ea;
  --text-secondary: #71767b;
  --accent-color: #00ba7c;
  --accent-hover: #00a26b;
  --border-color: #2f3336;
  --error-color: #f4212e;
  --header-bg: rgba(0, 0, 0, 0.65);
}
```

## レスポンシブデザイン

### レイアウト構造

3カラムレイアウトは `.layout` > `.sidebar` + `.main-wrapper` + `.right-sidebar` で構成されています。`.main-wrapper` は `.mobile-search-bar` と `.main`（コンテンツ描画先）を含みます。

### ブレークポイント

| ブレークポイント | 対象 | レイアウト変更 |
|----------------|------|--------------|
| 1025px以上 | デスクトップ | 3カラム表示（サイドバー + メイン + 右サイドバー） |
| 768px〜1024px | タブレット | 右サイドバー非表示、モバイル検索バー表示 |
| 767px以下 | スマートフォン | 左サイドバーも非表示、ボトムナビ表示 |

```css
/* タブレット（1024px以下）: 右サイドバー非表示 */
@media (max-width: 1024px) {
  .right-sidebar { display: none; }
  .main-wrapper { max-width: none; }
  .mobile-search-bar { display: block; }
}

/* スマートフォン（768px以下）: 左サイドバー非表示、ボトムナビ表示 */
@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-bottom-nav { display: block; }
  .main { padding-bottom: 80px; }
}
```

### モバイルボトムナビゲーション

768px以下で画面下部に固定表示されるナビゲーションバーです。

**ゲストユーザー:**
- ホーム / ログイン / 登録

**ログイン済みユーザー:**
- ホーム / 通知（未読バッジ付き）/ 作成 / 保存済 / マイページ

```css
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 50;
  padding-bottom: env(safe-area-inset-bottom, 0); /* iPhoneノッチ対応 */
}
```

通知バッジはデスクトップのサイドバー（`#unreadBadge`）とモバイルのボトムナビ（`#mobileUnreadBadge`）の両方を `updateUnreadBadge()` で同時に更新します。

現在のハッシュに応じて `.mobile-nav-item.active` クラスが自動的に切り替わります。

### モバイル検索バー

1024px以下で右サイドバーが非表示になるため、`.main-wrapper` 内の先頭に検索バーが表示されます。デスクトップでは `display: none` で非表示です。

### モバイル向けUI調整（768px以下）

| コンポーネント | 調整内容 |
|--------------|---------|
| プロフィールアバター | 120px → 80px |
| プロフィールバナー | 150px → 100px |
| フラッシュカード | 高さ250px → 200px、フォント32px → 24px |
| 判定ボタン | 80px → 64px |
| フィードカード | padding 16px → 12px |
| カードタイトル | 18px → 16px |
| モーダル | margin 8px、max-height: calc(100vh - 16px) |
| 単語追加フォーム | 横並び → 縦並び |
| 管理者テーブル | フォント・パディング縮小 |
| 管理者統計グリッド | 3列以上 → 2列 |
| 認証フォーム | パディング縮小、見出し縮小 |
| ゲスト同意バナー | ボトムナビの上に表示（bottom: 56px） |

## アクセシビリティ

### キーボード操作対応

- タブキーでフォーカス遷移可能
- Enter キーでボタン操作
- Esc キーでモーダルを閉じる

### スクリーンリーダー対応

```html
<!-- 例: いいねボタン -->
<span role="button" 
      aria-label="この単語帳にいいねする"
      aria-pressed="false"
      tabindex="0">
  <span class="material-icons">favorite_border</span>
  <span class="like-count">42</span>
</span>
```

### 色コントラスト

- テキストと背景の色コントラスト比は 4.5:1 以上
- 色だけで情報を伝えない（アイコン + 色 のように複合的表現）

## パフォーマンス最適化

### 仮想スクロール検討

大量のアイテムを表示する場合、仮想スクロール（Intersection Observer API）で未表示部分のDOM要素を削除することでメモリ使用量を削減できます。

```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) {
      // 画面外の要素は削除
      entry.target.remove();
    }
  });
});

wordTableBody.querySelectorAll('tr').forEach(row => {
  observer.observe(row);
});
```

### バッチ更新

DOM更新は一度に複数行をまとめて行うことで、ブラウザの再フロー・再ペイントを削減：

```javascript
// ❌ 非効率: 1行ずつ追加
words.forEach(w => {
  wordTableBody.innerHTML += `<tr>...</tr>`;
});

// ✅ 効率的: DocumentFragmentでバッチ追加
const fragment = document.createDocumentFragment();
words.forEach(w => {
  const row = document.createElement('tr');
  row.innerHTML = `<td>...</td>`;
  fragment.appendChild(row);
});
wordTableBody.appendChild(fragment);
```

## トラブルシューティング

### テーブルが崩れて見える

- CSSの `border-collapse: collapse` が設定されているか確認
- スマートフォンで表示の場合、レスポンシブ設定をチェック

### トグルボタンが反応しない

- `isExpanded` 状態管理が正しく行われているか
- イベントリスナーが正しく設定されているか確認

---

[ホームへ戻る](./README.md)
