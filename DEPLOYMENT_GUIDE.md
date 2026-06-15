# CalSys Security Hardening & Railway Deployment Guide

## Critical Security Updates Applied

This document outlines the security fixes applied to CalSys and instructions for deploying to Railway with proper secret management.

### Security Fixes Implemented

1. ✅ **Removed Hardcoded Secrets from Code** - `.env` files are now git-ignored
2. ✅ **Fixed DELETE Request CSRF Bypass** - All state-changing methods now require JSON body + CSRF token
3. ✅ **Fixed Weak JWT Secret** - Now requires minimum 64 random characters
4. ✅ **Fixed Short JWT Expiration** - Changed from 12h to 15m (implement refresh tokens for long-lived sessions)
5. ✅ **Fixed Database SSL Validation** - Enabled strict certificate validation in production
6. ✅ **Fixed IDOR Vulnerabilities** - Added ownership checks on student grade endpoints
7. ✅ **Fixed XSS Vulnerability** - Changed `innerHTML` to `textContent` in GradesViewer
8. ✅ **Improved Email Validation** - Now uses RFC 5322 compliant regex
9. ✅ **Added Parameter Length Validation** - Query parameters now validated for maximum length
10. ✅ **Updated CSRF Token Handling** - Tokens now separate from JWT payload

## Pre-Deployment Checklist

### 1. Generate Strong Secrets

Run these commands to generate cryptographically secure secrets:

```bash
# Generate JWT secret (64+ bytes)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('base64'))"

# Generate database password (32+ characters)
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"
```

**Example Output:**
```
JWT_SECRET=aB3xYzK9qWjL2mNo5pQrSt8uVwXyZaB1cDeFgHiJkLmNoPqRsT9uVwXyZaB1cDeFgHiJk=
DB_PASSWORD=x9y2k8jL1mNoPqRsT8uVwXyZaB1cDeFgHiJk=
```

### 2. Set Up Railway Environment Variables

1. Go to your Railway project dashboard
2. Navigate to **Variables** for your backend service
3. Add the following variables:

```env
NODE_ENV=production
PORT=3000

# Database Configuration
DB_HOST=<your-railway-db-host>
DB_USER=<your-railway-db-user>
DB_PASSWORD=<generated-password-from-step-1>
DB_NAME=calsys_db
DB_PORT=5432

# JWT Configuration
JWT_SECRET=<generated-secret-from-step-1>
JWT_EXPIRES_IN=15m
JWT_ISSUER=calsys-api
JWT_AUDIENCE=calsys-web

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.com,https://www.your-frontend-domain.com

# Trust Proxy (Railway uses proxies)
TRUST_PROXY=true
```

### 3. Frontend Configuration

1. Create `CalSys-JS/.env.production` with:
```env
VITE_API_URL=https://your-railway-backend-domain.com/api
```

2. Update `CalSys-JS/src/api/axios.js` if needed to use the environment variable

### 4. Update CORS Origins

Ensure `CORS_ORIGIN` in Railway includes:
- Your frontend domain (production)
- Your localhost if testing locally (development only)
- All subdomains as needed

**Example:**
```
CORS_ORIGIN=https://calsys.yourcompany.com,https://app.yourcompany.com
```

### 5. Deploy to Railway

#### Option A: Using Railway CLI

```bash
# Install Railway CLI if not already installed
npm install -g @railway/cli

# Login to Railway
railway login

# Link your project
railway link

# Deploy backend
cd backend
railway up

# Deploy frontend
cd ../CalSys-JS
railway up
```

#### Option B: Using Git Push with Railway Integration

```bash
# Add Railway remote
git remote add railway <your-railway-git-url>

# Push to deploy
git push railway main
```

### 6. Verify Deployment

After deployment, verify security headers and configuration:

```bash
# Check HTTPS is enforced
curl -i https://your-api-domain.com/api/health
# Should see: Strict-Transport-Security header

# Check CORS is properly configured
curl -i -H "Origin: https://your-frontend.com" https://your-api-domain.com/api/auth/me
# Should see: Access-Control-Allow-Origin header

# Check database connection
curl https://your-api-domain.com/api/health
# Should respond with: {"status":"OK","database":"connected"}
```

## Post-Deployment Security Audit

### Required Tests

1. **CSRF Protection**
   ```bash
   # Should reject DELETE without JSON body
   curl -X DELETE https://your-api-domain.com/api/admin/students/1 \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: text/plain"
   # Expected: 415 error
   ```

2. **IDOR Prevention**
   ```bash
   # Log in as Student A, then try accessing Student B's grades
   curl https://your-api-domain.com/api/grades/student-subjects?matricula=<student-b-id> \
     -H "Authorization: Bearer <student-a-token>"
   # Expected: 403 Forbidden
   ```

3. **JWT Validation**
   ```bash
   # Verify JWT is short-lived
   jwt_decode <token>  # Check exp claim is ~15 minutes from now
   
   # Try to use old token (should fail)
   curl https://your-api-domain.com/api/auth/me \
     -H "Authorization: Bearer <expired-token>"
   # Expected: 401 Unauthorized
   ```

4. **SSL Certificate Validation**
   ```bash
   # Verify database SSL is enabled (check logs)
   railway logs -s <database-service-name>
   # Should show "SSL connection"
   ```

## Monitoring & Logging

### Set Up Sentry Integration (Optional but Recommended)

```bash
# Install Sentry
npm install @sentry/node @sentry/tracing

# In backend/src/server.js, add:
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

### Log Important Security Events

The application logs:
- Authentication failures
- CSRF token mismatches
- IDOR attempts
- Rate limit hits
- Origin validation failures

Monitor these logs in Railway:
```bash
railway logs -s backend
```

## Troubleshooting

### Issue: "JWT_SECRET must be at least 64 random characters"

**Solution:** Generate a new secret using the command in Step 1, then update Railway variables.

### Issue: "CORS_ORIGIN must be set in production"

**Solution:** Ensure `CORS_ORIGIN` environment variable is set in Railway dashboard.

### Issue: Database connection fails with SSL error

**Solution:** In production, `rejectUnauthorized` is set to `true`. If using a self-signed certificate, either:
1. Use a CA-signed certificate (recommended)
2. Add CA certificate to `backend/src/config/database.js` and set it in `DB_CA_CERT` variable

### Issue: Token expires too quickly (15 minutes)

**Solution:** This is intentional for security. Implement refresh token rotation:
1. User gets access token (15m) + refresh token (7d)
2. On expiration, use refresh token to get new access token
3. This is more secure than long-lived tokens

## Maintenance

### Regular Security Tasks

1. **Rotate Secrets Every 90 Days**
   - Generate new JWT_SECRET
   - Update in Railway dashboard
   - Invalidate all existing tokens (users must re-login)

2. **Update Dependencies Monthly**
   ```bash
   npm audit
   npm update
   npm audit fix
   ```

3. **Review Access Logs Weekly**
   - Look for unusual IDOR/CSRF attempts
   - Check for brute-force attempts on login endpoint

4. **Test Rate Limiting**
   - Send 10+ login requests rapidly
   - Should see 429 (Too Many Requests) responses

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Support

For security issues, do NOT create public GitHub issues. Email your security contact directly.

---

**Last Updated:** June 15, 2026
**Security Level:** Production-Ready
