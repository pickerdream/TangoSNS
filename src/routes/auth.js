const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const db = require('../db');
const { getClientIp } = require('../helpers');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

/**
 * POST /api/auth/register
 * ユーザー登録
 * body: { username, display_name, password }
 */
router.post('/register', async (req, res) => {
    const { username, display_name, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'アカウントIDとパスワードは必須です' });
    }
    if (username.length > 30) {
        return res.status(400).json({ error: 'アカウントIDは30文字以内にしてください' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'アカウントIDは半角英数字とアンダースコアのみ使用できます' });
    }
    if (display_name && display_name.length > 50) {
        return res.status(400).json({ error: '表示名は50文字以内にしてください' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'パスワードは6文字以上にしてください' });
    }
    if (password.length > 128) {
        return res.status(400).json({ error: 'パスワードは128文字以内にしてください' });
    }

    const finalDisplayName = display_name || username;

    // IPアドレス・ポート・User-Agentを取得
    const ip = getClientIp(req);
    const port = req.socket?.remotePort || null;
    const userAgent = req.headers['user-agent'] || null;

    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await db.query(
            'INSERT INTO users (username, display_name, password, registration_ip) VALUES ($1, $2, $3, $4) RETURNING id, username, display_name, created_at, is_admin',
            [username, finalDisplayName, hashed, ip]
        );
        const user = result.rows[0];

        // IPアクティビティログに記録
        await db.query(
            'INSERT INTO user_ip_logs (user_id, ip_address, port, action, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, ip, port, 'register', userAgent]
        );

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({
            user: { ...user, bio: null, avatar_url: null, theme: 'system', is_admin: user.is_admin },
            token
        });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ error: 'このアカウントIDは既に使用されています' });
        }
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * POST /api/auth/login
 * ログイン
 * body: { username, password }
 */
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'ユーザー名とパスワードは必須です' });
    }

    try {
        const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];
        if (!user) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        // BANチェック
        if (user.is_banned) {
            return res.status(403).json({ error: 'このアカウントは利用停止されています。詳細はお問い合わせください。' });
        }

        // パスワード未設定(Google認証のみ)のユーザーはパスワードログイン不可
        if (!user.password) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'ユーザー名またはパスワードが正しくありません' });
        }

        // IPアドレス・ポート・User-Agentを取得
        const ip = getClientIp(req);
        const port = req.socket?.remotePort || null;
        const userAgent = req.headers['user-agent'] || null;

        // IPアクティビティログに記録
        await db.query(
            'INSERT INTO user_ip_logs (user_id, ip_address, port, action, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, ip, port, 'login', userAgent]
        );

        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                bio: user.bio,
                theme: user.theme,
                created_at: user.created_at,
                is_admin: user.is_admin
            },
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

/**
 * GET /api/auth/config
 * フロントエンドで必要な認証設定を返す
 */
router.get('/config', (req, res) => {
    res.json({
        googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    });
});

/**
 * POST /api/auth/google
 * Googleログイン / 新規登録
 * body: { credential }
 */
