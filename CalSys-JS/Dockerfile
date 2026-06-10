# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Serve stage ───────────────────────────────────────────────────────────────
FROM nginx:stable-alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config template (PORT is substituted at runtime via envsubst)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# envsubst is provided by the gettext package (pre-installed in nginx:stable-alpine)
# The official nginx image automatically processes /etc/nginx/templates/*.template
# files via envsubst and writes the results to /etc/nginx/conf.d/ on startup.

# Startup script: generates /usr/share/nginx/html/config.js with the correct
# backend API URL before handing off to nginx.  The URL is built from
# BACKEND_URL (set explicitly) or BACKEND_RAILWAY_PUBLIC_DOMAIN (Railway's
# auto-injected domain for the backend service), falling back to localhost.
COPY <<'EOF' /docker-entrypoint.d/10-generate-config.sh
#!/bin/sh
set -e

if [ -n "$BACKEND_URL" ]; then
  API_URL="$BACKEND_URL"
elif [ -n "$BACKEND_RAILWAY_PUBLIC_DOMAIN" ]; then
  API_URL="https://${BACKEND_RAILWAY_PUBLIC_DOMAIN}/api"
else
  API_URL="http://localhost:3000/api"
fi

cat > /usr/share/nginx/html/config.js <<JS
window.__RUNTIME_CONFIG__ = {
  API_URL: '${API_URL}',
};
JS

echo "Runtime config written: API_URL=${API_URL}"
EOF
RUN chmod +x /docker-entrypoint.d/10-generate-config.sh

# Default to port 3000 to match Railway's expected PORT value
ENV PORT=3000

EXPOSE ${PORT}

CMD ["nginx", "-g", "daemon off;"]
