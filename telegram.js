const TelegramBot = require('node-telegram-bot-api');
const sanitizeHtml = require('sanitize-html');
const Logger = require('./logger');

const MAIN_KEYBOARD = {
  reply_markup: {
    keyboard: [
      ['🔄 Check Now', '📋 List Users'],
      ['➕ Add User', '➖ Remove User'],
      ['🏥 Health Check', '/stats']
    ],
    resize_keyboard: true,
    persistent: true
  }
};

class TelegramClient {
  constructor(config) {
    this.bot = new TelegramBot(config.TELEGRAM_BOT_TOKEN, { polling: true });
    this.chatId = config.TELEGRAM_CHAT_ID;
    this.logger = Logger.getInstance();
    this.userStates = {};
  }

  static instance = null;

  static async init(config) {
    TelegramClient.instance = new TelegramClient(config);
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
      this.sendWelcome(msg.chat.id);
    });

    this.bot.onText(/\/cancel|❌ Cancel/, (msg) => {
      delete this.userStates[msg.chat.id];
      this.bot.sendMessage(msg.chat.id, '❌ Cancelled.', MAIN_KEYBOARD);
    });

    this.bot.on('message', (msg) => {
      // Handled by monitor.js
    });
  }

  async sendWelcome(chatId) {
    await this.bot.sendMessage(chatId, `
<b>⚡ Twitter Monitor v12.0-MODULAR</b>

✅ Production-ready with:
• Sotwe API + Nitter rotation (12 instances)
• Parallel batch fetching (10 at once)
• Auto-retry with exponential backoff
• Smart caching & deduplication
• HTML sanitization
• Pino structured logging
• Rate limiting + metrics

Use the buttons to manage users.
    `, { parse_mode: 'HTML', ...MAIN_KEYBOARD });
  }

  async shutdown() {
    this.bot.stopPolling();
    this.logger.info('Telegram bot shutdown complete');
  }
}

module.exports = TelegramClient;
