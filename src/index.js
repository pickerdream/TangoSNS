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

// OGP用HTMLエスケープ
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 単語帳ページの動的OGP（SNS共有時にタイトル・説明を表示）
app.get('/wordbook/:id', async (req, res) => {
  const { id } = req.params;
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
      // 単語帳が見つからない場合はデフォルトのindex.htmlを返す
      return res.send(indexHtmlTemplate);
    }

    const wb = result.rows[0];
    const displayName = wb.display_name || wb.username;
    const title = `${wb.title} - ${displayName}の単語帳 | TangoSNS`;
    const description = wb.description
      ? wb.description.slice(0, 150)
      : `${displayName}が作成した単語帳「${wb.title}」（${wb.word_count}語）`;
    const ogUrl = `${req.protocol}://${req.get('host')}/wordbook/${id}`;

    // メタタグを動的に置換
    let html = indexHtmlTemplate;
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${escapeHtml(title)}</title>`
    );
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<meta property="og:title" content=".*?">/,
      `<meta property="og:title" content="${escapeHtml(title)}">`
    );
    html = html.replace(
      /<meta property="og:description" content=".*?">/,
      `<meta property="og:description" content="${escapeHtml(description)}">`
    );
    html = html.replace(
      /<meta name="twitter:title" content=".*?">/,
      `<meta name="twitter:title" content="${escapeHtml(title)}">`
    );
    html = html.replace(
      /<meta name="twitter:description" content=".*?">/,
      `<meta name="twitter:description" content="${escapeHtml(description)}">`
    );
    // og:url を追加（og:locale の前に挿入）
    html = html.replace(
      /<meta property="og:locale"/,
      `<meta property="og:url" content="${escapeHtml(ogUrl)}">\n  <meta property="og:locale"`
    );

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
