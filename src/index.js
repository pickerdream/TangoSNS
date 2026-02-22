require('dotenv').config();
const express = require('express');

const authRoutes = require('./routes/auth');
const wordbookRoutes = require('./routes/wordbooks');
const wordRoutes = require('./routes/words');
const commentRoutes = require('./routes/comments');

const app = express();
const port = process.env.PORT || 3000;

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
app.use('/api/admin', adminRoutes);

const tagRoutes = require('./routes/tags');
app.use('/api/tags', tagRoutes);

const trendingRoutes = require('./routes/trending');
app.use('/api/trending', trendingRoutes);

// 404 ハンドラ
app.use((req, res) => {
  res.status(404).json({ error: 'エンドポイントが見つかりません' });
});

// グローバルエラーハンドラ
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'サーバーエラーが発生しました' });
});

app.listen(port, () => {
  console.log(`🚀 サーバー起動中: http://localhost:${port}`);
});
