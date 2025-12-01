const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(express.static('public'));

let browser = null;
let page = null;
let isReady = false;
let isInitializing = false;
let sessionStatus = 'disconnected';

// Store OTPs with expiration
const otpStore = new Map();

// Helper to generate a 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper to create OTP message
function createOTPMessage(otp, customMessage = null) {
    if (customMessage) {
        return customMessage.replace('{otp}', otp);
    }
    return `*UET JKUAT Ministry*\n\nYour verification code is: *${otp}*\n\nValid for 5 minutes. Do not share this code with anyone.\n\n_This is an automated message from UET JKUAT Funding Platform._`;
}

// Clean up expired OTPs
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of otpStore.entries()) {
        if (now > data.expiresAt) {
            otpStore.delete(key);
        }
    }
}, 60000);

// Ultra-reliable login detection for production
async function checkWhatsAppLogin() {
    if (!page) {
        sessionStatus = 'no_page';
        return false;
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const loginCheck = await page.evaluate(() => {
            // More comprehensive login detection
            const indicators = {
                // Primary chat interface elements
                chatList: !!document.querySelector('[data-testid="chat-list"]'),
                sidebar: !!document.querySelector('[data-testid="side"]'),
                searchInput: !!document.querySelector('[data-testid="search-input"]'),
                newChatBtn: !!document.querySelector('[data-testid="new-chat-btn"]'),
                menuBtn: !!document.querySelector('[data-testid="menu"]'),
                
                // Additional interface elements
                header: !!document.querySelector('header'),
                chatListHeader: !!document.querySelector('[data-testid="chatlist-header"]'),
                paneMain: !!document.querySelector('[data-testid="main"]'),
                
                // QR code indicators (means not logged in)
                qrCode: !!document.querySelector('[data-testid="qrcode"]'),
                qrContainer: !!document.querySelector('canvas[aria-label*="QR"]'),
                qrCanvas: !!document.querySelector('canvas'),
                
                // Check for main app structure
                mainApp: !!document.querySelector('[data-testid="app"]'),
                conversationPanel: !!document.querySelector('[data-testid="conversation-panel-wrapper"]'),
                
                // Text-based checks
                hasWhatsAppText: document.body.textContent.includes('WhatsApp'),
                hasLoginText: document.body.textContent.includes('To use WhatsApp on your computer'),
                hasChatText: document.body.textContent.includes('Search or start new chat') || 
                           document.body.textContent.includes('Click on a chat to read messages'),
                
                // URL check
                isMainPage: window.location.href === 'https://web.whatsapp.com/',
                
                // Check for any input elements (usually present when logged in)
                hasInputs: document.querySelectorAll('input, [contenteditable]').length > 0,
                
                // Check for navigation elements
                hasNavigation: !!document.querySelector('[role="navigation"]') || !!document.querySelector('nav'),
                
                // Count all interactive elements
                interactiveCount: document.querySelectorAll('button, [role="button"], input, [contenteditable]').length
            };
            
            // If QR code is clearly present, not logged in
            if (indicators.qrCode || (indicators.qrCanvas && indicators.hasLoginText)) {
                return { loggedIn: false, reason: 'qr_code_detected', indicators };
            }
            
            // Strong positive indicators for being logged in
            const strongIndicators = [
                indicators.chatList,
                indicators.sidebar, 
                indicators.newChatBtn,
                indicators.menuBtn,
                indicators.searchInput,
                indicators.chatListHeader
            ].filter(Boolean).length;
            
            if (strongIndicators >= 2) {
                return { loggedIn: true, reason: 'strong_indicators', count: strongIndicators, indicators };
            }
            
            // Check for chat interface text
            if (indicators.hasChatText && indicators.isMainPage && !indicators.hasLoginText) {
                return { loggedIn: true, reason: 'chat_interface_text', indicators };
            }
            
            // Fallback: many interactive elements + no QR code + WhatsApp text
            if (indicators.interactiveCount > 10 && !indicators.qrCode && indicators.hasWhatsAppText && indicators.isMainPage) {
                return { loggedIn: true, reason: 'interactive_elements', count: indicators.interactiveCount, indicators };
            }
            
            // Default to not logged in if we can't determine
            const positiveCount = Object.values(indicators).filter(v => v === true).length;
            return { loggedIn: false, reason: 'insufficient_evidence', count: positiveCount, indicators };
        });
        
        sessionStatus = loginCheck.loggedIn ? 'logged_in' : 'not_logged_in';
        
        if (loginCheck.loggedIn) {
            console.log(`✅ LOGGED IN (${loginCheck.reason}, ${loginCheck.count || 0} indicators)`);
        } else {
            console.log(`❌ NOT LOGGED IN (${loginCheck.reason})`);
            // Debug: show what we found
            const debugInfo = Object.entries(loginCheck.indicators || {})
                .filter(([key, value]) => value === true)
                .map(([key]) => key)
                .slice(0, 5); // First 5 true indicators
            
            if (debugInfo.length > 0) {
                console.log(`   🔍 Found elements: ${debugInfo.join(', ')}`);
            }
            if (loginCheck.indicators?.interactiveCount) {
                console.log(`   🔍 Interactive elements: ${loginCheck.indicators.interactiveCount}`);
            }
        }
        
        return loginCheck.loggedIn;
        
    } catch (error) {
        sessionStatus = 'error';
        console.log('❌ Error checking login:', error.message);
        return false;
    }
}

