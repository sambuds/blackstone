import { config } from 'dotenv';
import { PoolConfig } from 'pg';

export function dbConfigFromEnvironment(): PoolConfig {
  config();
  return {
    // number of milliseconds to wait before timing out when connecting a new client
    // default set to 10000
    connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 10000,

    // number of milliseconds a client must sit idle in the pool and not be checked out
    // before it is disconnected from the backend and discarded
    // default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS) || 10000,

    // maximum number of clients the pool should contain
    // by default this is set to 10.
    max: Number(process.env.DB_MAX_CLIENTS_IN_POOL) || 10,

    // connection string to connect to db
    connectionString: `postgres://${process.env.POSTGRES_DB_USER}:${process.env.POSTGRES_DB_PASSWORD}@${process.env.POSTGRES_DB_HOST}:${process.env.POSTGRES_DB_PORT}/${process.env.POSTGRES_DB_DATABASE}`,

    // other fields storing env vars. These are NOT required for the Postgres Pool constructor!
    user: process.env.POSTGRES_DB_USER,
    host: process.env.POSTGRES_DB_HOST,
    database: process.env.POSTGRES_DB_DATABASE,
    port: Number(process.env.POSTGRES_DB_PORT),
  };
}

