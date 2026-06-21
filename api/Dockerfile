FROM node:22-alpine
WORKDIR /app

# Install workspace deps against the lockfile.
COPY package*.json ./
COPY web/package.json web/package.json
COPY api/package.json api/package.json
RUN npm ci

COPY api api

ENV API_PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8787/api/health >/dev/null 2>&1 || exit 1
CMD ["npm", "run", "start", "--workspace", "api"]
