const multer = require('multer');
const upload = multer();
const { createHoard, getHoard } = require(`${global.__controllers}/hoard-controller`);

const { ensureAuth } = require(`${global.__common}/middleware`);

// APIs defined according to specification found here -> http://apidocjs.com
module.exports = (app, customMiddleware) => {
  // Use custom middleware if passed, otherwise use plain old ensureAuth
  let middleware = [];
  middleware = middleware.concat(customMiddleware.length ? customMiddleware : [ensureAuth]);

  /* **************
   * Content
   ************** */

  /**
  * @api {get} /hoard Read Content Object
  * @apiName ReadContent
  * @apiGroup Content
  *
  * @apiExample {curl} Simple:
  *     curl -i /hoard
  *
  */
  app.get('/hoard', getHoard);

  /**
  * @api {post} /hoard Read Content Object
  * @apiName ReadContent
  * @apiGroup Content
  *
  * @apiExample {curl} Simple:
  *     curl -iX POST /hoard
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  */
  app.post('/hoard', middleware, upload.any(), createHoard);
};
