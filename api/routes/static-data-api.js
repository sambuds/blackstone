const {
  getCountries,
  getAlpha2Countries,
  getAlpha2CountryRegions,
  getCurrencies,
  getAlpha3Currencies,
  getParameterType,
  getParameterTypes,
  getCollectionTypes,
} = require(`${global.__controllers}/static-data-controller`);

const { ensureAuth } = require(`${global.__common}/middleware`);

// APIs defined according to specification found here -> http://apidocjs.com
/**
 * @apiDefine NotLoggedIn
 *
 * @apiError NotLoggedIn The user making the request does not have a proper authentication token.
 */
/**
 * @apiDefine AuthTokenRequired
 *
 * @apiParam {String{20}} Cookie `access_token` containing the JsonWebToken is required, cookie is set upon successful login
 */

module.exports = (app, customMiddleware) => {
  // Use custom middleware if passed, otherwise use plain old ensureAuth
  let middleware = [];
  middleware = middleware.concat(customMiddleware.length ? customMiddleware : [ensureAuth]);

  /** *************
   * Jurisdictions
   ************** */

  /**
  * @api {get} /static-data/iso/countries Read Countries
  * @apiName ReadCountries
  * @apiGroup StaticData
  *
  * @apiExample {curl} Simple:
  *     curl -i /static-data/iso/countries
  *
  * @apiSuccess {Object[]} countries An array of countries objects (see below)
  * @apiSuccessExample {json} Success Objects Array
    [{
      "country": "US",
      "alpha2": "US",
      "alpha3": "USA",
      "m49": "840",
      "name": "United States of America"
    }]
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/static-data/iso/countries', middleware, getCountries);

  /**
  * @api {get} /static-data/iso/countries/:alpha2 Read Country
  * @apiName ReadCountry
  * @apiGroup StaticData
  *
  * @apiDescription Retrieves the country whose `alpha2` code matches the one passed as parameter.
  *
  * @apiExample {curl} Simple:
  *     curl -i /static-data/iso/countries/:alpha2
  *
  * @apiSuccess {Object} country A single countries objects (see below)
  * @apiSuccessExample {json} Success Object
      {
        "country": "US",
        "alpha2": "US",
        "alpha3": "USA",
        "m49": "840",
        "name": "United States of America"
      }
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/static-data/iso/countries/:alpha2', middleware, getAlpha2Countries);

  /**
  * @api {get} /static-data/iso/countries/:alpha2/regions Read a Country's Regions
  * @apiName ReadRegions
  * @apiGroup StaticData
  *
  * @apiDescription Retrieves an array of regions belonging to the country
  * whose `alpha2` code matches the one passed as parameter. Note that a
  * region may have its `code2` OR `code3` property populated, NOT both.
  * Thus to represent regions in the UI dropdown, we can use
  * `<alpha2>-<code2 or code3>` followed by the name.
  *
  * @apiExample {curl} Simple:
  *     curl -i /static-data/iso/countries/:alpha2/regions
  *
  * @apiSuccess {Object[]} regions An array of regions objects (see below)
  * @apiSuccessExample {json} Success Objects Array
    [{
        "country": "CA",
        "region": "0798FDAD71114ABA2A3CD6B4BD503410F8EF6B9208B889CC0BB33CD57CEEAA9C",
        "alpha2": "CA",
        "code2": "AB",
        "code3": "",
        "name": "Alberta"
      },
      {
        "country": "CA",
        "region": "1C16E32AED9920491BFED16E1396344027C8D6916833C64CE7F8CCF541398F3B",
        "alpha2": "CA",
        "code2": "NT",
        "code3": "",
        "name": "Northwest Territories"
      }
    ]
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/static-data/iso/countries/:alpha2/regions', middleware, getAlpha2CountryRegions);

  /** **********
   * Currencies
   *********** */

  /**
  * @api {get} /static-data/iso/currencies Read Currencies
  * @apiName ReadCurrencies
  * @apiGroup StaticData
  *
  * @apiExample {curl} Simple:
  *     curl -i /static-data/iso/currencies
  *
  * @apiSuccess {Object[]} currencies An array of currencies objects (see below)
  * @apiSuccessExample {json} Success Objects Array
    [{
        "currency": "AED",
        "alpha3": "AED",
        "m49": "784",
        "name": "United Arab Emirates dirham"
      },
      {
        "currency": "AFN",
        "alpha3": "AFN",
        "m49": "971",
        "name": "Afghan afghani"
      }
    ]
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/static-data/iso/currencies', middleware, getCurrencies);

  /**
  * @api {get} /static-data/iso/currencies/:alpha3 Read Currency
  * @apiName ReadCurrency
  * @apiGroup StaticData
  *
  * @apiDescription Retrieves the currency whose `alpha3` code matches
  * the one passed as parameter.
  *
  * @apiExample {curl} Simple:
  *     curl -i /static-data/iso/currencies/:alpha3
  *
  * @apiSuccess {Object} currency A single currency objects (see below)
  * @apiSuccessExample {json} Success Objects Array
    {
      "currency": "USD",
      "alpha3": "USD",
      "m49": "840",
      "name": "United States dollar"
    }
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/static-data/iso/currencies/:alpha3', middleware, getAlpha3Currencies);

  /**
   * @api {get} /static-data/parameter-types Read Parameter Types
   * @apiName ReadParameterTypes
   * @apiGroup StaticData
   *
   * @apiExample {curl} Simple:
   *     curl -i /static-data/parameter-types
   *
   * @apiSuccessExample {json} Success Objects Array
    [
        {"parameterType": 0, "label": "Boolean"},
        {"parameterType": 1, "label": "String"},
        {"parameterType": 2, "label": "Number"},
        {"parameterType": 3, "label": "Date"},
        {"parameterType": 4, "label": "Datetime"},
        {"parameterType": 5, "label": "Monetary Amount"},
        {"parameterType": 6, "label": "User/Organization"},
        {"parameterType": 7, "label": "Contract Address"},
        {"parameterType": 8, "label": "Signing Party"}
    ]
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/static-data/parameter-types', middleware, getParameterTypes);

  /**
   * @api {get} /static-data/parameter-types/:id Read Single Parmeter Type
   * @apiName ReadParameterTypes
   * @apiGroup StaticData
   *
   * @apiExample {curl} Simple:
   *     curl -i /static-data/parameter-types/:id
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/static-data/parameter-types/:id', middleware, getParameterType);


  /**
   * @api {get} /static-data/collection-types Read Collection Types
   * @apiName ReadCollectionTypes
   * @apiGroup StaticData
   *
   * @apiExample {curl} Simple:
   *     curl -i /static-data/collection-types
   *
   * @apiSuccessExample {json} Success Objects Array
    [
        {"collectionType": 0, "label": "Case"},
        {"collectionType": 1, "label": "Deal"},
        {"collectionType": 2, "label": "Dossier"},
        {"collectionType": 3, "label": "Folder"},
        {"collectionType": 4, "label": "Matter"},
        {"collectionType": 5, "label": "Package"},
        {"collectionType": 6, "label": "Project"},
    ]
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/static-data/collection-types', middleware, getCollectionTypes);
};
