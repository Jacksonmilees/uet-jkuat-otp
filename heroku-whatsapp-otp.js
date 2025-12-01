const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(express.static('public'));

let browser = null;
let page = null;
let isReady = false;
let isInitializing = false;
let sessionStatus = 'disconnected';
let qrCodeData = null;
let sessionData = null;

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

// Check if we have saved session data
function hasSavedSession() {
    try {
        return fs.existsSync('./session-data.json');
    } catch (error) {
        return false;
    }
}

// Save session data
function saveSessionData(data) {
    try {
        fs.writeFileSync('./session-data.json', JSON.stringify(data, null, 2));
        console.log('✅ Session data saved');
    } catch (error) {
        console.log('❌ Failed to save session data:', error.message);
    }
}

// Load session data
function loadSessionData() {
    try {
        if (hasSavedSession()) {
            const data = JSON.parse(fs.readFileSync('./session-data.json', 'utf8'));
            console.log('✅ Session data loaded');
            return data;
        }
    } catch (error) {
        console.log('❌ Failed to load session data:', error.message);
    }
    return null;
}

// Ultra-reliable login detection for production
async function checkWhatsAppLogin() {
    if (!page) {
        sessionStatus = 'no_page';
        return false;
    }
    
    try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const loginCheck = await page.evaluate(() => {
            const indicators = {
                chatList: !!document.querySelector('[data-testid="chat-list"]'),
                sidebar: !!document.querySelector('[data-testid="side"]'),
                searchInput: !!document.querySelector('[data-testid="search-input"]'),
                newChatBtn: !!document.querySelector('[data-testid="new-chat-btn"]'),
                menuBtn: !!document.querySelector('[data-testid="menu"]'),
                qrCode: !!document.querySelector('[data-testid="qrcode"]'),
                qrCanvas: !!document.querySelector('canvas'),
                hasLoginText: document.body.textContent.includes('To use WhatsApp on your computer'),
                hasChatText: document.body.textContent.includes('Search or start new chat'),
                isMainPage: window.location.href === 'https://web.whatsapp.com/',
                interactiveCount: document.querySelectorAll('button, [role="button"], input, [contenteditable]').length
            };
            
            if (indicators.qrCode || (indicators.qrCanvas && indicators.hasLoginText)) {
                return { loggedIn: false, reason: 'qr_code_detected', indicators };
            }
            
            const strongIndicators = [
                indicators.chatList,
                indicators.sidebar, 
                indicators.newChatBtn,
                indicators.menuBtn,
                indicators.searchInput
            ].filter(Boolean).length;
            
            if (strongIndicators >= 2) {
                return { loggedIn: true, reason: 'strong_indicators', count: strongIndicators, indicators };
            }
            
            if (indicators.hasChatText && indicators.isMainPage && !indicators.hasLoginText) {
                return { loggedIn: true, reason: 'chat_interface_text', indicators };
            }
            
            if (indicators.interactiveCount > 10 && !indicators.qrCode) {
                return { loggedIn: true, reason: 'interactive_elements', count: indicators.interactiveCount, indicators };
            }
            
            return { loggedIn: false, reason: 'insufficient_evidence', indicators };
        });
        
        sessionStatus = loginCheck.loggedIn ? 'logged_in' : 'not_logged_in';
        
        if (loginCheck.loggedIn) {
            console.log(`✅ LOGGED IN (${loginCheck.reason})`);
            // Save session data when successfully logged in
            saveSessionData({
                timestamp: Date.now(),
                status: 'logged_in',
                reason: loginCheck.reason
            });
        } else {
            console.log(`❌ NOT LOGGED IN (${loginCheck.reason})`);
        }
        
        return loginCheck.loggedIn;
        
    } catch (error) {
        sessionStatus = 'error';
        console.log('❌ Error checking login:', error.message);
        return false;
    }
}

// Get QR code data
async function getQRCodeData() {
    if (!page) return null;
    
    try {
        const qrData = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                return canvas.toDataURL();
            }
            return null;
        });
        
        if (qrData) {
            qrCodeData = qrData;
            console.log('📱 QR Code captured');
        }
        
        return qrData;
    } catch (error) {
        console.log('❌ Error getting QR code:', error.message);
        return null;
    }
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
        console.log('🚀 Starting WhatsApp Web for Heroku...');
        
        // Heroku-specific Chrome options
        const launchOptions = {
            headless: true, // Must be headless on Heroku
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
                '--no-zygote'
            ],
            executablePath: process.env.GOOGLE_CHROME_BIN || null
        };
        
        console.log('🔧 Launching Chrome...');
        browser = await puppeteer.launch(launchOptions);
        page = await browser.newPage();
        
        // Set user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        console.log('🌐 Navigating to WhatsApp Web...');
        await page.goto('https://web.whatsapp.com/', { 
            waitUntil: 'networkidle2',
            timeout: 30000 
        });
        
        console.log('⏳ Waiting for WhatsApp to load...');
        await page.waitForTimeout(5000);
        
        // Check if already logged in
        const isLoggedIn = await checkWhatsAppLogin();
        
        if (isLoggedIn) {
            console.log('✅ Already logged in!');
            isReady = true;
            isInitializing = false;
            return;
        }
        
        console.log('📱 Waiting for QR code...');
        
        // Wait for QR code and capture it
        await page.waitForSelector('canvas', { timeout: 10000 });
        await page.waitForTimeout(2000);
        
        const qrData = await getQRCodeData();
        if (qrData) {
            console.log('📱 QR Code ready for scanning');
            console.log('🔗 Access your app URL to scan the QR code');
        }
        
        // Wait for login
        console.log('⏳ Waiting for QR code scan...');
        
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        while (attempts < maxAttempts) {
            await page.waitForTimeout(5000);
            attempts++;
            
            const loggedIn = await checkWhatsAppLogin();
            if (loggedIn) {
                console.log('✅ Successfully logged in!');
                isReady = true;
                isInitializing = false;
                return;
            }
            
            // Update QR code every 30 seconds
            if (attempts % 6 === 0) {
                await getQRCodeData();
            }
            
            console.log(`⏳ Waiting... (${attempts}/${maxAttempts})`);
        }
        
        console.log('❌ Timeout waiting for login');
        isInitializing = false;
        
    } catch (error) {
        console.log('❌ Error initializing WhatsApp:', error.message);
        isInitializing = false;
    }
}

