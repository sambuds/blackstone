const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const logger = require(`${global.__common}/monax-logger`);
const contracts = require(`${global.__controllers}/contracts-controller`);

const Hoard = require('../hoard/index.js');

const hoard = new Hoard.Client(global.__settings.monax.hoard);

const seeds = require(`${global.__data}/seeds`);

(function startApp() {
  const log = logger.getLogger('agreements.web');

  require(`${global.__controllers}/notifications-controller`);
  require(path.join(global.__common, 'passport'))(passport);

  const portHTTP = global.__settings.monax.server.port_http || 3080;
  const app = express();
  app.use(helmet());

  // CORS for frontend requests
  const allowCrossDomain = (req, res, next) => {
    if (req.get('origin')) {
      res.setHeader('Access-Control-Allow-Origin', req.get('origin'));
    } else {
      res.setHeader('Access-Control-Allow-Origin', req.get('host'));
    }
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header(
      'Access-Control-Allow-Headers',
      'Content-Type,Content-Disposition,content-disposition,Authorization,authorization',
    );
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', 'set-cookie');
    next();
  };
  app.use(allowCrossDomain);

  // Configure JSON parsing as default
  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(passport.initialize());

  app.use((req, res, next) => {
    if (req.path !== '/healthcheck') {
      log.debug(`${req.method}:${req.path}`);
    }
    return next();
  });

  // Healthcheck
  app.use('/healthcheck', require('express-healthcheck')());

  // Allow text for query and bpmn/model routes
  app.use(['/query', '/bpm/process-models'], bodyParser.text({
    type: '*/*',
  }));

  /**
   * HOARD Routes
   */
  require(`${global.__routes}/hoard-api`)(app);

  /**
   * Archetypes Routes
   * Agreements Routes
   */
  require(`${global.__routes}/agreements-api`)(app);

  /**
   * Organization Routes
   * User Routes
   */
  require(`${global.__routes}/participants-api`)(app);

  /**
   * Static Data Routes
   */
  require(`${global.__routes}/static-data-api`)(app);

  /**
   * BPM Routes
   */
  require(`${global.__routes}/bpm-api`)(app);

  // SQL TEST ROUTE
  app.post('/query', (req, res, next) => {
    log.info(req.body);
    contracts.cache.db.all(req.body, (err, data) => {
      res.json(data);
      return next();
    });
  });

  // DEMO SEED ROUTES
  app.post('/seeds/users', (req, res, next) => {
    seeds.users(req, res, next, log);
  });

  // ERROR HANDLING MIDDLEWARE
  app.use((err, req, res, next) => {
    log.error(err.stack);
    if (err.output) {
      return res.status(err.output.statusCode).json(err.output.payload);
    }
    return res.sendStatus(500);
  });

  process.on('unhandledRejection', (reason, p) => {
    log.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
  });

  process.on('uncaughtException', (err) => {
    log.error(`uncaughtException, Error: ${err.message}, Stack: ${err.stack}`);
  });

  const httpServer = http.createServer(app).listen(portHTTP);

  module.exports = app; // for testing
}());
