const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/**
 * GET /api/wordbooks/:id/comments
 * コメント一覧取得
 */
router.get('/', async (req, res) => {
    const { id } = req.params;
    try {
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        const result = await db.query(
            `SELECT c.id, c.comment, c.created_at,
              u.id AS user_id, u.username
       FROM comments c
       JOIN users u ON c.user_id = u.id
       WHERE c.wordbook_id = $1
       ORDER BY c.created_at ASC`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/wordbooks/:id/comments
 * コメント投稿（要認証）
 * body: { comment }
 */
router.post('/', authenticate, async (req, res) => {
    const { id } = req.params;
    const { comment } = req.body;
    if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'コメントは必須です' });
    }
    try {
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        const result = await db.query(
            `INSERT INTO comments (user_id, wordbook_id, comment)
       VALUES ($1, $2, $3)
       RETURNING id, comment, created_at`,
            [req.user.id, id, comment.trim()]
        );
        const row = result.rows[0];
        res.status(201).json({
            id: row.id,
            comment: row.comment,
            created_at: row.created_at,
            user_id: req.user.id,
            username: req.user.username,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id/comments/:commentId
 * コメント削除（投稿者のみ）
 */
router.delete('/:commentId', authenticate, async (req, res) => {
    const { id, commentId } = req.params;
    try {
        const result = await db.query(
            `DELETE FROM comments
       WHERE id = $1 AND wordbook_id = $2 AND user_id = $3
       RETURNING id`,
            [commentId, id, req.user.id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: 'コメントが見つからないか権限がありません' });
        }
        res.json({ message: 'コメントを削除しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
