const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/follows/:userId
 * ユーザーをフォローする
 */
router.post('/:userId', authenticate, async (req, res) => {
    const followingId = parseInt(req.params.userId);
    const followerId = req.user.id;

    if (followingId === followerId) {
        return res.status(400).json({ error: '自分自身をフォローすることはできません' });
    }

    try {
        await db.query(
            'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [followerId, followingId]
        );
        res.json({ message: 'フォローしました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * DELETE /api/follows/:userId
 * ユーザーのフォローを解除する
 */
router.delete('/:userId', authenticate, async (req, res) => {
    const followingId = parseInt(req.params.userId);
    const followerId = req.user.id;

    try {
        await db.query(
            'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
            [followerId, followingId]
        );
        res.json({ message: 'フォローを解除しました' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/follows/:userId/followers
 * フォロワー一覧を取得
 */
router.get('/:userId/followers', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.username, u.avatar_url, u.bio
             FROM users u
             JOIN follows f ON f.follower_id = u.id
             WHERE f.following_id = $1
             ORDER BY f.created_at DESC`,
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/follows/:userId/following
 * フォロー中のユーザー一覧を取得
 */
router.get('/:userId/following', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.id, u.username, u.avatar_url, u.bio
             FROM users u
             JOIN follows f ON f.following_id = u.id
             WHERE f.follower_id = $1
             ORDER BY f.created_at DESC`,
            [req.params.userId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

module.exports = router;
