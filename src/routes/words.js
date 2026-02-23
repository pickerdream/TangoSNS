const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/**
 * GET /api/wordbooks/:id/words
 * 単語一覧取得
 */
router.get('/', async (req, res) => {
    const { id } = req.params;
    try {
        // 単語帳の存在確認
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        const result = await db.query(
            'SELECT * FROM words WHERE wordbook_id = $1 ORDER BY created_at ASC',
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id/words/:wordId
 * 単語詳細取得（閲覧数をカウント）
 */
router.get('/:wordId', async (req, res) => {
    const { id, wordId } = req.params;
    try {
        // 単語帳の存在確認
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        // 単語を取得し、view_countをインクリメント
        const result = await db.query(
            'UPDATE words SET view_count = view_count + 1 WHERE id = $1 AND wordbook_id = $2 RETURNING *',
            [wordId, id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: '単語が見つかりません' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/wordbooks/:id/words
 * 単語追加（所有者のみ）
 * body: { word, meaning }
 */
router.post('/', authenticate, async (req, res) => {
    const { id } = req.params;
    const { word, meaning } = req.body;
    if (!word || !meaning) {
        return res.status(400).json({ error: '単語と意味は必須です' });
    }
    if (word.length > 200) {
        return res.status(400).json({ error: '単語は200文字以内にしてください' });
    }
    if (meaning.length > 500) {
        return res.status(400).json({ error: '意味は500文字以内にしてください' });
    }
    try {
        // 所有者確認
        const wb = await db.query('SELECT user_id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wb.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'この操作は単語帳の所有者のみ実行できます' });
        }
        const result = await db.query(
            'INSERT INTO words (wordbook_id, word, meaning) VALUES ($1, $2, $3) RETURNING *',
            [id, word, meaning]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * PUT /api/wordbooks/:id/words/:wordId
 * 単語更新（所有者のみ）
 * body: { word, meaning }
 */
router.put('/:wordId', authenticate, async (req, res) => {
    const { id, wordId } = req.params;
    const { word, meaning } = req.body;
    if (!word || !meaning) {
        return res.status(400).json({ error: '単語と意味は必須です' });
    }
    try {
        // 所有者確認
        const wb = await db.query('SELECT user_id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wb.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'この操作は単語帳の所有者のみ実行できます' });
        }
        const result = await db.query(
            'UPDATE words SET word = $1, meaning = $2 WHERE id = $3 AND wordbook_id = $4 RETURNING *',
            [word, meaning, wordId, id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: '単語が見つかりません' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id/words/:wordId
 * 単語削除（所有者のみ）
 */
router.delete('/:wordId', authenticate, async (req, res) => {
    const { id, wordId } = req.params;
    try {
        // 所有者確認
        const wb = await db.query('SELECT user_id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wb.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'この操作は単語帳の所有者のみ実行できます' });
        }
        const result = await db.query(
            'DELETE FROM words WHERE id = $1 AND wordbook_id = $2 RETURNING id',
            [wordId, id]
        );
        if (!result.rows[0]) {
            return res.status(404).json({ error: '単語が見つかりません' });
        }
        res.json({ message: '単語を削除しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
