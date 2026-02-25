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
            `SELECT id, username, display_name, avatar_url, bio, theme, created_at,
                    (password IS NOT NULL) AS has_password,
                    (google_id IS NOT NULL) AS has_google,
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
 * プロフィール更新（ユーザー名・表示名・パスワード変更）
 * body: { username?, display_name?, currentPassword?, newPassword? }
 */
router.put('/me', authenticate, async (req, res) => {
    const { username, display_name, avatar_url, bio, theme, currentPassword, newPassword } = req.body;

    try {
        const userResult = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = userResult.rows[0];
        if (!user) return res.status(404).json({ error: 'ユーザーが見つかりません' });

        let newUsername = user.username;
        let newDisplayName = user.display_name;
        let newPasswordHash = user.password;

        // アカウントID更新
        if (username && username !== user.username) {
            if (username.length > 30) {
                return res.status(400).json({ error: 'アカウントIDは30文字以内にしてください' });
            }
            if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                return res.status(400).json({ error: 'アカウントIDは半角英数字とアンダースコアのみ使用できます' });
            }
            newUsername = username;
        }

        // 表示名更新
        if (display_name !== undefined && display_name !== user.display_name) {
            if (!display_name) {
                return res.status(400).json({ error: '表示名は必須です' });
            }
            if (display_name.length > 50) {
                return res.status(400).json({ error: '表示名は50文字以内にしてください' });
            }
            newDisplayName = display_name;
        }

        // パスワード更新
        if (newPassword) {
            if (newPassword.length < 6) {
                return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
            }
            if (newPassword.length > 128) {
                return res.status(400).json({ error: 'パスワードは128文字以内にしてください' });
            }
            // 既にパスワードが設定されている場合は現在のパスワードを要求
            if (user.password) {
                if (!currentPassword) {
                    return res.status(400).json({ error: '現在のパスワードを入力してください' });
                }
                const valid = await bcrypt.compare(currentPassword, user.password);
                if (!valid) {
                    return res.status(401).json({ error: '現在のパスワードが正しくありません' });
                }
            }
            // パスワード未設定(OAuthユーザー)の場合はそのまま新規設定を許可
            newPasswordHash = await bcrypt.hash(newPassword, 10);
        }

        const result = await db.query(
            'UPDATE users SET username = $1, display_name = $2, password = $3, avatar_url = $4, bio = $5, theme = $6 WHERE id = $7 RETURNING id, username, display_name, avatar_url, bio, theme, created_at',
            [newUsername, newDisplayName, newPasswordHash, avatar_url ?? user.avatar_url, bio ?? user.bio, theme ?? user.theme, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'そのアカウントIDは既に使用されています' });
        }
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/users/search?q=...
 * ユーザー検索（表示名・アカウントIDで部分一致）
 */
router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q || !q.trim()) {
        return res.json([]);
    }

    try {
        const result = await db.query(
            `SELECT id, username, display_name, avatar_url, bio,
                    (SELECT COUNT(*) FROM follows WHERE following_id = users.id) AS followers_count
             FROM users
             WHERE username ILIKE $1 OR display_name ILIKE $1
             ORDER BY
               CASE WHEN username ILIKE $2 THEN 0 WHEN display_name ILIKE $2 THEN 1 ELSE 2 END,
               username
             LIMIT 20`,
            [`%${q.trim()}%`, `${q.trim()}%`]
        );
        res.json(result.rows);
    } catch (err) {
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
            `SELECT id, username, display_name, avatar_url, bio, created_at,
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
