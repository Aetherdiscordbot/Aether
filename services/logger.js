/**
 * Simple logger using Winston.
 */
const winston = require('winston');
const chalk = require('chalk');

const LEVEL_COLORS = {
  error: chalk.red,
  warn: chalk.yellow,
  info: chalk.cyan,
  debug: chalk.gray,
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

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
  ],
});

module.exports = logger;