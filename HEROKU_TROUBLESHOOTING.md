# Heroku Troubleshooting Guide

## 🚨 **Current Issue: Application Error**

**Problem**: Your app works locally but shows "Application Error" on Heroku

**Root Cause**: Missing Chrome buildpack for Puppeteer

## 🔧 **Quick Fix**

Run this script to fix the Chrome issue:

```bash
fix-heroku-chrome.bat
```

## 📋 **What the Fix Does**

1. **Adds Chrome Buildpack**: Installs Google Chrome on Heroku
2. **Sets Environment Variables**: Configures Puppeteer to use Heroku's Chrome
3. **Redeploys**: Pushes the fix to Heroku

## 🔍 **Common Heroku Issues & Solutions**

### **Issue 1: CHROME_BIN is not set**
```
❌ Production initialization failed: CHROME_BIN is not set! 
Heroku Chrome buildpack is required.
```

**Solution**:
```bash
# Add Chrome buildpack
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-google-chrome

# Set Chrome environment variables
heroku config:set CHROME_BIN=/app/.apt/usr/bin/google-chrome
heroku config:set CHROME_PATH=/app/.apt/usr/bin/google-chrome
```

### **Issue 2: Build Timeout**
```
ERROR: Build terminated for reason: Build Timeout Expired
```

**Solution**:
```bash
# Use pre-built deployment
deploy-prebuilt.bat
```

### **Issue 3: App Crashes (H10 Error)**
```
at=error code=H10 desc="App crashed"
```

**Solution**:
```bash
# Check logs
heroku logs --tail

# Restart app
heroku restart
```

### **Issue 4: Memory Issues**
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solution**:
```bash
# Upgrade to larger dyno
heroku ps:type standard-1x
```

## 🛠️ **Manual Fix Steps**

If the script doesn't work, do this manually:

### **Step 1: Check Current Buildpacks**
```bash
heroku buildpacks
```

### **Step 2: Clear and Add Buildpacks**
```bash
heroku buildpacks:clear
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-google-chrome
heroku buildpacks:add heroku/nodejs
```

### **Step 3: Set Environment Variables**
```bash
heroku config:set CHROME_BIN=/app/.apt/usr/bin/google-chrome
heroku config:set CHROME_PATH=/app/.apt/usr/bin/google-chrome
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production
```

### **Step 4: Redeploy**
```bash
git add .
git commit -m "Fix Chrome buildpack"
git push heroku main
```

## 📊 **Monitoring Commands**

### **Check App Status**
```bash
heroku ps
heroku logs --tail
```

### **Check Configuration**
```bash
heroku config
heroku buildpacks
```

### **Check Build Status**
```bash
heroku builds:info
```

## 🎯 **Expected Behavior After Fix**

### **Successful Deployment**
```
✅ Build succeeded
✅ App started successfully
✅ Chrome available at /app/.apt/usr/bin/google-chrome
✅ Puppeteer can launch Chrome
```

### **App Should Show**
- ✅ Homepage loads
- ✅ Status endpoint works
- ✅ QR code displays
- ✅ WhatsApp Web initializes

## 🚨 **If Still Not Working**

### **1. Check Logs**
```bash
heroku logs --tail
```

### **2. Verify Buildpacks**
```bash
heroku buildpacks
# Should show:
# 1. https://github.com/heroku/heroku-buildpack-google-chrome
# 2. heroku/nodejs
```

### **3. Verify Environment Variables**
```bash
heroku config | findstr CHROME
# Should show:
# CHROME_BIN=/app/.apt/usr/bin/google-chrome
# CHROME_PATH=/app/.apt/usr/bin/google-chrome
```

### **4. Force Rebuild**
```bash
heroku builds:cache:purge
git commit --allow-empty -m "Force rebuild"
git push heroku main
```

## 📞 **Getting Help**

### **1. Heroku Status**
Check if Heroku is having issues: https://status.heroku.com/

### **2. Build Logs**
```bash
heroku builds:info
```

### **3. App Logs**
```bash
heroku logs --tail
```

### **4. Support**
If issues persist, contact Heroku support with:
- Build ID from `heroku builds:info`
- App name
- Error logs

## 🎉 **Success Checklist**

After running the fix, verify:

- [ ] `heroku buildpacks` shows Chrome buildpack first
- [ ] `heroku config` shows CHROME_BIN and CHROME_PATH
- [ ] `heroku logs --tail` shows successful Chrome launch
- [ ] App homepage loads without errors
- [ ] WhatsApp Web initializes properly

## 🚀 **Next Steps**

Once fixed:

1. **Test the app**: Visit your Heroku URL
2. **Scan QR code**: Use the `/qr` endpoint
3. **Monitor logs**: Keep `heroku logs --tail` running
4. **Test OTP sending**: Try the `/send-otp` endpoint

Your app should now work perfectly on Heroku! 🎉 