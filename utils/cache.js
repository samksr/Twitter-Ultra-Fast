const NodeCache = require('node-cache');
const Logger = require('./logger');

class SmartCache {
  constructor(ttl = 30) {
    this.cache = new NodeCache({ stdTTL: ttl, checkperiod: 60 });
    this.stats = { hits: 0, misses: 0, size: 0 };
    this.logger = Logger.getInstance();
  }

  static instance = null;

  static init() {
    if (!SmartCache.instance) {
      SmartCache.instance = new SmartCache(parseInt(process.env.CACHE_TTL || '30'));
    }
    return SmartCache.instance;
  }

  static getInstance() {
    return SmartCache.instance || SmartCache.init();
  }

  get(key) {
    const data = this.cache.get(key);
    if (data) {
      this.stats.hits++;
      return data;
    }
    this.stats.misses++;
    return null;
  }

  set(key, data) {
    this.cache.set(key, data);
    this.stats.size = this.cache.keys().length;
  }

  getStats() {
    return { ...this.stats };
  }

  async shutdown() {
    this.cache.close();
    this.logger.info('Cache shutdown complete');
  }
}

module.exports = SmartCache;
