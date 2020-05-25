import { config } from 'dotenv';
import { Pool } from 'pg';
import { dbConfigFromEnvironment } from './config';

if (process.env.NODE_ENV !== 'prod') {
  // Set defaults using dotenv - will only set variables not set already in ambient environment
  config();
}

const _pool = new Pool(dbConfigFromEnvironment());

_pool.on('error', (err, client) => {
  // eslint-disable-next-line no-console
  console.error(`Unexpected error on client ${client}: ${err.message}`);
  process.exit(1);
});


/**
 * IMPORTANT!!!
 * Any time a client is requested from this pool like so `const client = await pool.connect();`
 * make sure that the client is released with `client.release()` once you're done with it.
 * If you forget to release the client then the application will quickly exhaust
 * available, idle clients in the pool and all further calls to pool.connect will timeout
 * with an error or hang indefinitely if you have connectionTimeoutMills configured to 0.
 */
export const pool = _pool;
