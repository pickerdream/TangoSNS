const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tangosns_secret_key';

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

module.exports = { authenticate, JWT_SECRET };
