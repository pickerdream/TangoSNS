const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// 全ルートで認証必須
router.use(authenticate);

// 学習完了 (履歴と間違いの保存)
router.post('/finish', async (req, res) => {
    const { wordbookId, wrongWordIds } = req.body;
    if (!wordbookId) return res.status(400).json({ error: 'wordbookIdが必要です' });

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 1. 学習履歴 (study_history) を記録
        await client.query(
            'INSERT INTO study_history (user_id, wordbook_id) VALUES ($1, $2)',
            [req.user.id, wordbookId]
        );

        // 2. 間違えた単語 (study_mistakes) を記録
        if (wrongWordIds && Array.isArray(wrongWordIds)) {
            for (const wordId of wrongWordIds) {
                // 既に同じ単語を間違えている場合は無視 (ON CONFLICT DO NOTHING)
                await client.query(
                    `INSERT INTO study_mistakes (user_id, wordbook_id, word_id) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id, wordbook_id, word_id) DO NOTHING`,
                    [req.user.id, wordbookId, wordId]
                );
            }
        }

        // 3. 学習した単語のstudy_countをインクリメント
        await client.query(
            'UPDATE words SET study_count = study_count + 1 WHERE wordbook_id = $1',
            [wordbookId]
        );

        await client.query('COMMIT');
        res.status(201).json({ message: '学習記録を保存しました' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    } finally {
        client.release();
    }
});

// 学習履歴の取得
router.get('/history', async (req, res) => {
    try {
        // 直近学習した単語帳を重複なしで最新順に取得しつつ、その単語帳での「間違えた単語数」も集計して返す
        const result = await db.query(
            `SELECT DISTINCT ON (h.wordbook_id) 
          h.wordbook_id, h.created_at as last_studied,
          w.title, w.description, u.username,
          (SELECT COUNT(*) FROM study_mistakes m WHERE m.user_id = h.user_id AND m.wordbook_id = h.wordbook_id) as mistakes_count,
          EXISTS(SELECT 1 FROM wordbook_completions comp WHERE comp.wordbook_id = h.wordbook_id AND comp.user_id = h.user_id) AS is_completed
        FROM study_history h
        JOIN wordbooks w ON h.wordbook_id = w.id
        JOIN users u ON w.user_id = u.id
        WHERE h.user_id = $1
        ORDER BY h.wordbook_id, h.created_at DESC`,
            [req.user.id]
        );

        // DISTINCT ON の仕様で wordbook_id 順になるため、アプリ側で last_studied の降順で並び替える
        const history = result.rows.sort((a, b) => new Date(b.last_studied) - new Date(a.last_studied));
        res.json(history);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 特定の単語帳において間違えた単語リストを取得
router.get('/mistakes/:wordbookId', async (req, res) => {
    try {
        const { wordbookId } = req.params;
        const result = await db.query(
            `SELECT w.id, w.word, w.meaning, m.created_at
       FROM study_mistakes m
       JOIN words w ON m.word_id = w.id
       WHERE m.user_id = $1 AND m.wordbook_id = $2
       ORDER BY m.created_at DESC`,
            [req.user.id, wordbookId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 特定の単語の間違い記録を削除 (正解して克服した等)
router.delete('/mistakes/:wordbookId/:wordId', async (req, res) => {
    try {
        const { wordbookId, wordId } = req.params;
        await db.query(
            'DELETE FROM study_mistakes WHERE user_id = $1 AND wordbook_id = $2 AND word_id = $3',
            [req.user.id, wordbookId, wordId]
        );
        res.json({ message: '間違い記録を削除しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
