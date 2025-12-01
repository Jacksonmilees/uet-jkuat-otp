@echo off
echo 🚀 Pre-built Heroku Deployment Script
echo =====================================

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

REM Check if Heroku CLI is installed
heroku --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Heroku CLI not found. Please install Heroku CLI first.
    pause
    exit /b 1
)

echo 📦 Step 1: Installing dependencies locally...
call npm install --production

if errorlevel 1 (
    echo ❌ npm install failed
    pause
    exit /b 1
)

echo ✅ Dependencies installed successfully

echo 🧹 Step 2: Cleaning up unnecessary files...
if exist node_modules\.cache rmdir /s /q node_modules\.cache
if exist node_modules\puppeteer\.local-chromium rmdir /s /q node_modules\puppeteer\.local-chromium

echo ⚙️ Step 3: Setting Heroku configuration...
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false
heroku config:set NPM_CONFIG_CACHE=./.npm

echo 🔧 Step 4: Setting buildpacks...
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs

echo 📤 Step 5: Deploying to Heroku...
git add .
git commit -m "Pre-built deployment %date% %time%" 2>nul || echo No changes to commit
git push heroku main

echo ✅ Deployment completed!
echo 🌐 Your app should be available at: https://%HEROKU_APP_NAME%.herokuapp.com

echo.
echo 📋 Next steps:
echo 1. Check app status: heroku logs --tail
echo 2. Open app: heroku open
echo 3. Monitor: heroku ps

pause 