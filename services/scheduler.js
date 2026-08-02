/**
 * Scheduler registry: central place to register cron jobs and intervals so
 * they can all be started once and shut down cleanly.
 */
const cron = require('node-cron');
const logger = require('./logger');

const jobs = [];

/**
 * Register a cron job.
 * @param {string} expression node-cron expression
 * @param {Function} fn
 * @param {string} name
 */
function schedule(expression, fn, name = 'cron') {
  const task = cron.schedule(expression, () => {
    runSafe(fn, name);
  });
  // node-cron may auto-start on creation; stop so startAll() controls it.
  if (typeof task.stop === 'function') task.stop();
  jobs.push({ task, name, type: 'cron', started: false });
  logger.debug(`Scheduled cron job "${name}" (${expression})`);
}

/**
 * Register an interval job.
 * @param {number} ms
 * @param {Function} fn
 * @param {string} name
 */
function interval(ms, fn, name = 'interval') {
  const handle = setInterval(() => runSafe(fn, name), ms);
  handle.unref?.();
  jobs.push({ handle, name, type: 'interval' });
  logger.debug(`Scheduled interval job "${name}" (${ms}ms)`);
}

function runSafe(fn, name) {
  Promise.resolve()
    .then(() => fn())
    .catch((err) => logger.error(`Scheduled job "${name}" failed: ${err.message}`));
}

function startAll() {
  for (const job of jobs) {
    if (job.type === 'cron' && !job.started) {
      if (typeof job.task.start === 'function') job.task.start();
      job.started = true;
    }
  }
}

function stopAll() {
  for (const job of jobs) {
    if (job.type === 'cron') {
      if (typeof job.task.stop === 'function') job.task.stop();
      job.started = false;
    } else clearInterval(job.handle);
  }
}

module.exports = { schedule, interval, startAll, stopAll };
