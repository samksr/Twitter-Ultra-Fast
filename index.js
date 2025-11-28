require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const Logger = require('./utils/logger');
const SmartCache = require('./utils/cache');
const Fetcher = require('./utils/fetcher');
const Storage = require('./utils/storage');
const TelegramClient = require('./utils/telegram');
const Monitor = require('./utils/monitor');
const Metrics = require('./health/metrics');

const logger = Logger.getInstance();
const app = express();
const PORT = process.env.PORT || 8080;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});

async function main() {
  try {
    const { valid, error } = await Storage.validateConfig();
    if (!valid) {
      logger.fatal(`Configuration validation failed: ${error}`);
      process.exit(1);
    }

    logger.info('🚀 Initializing components...');
    SmartCache.init();
    Fetcher.init();
    await Storage.init();

    const config = {
      TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
      TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID
    };
    
    const monitor = new Monitor();
    await TelegramClient.init(config, monitor);

    const usersToMonitor = await Storage.loadUsers();
    const sentTweetsCount = (await Storage.loadSentIds()).size;

    logger.info(`✅ All components initialized`);
    logger.info(`📊 Monitoring ${usersToMonitor.length} users`);
    logger.info(`📝 Tweet history: ${sentTweetsCount} tweets tracked`);

    const metrics = Metrics.getInstance();

    app.get('/health', limiter, metrics.health(usersToMonitor, monitor.getLastCheckTime()));
    app.get('/metrics', limiter, metrics.prometheus(usersToMonitor, sentTweetsCount));

    monitor.startMonitoringLoop(usersToMonitor);

    async function gracefulShutdown() {
      logger.info('🛑 Shutting down gracefully...');
      try {
        await Promise.all([
          SmartCache.getInstance().shutdown(),
          TelegramClient.getInstance().shutdown(),
          Storage.shutdown()
        ]);
        logger.info('✅ Shutdown complete');
        process.exit(0);
      } catch (e) {
        logger.error('Shutdown error:', e);
        process.exit(1);
      }
    }

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🏥 Health server running on http://0.0.0.0:${PORT}`);
      logger.info(`📊 Health endpoint: http://0.0.0.0:${PORT}/health`);
      logger.info(`📈 Metrics endpoint: http://0.0.0.0:${PORT}/metrics`);
    });

  } catch (err) {
    logger.fatal('Failed to start application:', err);
    process.exit(1);
  }
}

main();
