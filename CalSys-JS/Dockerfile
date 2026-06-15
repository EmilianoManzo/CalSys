# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY src ./src
COPY index.html ./
COPY vite.config.js ./
COPY public ./public 2>/dev/null || true
COPY .env.production ./ 2>/dev/null || true

RUN npm run build

# Runtime stage - serve with nginx
FROM nginx:alpine

COPY nginx.conf /etc/nginx/nginx.conf

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
