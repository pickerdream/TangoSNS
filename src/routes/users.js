const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users/me
 * 自分のプロフィール取得
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id, username, avatar_url, bio, theme, created_at,
                    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following_count
             FROM users WHERE id = $1`,
            [req.user.id]
        );
        if (!result.rows[0]) return res.status(404).json({ error: 'ユーザーが見つかりません' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * PUT /api/users/me
 * プロフィール更新（ユーザー名・パスワード変更）
 * body: { username?, currentPassword?, newPassword? }
 */
router.put('/me', authenticate, async (req, res) => {
    const { username, avatar_url, bio, theme, currentPassword, newPassword } = req.body;

    try {
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

        let newUsername = user.username;
        let newPasswordHash = user.password;

        // ユーザー名更新
        if (username && username !== user.username) {
            newUsername = username;
        }

        // パスワード更新
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: '現在のパスワードを入力してください' });
            }
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) {
                return res.status(401).json({ error: '現在のパスワードが正しくありません' });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: '新しいパスワードは6文字以上にしてください' });
            }
            newPasswordHash = await bcrypt.hash(newPassword, 10);
        }

        const result = await db.query(
            'UPDATE users SET username = $1, password = $2, avatar_url = $3, bio = $4, theme = $5 WHERE id = $6 RETURNING id, username, avatar_url, bio, theme, created_at',
            [newUsername, newPasswordHash, avatar_url ?? user.avatar_url, bio ?? user.bio, theme ?? user.theme, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'そのユーザー名は既に使用されています' });
        }
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/users/:username
 * 他のユーザーのプロフィールと作成した単語帳を取得
 */
router.get('/:username', async (req, res) => {
    try {
        // トークンがある場合はユーザーIDを取得
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'tangosns_secret_key');
                currentUserId = decoded.id;
            } catch (e) { }
        }

        const userResult = await db.query(
            `SELECT id, username, avatar_url, bio, created_at,
                    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count,
                    (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following_count,
                    EXISTS(SELECT 1 FROM follows WHERE follower_id = $2 AND following_id = users.id) AS is_following
             FROM users WHERE username = $1`,
            [req.params.username, currentUserId]
        );
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

        // そのユーザーが作成した単語帳一覧
        const wbResult = await db.query(
            `SELECT id, title, description, created_at 
             FROM wordbooks 
             WHERE user_id = $1 
             ORDER BY created_at DESC`,
            [user.id]
        );

        res.json({
            user,
            wordbooks: wbResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
