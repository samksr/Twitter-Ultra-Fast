const Logger = require('../utils/logger');
const SmartCache = require('../utils/cache');

class Metrics {
  constructor() {
    this.logger = Logger.getInstance();
    this.cache = SmartCache.getInstance();
    this.startTime = Date.now();
    this.retries = { total: 0, success: 0, failed: 0 };
  }

  static instance = null;

  static getInstance() {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  health(usersToMonitor, lastCheck) {
    return (req, res) => {
      const stats = this.cache.getStats();
      const uptime = Date.now() - this.startTime;
      const hrs = Math.floor(uptime / 3600000);
      const mins = Math.floor((uptime % 3600000) / 60000);
      const failureRate = stats.misses > 0
        ? (stats.misses / (stats.hits + stats.misses) * 100).toFixed(1)
        : 0;

      res.json({
        status: 'ok',
        version: '12.0.0-MODULAR',
        mode: 'Production Modular',
        users: usersToMonitor.length,
        cache: {
          hits: stats.hits,
          misses: stats.misses,
          size: stats.size,
          hitRate: stats.hits + stats.misses > 0
            ? (stats.hits / (stats.hits + stats.misses) * 100).toFixed(1) + '%'
            : 'N/A'
        },
        uptime: `${hrs}h ${mins}m`,
        lastCheck: lastCheck ? new Date(lastCheck).toISOString() : 'N/A',
        failureRate: `${failureRate}%`,
        retries: this.retries
      });
    };
  }

  prometheus(usersToMonitor, sentTweetsCount) {
    return (req, res) => {
      const stats = this.cache.getStats();
      const uptime = Date.now() - this.startTime;

      const prometheusMetrics = `# HELP tweets_total Total tweets fetched
# TYPE tweets_total counter
tweets_total ${sentTweetsCount}

# HELP cache_hits_total Cache hit count
# TYPE cache_hits_total counter
cache_hits_total ${stats.hits}

# HELP cache_misses_total Cache miss count
# TYPE cache_misses_total counter
cache_misses_total ${stats.misses}

# HELP cache_size Current cache size
# TYPE cache_size gauge
cache_size ${stats.size}

# HELP uptime_ms Uptime in milliseconds
# TYPE uptime_ms gauge
uptime_ms ${uptime}

# HELP users_monitored Number of monitored users
# TYPE users_monitored gauge
users_monitored ${usersToMonitor.length}

# HELP retry_attempts_total Total retry attempts
# TYPE retry_attempts_total counter
retry_attempts_total ${this.retries.total}
`;
      res.set('Content-Type', 'text/plain');
      res.send(prometheusMetrics);
    };
  }
}

module.exports = Metrics;
