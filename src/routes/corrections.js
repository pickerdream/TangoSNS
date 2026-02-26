const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

/**
 * POST /api/wordbooks/:id/corrections/batch
 * 修正提案を一括送信（提案名・説明付き）
 * body: { title, description, corrections: [{ word_id, suggested_word, suggested_meaning }, ...] }
 */
router.post('/batch', authenticate, async (req, res) => {
    const wordbookId = req.params.id;
    const { title, description, corrections } = req.body;

    if (!title || !title.trim()) {
        return res.status(400).json({ error: '提案名は必須です' });
    }
    if (title.trim().length > 100) {
        return res.status(400).json({ error: '提案名は100文字以内にしてください' });
    }
    if (!Array.isArray(corrections) || corrections.length === 0) {
        return res.status(400).json({ error: '修正提案が含まれていません' });
    }
    if (corrections.length > 100) {
        return res.status(400).json({ error: '一度に送信できる修正提案は100件までです' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 単語帳情報を取得
        const wbResult = await client.query('SELECT user_id, title FROM wordbooks WHERE id = $1', [wordbookId]);
        if (!wbResult.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        const { user_id: ownerId, title: wbTitle } = wbResult.rows[0];

        if (req.user.id === ownerId) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: '自分の単語帳には修正提案できません' });
        }

        // 対象の単語を一括取得
        const wordIds = [...new Set(corrections.map(c => c.word_id))];
        const wordsResult = await client.query(
            `SELECT id, word, meaning FROM words WHERE wordbook_id = $1 AND id = ANY($2)`,
            [wordbookId, wordIds]
        );
        const wordMap = {};
        wordsResult.rows.forEach(w => { wordMap[w.id] = w; });

        // 提案（proposal）を作成
        const proposalResult = await client.query(
            `INSERT INTO correction_proposals (wordbook_id, suggester_id, title, description)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [wordbookId, req.user.id, title.trim(), (description || '').trim() || null]
        );
        const proposal = proposalResult.rows[0];

        const inserted = [];
        const errors = [];

        for (const corr of corrections) {
            const current = wordMap[corr.word_id];
            if (!current) {
                errors.push({ word_id: corr.word_id, error: '単語が見つかりません' });
                continue;
            }

            const finalWord = (corr.suggested_word != null && corr.suggested_word.trim()) ? corr.suggested_word.trim() : current.word;
            const finalMeaning = (corr.suggested_meaning != null && corr.suggested_meaning.trim()) ? corr.suggested_meaning.trim() : current.meaning;

            if (finalWord === current.word && finalMeaning === current.meaning) {
                continue; // 変更なしはスキップ
            }
            if (finalWord.length > 200) {
                errors.push({ word_id: corr.word_id, error: '単語は200文字以内にしてください' });
                continue;
            }
            if (finalMeaning.length > 500) {
                errors.push({ word_id: corr.word_id, error: '意味は500文字以内にしてください' });
                continue;
            }

            const insertResult = await client.query(
                `INSERT INTO word_corrections (word_id, wordbook_id, suggester_id, suggested_word, suggested_meaning, proposal_id)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [corr.word_id, wordbookId, req.user.id, finalWord, finalMeaning, proposal.id]
            );
            inserted.push(insertResult.rows[0]);
        }

        if (inserted.length === 0) {
            await client.query('ROLLBACK');
            if (errors.length > 0) {
                return res.status(400).json({ error: '有効な修正提案がありませんでした', errors });
            }
            return res.status(400).json({ error: '変更がありません' });
        }

        // 通知を送る
        const suggester = await client.query('SELECT username FROM users WHERE id = $1', [req.user.id]);
        await client.query(
            'INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)',
            [
                ownerId,
                'correction',
                `@${suggester.rows[0].username}さんが単語帳「${wbTitle}」に修正提案「${title.trim()}」を送信しました`,
                `#/wordbook/${wordbookId}`
            ]
        );

        await client.query('COMMIT');
        res.status(201).json({ inserted: inserted.length, proposal_id: proposal.id, errors });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    } finally {
        client.release();
    }
});

/**
 * GET /api/wordbooks/:id/corrections/count
 * 保留中の修正提案数を取得（提案単位）
 */