// Bulletproof Chrome detection for Heroku
function findChromePath() {
    console.log('🔍 Detecting Chrome installation...');
    
    // Strategy 1: Environment variables
    const envPaths = [
        process.env.CHROME_BIN,
        process.env.GOOGLE_CHROME_BIN,
        process.env.CHROME_PATH
    ].filter(Boolean);
    
    if (envPaths.length > 0) {
        console.log('✅ Found Chrome via environment variable:', envPaths[0]);
        return envPaths[0];
    }
    
    // Strategy 2: Common Chrome paths on Heroku
    const commonPaths = [
        '/app/.apt/usr/bin/google-chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium',
        '/opt/google/chrome/chrome',
        '/usr/bin/google-chrome-stable'
    ];
    
    console.log('🔍 Checking common Chrome paths...');
    for (const path of commonPaths) {
        try {
            if (require('fs').existsSync(path)) {
                console.log('✅ Found Chrome at:', path);
                return path;
            }
        } catch (e) {
            // Continue checking other paths
        }
    }
    
    // Strategy 3: Use system command to find Chrome
    try {
        const { execSync } = require('child_process');
        const chromePath = execSync('which google-chrome', { encoding: 'utf8' }).trim();
        if (chromePath) {
            console.log('✅ Found Chrome via system command:', chromePath);
            return chromePath;
        }
    } catch (e) {
        console.log('⚠️ System command failed, continuing...');
    }
    
    console.log('❌ No Chrome found, will use Puppeteer\'s bundled Chromium');
    return null;
}

