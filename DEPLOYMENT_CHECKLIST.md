# Deployment Checklist

## Pre-Deployment

### Code Quality
- [ ] All tests passing: `npm test`
- [ ] Endpoint tests passing: `npm run test:endpoints`
- [ ] No console errors or warnings
- [ ] Code follows project standards
- [ ] All dependencies up to date: `npm audit`
- [ ] No hardcoded secrets or credentials

### Environment Setup
- [ ] `.env` file configured locally
- [ ] All required environment variables documented
- [ ] Sensitive data not committed to git
- [ ] `.gitignore` properly configured

### Testing
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] API endpoints tested manually
- [ ] Error handling tested
- [ ] Edge cases covered

### Documentation
- [ ] README.md updated
- [ ] API_ENDPOINTS.md complete
- [ ] VERCEL_DEPLOYMENT.md reviewed
- [ ] Code comments added where needed
- [ ] Postman collection updated

---

## Vercel Deployment

### Pre-Deployment
- [ ] Git repository created and pushed
- [ ] Vercel account created
- [ ] Project connected to Vercel

### Environment Variables
- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` set (strong, random value)
- [ ] `SUPABASE_URL` configured
- [ ] `SUPABASE_ANON_KEY` configured
- [ ] `SUPABASE_SERVICE_ROLE_KEY` configured
- [ ] `SQUADCO_API_KEY` set (production key)
- [ ] `SQUADCO_PUBLIC_KEY` set (production key)
- [ ] `SQUADCO_API_URL` set to production URL
- [ ] `CORS_ORIGIN` set to production domain(s)
- [ ] `API_VERSION` set to `v1`

### Deployment
- [ ] Run `vercel --prod` or deploy via dashboard
- [ ] Verify deployment successful
- [ ] Check deployment logs for errors
- [ ] Verify all environment variables loaded

---

## Post-Deployment

### Verification
- [ ] Health check endpoint responding: `GET /health`
- [ ] API endpoints accessible
- [ ] Authentication working
- [ ] Database connections working
- [ ] Payment gateway integration working
- [ ] CORS properly configured
- [ ] SSL certificate active

### Testing
- [ ] Run endpoint tests against production: `TEST_URL=https://your-domain.vercel.app npm run test:endpoints`
- [ ] Test all critical user flows
- [ ] Test payment processing
- [ ] Test wallet operations
- [ ] Test withdrawal requests
- [ ] Test error handling

### Monitoring
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Set up performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alerts for errors
- [ ] Configure alerts for performance issues

### Security
- [ ] Verify HTTPS enabled
- [ ] Check security headers
- [ ] Verify rate limiting working
- [ ] Test CORS restrictions
- [ ] Verify JWT validation
- [ ] Check for exposed secrets

---

## Production Maintenance

### Regular Tasks
- [ ] Monitor error logs daily
- [ ] Check performance metrics
- [ ] Review API usage
- [ ] Update dependencies monthly
- [ ] Run security audits monthly
- [ ] Backup database regularly

### Monitoring Checklist
- [ ] Error rate < 1%
- [ ] Response time < 500ms
- [ ] Uptime > 99.9%
- [ ] No memory leaks
- [ ] Database connections healthy
- [ ] Payment gateway responsive

### Scaling Considerations
- [ ] Monitor request volume
- [ ] Check database performance
- [ ] Review rate limiting effectiveness
- [ ] Plan for traffic spikes
- [ ] Consider caching strategy
- [ ] Evaluate CDN usage

---

## Rollback Plan

### If Issues Occur
1. [ ] Check error logs
2. [ ] Identify root cause
3. [ ] Decide: fix or rollback
4. [ ] If rollback: `vercel rollback`
5. [ ] Verify previous version working
6. [ ] Fix issue locally
7. [ ] Test thoroughly
8. [ ] Redeploy

### Emergency Contacts
- [ ] Vercel support: https://vercel.com/support
- [ ] Supabase support: https://supabase.com/support
- [ ] Squadco support: https://squadco.com/support

---

## Post-Launch

### First Week
- [ ] Monitor error logs closely
- [ ] Check user feedback
- [ ] Monitor performance metrics
- [ ] Be ready to rollback if needed
- [ ] Daily check-ins on system health

### First Month
- [ ] Analyze usage patterns
- [ ] Optimize based on metrics
- [ ] Update documentation based on issues
- [ ] Plan improvements
- [ ] Review security logs

### Ongoing
- [ ] Keep dependencies updated
- [ ] Monitor for security vulnerabilities
- [ ] Optimize performance
- [ ] Plan feature improvements
- [ ] Maintain documentation

---

## Useful Commands

```bash
# Local testing
npm run dev                    # Start dev server
npm test                       # Run all tests
npm run test:endpoints        # Run endpoint tests

# Deployment
vercel                        # Deploy to staging
vercel --prod                # Deploy to production
vercel list                  # View deployments
vercel rollback              # Rollback to previous

# Monitoring
vercel logs                  # View logs
vercel env list             # List environment variables
vercel env pull             # Pull env vars locally

# Cleanup
npm audit                    # Check for vulnerabilities
npm update                   # Update dependencies
npm prune                    # Remove unused packages
```

---

## Troubleshooting

### Deployment Failed
1. Check build logs in Vercel dashboard
2. Verify all environment variables set
3. Check for syntax errors: `npm test`
4. Verify dependencies installed: `npm install`
5. Check Node.js version compatibility

### API Not Responding
1. Check health endpoint: `curl https://your-domain.vercel.app/health`
2. Check Vercel logs
3. Verify environment variables
4. Check database connectivity
5. Verify CORS configuration

### Performance Issues
1. Check response times in Vercel Analytics
2. Review database queries
3. Check for memory leaks
4. Verify rate limiting
5. Consider caching strategy

### Security Issues
1. Check for exposed secrets
2. Verify HTTPS enabled
3. Check security headers
4. Review CORS configuration
5. Verify JWT validation

---

## Sign-Off

- [ ] All checks completed
- [ ] Team reviewed deployment
- [ ] Stakeholders notified
- [ ] Monitoring configured
- [ ] Rollback plan ready
- [ ] Ready for production

**Deployed by:** ________________
**Date:** ________________
**Version:** ________________
