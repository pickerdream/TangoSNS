const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate, JWT_SECRET } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/**
 * GET /api/wordbooks/:id/verifications
 * 保証ユーザー一覧 + 保証数 + 自分が保証済みか
 */
router.get('/', async (req, res) => {
    const wordbookId = req.params.id;
    try {
        const wbCheck = await db.query('SELECT id FROM wordbooks WHERE id = $1', [wordbookId]);
        if (!wbCheck.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }

        // 任意認証: トークンがあれば現ユーザーIDを取得
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
                currentUserId = decoded.id;
            } catch (e) { /* ignore */ }
        }

        const result = await db.query(
            `SELECT wv.created_at, u.id AS user_id, u.username, u.display_name, u.avatar_url, u.is_verified
             FROM wordbook_verifications wv
             JOIN users u ON u.id = wv.user_id
             WHERE wv.wordbook_id = $1
             ORDER BY wv.created_at DESC`,
            [wordbookId]
        );

        res.json({
            verification_count: result.rows.length,
            verified_by_current_user: currentUserId ? result.rows.some(r => r.user_id === currentUserId) : false,
            verifiers: result.rows,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/wordbooks/:id/verifications
 * 単語帳を保証（認証済みユーザーのみ）
 */
router.post('/', authenticate, async (req, res) => {
    const wordbookId = req.params.id;
    try {
        const userCheck = await db.query('SELECT is_verified FROM users WHERE id = $1', [req.user.id]);
        if (!userCheck.rows[0] || !userCheck.rows[0].is_verified) {
            return res.status(403).json({ error: '認証済みユーザーのみ単語帳を保証できます' });
        }

        const wbCheck = await db.query('SELECT id, user_id FROM wordbooks WHERE id = $1', [wordbookId]);
        if (!wbCheck.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wbCheck.rows[0].user_id === req.user.id) {
            return res.status(400).json({ error: '自分の単語帳は保証できません' });
        }

        try {
            await db.query(
                'INSERT INTO wordbook_verifications (wordbook_id, user_id) VALUES ($1, $2)',
                [wordbookId, req.user.id]
            );
            res.json({ message: '単語帳を保証しました' });
        } catch (err) {
            if (err.code === '23505') {
                return res.status(400).json({ error: 'すでにこの単語帳を保証しています' });
            }
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id/verifications
 * 保証を取り消し
 */
router.delete('/', authenticate, async (req, res) => {
    const wordbookId = req.params.id;
    try {
        const result = await db.query(
            'DELETE FROM wordbook_verifications WHERE wordbook_id = $1 AND user_id = $2',
            [wordbookId, req.user.id]
        );
        if (result.rowCount === 0) {
            return res.status(400).json({ error: 'この単語帳を保証していません' });
        }
        res.json({ message: '保証を取り消しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
