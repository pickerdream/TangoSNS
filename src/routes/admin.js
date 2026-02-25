const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

/**
 * GET /api/admin/stats
 * 管理者ダッシュボード統計
 */
router.get('/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await db.query('SELECT COUNT(*) FROM users');
    const bannedUsers = await db.query('SELECT COUNT(*) FROM users WHERE is_banned = true');
    const totalWordbooks = await db.query('SELECT COUNT(*) FROM wordbooks');
    const totalWarnings = await db.query('SELECT COUNT(*) FROM user_warnings');
    const totalReports = await db.query('SELECT COUNT(*) FROM reports');

    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      bannedUsers: parseInt(bannedUsers.rows[0].count),
      totalWordbooks: parseInt(totalWordbooks.rows[0].count),
      totalWarnings: parseInt(totalWarnings.rows[0].count),
      totalReports: parseInt(totalReports.rows[0].count),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/admin/users
 * ユーザー一覧（IP、BAN状態、警告数含む）
 */
router.get('/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, u.username, u.display_name, u.created_at, u.registration_ip,
        u.is_admin, u.is_banned, u.ban_reason,
        COUNT(w.id) AS warning_count
      FROM users u
      LEFT JOIN user_warnings w ON w.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/admin/users/:id/warnings
 * ユーザーの警告履歴を取得
 */
router.get('/users/:id/warnings', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT w.id, w.reason, w.created_at, a.username AS admin_username, a.display_name AS admin_display_name
      FROM user_warnings w
      JOIN users a ON a.id = w.admin_id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * POST /api/admin/users/:id/warn
 * ユーザーに警告を送る
 */
router.post('/users/:id/warn', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) {
    return res.status(400).json({ error: '警告理由は必須です' });
  }

  try {
    const userCheck = await db.query('SELECT id, username FROM users WHERE id = $1', [id]);
    if (!userCheck.rows[0]) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }

    await db.query(
      'INSERT INTO user_warnings (user_id, admin_id, reason) VALUES ($1, $2, $3)',
      [id, req.user.id, reason]
    );

    // 警告を通知として送信
    await db.query(
      'INSERT INTO notifications (user_id, type, message, link) VALUES ($1, $2, $3, $4)',
      [id, 'warning', `⚠️ 管理者から警告を受けました: ${reason}`, null]
    );

    res.json({ message: '警告を送信しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * POST /api/admin/users/:id/ban
 * ユーザーをBANする
 */
router.post('/users/:id/ban', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: '自分自身をBANすることはできません' });
  }

  try {
    const userCheck = await db.query('SELECT id, is_admin FROM users WHERE id = $1', [id]);
    if (!userCheck.rows[0]) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    if (userCheck.rows[0].is_admin) {
      return res.status(400).json({ error: '管理者をBANすることはできません' });
    }

    await db.query(
      'UPDATE users SET is_banned = true, ban_reason = $2 WHERE id = $1',
      [id, reason || null]
    );

    res.json({ message: 'ユーザーをBANしました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * POST /api/admin/users/:id/unban
 * ユーザーのBANを解除する
 */
router.post('/users/:id/unban', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    await db.query(
      'UPDATE users SET is_banned = false, ban_reason = NULL WHERE id = $1',
      [id]
    );
    res.json({ message: 'BANを解除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * DELETE /api/admin/warnings/:id
 * 警告を削除する
 */
router.delete('/warnings/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM user_warnings WHERE id = $1', [id]);
    res.json({ message: '警告を削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/admin/users/:id/ip-logs
 * ユーザーのIPアクティビティログを取得
 */
router.get('/users/:id/ip-logs', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(`
      SELECT id, ip_address, port, action, user_agent, created_at
      FROM user_ip_logs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/admin/ip/:ip/users
 * 同じIPから登録/ログインしたユーザー一覧を取得
 */
router.get('/ip/:ip/users', authenticate, requireAdmin, async (req, res) => {
  const { ip } = req.params;
  try {
    const result = await db.query(`
      SELECT DISTINCT u.id, u.username, u.display_name, u.created_at, u.is_banned,
             (SELECT COUNT(*) FROM user_ip_logs WHERE user_id = u.id AND ip_address = $1) AS activity_count
      FROM users u
      JOIN user_ip_logs l ON l.user_id = u.id
      WHERE l.ip_address = $1
      ORDER BY u.created_at DESC
    `, [ip]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * ユーザーを削除する
 */
router.delete('/users/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: '自分自身を削除することはできません' });
  }

  try {
    const userCheck = await db.query('SELECT id, is_admin FROM users WHERE id = $1', [id]);
    if (!userCheck.rows[0]) {
      return res.status(404).json({ error: 'ユーザーが見つかりません' });
    }
    if (userCheck.rows[0].is_admin) {
      return res.status(400).json({ error: '管理者を削除することはできません' });
    }

    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'ユーザーを削除しました' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

/**
 * GET /api/admin/reports
 * 通報一覧を取得
 */
router.get('/reports', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        r.id, r.reason, r.created_at,
        u.username AS reporter_username, u.display_name AS reporter_display_name,
        ru.username AS reported_user_username, ru.display_name AS reported_user_display_name,
        rw.title AS reported_wordbook_title,
        rw.id AS reported_wordbook_id
      FROM reports r
      JOIN users u ON u.id = r.reporter_id
      LEFT JOIN users ru ON ru.id = r.reported_user_id
      LEFT JOIN wordbooks rw ON rw.id = r.reported_wordbook_id
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました' });
  }
});

module.exports = router;
