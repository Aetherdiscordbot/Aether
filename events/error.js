/**
 * Client error + warning handlers.
 */
const logger = require('../services/logger');

module.exports = {
  name: 'error',
  run(client, error) {
    logger.error(`Client error: ${error.message}`);
  },
};
