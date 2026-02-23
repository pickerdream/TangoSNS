const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/register
 * ユーザー登録
 * body: { username, password }
 */
router.post('/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
    }
    if (username.length > 30) {
        return res.status(400).json({ error: 'ユーザー名は30文字以内にしてください' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    if (password.length > 128) {
        return res.status(400).json({ error: 'パスワードは128文字以内にしてください' });
    }

    // IPアドレス・ポート・User-Agentを取得
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const port = req.socket?.remotePort || null;
    const userAgent = req.headers['user-agent'] || null;

    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (username, password, registration_ip) VALUES ($1, $2, $3) RETURNING id, username, created_at, is_admin',
            [username, hashed, ip]
        );
        const user = result.rows[0];

        // IPアクティビティログに記録
        await db.query(
            'INSERT INTO user_ip_logs (user_id, ip_address, port, action, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, ip, port, 'register', userAgent]
        );

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            user: { ...user, bio: null, avatar_url: null, theme: 'system', is_admin: user.is_admin },
            token
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'このユーザー名は既に使用されています' });
        }
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/auth/login
 * ログイン
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        // BANチェック
        if (user.is_banned) {
            return res.status(403).json({ error: 'このアカウントは利用停止されています。詳細はお問い合わせください。' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        // IPアドレス・ポート・User-Agentを取得
        const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
        const port = req.socket?.remotePort || null;
        const userAgent = req.headers['user-agent'] || null;

        // IPアクティビティログに記録
        await db.query(
            'INSERT INTO user_ip_logs (user_id, ip_address, port, action, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, ip, port, 'login', userAgent]
        );

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: {
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                bio: user.bio,
                theme: user.theme,
                created_at: user.created_at,
                is_admin: user.is_admin
            },
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