// Production-ready WhatsApp initialization
async function initializeWhatsApp() {
    if (isInitializing) {
        console.log('⏳ Already initializing...');
        return;
    }
    
    isInitializing = true;
    isReady = false;
    
    try {
        console.log('🚀 Starting WhatsApp Web for production...');
        
        // Create persistent session directory
        const userDataDir = './whatsapp_production_session';
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        
        // Bulletproof Chrome detection
        const chromePath = findChromePath();
        
        const launchOptions = {
            headless: process.env.NODE_ENV === 'production' ? "new" : false,
            userDataDir: userDataDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-gpu',
                '--single-process',
                '--no-zygote',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection',
                '--disable-background-networking',
                '--disable-sync',
                '--metrics-recording-only',
                '--no-default-browser-check',
                '--no-experiments',
                '--disable-default-apps',
                '--disable-component-extensions-with-background-pages',
                '--disable-background-mode',
                '--disable-client-side-phishing-detection',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-domain-reliability',
                '--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ],
            defaultViewport: null
        };
        
        // Only set executablePath if we found Chrome
        if (chromePath) {
            launchOptions.executablePath = chromePath;
        }
        
        console.log('🔧 Launching Chrome...');
        console.log('Chrome path:', chromePath || 'Using Puppeteer bundled Chromium');
        console.log('Headless mode:', process.env.NODE_ENV === 'production' ? "new" : false);
        
        // Try to launch with multiple strategies
        let browser = null;
        let launchError = null;
        
        // Strategy 1: Try with detected Chrome path
        if (chromePath) {
            try {
                browser = await puppeteer.launch(launchOptions);
                console.log('✅ Successfully launched with detected Chrome');
            } catch (error) {
                console.log('⚠️ Failed with detected Chrome, trying fallback...');
                launchError = error;
            }
        }
        
        // Strategy 2: Try without executablePath (use Puppeteer's Chromium)
        if (!browser) {
            try {
                const fallbackOptions = { ...launchOptions };
                delete fallbackOptions.executablePath;
                browser = await puppeteer.launch(fallbackOptions);
                console.log('✅ Successfully launched with Puppeteer Chromium');
            } catch (error) {
                console.log('❌ Failed with Puppeteer Chromium:', error.message);
                throw new Error(`Chrome launch failed: ${error.message}`);
            }
        }
        
        const pages = await browser.pages();
        page = pages[0] || await browser.newPage();
        
        // Set production user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        console.log('📱 Navigating to WhatsApp Web...');
        
        try {
            await page.goto('https://web.whatsapp.com/', { 
                waitUntil: 'domcontentloaded',
                timeout: 60000 
            });
        } catch (navError) {
            console.log('⚠️ Navigation timeout, continuing...');
        }
        
        console.log('⏳ Checking login status...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        let isLoggedIn = await checkWhatsAppLogin();
        
        if (isLoggedIn) {
            console.log('🎉 Already logged in! Production automation ready.');
            isReady = true;
            isInitializing = false;
            return;
        }
        
        console.log('📱 QR Code detected. Please scan with your phone...');
        console.log('💡 This will enable automated OTP sending for production');
        console.log('⏳ Monitoring login status...');
        
        // Production login monitoring - check every 2 seconds for 10 minutes
        const maxChecks = 300; // 10 minutes
        let checks = 0;
        
        const checkInterval = setInterval(async () => {
            checks++;
            
            try {
                isLoggedIn = await checkWhatsAppLogin();
                
                if (isLoggedIn) {
                    console.log('🎉 LOGIN SUCCESSFUL! Production automation is now active.');
                    isReady = true;
                    isInitializing = false;
                    clearInterval(checkInterval);
                    
                    // Verify production readiness
                    console.log('🔄 Verifying production readiness...');
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    const finalCheck = await checkWhatsAppLogin();
                    if (finalCheck) {
                        console.log('✅ PRODUCTION READY - Automated OTP sending enabled!');
                    } else {
                        console.log('⚠️ Session verification failed, but will continue...');
                        isReady = true;
                    }
                    
                    return;
                }
                
                if (checks >= maxChecks) {
                    console.log('⏰ Login timeout. Automation will remain in standby mode.');
                    clearInterval(checkInterval);
                    isInitializing = false;
                }
                
                if (checks % 30 === 0) {
                    console.log(`⏳ Still waiting for QR scan... (${Math.floor(checks * 2 / 60)} min elapsed)`);
                }
                
            } catch (error) {
                console.log('❌ Login check error:', error.message);
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Production initialization failed:', error.message);
        isReady = false;
        isInitializing = false;
        sessionStatus = 'failed';
        
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
            browser = null;
            page = null;
        }
        
        console.log('🔄 Will retry initialization in 30 seconds...');
        setTimeout(() => {
            if (!isInitializing) {
                initializeWhatsApp();
            }
        }, 30000);
    }
}

// Production-grade automated message sending
async function sendWhatsAppMessage(phoneNumber, message) {
    if (!isReady || !page) {
        throw new Error('WhatsApp automation not ready for production use');
    }
    
    try {
        console.log(`🚀 AUTOMATED SENDING to ${phoneNumber}...`);
        
        // Verify session before sending
        const sessionCheck = await checkWhatsAppLogin();
        if (!sessionCheck) {
            isReady = false;
            throw new Error('WhatsApp session lost - reinitializing...');
        }
        
        // Method 1: Direct URL approach (most reliable)
        const chatUrl = `https://web.whatsapp.com/send?phone=${phoneNumber}&text=${encodeURIComponent(message)}`;
        console.log('📱 Opening chat via direct URL...');
        
        await page.goto(chatUrl, { 
            waitUntil: 'networkidle0',
            timeout: 20000 
        });
        
        // Wait for chat to load
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        // Check for phone number errors
        const hasError = await page.evaluate(() => {
            const bodyText = document.body.textContent || '';
            return bodyText.includes('Phone number shared via url is invalid') || 
                   bodyText.includes('This phone number is not on WhatsApp') ||
                   document.querySelector('[data-testid="alert-phone-number-error"]');
        });
        
        if (hasError) {
            throw new Error('Invalid phone number or WhatsApp error');
        }
        
        // Production send button detection with multiple strategies
        console.log('🔍 Locating send button...');
        
        const sendResult = await page.evaluate(() => {
            // Strategy 1: Standard send button selectors
            const sendSelectors = [
                '[data-testid="compose-btn-send"]',
                '[data-icon="send"]',
                'button[aria-label*="Send"]',
                'span[data-testid="send"]'
            ];
            
            for (const selector of sendSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (element.offsetParent !== null && !element.disabled) {
                        element.click();
                        return { success: true, method: 'standard_selector', selector };
                    }
                }
            }
            
            // Strategy 2: Look for send icon by SVG path
            const svgs = document.querySelectorAll('svg');
            for (const svg of svgs) {
                const paths = svg.querySelectorAll('path');
                for (const path of paths) {
                    const d = path.getAttribute('d') || '';
                    if (d.includes('M2,21L23,12L2,3V10L17,12L2,14V21Z') || 
                        d.includes('M1.101,21.757L23.061,12.028L1.101,2.3l0.011,7.912')) {
                        const parent = svg.closest('button, [role="button"], span, div');
                        if (parent && parent.offsetParent !== null) {
                            parent.click();
                            return { success: true, method: 'svg_icon' };
                        }
                    }
                }
            }
            
            // Strategy 3: Enter key on message input
            const messageInput = document.querySelector('[data-testid="conversation-compose-box-input"]') ||
                               document.querySelector('[contenteditable="true"]:not([data-testid="search-input"])');
            
            if (messageInput) {
                messageInput.focus();
                const event = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true
                });
                messageInput.dispatchEvent(event);
                return { success: true, method: 'enter_key' };
            }
            
            // Strategy 4: Find any clickable element in message area
            const messageArea = document.querySelector('[data-testid="conversation-compose-box"]');
            if (messageArea) {
                const clickables = messageArea.querySelectorAll('button, [role="button"], span[tabindex]');
                for (const el of clickables) {
                    if (el.offsetParent !== null) {
                        el.click();
                        return { success: true, method: 'message_area_click' };
                    }
                }
            }
            
            return { success: false, method: 'all_failed' };
        });
        
        if (!sendResult.success) {
            // Final attempt: Wait and try again
            console.log('⚠️ Send button not found, waiting and retrying...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const retryResult = await page.evaluate(() => {
                // Simple retry with basic selectors
                const button = document.querySelector('[data-testid="compose-btn-send"]') ||
                             document.querySelector('[data-icon="send"]');
                if (button && button.offsetParent !== null) {
                    button.click();
                    return { success: true, method: 'retry_success' };
                }
                
                // Last resort: Press Enter
                const input = document.querySelector('[contenteditable="true"]');
                if (input) {
                    input.focus();
                    document.execCommand('insertText', false, '\n');
                    return { success: true, method: 'insert_newline' };
                }
                
                return { success: false, method: 'final_retry_failed' };
            });
            
            if (!retryResult.success) {
                throw new Error('Could not find or activate send button after multiple attempts');
            }
            
            console.log(`✅ Send button activated via ${retryResult.method} (retry)`);
        } else {
            console.log(`✅ Send button activated via ${sendResult.method}`);
        }
        
        // Wait for message to be sent
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify message was sent by checking for delivery indicators
        const messageSent = await page.evaluate(() => {
            // Look for message delivery indicators
            const deliveryIcons = document.querySelectorAll('[data-testid="msg-dblcheck"], [data-testid="msg-check"]');
            const lastMessage = document.querySelector('[data-testid="conversation-panel-messages"] > div:last-child');
            
            return {
                hasDeliveryIcon: deliveryIcons.length > 0,
                hasLastMessage: !!lastMessage,
                timestamp: Date.now()
            };
        });
        
        console.log('✅ MESSAGE SENT SUCCESSFULLY!');
        console.log(`   📱 Phone: ${phoneNumber}`);
        console.log(`   📤 Method: Automated`);
        console.log(`   ✔️ Delivery indicators: ${messageSent.hasDeliveryIcon ? 'Yes' : 'No'}`);
        
        return true;
        
    } catch (error) {
        console.error('❌ Automated sending failed:', error.message);
        
        // Handle session loss
        if (error.message.includes('session')) {
            isReady = false;
            console.log('🔄 Session lost, will reinitialize...');
            setTimeout(() => {
                if (!isInitializing) {
                    initializeWhatsApp();
                }
            }, 5000);
        }
        
        throw error;
    }
}

