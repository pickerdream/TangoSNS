const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 環境変数が設定されていません。サーバーを終了します。');
  process.exit(1);
}

/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <token> ヘッダーを検証し req.user にユーザー情報を付与する
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '認証トークンが必要です' });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'トークンが無効または期限切れです' });
  }
};

/**
 * 管理者認証ミドルウェア
 * authenticateの後に使用し、管理者権限を確認する
 */
const requireAdmin = async (req, res, next) => {
  try {
    const result = await db.query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!result.rows[0] || !result.rows[0].is_admin) {
      return res.status(403).json({ error: '管理者権限が必要です' });
    }
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
};

module.exports = { authenticate, requireAdmin, JWT_SECRET };
