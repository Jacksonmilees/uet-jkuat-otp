#  UET JKUAT WhatsApp OTP Service

A production-ready automated WhatsApp OTP (One-Time Password) system for UET JKUAT Ministry Funding Platform.

##  Features

-  **100% Automated OTP Sending** - No manual intervention required
-  **WhatsApp Integration** - Sends OTPs directly via WhatsApp Web
- **Secure OTP Generation** - 6-digit codes with expiration
-  **Instant Delivery** - Real-time message sending
-  **Production Ready** - Error handling, rate limiting, session persistence
- **Auto-Reconnection** - Maintains WhatsApp session automatically
-  **Status Monitoring** - Live system status and health checks

##  Quick Start

### Prerequisites
- Node.js (v14 or higher)
- Google Chrome installed
- WhatsApp account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd whatsapp-otp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the production system**
   ```bash
   npm start
   ```

4. **Scan QR Code**
   - Chrome will open with WhatsApp Web
   - Scan the QR code with your phone's WhatsApp
   - Wait for " PRODUCTION READY" status

##  API Usage

### Send OTP (Automated)
```bash
POST http://localhost:5000/send-otp
Content-Type: application/json

{
  "phone": "254700088271",
  "customMessage": "Your verification code is: {otp}" // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent automatically via WhatsApp",
  "otp": "123456",
  "expiresIn": "5 minutes",
  "mode": "automated",
  "provider": "WhatsApp",
  "timestamp": "2025-01-06T00:25:37.551Z"
}
```

### Verify OTP
```bash
POST http://localhost:5000/verify-otp
Content-Type: application/json

{
  "phone": "254700088271",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "timestamp": "2025-01-06T00:26:01.406Z"
}
```

### Check System Status
```bash
GET http://localhost:5000/status
```

##  Production Dashboard

Visit `http://localhost:5000` for the web dashboard with:
- Live system status
- OTP testing interface
- Production controls
- API documentation

##  Security Features

- **OTP Expiration**: Codes expire after 5 minutes
- **Rate Limiting**: Max 5 verification attempts per OTP
- **Session Persistence**: WhatsApp session maintained securely
- **Error Handling**: Comprehensive error management
- **Input Validation**: Phone number and OTP validation

##  Production Monitoring

### Health Check Endpoint
```bash
GET http://localhost:5000/status
```

### Restart Automation
```bash
POST http://localhost:5000/restart-automation
```

##  Deployment

### Production Deployment
1. Set up server with Node.js
2. Install dependencies: `npm install`
3. Configure environment variables
4. Start with process manager: `pm2 start npm -- start`
5. Set up reverse proxy (nginx/apache)

##  API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/send-otp` | POST | Send automated OTP |
| `/verify-otp` | POST | Verify OTP code |
| `/status` | GET | Get system status |
| `/restart-automation` | POST | Restart WhatsApp automation |
| `/` | GET | Production dashboard |

##  License

MIT License - feel free to use in your projects.

---

**Production System Status: ✅ FULLY OPERATIONAL**

*Built for UET JKUAT Ministry - Reliable, automated WhatsApp OTP delivery for student authentication.*
