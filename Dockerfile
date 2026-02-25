FROM node:20-alpine

WORKDIR /app

# 依存関係のインストール（キャッシュ効率化のため先にコピー）
COPY package*.json ./
RUN npm ci --omit=dev

# アプリケーションファイルをコピー
COPY src/ ./src/
COPY public/ ./public/
COPY migrations/ ./migrations/

EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/ || exit 1

CMD ["node", "src/index.js"]
