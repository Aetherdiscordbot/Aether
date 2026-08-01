/**
 * Winston-based logger with chalk console output and rotating file transport.
 */
const path = require('path');
const fs = require('fs');
const winston = require('winston');
const chalk = require('chalk');

const logsDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const LEVEL_COLORS = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  http: chalk.magenta,
  verbose: chalk.green,
  debug: chalk.gray,
  silly: chalk.dim,
};

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...rest }) => {
    const color = LEVEL_COLORS[level] || chalk.white;
    const meta = Object.keys(rest).length ? ` ${chalk.dim(JSON.stringify(rest))}` : '';
    return `${chalk.dim(timestamp)} ${color(level.toUpperCase().padEnd(5))} ${message}${meta}${stack ? `\n${stack}` : ''}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    new winston.transports.File({
      filename: path.join(logsDir, 'aether.log'),
      format: fileFormat,
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
  ],
});

module.exports = logger;
