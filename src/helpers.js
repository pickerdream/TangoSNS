/**
 * リクエストからクライアントのIPアドレスを取得する。
 * 優先順位: CF-Connecting-IP > X-Forwarded-For > socket.remoteAddress
 */
function getClientIp(req) {
    return req.headers['cf-connecting-ip']
        || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || null;
}

module.exports = { getClientIp };
