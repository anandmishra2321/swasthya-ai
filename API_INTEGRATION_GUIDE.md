# API_INTEGRATION_GUIDE.md

| Feature | Provider | Official URL | Env var(s) | Configured? | Verified? | Blocker |
|---|---|---|---|---|---|---|
| Database | MongoDB | https://www.mongodb.com/ | MONGODB_URI | Yes (local) | Yes | Production needs managed cluster |
| Rate limiting (optional) | Redis | https://redis.io/ | REDIS_URL | Optional | Yes (fallback) | None |
| Email | SMTP/SendGrid | https://resend.com/docs | EMAIL_PROVIDER, SMTP_* | Mock | No | Credentials |
| SMS | Twilio/MSG91 | https://www.twilio.com/docs | SMS_PROVIDER | none | No | Credentials |
| AI | OpenAI/Gemini | https://platform.openai.com/ | AI_PROVIDER, AI_API_KEY | mock | No | API key |
| Maps | OpenStreetMap/Nominatim | https://www.openstreetmap.org/ | (none) | Yes | Yes | Terms/attribution |
| Payments | Razorpay | https://razorpay.com/docs/ | RAZORPAY_KEY_ID/SECRET | No | Demo only | Keys |
| Wearables (Web Bluetooth) | Web Bluetooth | https://developer.mozilla.org/docs/Web/API/Web_Bluetooth_API | (none) | Yes | Blocked (no device) | Hardware |
| Wearables (vendor OAuth) | Fitbit/Garmin | https://dev.fitbit.com/ | FITBIT_CLIENT_ID/SECRET | No | No | Approval |
| Ambulance dispatch | EMRI/108 | (provider-specific) | (none) | No | No | Integration |
