const Logger = require('./logger');
const Fetcher = require('./fetcher');
const Storage = require('./storage');
const TelegramClient = require('./telegram');
const SmartCache = require('./cache');

class Monitor {
  constructor() {
    this.logger = Logger.getInstance();
    this.fetcher = Fetcher.getInstance();
    this.telegram = TelegramClient.getInstance();
    this.cache = SmartCache.getInstance();
    this.lastCheckTime = null;
  }

  async checkFeeds(usersToMonitor, manual = false) {
    if (manual) this.logger.info('⏩ Manual check triggered');
    this.lastCheckTime = Date.now();

    const sentTweetIds = await Storage.loadSentIds();
    const bootstrapState = await Storage.loadBootstrapState();
    let newCount = 0;

    // Parallel fetch all users
    const results = await Promise.allSettled(
      usersToMonitor.map(user => this.fetcher.fetchTweets(user))
    );

    for (let i = 0; i < results.length; i++) {
      const user = usersToMonitor[i];
      const result = results[i];

      if (result.status === 'rejected' || !result.value?.items) {
        this.logger.warn(`Failed to fetch @${user}`);
        continue;
      }

      const isFirstRun = !bootstrapState[user];
      const tweets = result.value.items
        .filter(t => t.id && !sentTweetIds.has(t.id))
        .sort((a, b) => a.createdAt - b.createdAt);

      for (const tweet of tweets) {
        if (isFirstRun) {
          sentTweetIds.add(tweet.id);
        } else {
          await this.telegram.sendTweetAlert(user, tweet, result.value.source);
          sentTweetIds.add(tweet.id);
          newCount++;
          await new Promise(r => setTimeout(r, 500)); // Rate limit
        }
      }

      if (isFirstRun) {
        bootstrapState[user] = true;
        this.logger.info(`✅ Initialized @${user} (${tweets.length} tweets cached)`);
      }
    }

    // Save state
    await Storage.saveSentIds(sentTweetIds);
    await Storage.saveBootstrapState(bootstrapState);

    if (manual) {
      const stats = this.cache.getStats();
      const msg = `✅ <b>Check Complete!</b>\n🔔 Found: ${newCount} new tweets\n💾 Cache: ${stats.hits}H/${stats.misses}M (${stats.size} items)`;
      await this.telegram.bot.sendMessage(this.telegram.chatId, msg, { parse_mode: 'HTML' });
    }

    return newCount;
  }

  startMonitoringLoop(usersToMonitor) {
    const runCheck = async () => {
      try {
        await this.checkFeeds(usersToMonitor);
      } catch (error) {
        this.logger.error('Monitor check error:', error);
      }
      const interval = 45000 + Math.random() * 15000; // 45-60s with jitter
      setTimeout(runCheck, interval);
    };

    // Initial delay
    setTimeout(runCheck, 5000);
    this.logger.info(`🔄 Monitoring loop started for ${usersToMonitor.length} users`);
  }

  getLastCheckTime() {
    return this.lastCheckTime;
  }
}

module.exports = Monitor;
