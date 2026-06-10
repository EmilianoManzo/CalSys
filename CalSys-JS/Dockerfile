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

# Default to port 3000 to match Railway's expected PORT value
ENV PORT=3000

EXPOSE ${PORT}

CMD ["nginx", "-g", "daemon off;"]
