require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const wordbookRoutes = require('./routes/wordbooks');
const wordRoutes = require('./routes/words');
const commentRoutes = require('./routes/comments');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// index.html テンプレートを読み込み
const indexHtmlPath = path.join(__dirname, '..', 'public', 'index.html');
const indexHtmlTemplate = fs.readFileSync(indexHtmlPath, 'utf-8');

// リバースプロキシ経由の X-Forwarded-For を信頼する
app.set('trust proxy', true);

// Cloudflare Tunnel 経由の場合、HTTP → HTTPS リダイレクト
app.use((req, res, next) => {
  if (req.headers['cf-connecting-ip'] && req.protocol === 'http') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

// ミドルウェア
app.use(express.json());

// JSONパースエラー時のクラッシュ防止
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON Parse Error:', err.message);
    return res.status(400).json({ error: '不正なJSONフォーマットです' });
  }
  next();
});

// OGP用HTMLエスケープ（1パスで全文字を置換）
const OGP_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
const OGP_ESCAPE_RE = /[&<>"']/g;
function escapeHtml(str) {
  return str.replace(OGP_ESCAPE_RE, ch => OGP_ESCAPE_MAP[ch]);
}

// OGP用ローディング画面（JS読み込み前に即座に表示、テーマ対応）
const ogpLoading = `<div id="ogp-loading" style="
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  min-height:100vh;gap:16px;
  background:var(--bg-color,#fff);color:var(--text-secondary,#536471);
  font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
">
  <div style="
    width:36px;height:36px;border:3px solid var(--border-color,#eee);
    border-top-color:var(--accent-color,#00ba7c);border-radius:50%;
    animation:ogp-spin .7s linear infinite;
  "></div>
  <span style="font-size:14px">読み込み中...</span>
  <style>@keyframes ogp-spin{to{transform:rotate(360deg)}}</style>
</div>`;

// OGPテンプレート: index.html からプレースホルダ付きテンプレートを事前構築
const ogpTemplate = indexHtmlTemplate
  .replace(/<title>.*?<\/title>/, '<title>{{TITLE}}</title>')
  .replace(/<meta name="description" content=".*?">/, '<meta name="description" content="{{DESC}}">')
  .replace(/<meta property="og:title" content=".*?">/, '<meta property="og:title" content="{{TITLE}}">')
  .replace(/<meta property="og:description" content=".*?">/, '<meta property="og:description" content="{{DESC}}">')
  .replace(/<meta name="twitter:title" content=".*?">/, '<meta name="twitter:title" content="{{TITLE}}">')
  .replace(/<meta name="twitter:description" content=".*?">/, '<meta name="twitter:description" content="{{DESC}}">')
  .replace(/<meta property="og:locale"/, '<meta property="og:url" content="{{URL}}">\n  <meta property="og:locale"')
  .replace('<div id="app"></div>', `<div id="app">${ogpLoading}</div>`);

// OGPキャッシュ（LRU風: Map の挿入順を利用、5分TTL、最大500件）
const OGP_CACHE_TTL = 5 * 60 * 1000;
const OGP_CACHE_MAX = 500;
const ogpCache = new Map();

function getOgpCache(key) {
  const entry = ogpCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > OGP_CACHE_TTL) {
    ogpCache.delete(key);
    return null;
  }
  return entry.html;
}

function setOgpCache(key, html) {
  if (ogpCache.size >= OGP_CACHE_MAX) {
    // 最も古いエントリを削除
    ogpCache.delete(ogpCache.keys().next().value);
  }
  ogpCache.set(key, { html, ts: Date.now() });
}

// 単語帳ページの動的OGP（SNS共有時にタイトル・説明を表示）
app.get('/wordbook/:id', async (req, res) => {
  const id = req.params.id;

  // 正の整数以外は即座にデフォルトHTMLを返す
  if (!/^\d+$/.test(id)) {
    return res.send(indexHtmlTemplate);
  }

  // キャッシュチェック
  const cached = getOgpCache(id);
  if (cached) return res.send(cached);

  try {
    const result = await db.query(
      `SELECT w.title, w.description, u.username, u.display_name,
              (SELECT COUNT(*) FROM words WHERE wordbook_id = w.id) AS word_count
       FROM wordbooks w
       JOIN users u ON w.user_id = u.id
       WHERE w.id = $1`,
      [id]
    );

    if (!result.rows[0]) {
      return res.send(indexHtmlTemplate);
    }

    const wb = result.rows[0];
    const displayName = wb.display_name || wb.username;
    const title = escapeHtml(`${wb.title} - ${displayName}の単語帳 | TangoSNS`);
    const description = escapeHtml(
      wb.description
        ? wb.description.slice(0, 150)
        : `${displayName}が作成した単語帳「${wb.title}」（${wb.word_count}語）`
    );
    const ogUrl = escapeHtml(`https://${req.get('host')}/wordbook/${id}`);

    // プレースホルダを一括置換
    const html = ogpTemplate
      .replaceAll('{{TITLE}}', title)
      .replaceAll('{{DESC}}', description)
      .replaceAll('{{URL}}', ogUrl);

    setOgpCache(id, html);
    res.send(html);
  } catch (err) {
    console.error('OGP route error:', err);
    res.send(indexHtmlTemplate);
  }
});

app.use(express.static('public')); // 追加：フロントエンド用

const userRoutes = require('./routes/users');

// ルート
app.get('/api/', (req, res) => {
  res.json({ message: '単語帳アプリ API へようこそ！', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/wordbooks', wordbookRoutes);
app.use('/api/wordbooks/:id/words', wordRoutes);
app.use('/api/wordbooks/:id/comments', commentRoutes);

const studyRoutes = require('./routes/study');
app.use('/api/study', studyRoutes);

const completionRoutes = require('./routes/completions');
app.use('/api/completions', completionRoutes);

const notificationRoutes = require('./routes/notifications');
app.use('/api/notifications', notificationRoutes);

const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);

const tagRoutes = require('./routes/tags');
app.use('/api/tags', tagRoutes);

const trendingRoutes = require('./routes/trending');
app.use('/api/trending', trendingRoutes);

const followRoutes = require('./routes/follows');
app.use('/api/follows', followRoutes);

// 404 ハンドラ
app.use((req, res) => {
  res.status(404).json({ error: 'エンドポイントが見つかりません' });
});

// グローバルエラーハンドラ
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

const { runMigrations } = require('./migrate');

(async () => {
  try {
    await runMigrations();
    app.listen(port, () => {
      console.log(`🚀 サーバー起動中: http://localhost:${port}`);
    });
  } catch (err) {
    console.error('マイグレーション失敗:', err.message);
    process.exit(1);
  }
})();
