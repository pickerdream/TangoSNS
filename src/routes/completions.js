const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// 全ルートで認証必須
router.use(authenticate);

// 単語帳を完了マークする
router.post('/:wordbookId', async (req, res) => {
    try {
        const { wordbookId } = req.params;
        await db.query(
            `INSERT INTO wordbook_completions (user_id, wordbook_id) 
             VALUES ($1, $2) 
             ON CONFLICT (user_id, wordbook_id) DO NOTHING`,
            [req.user.id, wordbookId]
        );
        res.status(201).json({ message: '単語帳を完了マークしました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 単語帳の完了マークを外す
router.delete('/:wordbookId', async (req, res) => {
    try {
        const { wordbookId } = req.params;
        await db.query(
            'DELETE FROM wordbook_completions WHERE user_id = $1 AND wordbook_id = $2',
            [req.user.id, wordbookId]
        );
        res.json({ message: '完了マークを外しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
