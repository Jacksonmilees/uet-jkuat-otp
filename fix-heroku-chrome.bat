@echo off
echo 🔧 Fixing Heroku Chrome Buildpack Issue
echo ======================================

echo 📋 Current buildpacks:
heroku buildpacks

echo.
echo 🧹 Clearing existing buildpacks...
heroku buildpacks:clear

echo.
echo 📦 Adding Chrome buildpack first...
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-google-chrome

echo.
echo 📦 Adding Node.js buildpack second...
heroku buildpacks:add heroku/nodejs

echo.
echo ⚙️ Setting Chrome environment variables...
heroku config:set CHROME_BIN=/app/.apt/usr/bin/google-chrome
heroku config:set CHROME_PATH=/app/.apt/usr/bin/google-chrome
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production

echo.
echo 📋 Updated buildpacks:
heroku buildpacks

echo.
echo 🔧 Updated configuration:
heroku config | findstr CHROME

echo.
echo 🚀 Redeploying with Chrome support...
git add .
git commit -m "Add Chrome buildpack support" 2>nul || echo No changes to commit
git push heroku main

echo.
echo ✅ Chrome buildpack fix completed!
echo 📱 Your app should now work with Puppeteer on Heroku
echo.
echo 📋 To monitor the deployment:
echo heroku logs --tail
echo.
pause 