// External dependencies
const fs = require('fs');
const toml = require('toml');
const events = require('events');
const path = require('path');
const _ = require('lodash');
const monax = require('@monax/burrow');

(function bootstrapAPI() {
  module.exports = (app, customConfigs = {}) => {
    // Set up global directory constants used throughout the app
    global.__appDir = __dirname;
    global.__common = path.resolve(global.__appDir, 'common');
    global.__config = path.resolve(global.__appDir, 'config');
    global.__contracts = path.resolve(global.__appDir, 'contracts');
    global.__abi = path.resolve(global.__appDir, 'public-abi');
    global.__routes = path.resolve(global.__appDir, 'routes');
    global.__controllers = path.resolve(global.__appDir, 'controllers');
    global.__data = path.resolve(global.__appDir, 'data');
    global.__lib = path.resolve(global.__appDir, 'lib');
    global.__schemas = path.resolve(global.__appDir, 'schemas');

    // Read configuration
    const configFilePath = process.env.MONAX_CONFIG || `${global.__config}/settings.toml`;
    global.__settings = (() => {
      const settings = toml.parse(fs.readFileSync(configFilePath));
      if (process.env.MONAX_HOARD) _.set(settings, 'monax.hoard', process.env.MONAX_HOARD);
      if (process.env.MONAX_ANALYTICS_ID) _.set(settings, 'monax.analyticsID', process.env.MONAX_ANALYTICS_ID);
      if (process.env.CHAIN_URL_GRPC) _.set(settings, 'monax.chain.url', process.env.CHAIN_URL_GRPC);
      if (process.env.MONAX_ACCOUNTS_SERVER_KEY) _.set(settings, 'monax.accounts.server', process.env.MONAX_ACCOUNTS_SERVER_KEY);
      if (process.env.MONAX_CONTRACTS_LOAD) _.set(settings, 'monax.contracts.load', process.env.MONAX_CONTRACTS_LOAD);
      if (process.env.MONAX_BUNDLES_PATH) _.set(settings, 'monax.bundles.bundles_path', process.env.MONAX_BUNDLES_PATH);
      if (process.env.MONAX_JWT_SECRET) _.set(settings, 'monax.jwt.secret', process.env.MONAX_JWT_SECRET);
      if (process.env.MONAX_JWT_ISSUER) _.set(settings, 'monax.jwt.issuer', process.env.MONAX_JWT_ISSUER);
      if (process.env.MONAX_JWT_EXPIRES_IN) _.set(settings, 'monax.jwt.expiresIn', process.env.MONAX_JWT_EXPIRES_IN);
      if (process.env.MONAX_COOKIE_MAX_AGE) _.set(settings, 'monax.cookie.maxAge', process.env.MONAX_COOKIE_MAX_AGE);
      if (process.env.IDENTITY_PROVIDER) _.set(settings, 'identity_provider', process.env.IDENTITY_PROVIDER);
      if (process.env.MAX_WAIT_FOR_VENT_MS) _.set(settings, 'max_wait_for_vent_ms', process.env.MAX_WAIT_FOR_VENT_MS);
      _.set(
        settings,
        'db.app_db_url',
        `postgres://${process.env.POSTGRES_DB_USER}:${process.env.POSTGRES_DB_PASSWORD}@${process.env.POSTGRES_DB_HOST}:${process.env.POSTGRES_DB_PORT}/${process.env.POSTGRES_DB_DATABASE}`,
      );
      _.set(settings, 'db.app_db_schema', process.env.POSTGRES_DB_SCHEMA);
      _.set(
        settings,
        'db.chain_db_url',
        `postgres://${process.env.POSTGRES_DB_USER}:${process.env.POSTGRES_DB_PASSWORD}@${process.env.POSTGRES_DB_HOST}:${process.env.POSTGRES_DB_PORT}/${process.env.POSTGRES_DB_DATABASE}`,
      );
      _.set(settings, 'db.chain_db_schema', process.env.POSTGRES_DB_SCHEMA_VENT);
      if (process.env.NODE_ENV === 'production') _.set(settings, 'monax.cookie.secure', true);
      else _.set(settings, 'monax.cookie.secure', false);
      return settings;
    })();

    global.__monax_constants = require(path.join(global.__common, 'monax-constants'));
    global.__monax_bundles = global.__monax_constants.MONAX_BUNDLES;
    const { hexToString, stringToHex } = require(`${global.__common}/controller-dependencies`);
    global.hexToString = hexToString;
    global.stringToHex = stringToHex;

    if (customConfigs.globalVariables) customConfigs.globalVariables();

    // EventEmitter to signal application state, e.g. to test suite
    const eventEmitter = new events.EventEmitter();
    const eventConsts = { STARTED: 'started' };

    // Local modules require configuration to be loaded
    const logger = require(`${global.__common}/monax-logger`);

    const log = logger.getLogger('monax');

    log.info('Starting platform ...');

    const contracts = require(`${global.__controllers}/contracts-controller`);

    contracts.load().then(() => {
      log.info('Contracts loaded.');
      require(`${global.__common}/aa-web-api`)(app, customConfigs.endpoints, customConfigs.middleware, customConfigs.passport);
      log.info('Web API started and ready for requests.');
      log.info('Active Agreements Application started successfully ...');
      eventEmitter.emit(eventConsts.STARTED);
    }).catch((error) => {
      log.error(`Unexpected error initializing the application: ${error.stack}`);
    });

    return {
      events: eventConsts,
      eventEmitter,
    };
  };
}());
