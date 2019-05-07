const express = require('express');
const http = require('http');
const bodyParser = require('body-parser');
const path = require('path');
const passport = require('passport');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const logger = require(`${global.__common}/logger`);
const log = logger.getLogger('app');

const app = express();

// Passport for authentication
require(path.join(global.__common, 'passport'))(passport);
app.use(passport.initialize());

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

// Healthcheck
app.use((req, res, next) => {
  if (req.path !== '/healthcheck') {
    log.debug(`${req.method}:${req.path}`);
  }
  return next();
});
app.use('/healthcheck', require('express-healthcheck')());

// Allow text for query and bpmn/model routes
app.use(['/query', '/pg-query', '/bpm/process-models'], bodyParser.text({
  type: '*/*',
}));

/**
 * HOARD Routes
 */
require(`${global.__routes}/hoard-api`)(app);

/**
 * Archetype Routes
 */
require(`${global.__routes}/archetypes-api`)(app);

/**
 * Archetype Package Routes
 */
require(`${global.__routes}/archetype-packages-api`)(app);

/**
 * Agreement Routes
 */
require(`${global.__routes}/agreements-api`)(app);

/**
 * Agreement Collection Routes
 */
require(`${global.__routes}/agreement-collections-api`)(app);

/**
 * User Routes
 */
require(`${global.__routes}/users-api`)(app);

/**
 * Organization Routes
 */
require(`${global.__routes}/organizations-api`)(app);

/**
 * Static Data Routes
 */
require(`${global.__routes}/static-data-api`)(app);

/**
 * BPM Model Routes
 */
require(`${global.__routes}/bpm-models-api`)(app);

/**
 * BPM Runtime Routes
 */
require(`${global.__routes}/bpm-runtime-api`)(app);

// ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
  if (err.output) {
    log.error(`[ ${err.output.statusCode} ${err.output.payload ? `- ${err.output.payload.error} ]` : ']'}`, err.stack);
    return res.status(err.output.statusCode).json(err.output.payload);
  }
  log.error(err.stack);
  return res.sendStatus(500);
});

process.on('unhandledRejection', (reason, p) => {
  log.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});

require('./gracefulShutdown');

const portHTTP = global.__settings.server.port_http || 3080;
http.createServer(app).listen(portHTTP);

module.exports = app;
