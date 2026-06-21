# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

# Install workspace deps against the lockfile for reproducible builds.
COPY package*.json ./
COPY web/package.json web/package.json
COPY api/package.json api/package.json
RUN npm ci

COPY web web
RUN npm run build --workspace web

# ---- Runtime stage ----
FROM nginx:1.27-alpine AS runtime
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null 2>&1 || exit 1
CMD ["nginx", "-g", "daemon off;"]
