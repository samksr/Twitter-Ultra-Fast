const axios = require('axios');
const Parser = require('rss-parser');
const Logger = require('./logger');
const SmartCache = require('./cache');

const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.woodland.cafe',
  'https://nitter.poast.org',
  'https://xcancel.com',
  'https://nitter.soopy.moe',
  'https://nitter.lucabased.xyz',
  'https://nitter.freereddit.com',
  'https://nitter.moomoo.me',
  'https://nitter.perennialteks.com',
  'https://nitter.no-logs.com',
  'https://nitter.projectsegfau.lt',
  'https://nitter.eu'
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
];

class Fetcher {
  constructor() {
    this.axios = axios.create({
      timeout: 8000,
      headers: { 'User-Agent': this.getRandomAgent() }
    });
    this.parser = new Parser({ timeout: 8000 });
    this.logger = Logger.getInstance();
    this.cache = SmartCache.getInstance();
  }

  static instance = null;

  static init() {
    Fetcher.instance = new Fetcher();
    return Fetcher.instance;
  }

  static getInstance() {
    return Fetcher.instance || Fetcher.init();
  }

  getRandomAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async fetchWithRetry(url, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const res = await this.axios.get(url, {
          headers: { 'User-Agent': this.getRandomAgent() }
        });
        return res.data;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  async fetchSotwe(username) {
    const cacheKey = `sotwe_${username}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    try {
      const data = await this.fetchWithRetry(`https://api.sotwe.com/v3/user/${username}`);
      if (data?.data?.length) {
        const items = data.data
          .filter(t => !t.in_reply_to_status_id_str)
          .map(t => ({
            id: t.id_str,
            text: t.full_text || t.text,
            createdAt: new Date(t.created_at).getTime(),
            media: t.entities?.media?.map(m => m.media_url_https) || [],
            source: 'Sotwe⚡'
          }));
        const result = { source: 'Sotwe⚡', items };
        this.cache.set(cacheKey, result);
        return result;
      }
    } catch (e) {
      this.logger.debug(`Sotwe failed for @${username}`);
    }
    return null;
  }

  async fetchNitter(username) {
    const shuffled = [...NITTER_INSTANCES]
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    for (const instance of shuffled) {
      try {
        const feed = await this.parser.parseURL(`${instance}/${username}/rss?t=${Date.now()}`, {
          headers: { 'User-Agent': this.getRandomAgent() }
        });
        if (feed.items?.length) {
          const items = feed.items
            .map(t => {
              const match = t.link.match(/\/status\/(\d+)/);
              return {
                id: match?.[1],
                text: t.contentSnippet || t.title || '',
                createdAt: new Date(t.pubDate).getTime(),
                media: [],
                source: `Nitter (${new URL(instance).hostname})`
              };
            })
            .filter(t => t.id);
          const result = { source: items[0]?.source || 'Nitter', items };
          this.cache.set(`nitter_${username}`, result);
          return result;
        }
      } catch (e) {
        this.logger.debug(`Nitter ${instance} failed for @${username}`);
        continue;
      }
    }
    return null;
  }

  async fetchTweets(username) {
    let data = await this.fetchSotwe(username);
    if (data) return data;
    return await this.fetchNitter(username);
  }
}

module.exports = Fetcher;
