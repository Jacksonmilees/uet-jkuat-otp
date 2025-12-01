#!/bin/bash

# Heroku Deployment Script for WhatsApp OTP Production
# This script optimizes the deployment process to prevent timeouts

echo "🚀 Starting optimized Heroku deployment..."

# Set environment variables for faster builds
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
export NODE_ENV=production
export NPM_CONFIG_PRODUCTION=false

# Clear any existing build cache
echo "🧹 Clearing build cache..."
heroku plugins:install heroku-builds
heroku builds:cache:purge -a $(heroku apps:info --json | jq -r .app.name) 2>/dev/null || echo "No cache to clear"

# Set buildpacks
echo "⚙️  Setting buildpacks..."
heroku buildpacks:clear
heroku buildpacks:add heroku/nodejs

# Set config vars
echo "🔧 Setting configuration variables..."
heroku config:set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false

# Deploy with optimized settings
echo "📦 Deploying to Heroku..."
git add .
git commit -m "Optimized deployment $(date +%Y%m%d-%H%M%S)" || echo "No changes to commit"
git push heroku main

echo "✅ Deployment completed!"
echo "🌐 Your app should be available at: https://$(heroku apps:info --json | jq -r .app.name).herokuapp.com" 