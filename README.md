# 🐦 Twitter → Telegram Monitor v12.0-MODULAR

Production-grade Twitter monitoring bot that forwards tweets to Telegram with modular architecture, structured logging, and comprehensive security.

## ✨ Features

- **🚀 Fast**: 5-8s for 3 users (parallel batching)
- **🔄 Reliable**: Auto-retry with exponential backoff
- **🔐 Secure**: Joi validation + sanitize-html + rate limiting
- **📊 Observable**: Pino structured logs + Prometheus metrics
- **🏗️ Modular**: Separated concerns, easy to extend
- **⚡ Scalable**: Add features without touching core code
- **24/7**: Deploy to Zeabur/Railway and forget

## 🎯 Monitored Users

- `@samksr10`
- `@Moolah_nad`
- `@earnbybase`

(Edit `USERS_TO_MONITOR` env var to change)

## 🏗️ Architecture

```
index.js (slim entrypoint)
├── utils/
│   ├── logger.js          # Pino structured logging
│   ├── cache.js           # SmartCache with TTL
│   ├── fetcher.js         # Sotwe + Nitter with retries
│   ├── storage.js         # Persistent storage with Joi validation
│   ├── telegram.js        # Telegram bot with HTML sanitization
│   └── monitor.js         # Check loop
└── health/
    └── metrics.js         # Health + Prometheus endpoints
```

## 📦 Tech Stack

- **Runtime**: Node.js 20+
- **Bot**: node-telegram-bot-api
- **Fetching**: axios + RSS parser
- **Caching**: node-cache
- **Logging**: Pino + Pino Pretty
- **Validation**: Joi
- **Security**: Helmet + sanitize-html + express-rate-limit
- **Monitoring**: Prometheus metrics

## 🚀 Quick Start

### Local Development

1. **Clone & Setup**
```bash
git clone <your-repo>
cd twitter-telegram-bot
npm install
```

2. **Configure**
```bash
cp .env.example .env
# Edit .env with your values:
# - TELEGRAM_BOT_TOKEN
# - TELEGRAM_CHAT_ID
# - USERS_TO_MONITOR (comma-separated)
```

3. **Run**
```bash
npm run dev    # Development with auto-reload
npm start      # Production
```

4. **Verify**
```bash
curl http://localhost:8080/health
curl http://localhost:8080/metrics
```

## 🌐 Deploy to Zeabur (24/7 Free)

### Option A: GitHub Auto-Deploy

1. Push code to GitHub
2. Go to https://zeabur.com
3. Connect your GitHub repo
4. Add environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `USERS_TO_MONITOR`
5. Click Deploy ✅

### Option B: Railway (Alternative)

1. Push to GitHub
2. Connect to Railway
3. Set env variables
4. Deploy ✅

## 📊 Monitoring

### Health Endpoint
```bash
GET /health
```
Returns:
- Cache stats (hits/misses)
- Uptime
- Users monitored
- Failure rate
- Last check time

### Prometheus Metrics
```bash
GET /metrics
```
Export to monitoring systems:
- `tweets_total` - Total tweets fetched
- `cache_hits_total` - Cache hit count
- `cache_size` - Current cache size
- `uptime_ms` - Uptime in milliseconds
- `users_monitored` - Number of monitored users

### Structured Logs
All logs go through Pino with timestamps and levels:
```
[INFO] ✅ Initialized @samksr10 (45 tweets cached)
[INFO] 🔔 Sent tweet from @samksr10
[DEBUG] Sotwe failed for @samksr10
```

## 🔧 Configuration

All settings via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | **Required** | Your Telegram bot token |
| `TELEGRAM_CHAT_ID` | **Required** | Target chat ID |
| `USERS_TO_MONITOR` | - | Comma-separated usernames |
| `PORT` | 8080 | Health server port |
| `LOG_LEVEL` | info | Pino log level |
| `CACHE_TTL` | 30000 | Cache TTL in ms |
| `CACHE_FILE` | `./data/tweet_cache.json` | Tweet cache location |
| `USERS_FILE` | `./data/monitored_users.json` | Users list location |
| `STATE_FILE` | `./data/user_state.json` | Bootstrap state location |

## 📝 Data Files

All data is persistent:

- `data/tweet_cache.json` - Last 5000 tweet IDs (prevents duplicates)
- `data/monitored_users.json` - List of users to monitor
- `data/user_state.json` - Bootstrap flags per user

(Gitignored for privacy)

## 🔄 How It Works

1. **Startup**
   - Load configuration + data files
   - Initialize Pino logger
   - Start cache + fetcher
   - Connect Telegram bot

2. **Main Loop (45-60s interval)**
   - Fetch tweets from all users in parallel
   - Try Sotwe API first (fastest)
   - Fall back to Nitter if needed (12 instances)
   - Auto-retry with exponential backoff
   - Send unseen tweets to Telegram
   - Save state

3. **Data Persistence**
   - Atomic writes to prevent corruption
   - Auto-save on shutdown
   - Graceful error handling

## 🔐 Security

- ✅ Input validation (Joi schema)
- ✅ HTML sanitization (sanitize-html)
- ✅ Rate limiting (express-rate-limit)
- ✅ OWASP headers (Helmet)
- ✅ Environment variable management
- ✅ Graceful error handling

## 📈 Performance

- **3 users**: 5-8 seconds (parallel)
- **10 users**: 15-25 seconds (batches)
- **30 users**: 40-60 seconds (multiple batches)

**Cache efficiency**: 60-70% hit rate typical

## 🐛 Troubleshooting

### Bot not starting?
Check Zeabur/Railway logs:
```bash
curl https://your-app.zeabur.app/health
```

### No tweets coming through?
1. Check `/health` endpoint
2. Verify `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`
3. Check Pino logs for errors

### High failure rate?
- Nitter instances may be down
- Wait for auto-retry
- Check `/metrics` endpoint

## 📚 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | System health status |
| `/metrics` | GET | Prometheus metrics |

## 🤝 Contributing

This is a personal bot, but feel free to fork and customize:

1. Add new data sources
2. Modify tweet formatting
3. Add webhooks/notifications
4. Extend monitoring

## 📄 License

MIT - Use freely

---

**Deployed on**: Zeabur / Railway  
**Version**: 12.0.0-MODULAR  
**Status**: Production Ready ✅