router.get('/count', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT COUNT(*) FROM correction_proposals WHERE wordbook_id = $1 AND status = $2',
            [req.params.id, 'pending']
        );
        res.json({ count: parseInt(result.rows[0].count) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id/corrections/proposals
 * 提案一覧を取得（status クエリパラメータでフィルタ可能）
 */
router.get('/proposals', async (req, res) => {
    const wordbookId = req.params.id;
    const { status } = req.query;

    try {
        const params = [wordbookId];
        let query = `
            SELECT cp.*,
                   u.username, u.display_name, u.avatar_url, u.is_verified,
                   (SELECT COUNT(*) FROM word_corrections wc WHERE wc.proposal_id = cp.id) AS correction_count
            FROM correction_proposals cp
            JOIN users u ON u.id = cp.suggester_id
            WHERE cp.wordbook_id = $1
        `;

        if (status) {
            params.push(status);
            query += ` AND cp.status = $${params.length}`;
        }

        query += ' ORDER BY cp.created_at DESC';

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id/corrections/proposals/:pid
 * 提案の詳細（含む全修正内容）
 */
router.get('/proposals/:pid', async (req, res) => {
    const { id: wordbookId, pid } = req.params;

    try {
        // 提案情報
        const proposalResult = await db.query(
            `SELECT cp.*, u.username, u.display_name, u.avatar_url, u.is_verified
             FROM correction_proposals cp
             JOIN users u ON u.id = cp.suggester_id
             WHERE cp.id = $1 AND cp.wordbook_id = $2`,
            [pid, wordbookId]
        );
        if (!proposalResult.rows[0]) {
            return res.status(404).json({ error: '提案が見つかりません' });
        }

        // 提案に紐づく修正一覧
        const correctionsResult = await db.query(
            `SELECT wc.*, w.word AS original_word, w.meaning AS original_meaning
             FROM word_corrections wc
             JOIN words w ON w.id = wc.word_id
             WHERE wc.proposal_id = $1
             ORDER BY wc.id ASC`,
            [pid]
        );

        res.json({
            ...proposalResult.rows[0],
            corrections: correctionsResult.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * PUT /api/wordbooks/:id/corrections/proposals/:pid/approve
 * 提案を一括承認（全修正を単語に適用）
 */
router.put('/proposals/:pid/approve', authenticate, async (req, res) => {
    const { id: wordbookId, pid } = req.params;

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // 所有者確認
        const wb = await client.query('SELECT user_id, title FROM wordbooks WHERE id = $1', [wordbookId]);
        if (!wb.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wb.rows[0].user_id !== req.user.id) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'この操作は単語帳の所有者のみ実行できます' });
        }

        const wbTitle = wb.rows[0].title;

        // 提案を取得
        const proposal = await client.query(
            'SELECT * FROM correction_proposals WHERE id = $1 AND wordbook_id = $2 AND status = $3',
            [pid, wordbookId, 'pending']
        );
        if (!proposal.rows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: '保留中の修正提案が見つかりません' });
        }

        const prop = proposal.rows[0];

        // 提案に紐づく全修正を取得
        const corrections = await client.query(
            'SELECT * FROM word_corrections WHERE proposal_id = $1',
            [pid]
        );

        // 各単語を更新
        for (const corr of corrections.rows) {
            await client.query(
                'UPDATE words SET word = $1, meaning = $2 WHERE id = $3',
                [corr.suggested_word, corr.suggested_meaning, corr.word_id]
            );
            await client.query(
                'UPDATE word_corrections SET status = $1 WHERE id = $2',
                ['approved', corr.id]
            );
        }

        // 提案を承認
        await client.query(
            'UPDATE correction_proposals SET status = $1 WHERE id = $2',
            ['approved', pid]
        );

        // 同じ単語への他の保留中提案内の修正を自動却下
        const affectedWordIds = corrections.rows.map(c => c.word_id);
        if (affectedWordIds.length > 0) {
            const autoRejected = await client.query(
                `UPDATE word_corrections SET status = 'rejected'
                 WHERE word_id = ANY($1) AND status = 'pending' AND proposal_id != $2
                 RETURNING DISTINCT proposal_id`,
                [affectedWordIds, pid]
            );

            // 自動却下された修正の提案が全て処理済みかチェックし、提案自体も却下
            for (const row of autoRejected.rows) {
                const remaining = await client.query(
                    'SELECT COUNT(*) FROM word_corrections WHERE proposal_id = $1 AND status = $2',
                    [row.proposal_id, 'pending']
                );
                if (parseInt(remaining.rows[0].count) === 0) {
                    const otherProp = await client.query(
                        'UPDATE correction_proposals SET status = $1 WHERE id = $2 AND status = $3 RETURNING suggester_id',
                        ['rejected', row.proposal_id, 'pending']
                    );
                    if (otherProp.rows[0]) {
                        await client.query(
                            'INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)',
                            [otherProp.rows[0].suggester_id, 'correction', `単語帳「${wbTitle}」への修正提案が却下されました`, `#/wordbook/${wordbookId}`]
                        );
                    }
                }
            }
        }

        // 提案者に承認通知
        await client.query(
            'INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)',
            [prop.suggester_id, 'correction', `単語帳「${wbTitle}」への修正提案「${prop.title}」が承認されました`, `#/wordbook/${wordbookId}`]
        );

        await client.query('COMMIT');
        res.json({ message: '修正提案を承認しました' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    } finally {
        client.release();
    }
});

/**
 * PUT /api/wordbooks/:id/corrections/proposals/:pid/reject
 * 提案を一括却下
 */
router.put('/proposals/:pid/reject', authenticate, async (req, res) => {
    const { id: wordbookId, pid } = req.params;

    try {
        // 所有者確認
        const wb = await db.query('SELECT user_id, title FROM wordbooks WHERE id = $1', [wordbookId]);
        if (!wb.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }
        if (wb.rows[0].user_id !== req.user.id) {
            return res.status(403).json({ error: 'この操作は単語帳の所有者のみ実行できます' });
        }

        // 提案を取得
        const proposal = await db.query(
            'SELECT * FROM correction_proposals WHERE id = $1 AND wordbook_id = $2 AND status = $3',
            [pid, wordbookId, 'pending']
        );
        if (!proposal.rows[0]) {
            return res.status(404).json({ error: '保留中の修正提案が見つかりません' });
        }

        const prop = proposal.rows[0];

        // 提案と全修正を却下
        await db.query('UPDATE correction_proposals SET status = $1 WHERE id = $2', ['rejected', pid]);
        await db.query('UPDATE word_corrections SET status = $1 WHERE proposal_id = $2 AND status = $3', ['rejected', pid, 'pending']);

        // 提案者に却下通知
        await db.query(
            'INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)',
            [prop.suggester_id, 'correction', `単語帳「${wb.rows[0].title}」への修正提案「${prop.title}」が却下されました`, `#/wordbook/${wordbookId}`]
        );

        res.json({ message: '修正提案を却下しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
