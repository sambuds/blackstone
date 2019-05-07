/* eslint-disable no-console */
process.stdin.resume();

const { pool } = require('./postgres-db');

process.on('uncaughtException', (err) => {
  console.error(`uncaughtException, Error: ${err.message}, Stack: ${err.stack}`);
  process.exit(1);
});

const handle = async (signal) => {
  console.info(`Received ${signal}. Closing db pool and exiting...`);
  pool.end().then(() => {
    process.exit();
  });
};

process.on('SIGINT', handle);
process.on('SIGTERM', handle);
