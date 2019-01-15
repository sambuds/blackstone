const passport = require('passport');

/**
 * Middleware that authenticates the request with jwt
 * Import and add this middleware to any route that needs jwt authentication
 */
const ensureAuth = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (err, user, info) => {
    if (err) return res.status(500).send(`Failed to authenticate: ${err}`);
    if (!user) {
      if (info.message === 'No auth token') return res.status(401).send('No auth token found. Sign in to receive token');
      if (info && info.name === 'TokenExpiredError') return res.status(401).send(`Unauthorized: ${info.message}`);
      if (info && info.name === 'JsonWebTokenError') return res.status(401).send(`JsonWebToken Error: ${info.message}`);
      return res.status(500).send(`Token Verification Failed: ${info.message}`);
    }
    if (!req.user) {
      return req.login(user, (loginErr) => {
        if (err) res.status(500).send(`Failed to login user: ${loginErr.stack}`);
        return next();
      });
    }
    return next();
  })(req, res, next);
};

module.exports = {
  ensureAuth,
};
