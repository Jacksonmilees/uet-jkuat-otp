# 🚀 Deploy UET JKUAT OTP Service to Heroku

## ✅ What I Changed:
- ✅ Renamed OTP messages from generic to "UET JKUAT Ministry"
- ✅ Updated README branding
- ✅ **NO CODE CHANGES** - Everything else stays the same (it was working!)

---

## 📋 Deploy to Heroku via GitHub

### Step 1: Push to GitHub

1. **Go to ImaraBuild-OTP folder:**
   ```bash
   cd ImaraBuild-OTP
   ```

2. **Initialize git (if not already):**
   ```bash
   git init
   git add .
   git commit -m "UET JKUAT OTP Service - Ready for deployment"
   ```

3. **Create GitHub repo and push:**
   ```bash
   # Create a new repo on GitHub called "uetjkuat-otp"
   # Then:
   git remote add origin https://github.com/YOUR-USERNAME/uetjkuat-otp.git
   git branch -M main
   git push -u origin main
   ```

### Step 2: Connect to Heroku

1. **Go to Heroku Dashboard:** https://dashboard.heroku.com

2. **Create New App:**
   - Click "New" → "Create new app"
   - App name: `uetjkuat-otp` (or whatever you want)
   - Region: Choose your region
   - Click "Create app"

3. **Connect to GitHub:**
   - Go to "Deploy" tab
   - Deployment method: Select "GitHub"
   - Connect to GitHub
   - Search for your repo: `uetjkuat-otp`
   - Click "Connect"

4. **Enable Automatic Deploys (Optional):**
   - Click "Enable Automatic Deploys"
   - Every push to main will auto-deploy

5. **Deploy:**
   - Scroll to "Manual deploy"
   - Branch: `main`
   - Click "Deploy Branch"
   - Wait for deployment to finish

### Step 3: Get Your Heroku URL

After deployment, your OTP service will be at:
```
https://YOUR-APP-NAME.herokuapp.com
```

Example: `https://uetjkuat-otp.herokuapp.com`

---

## 🔧 Configure Main Backend

Once you have the Heroku URL, tell me and I'll configure the main backend:

```bash
# I'll run this for you:
heroku config:set OTP_SERVICE_URL=https://YOUR-OTP-APP.herokuapp.com -a uetjkuat
heroku run php artisan config:clear -a uetjkuat
heroku restart -a uetjkuat
```

---

## 🧪 Test Your OTP Service

### Test 1: Check Status
```bash
curl https://YOUR-APP-NAME.herokuapp.com/status
```

### Test 2: Send OTP
```bash
curl -X POST https://YOUR-APP-NAME.herokuapp.com/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "254712345678"}'
```

### Test 3: Verify OTP
```bash
curl -X POST https://YOUR-APP-NAME.herokuapp.com/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "254712345678", "otp": "123456"}'
```

---

## 📱 WhatsApp Authentication

**IMPORTANT:** You need to authenticate WhatsApp once:

### Option A: Use Heroku Console (If possible)
```bash
heroku run bash -a YOUR-APP-NAME
# Then manually trigger WhatsApp login
```

### Option B: Pre-authenticate Locally
1. Run OTP service locally first
2. Scan QR code
3. Session saves in `whatsapp_session/`
4. Deploy with session (complex)

### Option C: Use WhatsApp Business API (Recommended for Production)
- More reliable
- No QR scanning
- Official API

---

## 📊 Monitor Your Deployment

### View Logs
```bash
heroku logs --tail -a YOUR-APP-NAME
```

### Check Dynos
```bash
heroku ps -a YOUR-APP-NAME
```

### Restart App
```bash
heroku restart -a YOUR-APP-NAME
```

---

## ✅ After Deployment

**Send me the Heroku URL and I'll:**
1. Configure the main backend (`uetjkuat`) to use your OTP service
2. Update the frontend to call the correct endpoints
3. Test the full integration

**Example URL to send me:**
```
https://uetjkuat-otp.herokuapp.com
```

---

## 🎯 Summary

1. ✅ Push ImaraBuild-OTP folder to GitHub
2. ✅ Create Heroku app
3. ✅ Connect GitHub to Heroku
4. ✅ Deploy
5. ✅ Send me the Heroku URL
6. ✅ I'll configure the backend

**That's it!** The code is already working, just deploy it! 🚀
