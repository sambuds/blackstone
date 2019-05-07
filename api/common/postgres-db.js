/* eslint-disable no-console */
const { Pool } = require('pg');

if (!global.db.connectionString) {
  console.error('No db connection string set in [ global.db.connectionString ]. Exiting.');
  process.exit(1);
}
if (!global.db.schema.chain) {
  console.error('No chain data schema name set in [ global.db.schema.chain ]. Exiting.');
  process.exit(1);
}
if (!global.db.schema.app) {
  console.error('No app data schema name set in [ global.db.schema.app ]. Exiting.');
  process.exit(1);
}

const config = {
  // number of milliseconds to wait before timing out when connecting a new client
  // default set to 10000
  connectionTimeoutMillis: process.env.DB_CONNECTION_TIMEOUT_MS || 10000,

  // number of milliseconds a client must sit idle in the pool and not be checked out
  // before it is disconnected from the backend and discarded
  // default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
  idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS || 10000,

  // maximum number of clients the pool should contain
  // by default this is set to 10.
  max: process.env.DB_MAX_CLIENTS_IN_POOL || 10,

  // connection string to connect to db
  connectionString: global.db.connectionString,
};

const pool = new Pool(config);
pool.on('error', (err, client) => {
  console.error(`Unexpected error on client ${client}: ${err.message}`);
  process.exit(1);
});

/**
 * IMPORTANT!!!
 * Any time a client is requested from this pool like so `const client = await pool.connec();`
 * make sure that the client is released with `client.release()` once you're done with it.
 * If you forget to release the client then the application will quickly exhaust
 * available, idle clients in the pool and all further calls to pool.connect will timeout
 * with an error or hang indefinitely if you have connectionTimeoutMills configured to 0.
 */
module.exports = { pool };
