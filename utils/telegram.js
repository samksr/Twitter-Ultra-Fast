const TelegramBot = require('node-telegram-bot-api');
const sanitizeHtml = require('sanitize-html');
const Logger = require('./logger');
const Storage = require('./storage');

const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      ['🔄 Check Now', '📋 List Users'],
      ['➕ Add User', '➖ Remove User'],
      ['🏥 Health Check']
    ],
    resize_keyboard: true,
    persistent: false
  }
};

class TelegramClient {
  constructor(config, monitor) {
    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatId = config.TELEGRAM_CHAT_ID;
    this.logger = Logger.getInstance();
    this.monitor = monitor;
    this.userStates = {};
  }

  static instance = null;

  static async init(config, monitor) {
    TelegramClient.instance = new TelegramClient(config, monitor);
    await TelegramClient.instance.setupHandlers();
    return TelegramClient.instance;
  }

  static getInstance() {
    return TelegramClient.instance;
  }

  sanitize(text) {
    return sanitizeHtml(text, {
      allowedTags: ['b', 'i', 'a', 'code'],
      allowedAttributes: { a: ['href'] }
    });
  }

  async sendTweetAlert(username, tweet, source) {
    const link = `https://x.com/${username}/status/${tweet.id}`;
    const date = new Date(tweet.createdAt).toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit'
    });

    const caption = this.sanitize(`
<b>🐦 @${username} Posted:</b>
<code>${source}</code>

${tweet.text.substring(0, 800)}

⏰ ${date} • <a href="${link}"><b>🔗 Open Tweet</b></a>
    `.trim());

    try {
      if (tweet.media?.[0]) {
        await this.bot.sendPhoto(this.chatId, tweet.media[0], {
          caption,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        }).catch(() =>
          this.bot.sendMessage(this.chatId, caption, {
            parse_mode: 'HTML',
            disable_web_page_preview: false,
            ...MAIN_KEYBOARD
          })
        );
      } else {
        await this.bot.sendMessage(this.chatId, caption, {
          parse_mode: 'HTML',
          disable_web_page_preview: false,
          ...MAIN_KEYBOARD
        });
      }
      this.logger.info(`🔔 Sent tweet from @${username}`);
    } catch (e) {
      this.logger.error(`Failed to send tweet for @${username}:`, e.message);
    }
  }

  async setupHandlers() {
    this.bot.onText(/\/start/, (msg) => {
      this.handleStart(msg.chat.id);
    });

    this.bot.onText(/🔄 Check Now/, (msg) => {
      this.handleCheckNow(msg.chat.id);
    });

    this.bot.onText(/📋 List Users/, (msg) => {
      this.handleListUsers(msg.chat.id);
    });

    this.bot.onText(/➕ Add User/, (msg) => {
      this.handleAddUser(msg.chat.id);
    });

    this.bot.onText(/➖ Remove User/, (msg) => {
      this.handleRemoveUser(msg.chat.id);
    });

    this.bot.onText(/🏥 Health Check/, (msg) => {
      this.handleHealthCheck(msg.chat.id);
    });

    this.bot.on('message', (msg) => {
      if (this.userStates[msg.chat.id] === 'waiting_add') {
        this.processAddUser(msg);
      } else if (this.userStates[msg.chat.id] === 'waiting_remove') {
        this.processRemoveUser(msg);
      }
    });
  }

  async handleStart(chatId) {
    await this.bot.sendMessage(chatId, `
<b>⚡ Twitter Monitor v12.0-MODULAR</b>

✅ Production-ready with:
• Sotwe API + Nitter rotation
• Parallel batch fetching
• Auto-retry with exponential backoff
• Smart caching & deduplication
• HTML sanitization
• Pino structured logging
• Rate limiting + metrics

Use the buttons to manage users.
    `, { parse_mode: 'HTML', ...MAIN_KEYBOARD });
  }

  async handleCheckNow(chatId) {
    await this.bot.sendMessage(chatId, '⏳ Checking tweets now...', MAIN_KEYBOARD);
    
    try {
      const users = await Storage.loadUsers();
      if (this.monitor) {
        await this.monitor.checkFeeds(users, true);
      } else {
        await this.bot.sendMessage(chatId, '❌ Monitor not initialized', MAIN_KEYBOARD);
      }
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Check failed: ${e.message}`, MAIN_KEYBOARD);
    }
  }

  async handleListUsers(chatId) {
    try {
      const users = await Storage.loadUsers();
      const list = users.length > 0 
        ? users.map((u, i) => `${i + 1}. @${u}`).join('\n')
        : 'No users monitored yet';
      
      await this.bot.sendMessage(chatId, `
📋 <b>Monitored Users:</b>
${list}

Total: ${users.length} users
      `, { parse_mode: 'HTML', ...MAIN_KEYBOARD });
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`, MAIN_KEYBOARD);
    }
  }

  async handleAddUser(chatId) {
    this.userStates[chatId] = 'waiting_add';
    await this.bot.sendMessage(chatId, 'Send username (without @) to add:', MAIN_KEYBOARD);
  }

  async processAddUser(msg) {
    const username = msg.text.trim().replace('@', '');
    const chatId = msg.chat.id;
    
    try {
      let users = await Storage.loadUsers();
      if (!users.includes(username)) {
        users.push(username);
        await Storage.saveJson('./data/monitored_users.json', users);
        await this.bot.sendMessage(chatId, `✅ Added @${username}`, MAIN_KEYBOARD);
      } else {
        await this.bot.sendMessage(chatId, `⚠️ @${username} already monitored`, MAIN_KEYBOARD);
      }
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`, MAIN_KEYBOARD);
    }
    delete this.userStates[chatId];
  }

  async handleRemoveUser(chatId) {
    this.userStates[chatId] = 'waiting_remove';
    await this.bot.sendMessage(chatId, 'Send username (without @) to remove:', MAIN_KEYBOARD);
  }

  async processRemoveUser(msg) {
    const username = msg.text.trim().replace('@', '');
    const chatId = msg.chat.id;
    
    try {
      let users = await Storage.loadUsers();
      users = users.filter(u => u !== username);
      await Storage.saveJson('./data/monitored_users.json', users);
      await this.bot.sendMessage(chatId, `✅ Removed @${username}`, MAIN_KEYBOARD);
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`, MAIN_KEYBOARD);
    }
    delete this.userStates[chatId];
  }

  async handleHealthCheck(chatId) {
    try {
      const cache = this.monitor?.cache || { hits: 0, misses: 0, size: 0 };
      const hitRate = cache.hits + cache.misses > 0
        ? (cache.hits / (cache.hits + cache.misses) * 100).toFixed(1)
        : 0;
      
      await this.bot.sendMessage(chatId, `
🏥 <b>Health Check:</b>

📊 Cache Stats:
• Hits: ${cache.hits || 0}
• Misses: ${cache.misses || 0}
• Hit Rate: ${hitRate}%
• Size: ${cache.size || 0}

✅ Bot is running normally
      `, { parse_mode: 'HTML', ...MAIN_KEYBOARD });
    } catch (e) {
      await this.bot.sendMessage(chatId, `❌ Error: ${e.message}`, MAIN_KEYBOARD);
    }
  }

  async shutdown() {
    try {
      this.bot.stopPolling();
      this.logger.info('Telegram bot shutdown complete');
    } catch (e) {
      this.logger.error('Shutdown error:', e);
    }
  }
}

module.exports = TelegramClient;
