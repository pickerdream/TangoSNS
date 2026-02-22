const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/tags
 * 全タグ一覧（使用数付き）
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id, t.name, COUNT(wt.wordbook_id) AS usage_count
      FROM tags t
      LEFT JOIN wordbook_tags wt ON wt.tag_id = t.id
      GROUP BY t.id
      ORDER BY usage_count DESC, t.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/tags/popular
 * 人気のタグ（上位10件）
 */
router.get('/popular', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT t.id, t.name, COUNT(wt.wordbook_id) AS usage_count
      FROM tags t
      JOIN wordbook_tags wt ON wt.tag_id = t.id
      GROUP BY t.id
      ORDER BY usage_count DESC
      LIMIT 10
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/tags/search?q=xxx
 * タグ名で検索（オートコンプリート用）
 */
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const result = await db.query(`
      SELECT id, name
      FROM tags
      WHERE name ILIKE $1
      ORDER BY name ASC
      LIMIT 10
    `, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