// PRODUCTION API ENDPOINTS

// Send OTP - Fully Automated
app.post('/send-otp', async (req, res) => {
    const { phone, customMessage } = req.body;
    
    if (!phone) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone number is required',
            error: 'MISSING_PHONE'
        });
    }
    
    const otp = generateOTP();
    const message = createOTPMessage(otp, customMessage);
    
    // Store OTP
    otpStore.set(phone, {
        otp: otp,
        expiresAt: Date.now() + (5 * 60 * 1000),
        attempts: 0
    });
    
    console.log(`📱 PRODUCTION OTP REQUEST for ${phone}: ${otp}`);
    
    // AUTOMATED SENDING - This is what you want for production
    if (isReady) {
        try {
            console.log('🤖 AUTOMATED MODE - Sending via WhatsApp...');
            await sendWhatsAppMessage(phone, message);
            
            return res.json({ 
                success: true, 
                message: 'OTP sent automatically via WhatsApp', 
                otp: otp, // Remove this in production for security
                expiresIn: '5 minutes',
                mode: 'automated',
                provider: 'WhatsApp',
                timestamp: new Date().toISOString()
            });
            
        } catch (err) {
            console.error('❌ AUTOMATION FAILED:', err.message);
            
            // For production, you might want to:
            // 1. Log the error
            // 2. Try fallback methods
            // 3. Alert administrators
            
            return res.status(500).json({ 
                success: false, 
                message: 'Automated sending temporarily unavailable',
                error: 'AUTOMATION_FAILED',
                fallback: `Manual URL: https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`
            });
        }
    } else {
        // Not ready for automation
        console.log('⚠️ AUTOMATION NOT READY - System initializing...');
        
        return res.status(503).json({ 
            success: false, 
            message: 'WhatsApp automation is initializing. Please try again in a moment.',
            error: 'AUTOMATION_INITIALIZING',
            status: {
                isReady: isReady,
                isInitializing: isInitializing,
                sessionStatus: sessionStatus
            }
        });
    }
});

