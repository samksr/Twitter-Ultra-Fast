const fs = require('fs').promises;
const path = require('path');
const Joi = require('joi');
const Logger = require('./logger');

const FILES = {
  cache: process.env.CACHE_FILE || path.join(__dirname, '../data/tweet_cache.json'),
  users: process.env.USERS_FILE || path.join(__dirname, '../data/monitored_users.json'),
  state: process.env.STATE_FILE || path.join(__dirname, '../data/user_state.json')
};

class Storage {
  static logger = null;

  static async validateConfig() {
    const schema = Joi.object({
      TELEGRAM_BOT_TOKEN: Joi.string().required(),
      TELEGRAM_CHAT_ID: Joi.string().required(),
      USERS_TO_MONITOR: Joi.string().optional()
    }).unknown(true);

    const { error, value } = schema.validate(process.env);
    return { valid: !error, config: value, error: error?.message };
  }

  static async init() {
    Storage.logger = Logger.getInstance();
    await fs.mkdir(path.dirname(FILES.cache), { recursive: true });
    return true;
  }

  static async loadJson(file, defaultValue = []) {
    try {
      await fs.access(file);
      const data = await fs.readFile(file, 'utf8');
      return JSON.parse(data);
    } catch {
      return defaultValue;
    }
  }

  static async saveJson(file, data) {
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, JSON.stringify(data, null, 2));
    } catch (e) {
      Storage.logger?.error(`Failed to save ${file}:`, e.message);
    }
  }

  static async loadUsers() {
    let users = await Storage.loadJson(FILES.users);
    if (!users.length && process.env.USERS_TO_MONITOR) {
      users = process.env.USERS_TO_MONITOR.split(',')
        .map(u => u.trim().replace('@', ''))
        .filter(Boolean);
      await Storage.saveJson(FILES.users, users);
    }
    return users;
  }

  static async loadSentIds() {
    const cached = await Storage.loadJson(FILES.cache);
    return new Set(cached);
  }

  static async saveSentIds(ids) {
    await Storage.saveJson(FILES.cache, Array.from(ids).slice(-5000));
  }

  static async loadBootstrapState() {
    return await Storage.loadJson(FILES.state, {});
  }

  static async saveBootstrapState(state) {
    await Storage.saveJson(FILES.state, state);
  }

  static async shutdown() {
    // Flush any pending writes
  }
}

module.exports = Storage;
