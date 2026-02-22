const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/trending/words
 * 単語帳の学習回数が多い順に単語を取得
 */
router.get('/words', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT w.id, w.word, w.meaning, w.view_count,
                    wb.title AS wordbook_title, wb.id AS wordbook_id,
                    u.username,
                    COALESCE((SELECT COUNT(*) FROM study_history sh WHERE sh.wordbook_id = wb.id), 0) AS study_count
             FROM words w
             JOIN wordbooks wb ON w.wordbook_id = wb.id
             JOIN users u ON wb.user_id = u.id
             ORDER BY study_count DESC, w.view_count DESC
             LIMIT 5`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;