router.post('/google', async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: 'Google認証情報が必要です' });
    }

    if (!googleClient) {
        return res.status(500).json({ error: 'Google認証が設定されていません' });
    }

    // IPアドレス・ポート・User-Agentを取得
    const ip = getClientIp(req);
    const port = req.socket?.remotePort || null;
    const userAgent = req.headers['user-agent'] || null;

    try {
        // GoogleのIDトークンを検証
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const googleName = payload['name'] || '';
        const googlePicture = payload['picture'] || null;

        // google_idで既存ユーザーを検索
        let result = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        let user = result.rows[0];
        let action = 'google_login';

        if (!user) {
            // 新規ユーザー作成
            action = 'google_register';

            // 表示名: Googleの名前をそのまま使用
            const displayName = googleName.slice(0, 50) || 'ユーザー';

            // ハンドル(username)の生成: 英数字_のみに変換
            let username = googleName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20);
            if (!username) username = 'user';

            // ユーザー名の重複チェック
            let suffix = '';
            let attempts = 0;
            while (attempts < 10) {
                const existing = await db.query('SELECT id FROM users WHERE username = $1', [username + suffix]);
                if (existing.rows.length === 0) break;
                attempts++;
                suffix = '_' + Math.floor(Math.random() * 10000);
            }
            username = username + suffix;

            result = await db.query(
                `INSERT INTO users (username, display_name, password, google_id, avatar_url, registration_ip)
                 VALUES ($1, $2, NULL, $3, $4, $5)
                 RETURNING id, username, display_name, avatar_url, bio, theme, created_at, is_admin`,
                [username, displayName, googleId, googlePicture, ip]
            );
            user = result.rows[0];
        }

        // BANチェック
        if (user.is_banned) {
            return res.status(403).json({ error: 'このアカウントは利用停止されています。詳細はお問い合わせください。' });
        }

        // IPアクティビティログに記録
        await db.query(
            'INSERT INTO user_ip_logs (user_id, ip_address, port, action, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [user.id, ip, port, action, userAgent]
        );

        // JWTトークン発行
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            user: {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                avatar_url: user.avatar_url,
                bio: user.bio || null,
                theme: user.theme || 'system',
                created_at: user.created_at,
                is_admin: user.is_admin
            },
            token,
        });
    } catch (err) {
        console.error('Google auth error:', err);
        if (err.message && err.message.includes('Token used too late')) {
            return res.status(401).json({ error: 'Google認証トークンの有効期限が切れています。もう一度お試しください。' });
        }
        res.status(500).json({ error: 'Google認証に失敗しました' });
    }
});

/**
 * POST /api/auth/google/link
 * 既存アカウントにGoogleアカウントを連携
 * body: { credential }
 * 認証必須
 */
router.post('/google/link', async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: 'Google認証情報が必要です' });
    }

    if (!googleClient) {
        return res.status(500).json({ error: 'Google認証が設定されていません' });
    }

    // JWTトークンからユーザーを取得
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '認証が必要です' });
    }

    let userId;
    try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        userId = decoded.id;
    } catch {
        return res.status(401).json({ error: 'トークンが無効です' });
    }

    try {
        // GoogleのIDトークンを検証
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];

        // このGoogleアカウントが既に他のユーザーに紐づいていないか確認
        const existing = await db.query('SELECT id FROM users WHERE google_id = $1', [googleId]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'このGoogleアカウントは既に別のアカウントに連携されています' });
        }

        // 現在のユーザーが既にGoogle連携済みでないか確認
        const userResult = await db.query('SELECT google_id FROM users WHERE id = $1', [userId]);
        if (!userResult.rows[0]) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }
        if (userResult.rows[0].google_id) {
            return res.status(409).json({ error: '既にGoogleアカウントが連携されています' });
        }

        // Google連携を設定
        await db.query('UPDATE users SET google_id = $1 WHERE id = $2', [googleId, userId]);

        res.json({ message: 'Googleアカウントを連携しました' });
    } catch (err) {
        console.error('Google link error:', err);
        res.status(500).json({ error: 'Google連携に失敗しました' });
    }
});

/**
 * DELETE /api/auth/google/link
 * Googleアカウントの連携を解除
 * 認証必須・パスワード設定済みの場合のみ
 */
router.delete('/google/link', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '認証が必要です' });
    }

    let userId;
    try {
        const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET);
        userId = decoded.id;
    } catch {
        return res.status(401).json({ error: 'トークンが無効です' });
    }

    try {
        const userResult = await db.query('SELECT google_id, password FROM users WHERE id = $1', [userId]);
        if (!userResult.rows[0]) {
            return res.status(404).json({ error: 'ユーザーが見つかりません' });
        }

        if (!userResult.rows[0].google_id) {
            return res.status(400).json({ error: 'Googleアカウントは連携されていません' });
        }

        // パスワード未設定の場合はログイン手段がなくなるため解除不可
        if (!userResult.rows[0].password) {
            return res.status(400).json({ error: 'パスワードを設定してからGoogleアカウントの連携を解除してください' });
        }

        await db.query('UPDATE users SET google_id = NULL WHERE id = $1', [userId]);
        res.json({ message: 'Googleアカウントの連携を解除しました' });
    } catch (err) {
        console.error('Google unlink error:', err);
        res.status(500).json({ error: 'Google連携の解除に失敗しました' });
    }
});

module.exports = router;