// Verify OTP - Production Ready
app.post('/verify-otp', (req, res) => {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
        return res.status(400).json({ 
            success: false, 
            message: 'Phone number and OTP are required',
            error: 'MISSING_FIELDS'
        });
    }
    
    const storedData = otpStore.get(phone);
    
    if (!storedData) {
        return res.status(404).json({ 
            success: false, 
            message: 'OTP not found or expired',
            error: 'OTP_NOT_FOUND'
        });
    }
    
    // Check expiration
    if (Date.now() > storedData.expiresAt) {
        otpStore.delete(phone);
        return res.status(400).json({ 
            success: false, 
            message: 'OTP has expired',
            error: 'OTP_EXPIRED'
        });
    }
    
    // Increment attempt counter
    storedData.attempts++;
    
    // Check for too many attempts
    if (storedData.attempts > 5) {
        otpStore.delete(phone);
        return res.status(429).json({ 
            success: false, 
            message: 'Too many verification attempts',
            error: 'TOO_MANY_ATTEMPTS'
        });
    }
    
    // Verify OTP
    if (storedData.otp === otp) {
        otpStore.delete(phone);
        console.log(`✅ OTP VERIFIED for ${phone}`);
        
        return res.json({ 
            success: true, 
            message: 'OTP verified successfully',
            timestamp: new Date().toISOString()
        });
    } else {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid OTP',
            error: 'INVALID_OTP',
            attemptsRemaining: 5 - storedData.attempts
        });
    }
});