// Send WhatsApp message
async function sendWhatsAppMessage(phoneNumber, message) {
    if (!isReady || !page) {
        throw new Error('WhatsApp not ready');
    }
    
    try {
        // Format phone number
        const formattedNumber = phoneNumber.replace(/\D/g, '');
        const chatUrl = `https://web.whatsapp.com/send?phone=${formattedNumber}&text=${encodeURIComponent(message)}`;
        
        console.log(`📤 Sending message to ${phoneNumber}...`);
        
        await page.goto(chatUrl, { waitUntil: 'networkidle2' });
        await page.waitForTimeout(3000);
        
        // Wait for send button and click it
        await page.waitForSelector('[data-testid="send"]', { timeout: 10000 });
        await page.click('[data-testid="send"]');
        
        await page.waitForTimeout(2000);
        
        console.log('✅ Message sent successfully');
        return true;
        
    } catch (error) {
        console.log('❌ Error sending message:', error.message);
        throw error;
    }
}

// API Routes
app.get('/', (req, res) => {
    res.json({
        status: 'WhatsApp OTP System',
        session: sessionStatus,
        ready: isReady,
        qrCode: qrCodeData ? 'Available' : 'Not available'
    });
});

app.get('/status', (req, res) => {
    res.json({
        status: sessionStatus,
        ready: isReady,
        initializing: isInitializing,
        qrCode: qrCodeData ? 'Available' : 'Not available'
    });
});

app.get('/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qrCode: qrCodeData });
    } else {
        res.status(404).json({ error: 'QR code not available' });
    }
});

app.post('/send-otp', async (req, res) => {
    try {
        const { phoneNumber, customMessage } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }
        
        if (!isReady) {
            return res.status(503).json({ 
                error: 'WhatsApp not ready', 
                status: sessionStatus,
                qrCode: qrCodeData ? 'Available at /qr endpoint' : 'Not available'
            });
        }
        
        const otp = generateOTP();
        const message = createOTPMessage(otp, customMessage);
        
        await sendWhatsAppMessage(phoneNumber, message);
        
        // Store OTP with 5-minute expiration
        otpStore.set(phoneNumber, {
            otp,
            expiresAt: Date.now() + (5 * 60 * 1000)
        });
        
        res.json({ 
            success: true, 
            message: 'OTP sent successfully',
            phoneNumber,
            expiresIn: '5 minutes'
        });
        
    } catch (error) {
        console.log('❌ Error in /send-otp:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/verify-otp', (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        
        if (!phoneNumber || !otp) {
            return res.status(400).json({ error: 'Phone number and OTP are required' });
        }
        
        const storedData = otpStore.get(phoneNumber);
        
        if (!storedData) {
            return res.status(404).json({ error: 'OTP not found or expired' });
        }
        
        if (Date.now() > storedData.expiresAt) {
            otpStore.delete(phoneNumber);
            return res.status(400).json({ error: 'OTP has expired' });
        }
        
        if (storedData.otp === otp) {
            otpStore.delete(phoneNumber);
            res.json({ success: true, message: 'OTP verified successfully' });
        } else {
            res.status(400).json({ error: 'Invalid OTP' });
        }
        
    } catch (error) {
        console.log('❌ Error in /verify-otp:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/init', async (req, res) => {
    try {
        if (isInitializing) {
            return res.json({ message: 'Already initializing...' });
        }
        
        if (isReady) {
            return res.json({ message: 'Already ready!' });
        }
        
        // Start initialization in background
        initializeWhatsApp();
        
        res.json({ message: 'Initialization started' });
        
    } catch (error) {
        console.log('❌ Error in /init:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp OTP Server running on port ${PORT}`);
    console.log(`📱 Access QR code at: http://localhost:${PORT}/qr`);
    console.log(`📊 Status at: http://localhost:${PORT}/status`);
    
    // Auto-initialize on startup
    setTimeout(() => {
        initializeWhatsApp();
    }, 2000);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('🛑 Shutting down...');
    if (browser) {
        await browser.close();
    }
    process.exit(0);
}); 