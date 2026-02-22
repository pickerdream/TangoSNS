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
    if (password.length < 6) {
        return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }

    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username, created_at',
            [username, hashed]
        );
        const user = result.rows[0];
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ user, token });
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

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: { id: user.id, username: user.username, created_at: user.created_at },
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
