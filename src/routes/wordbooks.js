const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/wordbooks
 * 単語帳一覧取得
 * クライアント側で ?username=... や ?q=... や ?tag=... や ?sort=... を指定可能
 * sort: 'latest' (デフォルト), 'popular' (view_count DESC)
 */
router.get('/', async (req, res) => {
    try {
        const { username, q, tag, sort, following_only, uncompleted, unstudied, mistakes } = req.query;

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
      SELECT w.id, w.title, w.description, w.created_at, w.view_count,
             u.id AS user_id, u.username, u.avatar_url,
             EXISTS(SELECT 1 FROM wordbook_completions c WHERE c.wordbook_id = w.id AND c.user_id = $1) AS is_completed,
             COALESCE(
               (SELECT json_agg(json_build_object('id', t.id, 'name', t.name))
                FROM wordbook_tags wt
                JOIN tags t ON t.id = wt.tag_id
                WHERE wt.wordbook_id = w.id),
               '[]'
             ) AS tags
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
        if (tag) {
            params.push(tag);
            conditions.push(`EXISTS(SELECT 1 FROM wordbook_tags wt JOIN tags t ON t.id = wt.tag_id WHERE wt.wordbook_id = w.id AND t.name = $${params.length})`);
        }
        if (following_only === 'true' && currentUserId) {
            conditions.push(`EXISTS(SELECT 1 FROM follows f WHERE f.following_id = w.user_id AND f.follower_id = $1)`);
        }

        // 状態フィルタ（ログイン時のみ有効）
        if (currentUserId) {
            if (uncompleted === 'true') {
                conditions.push(`NOT EXISTS(SELECT 1 FROM wordbook_completions c WHERE c.wordbook_id = w.id AND c.user_id = $1)`);
            }
            if (unstudied === 'true') {
                conditions.push(`NOT EXISTS(SELECT 1 FROM study_history h WHERE h.wordbook_id = w.id AND h.user_id = $1)`);
            }
            if (mistakes === 'true') {
                conditions.push(`EXISTS(SELECT 1 FROM study_mistakes m WHERE m.wordbook_id = w.id AND m.user_id = $1)`);
            }
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        // 並び替え
        if (sort === 'popular') {
            query += ' ORDER BY w.view_count DESC';
        } else {
            query += ' ORDER BY w.created_at DESC';
        }

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
 * body: { title, description, tags: ["タグ1", "タグ2"] }
 */
router.post('/', authenticate, async (req, res) => {
    const { title, description, tags } = req.body;
    if (!title) return res.status(400).json({ error: 'タイトルは必須です' });

    try {
        const result = await db.query(
            'INSERT INTO wordbooks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, title, description]
        );
        const wordbook = result.rows[0];

        // タグを処理
        if (tags && Array.isArray(tags) && tags.length > 0) {
            for (const tagName of tags) {
                const trimmed = tagName.trim().toLowerCase();
                if (!trimmed) continue;

                // タグを取得または作成
                let tagResult = await db.query('SELECT id FROM tags WHERE name = $1', [trimmed]);
                let tagId;
                if (tagResult.rows[0]) {
                    tagId = tagResult.rows[0].id;
                } else {
                    const newTag = await db.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [trimmed]);
                    tagId = newTag.rows[0].id;
                }

                // 単語帳とタグを紐付け
                await db.query(
                    'INSERT INTO wordbook_tags (wordbook_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [wordbook.id, tagId]
                );
            }
        }

        res.status(201).json(wordbook);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id
 * 単語帳詳細取得（単語・コメント数も含む）
 */
/**
 * GET /api/wordbooks/bookmarked
 * ブックマークした単語帳一覧を取得 (フィルタリング対応)
 */
router.get('/bookmarked', authenticate, async (req, res) => {
    try {
        const { uncompleted, unstudied, mistakes } = req.query;
        const params = [req.user.id];
        let query = `
            SELECT w.*, u.username, u.avatar_url,
                   (SELECT COUNT(*) FROM wordbook_likes WHERE wordbook_id = w.id) AS like_count,
                   (SELECT COUNT(*) FROM words WHERE wordbook_id = w.id) AS word_count,
                   EXISTS(SELECT 1 FROM wordbook_completions c WHERE c.wordbook_id = w.id AND c.user_id = $1) AS is_completed
            FROM wordbooks w
            JOIN users u ON u.id = w.user_id
            JOIN wordbook_bookmarks b ON b.wordbook_id = w.id
            WHERE b.user_id = $1
        `;

        if (uncompleted === 'true') {
            query += ` AND NOT EXISTS(SELECT 1 FROM wordbook_completions c WHERE c.wordbook_id = w.id AND c.user_id = $1)`;
        }
        if (unstudied === 'true') {
            query += ` AND NOT EXISTS(SELECT 1 FROM study_history s WHERE s.wordbook_id = w.id AND s.user_id = $1)`;
        }
        if (mistakes === 'true') {
            query += ` AND EXISTS(SELECT 1 FROM study_mistakes m WHERE m.wordbook_id = w.id AND m.user_id = $1)`;
        }

        query += ` ORDER BY b.created_at DESC`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id/bookmark-status
 * 単語帳のブックマーク状態を取得
 */
router.get('/:id/bookmark-status', async (req, res) => {
    const { id } = req.params;
    try {
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const jwt = require('jsonwebtoken');
            try {
                const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET || 'tangosns_secret_key');
                currentUserId = decoded.id;
            } catch (e) { }
        }

        const result = await db.query(
            'SELECT EXISTS(SELECT 1 FROM wordbook_bookmarks WHERE wordbook_id = $1 AND user_id = $2) AS is_bookmarked',
            [id, currentUserId]
        );

        res.json({ is_bookmarked: !!currentUserId && result.rows[0].is_bookmarked });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/wordbooks/:id/bookmark
 * 単語帳をブックマークに追加
 */
router.post('/:id/bookmark', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) return res.status(404).json({ error: '単語帳が見つかりません' });

        try {
            await db.query(
                'INSERT INTO wordbook_bookmarks (user_id, wordbook_id) VALUES ($1, $2)',
                [req.user.id, id]
            );
            res.json({ message: 'ブックマークに追加しました' });
        } catch (err) {
            if (err.code === '23505') {
                res.status(400).json({ error: 'すでにブックマークしています' });
            } else {
                throw err;
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id/bookmark
 * 単語帳のブックマークを解除
 */
router.delete('/:id/bookmark', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(
            'DELETE FROM wordbook_bookmarks WHERE user_id = $1 AND wordbook_id = $2',
            [req.user.id, id]
        );

        if (result.rowCount === 0) {
            res.status(400).json({ error: 'ブックマークしていません' });
        } else {
            res.json({ message: 'ブックマークを解除しました' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

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

        // IPアドレスとポートを取得
        const clientIp = req.ip || req.connection.remoteAddress || '0.0.0.0';
        const clientPort = req.connection.remotePort || 0;

        // ビュー数をカウント（同一ユーザーまたは同一IP:ポートの場合、1時間以上経過している場合のみ）
        let shouldCountView = true;
        if (currentUserId) {
            // ログインユーザーの最後のビュー時刻をチェック
            const lastViewResult = await db.query(
                `SELECT viewed_at FROM wordbook_views 
                 WHERE user_id = $1 AND wordbook_id = $2`,
                [currentUserId, id]
            );

            if (lastViewResult.rows[0]) {
                const lastViewTime = new Date(lastViewResult.rows[0].viewed_at);
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

                if (lastViewTime > oneHourAgo) {
                    // 1時間以内なのでカウントしない
                    shouldCountView = false;
                }
            }
        } else {
            // ゲストユーザーの場合、IP:ポートの組み合わせでチェック
            const lastGuestViewResult = await db.query(
                `SELECT viewed_at FROM guest_wordbook_views 
                 WHERE ip_address = $1 AND port = $2 AND wordbook_id = $3`,
                [clientIp, clientPort, id]
            );

            if (lastGuestViewResult.rows[0]) {
                const lastViewTime = new Date(lastGuestViewResult.rows[0].viewed_at);
                const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

                if (lastViewTime > oneHourAgo) {
                    // 1時間以内なのでカウントしない
                    shouldCountView = false;
                }
            }
        }

        // ビュー数をアップデート
        let wbResult;
        if (shouldCountView) {
            wbResult = await db.query(
                `UPDATE wordbooks SET view_count = view_count + 1 WHERE id = $1
                 RETURNING id, title, description, created_at, view_count`,
                [id]
            );
        } else {
            wbResult = await db.query(
                `SELECT id, title, description, created_at, view_count FROM wordbooks WHERE id = $1`,
                [id]
            );
        }

        if (!wbResult.rows[0]) {
            return res.status(404).json({ error: '単語帳が見つかりません' });
        }

        const wordbook = wbResult.rows[0];

        // ビュー履歴を更新
        if (currentUserId) {
            await db.query(
                `INSERT INTO wordbook_views (user_id, wordbook_id, viewed_at) 
                 VALUES ($1, $2, current_timestamp)
                 ON CONFLICT (user_id, wordbook_id) DO UPDATE 
                 SET viewed_at = current_timestamp`,
                [currentUserId, id]
            );
        } else {
            // ゲストユーザーのビュー履歴を更新
            await db.query(
                `INSERT INTO guest_wordbook_views (ip_address, port, wordbook_id, viewed_at) 
                 VALUES ($1, $2, $3, current_timestamp)
                 ON CONFLICT (ip_address, port, wordbook_id) DO UPDATE 
                 SET viewed_at = current_timestamp`,
                [clientIp, clientPort, id]
            );
        }

        // ユーザー情報、単語数、コメント数、学習回数を取得
        const detailsResult = await db.query(
            `SELECT u.id AS user_id, u.username, u.avatar_url, u.bio,
                    COUNT(DISTINCT wd.id) AS word_count,
                    COUNT(DISTINCT c.id)  AS comment_count,
                    COALESCE((SELECT COUNT(*) FROM study_history sh WHERE sh.wordbook_id = $1), 0) AS study_count,
                    EXISTS(SELECT 1 FROM wordbook_completions comp WHERE comp.wordbook_id = $1 AND comp.user_id = $2) AS is_completed
             FROM users u
             LEFT JOIN words wd ON wd.wordbook_id = $1
             LEFT JOIN comments c ON c.wordbook_id = $1
             WHERE u.id = (SELECT user_id FROM wordbooks WHERE id = $1)
             GROUP BY u.id`,
            [id, currentUserId]
        );

        // タグを取得
        const tagsResult = await db.query(`
            SELECT t.id, t.name
            FROM wordbook_tags wt
            JOIN tags t ON t.id = wt.tag_id
            WHERE wt.wordbook_id = $1
            ORDER BY t.name
        `, [id]);

        res.json({ ...wordbook, ...detailsResult.rows[0], tags: tagsResult.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * PUT /api/wordbooks/:id
 * 単語帳を更新
 * body: { title, description, tags: ["タグ1", "タグ2"] }
 */
router.put('/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { title, description, tags } = req.body;

    if (!title) return res.status(400).json({ error: 'タイトルは必須です' });

    try {
        // 所有権の確認
        const check = await db.query('SELECT user_id FROM wordbooks WHERE id = $1', [id]);
        if (!check.rows[0]) return res.status(404).json({ error: '単語帳が見つかりません' });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: '編集権限がありません' });

        // 単語帳を更新
        await db.query(
            'UPDATE wordbooks SET title = $1, description = $2 WHERE id = $3',
            [title, description, id]
        );

        // 既存のタグを削除
        await db.query('DELETE FROM wordbook_tags WHERE wordbook_id = $1', [id]);

        // 新しいタグを追加
        if (tags && Array.isArray(tags) && tags.length > 0) {
            for (const tagName of tags) {
                const trimmed = tagName.trim().toLowerCase();
                if (!trimmed) continue;

                // タグを取得または作成
                let tagResult = await db.query('SELECT id FROM tags WHERE name = $1', [trimmed]);
                let tagId;
                if (tagResult.rows[0]) {
                    tagId = tagResult.rows[0].id;
                } else {
                    const newTag = await db.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [trimmed]);
                    tagId = newTag.rows[0].id;
                }

                // 単語帳とタグを紐付け
                await db.query(
                    'INSERT INTO wordbook_tags (wordbook_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [id, tagId]
                );
            }
        }

        res.json({ message: '単語帳を更新しました' });
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

/**
 * POST /api/wordbooks/:id/like
 * 単語帳にいいねを追加
 */
router.post('/:id/like', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        // 単語帳の存在確認
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) return res.status(404).json({ error: '単語帳が見つかりません' });

        // いいねを追加
        try {
            await db.query(
                'INSERT INTO wordbook_likes (user_id, wordbook_id) VALUES ($1, $2)',
                [req.user.id, id]
            );
            res.json({ message: 'いいねしました' });
        } catch (err) {
            // 既にいいねている場合はスキップ
            if (err.code === '23505') {
                res.status(400).json({ error: 'すでにいいねしています' });
            } else {
                throw err;
            }
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/wordbooks/:id/like
 * 単語帳のいいねを削除
 */
router.delete('/:id/like', authenticate, async (req, res) => {
    const { id } = req.params;
    try {
        // 単語帳の存在確認
        const wb = await db.query('SELECT id FROM wordbooks WHERE id = $1', [id]);
        if (!wb.rows[0]) return res.status(404).json({ error: '単語帳が見つかりません' });

        // いいねを削除
        const result = await db.query(
            'DELETE FROM wordbook_likes WHERE user_id = $1 AND wordbook_id = $2',
            [req.user.id, id]
        );

        if (result.rowCount === 0) {
            res.status(400).json({ error: 'いいねしていません' });
        } else {
            res.json({ message: 'いいねを取り消しました' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/wordbooks/:id/likes
 * 単語帳のいいね情報を取得（いいね数、ログインユーザーがいいねしているか）
 */
router.get('/:id/likes', async (req, res) => {
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

        // いいね数とログインユーザーのいいね状態を取得
        const result = await db.query(
            `SELECT COUNT(*) AS like_count,
                    EXISTS(
                        SELECT 1 FROM wordbook_likes WHERE wordbook_id = $1 AND user_id = $2
                    ) AS liked_by_current_user
             FROM wordbook_likes
             WHERE wordbook_id = $1`,
            [id, currentUserId]
        );

        const row = result.rows[0];
        res.json({
            like_count: parseInt(row.like_count),
            liked_by_current_user: !!currentUserId && row.liked_by_current_user
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});



module.exports = router;
