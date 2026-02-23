const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/reports
 * アカウントまたは単語帳を通報する
 */
router.post('/', authenticate, async (req, res) => {
    const { reported_user_id, reported_wordbook_id, reason } = req.body;

    if (!reason) {
        return res.status(400).json({ error: '通報理由は必須です' });
    }

    if (!reported_user_id && !reported_wordbook_id) {
        return res.status(400).json({ error: '通報対象（ユーザーまたは単語帳）が必要です' });
    }

    try {
        await db.query(
            'INSERT INTO reports (reporter_id, reported_user_id, reported_wordbook_id, reason) VALUES ($1, $2, $3, $4)',
            [req.user.id, reported_user_id || null, reported_wordbook_id || null, reason]
        );

        res.json({ message: '通報を受け付けました。ご協力ありがとうございます。' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
