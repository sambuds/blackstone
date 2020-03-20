/*

Run this script with `node ./scripts/generateCountriesContract/index.js`

This script reads countries.csv and the csv files in regions/ to generate
a solidity file (result.sol), which can be used for the IsoCountries100 contract
found in contracts/src/commons-standards/contracts/IsoCountries100.sol

If a result.sol file already exists, it will be overwritten by re-running the script

*/

const csv = require("csvtojson");
const fs = require("fs");
const path = require("path");
const CSV_FILE_PATH = path.resolve(__dirname, "countries.csv");
const RESULT_FILE_PATH = path.resolve(__dirname, "result.sol");
const {
  newLine,
  heading,
  openContract,
  openConstructor,
  countryInitializeComment,
  initializeCountryAndAddToCountryKeys,
  initializeRegionAndAddToRegionKeys,
  closeConstructor,
  defineCountryRegistrationFunction,
  defineRegionRegistrationFunction,
  closeContract
} = require("./snippets");

(async function() {
  /* -------------- REMOVE EXISTING RESULT FILE -------------- */
  if (fs.existsSync(RESULT_FILE_PATH)) {
    fs.unlinkSync(RESULT_FILE_PATH);
  }

  /* -------------- ADD PRE-CONTRACT DEFINITION STUFF -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, heading);

  /* -------------- START CONTRACT DEFINITION -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, openContract);
  
  /* -------------- OPEN CONTRACT CONSTRUCTOR -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, openConstructor);
  
  /* -------------- INITIALIZE COUNTRIES AND THEIR REGIONS -------------- */
  // country obj keys: name, alpha2, alpha3, numeric, subdivisions, independent
  // region obj keys: code, name, category
  const countries = await csv().fromFile(CSV_FILE_PATH);
  const countryPromises = countries.map(async country => {
    fs.appendFileSync(RESULT_FILE_PATH, countryInitializeComment(country.name));
    fs.appendFileSync(
      RESULT_FILE_PATH,
      initializeCountryAndAddToCountryKeys(country)
    );
    let regions = [];
    const REGION_FILE_PATH = path.resolve(
      __dirname,
      "regions",
      `${country.alpha2}.csv`
    );
    if (fs.existsSync(REGION_FILE_PATH)) {
      regions = await csv().fromFile(REGION_FILE_PATH);
    }
    regions.forEach(({ code, name }) => {
      const codes = code.split("-");
      const code2 = codes[1].length <= 2 ? codes[1] : "";
      const code3 = codes[1].length === 3 ? codes[1] : "";
      fs.appendFileSync(
        RESULT_FILE_PATH,
        initializeRegionAndAddToRegionKeys({
          alpha2: country.alpha2,
          code2,
          code3,
          name
        })
      );
    });
    fs.appendFileSync(RESULT_FILE_PATH, newLine);
  });
  await Promise.all(countryPromises);

  /* -------------- CLOSE CONTRACT CONSTRUCTOR -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, closeConstructor);

  /* -------------- DEFINE COUNTRY REGISTRATION FUNCTION -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, defineCountryRegistrationFunction);

  /* -------------- DEFINE REGION REGISTRATION FUNCTION -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, defineRegionRegistrationFunction);

  /* -------------- CLOSE CONTRACT -------------- */
  fs.appendFileSync(RESULT_FILE_PATH, closeContract);
})();
