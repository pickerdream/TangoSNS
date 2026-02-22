# ゲストユーザー（未ログイン）アクセス制御

## 概要

TangoSNSでは、ログインしていないゲストユーザーにも特定の機能へのアクセスを許可しています。これにより、ユーザーがアカウント登録なしでプラットフォームの機能を体験でき、登録への動機付けになります。

## ゲストユーザーがアクセス可能なページ

### 1. ホームページ (`#/`)
- 全公開中の単語帳フィード表示
- 急上昇の単語帳表示
- 人気タグの表示
- 検索機能の使用

### 2. 単語帳詳細 (`#/wordbook/:id`)
- 単語帳の内容閲覧
- 登録された単語の表示（表形式）
- コメント一覧の表示
- タグの表示
- 作成者情報の表示

### 3. ユーザープロフィール (`#/user/:username`)
- ユーザー情報の閲覧
- ユーザーが作成した単語帳一覧
- ユーザーの自己紹介・プロフィール情報

## ゲストユーザーが制限されている機能

### ブロック
- ログイン画面への意図的なリダイレクト：
  - プロフィール編集 (`#/profile`)
  - 設定 (`#/settings`)
  - 学習履歴 (`#/history`)
  - 通知 (`#/notifications`)
  - 管理者パネル (`#/admin`)

### 制限された操作
- 単語帳の作成・編集・削除
- 単語の追加・編集
- コメント投稿
- いいね機能
- 学習モードの起動
- 完了マークの付与
- タグフォロー

## 実装詳細

### ルーティング制御（`public/app.js` - `router` 関数）

```javascript
// 未ログイン時のアクセス制限
if (!token && 
    hash !== '#/login' && 
    hash !== '#/register' &&
    hash !== '#/' &&
    !hash.startsWith('#/?') &&
    !hash.startsWith('#/wordbook/') &&
    !hash.startsWith('#/user/')) {
  renderLanding(appDiv);
  return;
}
```

ゲストユーザーがアクセス可能なルートは以下の通り：
- `#/login` - ログインページ
- `#/register` - 登録ページ
- `#/` - ホームページ
- `#/?tag=xxx` - タグ検索
- `#/wordbook/:id` - 単語帳詳細
- `#/user/:username` - ユーザープロフィール

### レイアウト表示（`createLayout(user)` 関数）

ゲストユーザー（`user === null`）の場合は簡略化されたレイアウトを表示：

```javascript
// ゲスト用サイドバー
- ホームリンク
- ログインボタン
- 登録ボタン
- 検索ボックス
- 急上昇
- 人気タグ
- おすすめ（ログイン促進メッセージ）
```

ログイン済みユーザーの場合は完全なサイドバー：
- 学習履歴リンク
- 通知リンク
- プロフィールリンク
- 設定リンク
- 管理者パネル（管理者のみ）

### ゲスト向け同意バナー（`public/app.js` - `renderGuestConsentPopup` 関数）

ゲストユーザーに対して、サービス利用が利用規約およびプライバシーポリシーへの同意とみなされることを通知するバナーを表示します。

- **表示条件**: ログインしていないユーザーがアクセスした際、レイアウト生成時に自動的に表示。
- **デザイン**: 画面下部に固定（Fixed）、アプリケーションのテーマに合わせたアクセントカラー（グリーン）で表示。
- **機能**: 利用規約とプライバシーポリシーへの直接リンクを提供し、バナーを閉じるボタン（×）を配置。

```javascript
function renderGuestConsentPopup(container) {
  const popup = document.createElement('div');
  popup.className = 'guest-consent-banner';
  popup.innerHTML = `
    <div class="guest-consent-content">
      サービスを利用することで、
      <a href="#/terms">利用規約</a>と
      <a href="#/privacy">プライバシーポリシー</a>に同意したものとみなされます。
    </div>
    <button onclick="this.parentElement.remove()" style="color:white; opacity:0.7">
      <span class="material-icons" style="font-size:18px">close</span>
    </button>
  `;
  container.appendChild(popup);
}
```

### ゲスト向けCTA（Call To Action）


各ページにおいて、ゲストユーザーを登録・ログインに導くメッセージを配置：

- 単語帳詳細：「学習を始める」ボタンをクリックするとログイン画面へリダイレクト
- コメント投稿エリア：「コメントを投稿するにはログインしてください」メッセージ

## API呼び出し時の認証

### トークン付与
ゲストユーザーはトークンを持たないため、認証が不要なAPIエンドポイントのみアクセス可能：

```javascript
// fetchAPI関数内
const token = localStorage.getItem('token');
if (token) {
  headers['Authorization'] = `Bearer ${token}`;
}
```

### アクセス可能なエンドポイント（認証不要）
- `GET /wordbooks/:id` - 単語帳詳細取得
- `GET /wordbooks/:id/words` - 単語一覧取得
- `GET /wordbooks/:id/comments` - コメント一覧取得
- `GET /users/:username` - ユーザー情報取得
- `GET /wordbooks` - 単語帳一覧取得（検索・フィルタ）

### アクセス制限されたエンドポイント（認証必須）
- `POST /wordbooks` - 単語帳作成
- `PUT/DELETE /wordbooks/:id` - 単語帳編集・削除
- `POST /wordbooks/:id/comments` - コメント投稿
- `POST /study/:wbId/start` - 学習開始
- 他すべての変更操作

## ビュー数カウント（ゲスト対応）

ゲストユーザーが単語帳を閲覧した場合、IP アドレス + ポート番号 + 単語帳IDで1時間ごとにビュー数をカウント（`guest_wordbook_views` テーブル）。

詳細は [**ビュー数制限管理**](./view-counting.md) を参照。

## セッション管理

ゲストユーザーはSessionIDを持たず、ブラウザのlocalStorageのみが状態管理の対象：

```javascript
// ゲスト状態の判定
const user = JSON.parse(localStorage.getItem('user') || 'null');
if (user === null) {
  // ゲストユーザー
}
```

ゲストユーザーが操作を行う場合、プリフライトチェック通常、APIレスポンスで `401 Unauthorized` が返されます。

## UX設計原則

1. **段階的な機能公開** - コア機能（閲覧）は誰でも利用可能に
2. **登録への自然な導線** - 操作時に「ログインが必要」というメッセージを表示
3. **信頼構築** - ゲストが十分な体験をしてから登録を促す

---

[ホームへ戻る](./README.md)
