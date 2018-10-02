const boom = require('boom');
const jwt = require('jsonwebtoken');
const passportJwt = require('passport-jwt');
const bcrypt = require('bcryptjs');
const pool = require(`${global.__common}/postgres-db`);
const JwtStrategy = passportJwt.Strategy;
const LocalStrategy = require('passport-local').Strategy;
const contracts = require(`${global.__controllers}/contracts-controller`);
const sqlCache = require(`${global.__controllers}/sqlsol-query-helper`);

module.exports = (passport) => {
  const isValidUser = async (id) => {
    try {
      await contracts.getUserById(id);
      return true;
    } catch (err) {
      if (err.output.statusCode === 404) {
        return false;
      }
      throw err;
    }
  };

  const cookieExtractor = (req) => {
    let token = null;
    if (req && req.cookies) {
      token = req.cookies['access_token'];
    }
    return token;
  };

  const jwtOpts = {
    jwtFromRequest: cookieExtractor,
    secretOrKey: global.__settings.monax.jwt.secret,
    issuer: global.__settings.monax.jwt.issuer,
    passReqToCallback: true,
    jsonWebTokenOptions: {
      expiresIn: global.__settings.monax.jwt.expiresIn,
    },
  };

  const usernameOpts = {
    usernameField: 'username',
    passwordField: 'password',
    passReqToCallback: true,
  };

  const emailOpts = {
    usernameField: 'email',
    passwordField: 'password',
    passReqToCallback: true,
  };

  passport.serializeUser((user, done) => {
    done(null, user);
  });

  passport.deserializeUser((user, done) => {
    done(null, user);
  });

  /*
  Local Strategy Flow:
  Get address hashed userId from chain
  Get address from sqlsol using hashed userId
  Compare chain address to sqlsol address and return unauthorized on mismatch
  Get address and password digest from pg
  Compare chain address to pg address and return unauthorized on mismatch
  Compare given password with password digest and return unauthorized on mismatch
  Return success
  */
 const authenticate = async (id, idType, password, done) => {
   const text = `SELECT username, email, address, password_digest, created_at FROM users WHERE LOWER(${idType}) = LOWER($1)`;
   try {
     const { rows } = await pool.query({
       text,
       values: [id],
     });
     if (!rows[0]) {
       return done(null, false, { message: 'Invalid login credentials' });
     }
     const { username, password_digest: pwDigest, address: addressFromPg, created_at: createdAt } = rows[0];
     const { address: addressFromChain, hashedId } = await contracts.getUserById(username);
     const data = (await sqlCache.getUsers({ id: hashedId }))[0];
     if (!data) return done(null, false, { message: 'Invalid login credentials' });
     const isPassword = await bcrypt.compare(password, pwDigest);
     if (isPassword) {
       if (addressFromChain === addressFromPg && data.address === addressFromChain) {
         const token = jwt.sign(
           {
             address: addressFromChain,
             id: username,
           },
           global.__settings.monax.jwt.secret,
           {
             expiresIn: global.__settings.monax.jwt.expiresIn,
             subject: username,
             issuer: global.__settings.monax.jwt.issuer,
           },
         );
         return done(null, { token, address: addressFromChain, createdAt, username }, { message: 'Login successful' });
       }
       return done(null, false, { message: 'Failed to login - User account address mismatch' });
     }
     return done(null, false, { message: 'Invalid login credentials' });
   } catch (err) {
     if (err.output && (err.output.statusCode === 401 || err.output.statusCode === 404)) {
       return done(null, false, { message: 'Invalid login credentials' });
     }
     return done(boom.badImplementation(err));
   }
 }
  const usernameStrategy = new LocalStrategy(usernameOpts, async (req, username, password, done) => {
    await authenticate(username, 'username', password, done);
  });

  const emailStrategy = new LocalStrategy(emailOpts, async (req, email, password, done) => {
    await authenticate(email, 'email', password, done);
  });

  const jwtStrategy = new JwtStrategy(jwtOpts, async (req, jwtPayload, done) => {
    try {
      const userIsValid = await isValidUser(jwtPayload.id);
      if (userIsValid) {
        const user = {
          address: jwtPayload.address,
          id: jwtPayload.id,
        };
        return done(null, user, { message: 'User authentication successful' });
      }
      return done(null, null, { message: 'No user found' });
    } catch (err) {
      return done(err, null, { message: 'Failed to authenticate user' });
    }
  });

  passport.use('username-login', usernameStrategy);
  passport.use('email-login', emailStrategy);
  passport.use('jwt', jwtStrategy);
};
