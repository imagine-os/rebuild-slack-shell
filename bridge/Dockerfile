FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
# Rotating refresh tokens are persisted here; mount a volume at /data to keep them across deploys.
ENV SLACK_TOKEN_STORE=/data/.tokens.json
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 8787
CMD ["node", "src/index.js"]
