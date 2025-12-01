# Heroku Deployment Guide - WhatsApp OTP Production

## 🚀 Quick Deploy (Recommended)

```bash
# Make the deployment script executable
chmod +x deploy-heroku.sh

# Run the optimized deployment script
./deploy-heroku.sh
```

## 🔧 Manual Deployment Steps

### 1. Prerequisites
- Heroku CLI installed
- Git repository initialized
- Node.js 18.x locally

### 2. Create Heroku App
```bash
heroku create your-app-name
```

### 3. Set Buildpacks
```bash
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs
```

### 4. Configure Environment Variables
```bash
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false
```

### 5. Deploy
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## 🛠️ Build Timeout Fixes Applied

### 1. Puppeteer Optimization
- **`.npmrc`**: Prevents Chromium download during build
- **Environment Variables**: Skip Chromium download
- **Package.json Config**: Additional Puppeteer settings

### 2. Node.js Version Lock
- Updated to Node.js 18.x (more stable)
- Specified npm version 9.x

### 3. Build Optimization
- Added `cacheDirectories` for faster rebuilds
- Optimized build scripts
- Added `.herokuignore` to exclude unnecessary files

### 4. Heroku Configuration
- Proper `app.json` configuration
- Buildpack optimization
- Environment variable management

## 🔍 Troubleshooting

### Build Still Times Out?
1. **Clear Build Cache**:
   ```bash
   heroku builds:cache:purge -a your-app-name
   ```

2. **Force Clean Deploy**:
   ```bash
   heroku builds:cache:purge -a your-app-name
   git commit --allow-empty -m "Force rebuild"
   git push heroku main
   ```

3. **Check Build Logs**:
   ```bash
   heroku builds:info -a your-app-name
   ```

### Puppeteer Issues?
1. **Verify Chromium Skip**:
   ```bash
   heroku config:get PUPPETEER_SKIP_CHROMIUM_DOWNLOAD
   ```

2. **Add Chrome Buildpack** (if needed):
   ```bash
   heroku buildpacks:add --index 1 https://github.com/heroku/heroku-buildpack-google-chrome
   ```

## 📊 Monitoring

### Check App Status
```bash
heroku logs --tail
heroku ps
```

### View Configuration
```bash
heroku config
heroku buildpacks
```

## 🎯 Performance Tips

1. **Use the deployment script** - It handles all optimizations automatically
2. **Monitor build times** - Should be under 10 minutes
3. **Keep dependencies minimal** - Only essential packages
4. **Use build cache** - Faster subsequent deployments

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Build timeout | Use deployment script, clear cache |
| Puppeteer errors | Verify Chromium skip settings |
| Node version issues | Check engines in package.json |
| Memory issues | Upgrade to larger dyno |

## 📞 Support

If you continue experiencing issues:
1. Check Heroku status: https://status.heroku.com/
2. Review build logs: `heroku builds:info`
3. Contact Heroku support with build ID 