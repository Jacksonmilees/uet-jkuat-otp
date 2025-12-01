@echo off
echo 🚀 Starting optimized Heroku deployment...

REM Set environment variables for faster builds
set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
set NODE_ENV=production
set NPM_CONFIG_PRODUCTION=false

echo 🧹 Clearing build cache...
heroku plugins:install heroku-builds
heroku builds:cache:purge 2>nul || echo No cache to clear

echo ⚙️  Setting buildpacks...
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs

echo 🔧 Setting configuration variables...
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false

echo 📦 Deploying to Heroku...
git add .
git commit -m "Optimized deployment %date% %time%" 2>nul || echo No changes to commit
git push heroku main

echo ✅ Deployment completed!
echo 🌐 Your app should be available at: https://%HEROKU_APP_NAME%.herokuapp.com
pause 