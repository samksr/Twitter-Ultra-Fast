const pino = require('pino');

class Logger {
  static instance = null;

  static getInstance() {
    if (!Logger.instance) {
      Logger.instance = pino({
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
          }
        }
      });
    }
    return Logger.instance;
  }
}

module.exports = Logger;
