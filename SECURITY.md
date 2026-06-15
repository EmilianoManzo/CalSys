# Security Policy for CalSys

## Reporting Security Vulnerabilities

If you discover a security vulnerability in CalSys, please **DO NOT** open a public GitHub issue. Instead:

1. Email: [security@your-organization.com](mailto:security@your-organization.com)
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. Expected response time: 24 hours
4. We will work with you to develop a fix before public disclosure

## Security Standards

CalSys adheres to the following security standards:

### OWASP Top 10 (2021)

- ✅ A01:2021 - Broken Access Control (IDOR checks implemented)
- ✅ A02:2021 - Cryptographic Failures (SSL/TLS validation enabled)
- ✅ A03:2021 - Injection (Parameterized queries, input validation)
- ✅ A04:2021 - Insecure Design (CSRF, rate limiting)
- ✅ A05:2021 - Security Misconfiguration (Environment variable management)
- ✅ A06:2021 - Vulnerable Components (Regular dependency updates)
- ✅ A07:2021 - Identification & Authentication (JWT hardening)
- ✅ A08:2021 - Software & Data Integrity (Code integrity checks)
- ✅ A09:2021 - Logging & Monitoring (Security event logging)
- ✅ A10:2021 - SSRF (Not applicable to current architecture)

### Authentication & Authorization

- JWT tokens with RS256 algorithm (HS256 with strong entropy in production)
- Short-lived access tokens (15 minutes)
- CSRF token validation on state-changing requests
- Role-based access control (RBAC) with ownership verification
- Account lockout after 5 failed login attempts (15-minute lockout)

### Data Protection

- All sensitive data encrypted in transit (HTTPS/TLS 1.2+)
- Database passwords stored in secure environment variables
- No secrets committed to version control
- Regular rotation of cryptographic keys (every 90 days)

### Input Validation

- Email validation (RFC 5322 compliant)
- Numeric ID validation (positive integers only)
- String length validation (maximum limits enforced)
- Query parameter validation
- Special character escaping

### Output Encoding

- HTML entity encoding for user-supplied content
- Use of `textContent` instead of `innerHTML` in DOM manipulation
- Content-Security-Policy headers enabled
- X-Content-Type-Options: nosniff header set

### Session Management

- Tokens stored in httpOnly, Secure cookies
- SameSite=Strict CSRF protection
- Session timeout after 15 minutes of inactivity
- Concurrent session limits (implementation pending)

## Deployment Security

### Production Checklist

Before deploying to production, ensure:

- [ ] All secrets are in Railway environment variables (NOT in code)
- [ ] `.env` files are in `.gitignore` and removed from git history
- [ ] HTTPS is enforced (automatic with Railway)
- [ ] Database SSL validation is enabled (`rejectUnauthorized: true`)
- [ ] CORS origins are properly configured (no wildcard `*`)
- [ ] Rate limiting is active on auth endpoints
- [ ] Security headers are present (CSP, HSTS, etc.)
- [ ] Logging is configured for security events
- [ ] Database backups are configured

### Monitoring

Production deployments should have:

- Security event logging (authentication failures, CSRF denials, IDOR attempts)
- Rate limit monitoring
- Error tracking (Sentry integration)
- Access logs review (weekly)
- Dependency vulnerability scanning (npm audit)

## Known Limitations

1. **Refresh Token Rotation** - Not yet implemented. Consider adding for long-lived sessions.
2. **Concurrent Session Limits** - Not yet implemented. Add per-user session limits.
3. **IP Whitelisting** - Not implemented. Consider for admin endpoints.
4. **2FA/MFA** - Not implemented. Recommended for admin accounts.
5. **OAuth2/OIDC Integration** - Not implemented. Consider for SSO.

## Security Updates

We monitor security issues in dependencies and release patches as needed:

- Critical severity: 24 hours
- High severity: 7 days
- Medium severity: 30 days
- Low severity: 90 days

Follow security updates by:

```bash
# Check for vulnerabilities
npm audit

# Fix known vulnerabilities
npm audit fix

# Update all dependencies
npm update
```

## Testing & Verification

### Manual Security Testing

```bash
# Test IDOR prevention
curl -H "Authorization: Bearer <token>" \
  https://api.example.com/api/grades/student-subjects?matricula=<other-student-id>
# Expected: 403 Forbidden

# Test CSRF protection
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: text/plain" \
  https://api.example.com/api/admin/materias
# Expected: 415 Unsupported Media Type

# Test rate limiting
for i in {1..11}; do
  curl -X POST https://api.example.com/api/auth/login \
    -d '{"username":"test","password":"wrong","role":"admin"}'
done
# Expected: 429 Too Many Requests after 10 attempts
```

### Automated Security Testing

```bash
# Dependency vulnerability scan
npm audit

# OWASP ZAP scanning (optional)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.example.com/api/health

# SonarQube code quality (optional)
sonar-scanner
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices (RFC 8725)](https://tools.ietf.org/html/rfc8725)
- [CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

---

**Security Policy Version:** 1.0  
**Last Updated:** June 15, 2026
