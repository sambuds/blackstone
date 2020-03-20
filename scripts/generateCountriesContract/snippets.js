module.exports = {
  newLine: `
`,

  heading: `pragma solidity ^0.4.23;

import "./IsoCountries.sol";
    
//** Country: https://en.wikipedia.org/wiki/ISO_3166-1
//** Regions: https://en.wikipedia.org/wiki/ISO_3166-2

`,

  openContract: `contract IsoCountries100 is VersionLinkedAppendOnly([1,0,0]), IsoCountries {
    // Country keys are held as dedicated bytes2 values. 
    // The key matches the ISO 3166-1 Alpha2 code of the country.
    // The key will also match the country code of the region struct.
    // This key is to be used by other contracts as the primary key to reference the country.
    // Region keys are hashes of the country key and bytes3 region code
`,

  openConstructor: `
    /**
    * @dev Constructor
    */
    constructor() public {
`,

  countryInitializeComment: countryName => `        /** ${countryName.toUpperCase()} INITIALIZATION */
`,

  initializeCountryAndAddToCountryKeys: ({
    alpha2,
    alpha3,
    numeric,
    name
  }) => `        registerCountry("${alpha2}", "${alpha3}", "${numeric}", "${name}");
`,

  initializeRegionAndAddToRegionKeys: ({
    alpha2,
    code2,
    code3,
    name
  }) => `        registerRegion("${alpha2}", "${code2}", "${code3}", "${name}", keccak256(abi.encodePacked("${alpha2}", "${code2 ||
    code3}")));
`,

  closeConstructor: `    }
`,

  defineCountryRegistrationFunction: `
    function registerCountry(bytes2 _alpha2, bytes3 _alpha3, bytes3 _m49, string _name) internal returns (Country) {
        bytes32[] memory regionKeys;
        countries[_alpha2] = Country({ alpha2: _alpha2, alpha3: _alpha3, m49: _m49, name: _name, regionKeys: regionKeys, exists: true });
        countryKeys.push(_alpha2);
    }
`,

  defineRegionRegistrationFunction: `
    function registerRegion(bytes2 _alpha2, bytes2 _code2, bytes3 _code3, string _name, bytes32 regionKey) internal returns (Region) {
        countries[_alpha2].regions[regionKey] = Region({ country: _alpha2, code2: _code2, code3: _code3, name: _name, exists: true });
        countries[_alpha2].regionKeys.push(regionKey);
    }
`,

  closeContract: `
}
`
};
