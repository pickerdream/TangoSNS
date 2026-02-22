const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/wordbooks
 * 単語帳一覧取得
 * クライアント側で ?username=... や ?q=... を指定可能
 */
router.get('/', async (req, res) => {
    try {
        const { username, q } = req.query;

        // ログイン中のユーザーIDを取得（認証は任意だが、完了マーク表示に必要）
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'tangosns_secret_key');
                currentUserId = decoded.id;
            } catch (e) { }
        }

        let query = `
      SELECT w.id, w.title, w.description, w.created_at,
             u.id AS user_id, u.username, u.avatar_url,
             EXISTS(SELECT 1 FROM wordbook_completions c WHERE c.wordbook_id = w.id AND c.user_id = $1) AS is_completed
      FROM wordbooks w
      JOIN users u ON w.user_id = u.id
    `;
        const params = [currentUserId];
        const conditions = [];

        if (username) {
            params.push(username);
            conditions.push(`u.username = $${params.length}`);
        }
        if (q) {
            params.push(`%${q}%`);
            conditions.push(`(w.title ILIKE $${params.length} OR w.description ILIKE $${params.length})`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        query += ' ORDER BY w.created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/wordbooks
 * 単語帳新規作成
 */
router.post('/', authenticate, async (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'タイトルは必須です' });

    try {
        const result = await db.query(
            'INSERT INTO wordbooks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, title, description]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id
 * 単語帳詳細取得（単語・コメント数も含む）
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;
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

        const wbResult = await db.query(
            `SELECT w.id, w.title, w.description, w.created_at,
               u.id AS user_id, u.username, u.avatar_url, u.bio,
               COUNT(DISTINCT wd.id) AS word_count,
               COUNT(DISTINCT c.id)  AS comment_count,
               EXISTS(SELECT 1 FROM wordbook_completions comp WHERE comp.wordbook_id = w.id AND comp.user_id = $2) AS is_completed
        FROM wordbooks w
        JOIN users u ON w.user_id = u.id
        LEFT JOIN words wd ON wd.wordbook_id = w.id
        LEFT JOIN comments c ON c.wordbook_id = w.id
        WHERE w.id = $1
        GROUP BY w.id, u.id`,
            [id, currentUserId]
        );

        if (!wbResult.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        res.json(wbResult.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        // 所有権の確認
        const check = await db.query('SELECT user_id FROM wordbooks WHERE id = $1', [id]);
        if (!check.rows[0]) return res.status(404).json({ error: '単語帳が見つかりません' });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: '削除権限がありません' });

        await db.query('DELETE FROM wordbooks WHERE id = $1', [id]);
        res.json({ message: '単語帳を削除しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
