# Docker Deployment Guide for CalSys

This guide explains how to deploy CalSys to Railway using Docker containers.

## Architecture

- **Backend**: Node.js Express server (port 3000)
- **Frontend**: React/Vite + Nginx (port 3000, exposed as port 80 in docker)
- **Database**: MySQL 8.0

## Local Testing with Docker Compose

Before deploying to Railway, test locally:

```bash
# Generate strong JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Update docker-compose.yml with the generated secret

# Build and run all services
docker-compose up --build

# Access the application
# Frontend: http://localhost
# Backend: http://localhost:3000/api
# Database: localhost:3306
```

### Verify Services

```bash
# Check backend health
curl http://localhost:3000/api/health

# Check frontend
curl http://localhost/health

# Check database connection
docker-compose exec db mysql -uroot -proot -e "SHOW DATABASES;"
```

### Stopping Services

```bash
docker-compose down

# Also remove volumes (database data)
docker-compose down -v
```

## Railway Deployment

### Prerequisites

1. Railway account and project
2. Docker images for backend and frontend
3. Environment variables configured
4. Database service in Railway

### Step 1: Create Services in Railway

1. Go to Railway dashboard
2. Create new service for **Backend**:
   - Source: Dockerfile (from backend/Dockerfile)
   - Port: 3000

3. Create new service for **Frontend**:
   - Source: Dockerfile (from CalSys-JS/Dockerfile)
   - Port: 3000 (exposed as HTTP)

4. Add MySQL database service

### Step 2: Configure Environment Variables

**Backend Service Variables:**

```env
NODE_ENV=production
PORT=3000
TRUST_PROXY=true

# Database
DB_HOST=<railway-db-host>
DB_USER=<railway-db-user>
DB_PASSWORD=<generated-password>
DB_NAME=calsys_db
DB_PORT=3306

# JWT (must be 64+ random characters)
JWT_SECRET=<generated-secret>
JWT_EXPIRES_IN=15m
JWT_ISSUER=calsys-api
JWT_AUDIENCE=calsys-web

# CORS
CORS_ORIGIN=https://your-frontend-domain.com
```

**Frontend Service Variables:**

```env
VITE_API_URL=https://your-backend-domain.com/api
```

### Step 3: Deploy

#### Option A: Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy backend
cd backend
railway up --name calsys-backend

# Deploy frontend
cd ../CalSys-JS
railway up --name calsys-frontend
```

#### Option B: Using GitHub Integration

1. Push code to GitHub
2. In Railway dashboard, select "Deploy from GitHub"
3. Connect repository and select branch
4. Railway auto-deploys on push

#### Option C: Using Docker Push

```bash
# Build and push backend image
docker build -t your-registry/calsys-backend:latest -f backend/Dockerfile .
docker push your-registry/calsys-backend:latest

# Build and push frontend image
docker build -t your-registry/calsys-frontend:latest -f CalSys-JS/Dockerfile .
docker push your-registry/calsys-frontend:latest
```

### Step 4: Verify Deployment

```bash
# Test backend
curl -i https://your-backend-domain.com/api/health

# Test frontend
curl -i https://your-frontend-domain.com

# Check security headers
curl -i https://your-backend-domain.com/api/auth/me | grep -i "content-security-policy\|x-frame-options\|strict-transport-security"
```

## Troubleshooting

### Backend fails to start

**Error:** `JWT_SECRET must be set to at least 64 random characters`

**Solution:** Generate and set JWT_SECRET in Railway Variables:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

### Frontend shows blank page

**Error:** 404 or blank white page

**Solutions:**
1. Check VITE_API_URL points to correct backend
2. Verify nginx.conf is in CalSys-JS directory
3. Check build logs: `railway logs -s frontend`

### Database connection fails

**Error:** `ECONNREFUSED 127.0.0.1:3306`

**Solutions:**
1. Verify DB_HOST, DB_USER, DB_PASSWORD in Railway Variables
2. Ensure database service is running
3. Check network connectivity between services

### CORS errors

**Error:** `Cross-Origin Request Blocked`

**Solution:** Update CORS_ORIGIN to include frontend domain:
```env
CORS_ORIGIN=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

## Security Checklist

- [ ] JWT_SECRET is 64+ random characters
- [ ] No secrets in code (all in Railway Variables)
- [ ] SSL/HTTPS enforced (Railway automatic)
- [ ] Database password is strong
- [ ] CORS origins are specific (not wildcard)
- [ ] Security headers present in responses
- [ ] Rate limiting working on auth endpoints
- [ ] No console.logs with sensitive data

## Monitoring

### Logs

```bash
# Backend logs
railway logs -s backend

# Frontend logs
railway logs -s frontend

# Database logs
railway logs -s database
```

### Health Checks

Both services have health checks configured:

- **Backend:** GET `/api/health`
- **Frontend:** GET `/health`

These are automatically monitored by Railway.

## Updating Deployment

### After Code Changes

```bash
# Just push to GitHub
git push origin main

# Or manually deploy with CLI
railway up
```

### After Environment Changes

1. Update variables in Railway dashboard
2. Restart services (Railway auto-restarts or manual restart)

### Database Migrations

If you add new database columns:

```bash
# SSH into Railway service
railway shell -s backend

# Run migrations
mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME < migration.sql
```

## Rollback

To revert to previous deployment:

1. In Railway dashboard, go to Deployments
2. Select previous successful deployment
3. Click "Redeploy"

## Resources

- [Railway Docs](https://docs.railway.app/)
- [Docker Docs](https://docs.docker.com/)
- [Nginx Docs](https://nginx.org/en/docs/)
- [Express.js Docs](https://expressjs.com/)

---

**Status:** Production-Ready with Docker 🐳
