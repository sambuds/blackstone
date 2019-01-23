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
      if (process.env.MONAX_DOUG) _.set(settings, 'monax.DOUG', process.env.MONAX_DOUG); // TODO I don't think this option of setting DOUG is ever used. DOUG is read from NameReg
      if (process.env.MONAX_HOARD) _.set(settings, 'monax.hoard', process.env.MONAX_HOARD);
      if (process.env.MONAX_ANALYTICS_ID) _.set(settings, 'monax.analyticsID', process.env.MONAX_ANALYTICS_ID);
      if (process.env.MONAX_CHAIN_HOST) _.set(settings, 'monax.chain.host', process.env.MONAX_CHAIN_HOST);
      if (process.env.MONAX_CHAIN_PORT) _.set(settings, 'monax.chain.port', process.env.MONAX_CHAIN_PORT);
      if (process.env.MONAX_ACCOUNTS_SERVER_KEY) _.set(settings, 'monax.accounts.server', process.env.MONAX_ACCOUNTS_SERVER_KEY);
      if (process.env.MONAX_CONTRACTS_LOAD) _.set(settings, 'monax.contracts.load', process.env.MONAX_CONTRACTS_LOAD);
      if (process.env.MONAX_BUNDLES_PATH) _.set(settings, 'monax.bundles.bundles_path', process.env.MONAX_BUNDLES_PATH);
      if (process.env.MONAX_JWT_SECRET) _.set(settings, 'monax.jwt.secret', process.env.MONAX_JWT_SECRET);
      if (process.env.MONAX_JWT_ISSUER) _.set(settings, 'monax.jwt.issuer', process.env.MONAX_JWT_ISSUER);
      if (process.env.MONAX_JWT_EXPIRES_IN) _.set(settings, 'monax.jwt.expiresIn', process.env.MONAX_JWT_EXPIRES_IN);
      if (process.env.MONAX_COOKIE_MAX_AGE) _.set(settings, 'monax.cookie.maxAge', process.env.MONAX_COOKIE_MAX_AGE);
      if (process.env.MONAX_ECOSYSTEM) _.set(settings, 'monax.ecosystem', process.env.MONAX_ECOSYSTEM);
      if (process.env.NODE_ENV === 'production') {
        _.set(
          settings,
          'monax.pg.app_db_url',
          `postgres://${process.env.POSTGRES_DB_USER}:${process.env.POSTGRES_DB_PASSWORD}@${process.env.POSTGRES_DB_HOST}:${process.env.POSTGRES_DB_PORT}/${process.env.POSTGRES_DB_DATABASE}`,
        );
        _.set(
          settings,
          'monax.pg.chain_db_url',
          `postgres://${process.env.POSTGRES_DB_USER}:${process.env.POSTGRES_DB_PASSWORD}@${process.env.POSTGRES_DB_HOST}:${process.env.POSTGRES_DB_PORT}/${process.env.POSTGRES_DB_DATABASE_VENT}`,
        );
      }
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
      require(`${global.__common}/aa-web-api`)(app, customConfigs.endpoints);
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