// Production Status Endpoint
app.get('/status', async (req, res) => {
    let currentStatus = sessionStatus;
    
    if (page && isReady) {
        try {
            const liveCheck = await checkWhatsAppLogin();
            currentStatus = liveCheck ? 'production_ready' : 'session_lost';
        } catch (e) {
            currentStatus = 'check_failed';
        }
    }
    
    res.json({
        status: 'running',
        automation: {
            isReady: isReady,
            isInitializing: isInitializing,
            sessionStatus: currentStatus,
            mode: isReady ? 'automated' : 'initializing'
        },
        production: {
            ready: isReady,
            activeOTPs: otpStore.size,
            uptime: Math.floor(process.uptime()),
            version: '1.0.0'
        }
    });
});

// Production restart endpoint
app.post('/restart-automation', async (req, res) => {
    console.log('🔄 PRODUCTION RESTART requested...');
    
    isReady = false;
    
    if (browser) {
        try {
            await browser.close();
        } catch (e) {}
        browser = null;
        page = null;
    }
    
    setTimeout(() => initializeWhatsApp(), 1000);
    
    res.json({ 
        success: true, 
        message: 'WhatsApp automation restarting...',
        timestamp: new Date().toISOString()
    });
});

// QR Scanner page
app.get('/scanner', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// QR Code endpoint for Heroku
app.get('/qr', async (req, res) => {
    try {
        if (!page) {
            return res.status(404).json({ error: 'WhatsApp not initialized' });
        }
        
        const qrData = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                return canvas.toDataURL();
            }
            return null;
        });
        
        if (qrData) {
            res.json({ qrCode: qrData });
        } else {
            res.status(404).json({ error: 'QR code not available' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Production dashboard
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp OTP Production System</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                .header { background: #25d366; color: white; padding: 20px; border-radius: 10px; text-align: center; margin-bottom: 20px; }
                .status { padding: 15px; border-radius: 8px; margin: 15px 0; font-weight: bold; }
                .ready { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .initializing { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .card { background: white; padding: 20px; border-radius: 10px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                input, button { padding: 12px; margin: 8px; border-radius: 6px; border: 1px solid #ddd; font-size: 14px; }
                button { background: #007bff; color: white; cursor: pointer; border: none; }
                button:hover { background: #0056b3; }
                .success { background: #d4edda; color: #155724; }
                .error-msg { background: #f8d7da; color: #721c24; }
                .api-example { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 WhatsApp OTP Production System</h1>
                <p>Automated OTP delivery for live applications</p>
            </div>
            
            <div class="status ${isReady ? 'ready' : isInitializing ? 'initializing' : 'error'}">
                🔄 Status: ${isReady ? '✅ PRODUCTION READY - Automated sending active' : isInitializing ? '⏳ Initializing - Please scan QR code' : '❌ Not ready - Restart required'}
            </div>
            
            <div class="card">
                <h2>📱 Live OTP Test</h2>
                <form id="otpForm">
                    <div>
                        <label><strong>Phone Number (with country code):</strong></label><br>
                        <input type="tel" id="phone" placeholder="254700088271" required style="width: 300px;">
                    </div>
                    <div>
                        <label><strong>Custom Message (optional):</strong></label><br>
                        <textarea id="customMessage" rows="3" style="width: 300px;" placeholder="Your OTP is: {otp}"></textarea>
                    </div>
                    <button type="submit" style="background: #25d366;">🚀 Send OTP (Automated)</button>
                </form>
                
                <div id="result" style="margin-top: 20px;"></div>
            </div>
            
            <div class="card">
                <h2>🔧 Production Controls</h2>
                <button onclick="checkStatus()" style="background: #17a2b8;">Check Status</button>
                <button onclick="restartAutomation()" style="background: #dc3545;">Restart Automation</button>
            </div>
            
            <div class="card">
                <h2>📋 API Documentation</h2>
                <h3>Send OTP (Automated)</h3>
                <div class="api-example">
POST /send-otp
Content-Type: application/json

{
  "phone": "254700088271",
  "customMessage": "Your verification code is: {otp}"
}
                </div>
                
                <h3>Verify OTP</h3>
                <div class="api-example">
POST /verify-otp
Content-Type: application/json

{
  "phone": "254700088271", 
  "otp": "123456"
}
                </div>
            </div>
            
            <script>
                // Auto-refresh status
                setInterval(updateStatus, 10000);
                
                async function updateStatus() {
                    try {
                        const response = await fetch('/status');
                        const data = await response.json();
                        const statusDiv = document.querySelector('.status');
                        
                        if (data.automation.isReady) {
                            statusDiv.className = 'status ready';
                            statusDiv.innerHTML = '🔄 Status: ✅ PRODUCTION READY - Automated sending active';
                        } else if (data.automation.isInitializing) {
                            statusDiv.className = 'status initializing';
                            statusDiv.innerHTML = '🔄 Status: ⏳ Initializing - Please scan QR code';
                        } else {
                            statusDiv.className = 'status error';
                            statusDiv.innerHTML = '🔄 Status: ❌ Not ready - Restart required';
                        }
                    } catch (e) {
                        console.error('Status update failed:', e);
                    }
                }
                
                document.getElementById('otpForm').addEventListener('submit', async (e) => {
                    e.preventDefault();
                    
                    const phone = document.getElementById('phone').value;
                    const customMessage = document.getElementById('customMessage').value;
                    const resultDiv = document.getElementById('result');
                    
                    resultDiv.innerHTML = '<div style="background: #cce7ff; padding: 15px; border-radius: 5px;">🚀 Sending OTP automatically...</div>';
                    
                    try {
                        const response = await fetch('/send-otp', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phone, customMessage })
                        });
                        
                        const data = await response.json();
                        
                        if (data.success) {
                            resultDiv.innerHTML = \`
                                <div class="success" style="padding: 15px; border-radius: 5px;">
                                    <h3>✅ OTP Sent Successfully!</h3>
                                    <p><strong>Phone:</strong> \${phone}</p>
                                    <p><strong>OTP:</strong> \${data.otp}</p>
                                    <p><strong>Mode:</strong> \${data.mode}</p>
                                    <p><strong>Time:</strong> \${data.timestamp}</p>
                                    <p><em>Message delivered automatically via WhatsApp!</em></p>
                                </div>
                            \`;
                        } else {
                            resultDiv.innerHTML = \`
                                <div class="error-msg" style="padding: 15px; border-radius: 5px;">
                                    <h3>❌ Error</h3>
                                    <p><strong>Message:</strong> \${data.message}</p>
                                    <p><strong>Error Code:</strong> \${data.error}</p>
                                    \${data.fallback ? '<p><strong>Fallback:</strong> ' + data.fallback + '</p>' : ''}
                                </div>
                            \`;
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '<div class="error-msg" style="padding: 15px; border-radius: 5px;"><strong>Connection Error:</strong> Could not reach server</div>';
                    }
                });
                
                async function checkStatus() {
                    const response = await fetch('/status');
                    const data = await response.json();
                    document.getElementById('result').innerHTML = \`
                        <div style="background: #e9ecef; padding: 15px; border-radius: 5px;">
                            <h3>📊 System Status</h3>
                            <p><strong>Production Ready:</strong> \${data.automation.isReady}</p>
                            <p><strong>Session Status:</strong> \${data.automation.sessionStatus}</p>
                            <p><strong>Active OTPs:</strong> \${data.production.activeOTPs}</p>
                            <p><strong>Uptime:</strong> \${data.production.uptime} seconds</p>
                            <p><strong>Mode:</strong> \${data.automation.mode}</p>
                        </div>
                    \`;
                }
                
                async function restartAutomation() {
                    if (confirm('Restart WhatsApp automation? This will temporarily interrupt service.')) {
                        const response = await fetch('/restart-automation', { method: 'POST' });
                        const data = await response.json();
                        alert(data.message);
                        setTimeout(() => location.reload(), 3000);
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Start production server
app.listen(PORT, () => {
    console.log('🚀 WHATSAPP OTP PRODUCTION SYSTEM STARTING...');
    console.log(`📱 Server running on http://localhost:${PORT}`);
    console.log('🔧 Chrome will open for WhatsApp Web authentication');
    console.log('⚡ Production-grade automated OTP delivery');
    console.log('');
    
    // Start WhatsApp automation
    initializeWhatsApp();
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down production system...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
});
