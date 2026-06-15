# CalSys Security Hardening - Complete ✅

## Summary of Changes Applied Locally

All critical and high-severity security vulnerabilities have been fixed and committed. The application is now ready for production deployment on Railway.

### Security Fixes Applied

| Issue | Severity | Status | Details |
|-------|----------|--------|---------|
| Hardcoded secrets in .env | CRITICAL | ✅ FIXED | Removed from git history, added to .gitignore, created .env.example files |
| DELETE CSRF bypass | CRITICAL | ✅ FIXED | Removed DELETE exemption from requireJsonBody middleware |
| Weak JWT secret (32 chars) | CRITICAL | ✅ FIXED | Increased to 64 chars minimum, improved validation |
| Short JWT expiration (12h) | CRITICAL | ✅ FIXED | Reduced to 15 minutes for short-lived tokens |
| Database SSL disabled | CRITICAL | ✅ FIXED | Enabled strict certificate validation in production |
| IDOR on student grades | HIGH | ✅ FIXED | Added ownership verification on 3 endpoints |
| XSS via innerHTML | HIGH | ✅ FIXED | Changed to textContent in GradesViewer component |
| Weak email validation | HIGH | ✅ FIXED | Updated to RFC 5322 compliant regex |
| No parameter length validation | HIGH | ✅ FIXED | Added validateMaxLength, validateSubjectCode, validateSemesterCode |
| CSRF token in JWT payload | HIGH | ✅ FIXED | Removed from JWT, stored separately in sessionStorage |

## Files Modified

```
✅ backend/src/middleware/security.js (JWT, CSRF, headers)
✅ backend/src/routes/auth.routes.js (signAuthToken call)
✅ backend/src/config/database.js (SSL validation)
✅ backend/src/routes/grades.routes.js (IDOR checks)
✅ backend/src/utils/validation.js (email, parameter length)
✅ CalSys-JS/src/components/admin/GradesViewer.jsx (XSS fix)
✅ .gitignore (added .env patterns)
✅ backend/.env.example (created)
✅ CalSys-JS/.env.example (created)
✅ backend/railway.json (created)
✅ DEPLOYMENT_GUIDE.md (created)
✅ SECURITY.md (created)
```

## Next Steps: Railway Deployment

### 1. Generate Strong Secrets (Required!)

Before deploying to Railway, generate cryptographically secure secrets. Run these commands in your terminal:

```bash
# Generate JWT Secret (64+ random bytes)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('base64'))"

# Generate Database Password (32+ random bytes)
node -e "console.log('DB_PASSWORD=' + require('crypto').randomBytes(32).toString('base64'))"

# Save the output - you'll need these values
```

**Example Output:**
```
JWT_SECRET=f7xK9mP2wL8qR5tJ3bN6vH4zY0aBcDeF1gHiJkLmN9oP1qRsT8uVwXyZaB2cDeFg=
DB_PASSWORD=x9y2k8jL1mNoPqRs9tUvWxYzAaBbCcDdEeFf=
```

### 2. Set Up Railway Project

1. Go to [Railway.app](https://railway.app) and sign in
2. Create a new project or use existing
3. Add a MySQL/PostgreSQL database plugin to your project
4. Configure variables in the **Variables** tab

### 3. Configure Environment Variables in Railway

Navigate to your backend service **Variables** tab and add:

```env
# Basic Configuration
NODE_ENV=production
PORT=3000
TRUST_PROXY=true

# Database (get these from Railway database details)
DB_HOST=<your-railway-db-host>
DB_USER=<your-railway-db-user>
DB_PASSWORD=<paste the generated password from step 1>
DB_NAME=calsys_db
DB_PORT=3306

# Security (paste the generated JWT secret from step 1)
JWT_SECRET=<paste the generated secret from step 1>
JWT_EXPIRES_IN=15m
JWT_ISSUER=calsys-api
JWT_AUDIENCE=calsys-web

# CORS (update with your actual domain)
CORS_ORIGIN=https://your-frontend-domain.com,https://www.your-frontend-domain.com
```

### 4. Deploy to Railway

#### Option A: Using Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Navigate to backend directory
cd backend

# Deploy
railway up --name calsys-backend

# Check deployment
railway logs
```

#### Option B: Using Git Push

```bash
# Add Railway remote
git remote add railway <your-railway-git-url>

# Push to deploy
git push railway main
```

#### Option C: Using Railway Dashboard

1. Go to Railway project
2. Click **Deploy** button
3. Connect your GitHub repository
4. Select branch and deploy

### 5. Deploy Frontend

```bash
cd CalSys-JS

# Create production .env file
echo "VITE_API_URL=https://your-railway-api-domain.com/api" > .env.production

# Build
npm run build

# Deploy to Railway (or Vercel/Netlify)
railway up --name calsys-frontend
```

### 6. Verify Deployment

After deployment, test critical security features:

```bash
# Test 1: Check HTTPS and security headers
curl -i https://your-api-domain.com/api/health
# Look for: Strict-Transport-Security, X-Frame-Options, etc.

# Test 2: Check CORS
curl -i -H "Origin: https://your-frontend.com" \
  https://your-api-domain.com/api/auth/me
# Look for: Access-Control-Allow-Origin header

# Test 3: Test CSRF protection (should fail without X-CSRF-Token)
curl -X POST https://your-api-domain.com/api/admin/materias \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{}' \
  --header "X-CSRF-Token: invalid"
# Should see: 403 error
```

## Verification Checklist

After deployment, complete this security checklist:

- [ ] Application loads on Railway domain
- [ ] Login works with new JWT validation
- [ ] CSRF tokens are validated on state-changing requests
- [ ] Student A cannot view Student B's grades (IDOR fixed)
- [ ] Security headers are present in responses
- [ ] Rate limiting works (try 10+ rapid login attempts)
- [ ] Database connection uses SSL (check logs)
- [ ] No secrets are exposed in logs or configuration
- [ ] Tokens expire after 15 minutes (test with `jwt.io`)

## Important Notes

### Do NOT

❌ Commit `.env` files to GitHub  
❌ Use weak passwords or secrets  
❌ Set `NODE_ENV=development` in production  
❌ Disable SSL validation  
❌ Use CORS with wildcard `*`  

### Always

✅ Store secrets in Railway dashboard variables only  
✅ Use HTTPS for all API communication  
✅ Rotate JWT secrets every 90 days  
✅ Monitor security logs regularly  
✅ Keep dependencies updated  

## Troubleshooting

### "JWT_SECRET must be at least 64 random characters"

**Solution:** Generate a new secret using the command from Step 1 and update in Railway Variables.

### "CORS_ORIGIN must be set in production"

**Solution:** Add `CORS_ORIGIN` to Railway Variables with your actual frontend domain.

### "Database connection failed"

**Solution:** Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD` are correct in Railway Variables. Make sure database service is running.

### "Token expires immediately"

**Solution:** This is correct! 15-minute expiration is intentional. Implement refresh token logic if needed.

## Support & Documentation

- 📖 **Deployment Guide:** See `DEPLOYMENT_GUIDE.md` in repository
- 🔒 **Security Policy:** See `SECURITY.md` in repository
- 🚂 **Railway Docs:** https://docs.railway.app/
- 🛡️ **OWASP Top 10:** https://owasp.org/www-project-top-ten/

## Questions?

Review the security files in the repository:
- `DEPLOYMENT_GUIDE.md` - Detailed setup instructions
- `SECURITY.md` - Security standards and policies
- `.env.example` files - Template variables needed

---

**All security fixes are applied and committed.** Ready to deploy to Railway! 🚀
