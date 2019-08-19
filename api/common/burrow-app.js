const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const util = require('util');
const logger = require('./logger');

(function bootstrapApp() {
  const log = logger.getLogger('burrow');

  // EventEmitter
  function AppEvents() {
    EventEmitter.call(this);
  }

  util.inherits(AppEvents, EventEmitter);

  /**
   * Returns the JSON object representing the abi of the given contract
   * @param {string} abiPath representing the location of the abi file
   * @param {string} contractName name of the contract with or without the .abi extension
   * @returns {Object} ABI as JSON object
   */
  const getAbi = (abiPath, contractName) => {
    let fullPath = path.join(abiPath, contractName);
    if (!fs.existsSync(fullPath)) {
      fullPath = (path.join(abiPath, contractName)).concat('.bin');
    }
    return JSON.parse(fs.readFileSync(fullPath)).Abi;
  };

  /**
   * Constructor
   */
  function Manager(db, dougAddress, dougABI) {
    const self = this;
    log.info(`Creating a new application manager for DOUG at address: ${dougAddress}`);
    self.db = db;
    // Attempt to resolve the DOUG abi, if not provided.
    const _dougABI = dougABI || getAbi(process.env.API_ABI_DIRECTORY, 'DOUG');
    self.doug = db.burrow.contracts.new(_dougABI, null, dougAddress);
    self.contracts = {};
    self.listen = new AppEvents();
  }

  /**
     * Returns a promise to load the details for the contract registered under the provided name from DOUG.
     * The contract is stored in the Manager's contracts array as an object with the following fields:
     * { abi: abiJsonObject,
     *   address: "0x234294...",
     *   factory: contractFactory.at(address)
     * }
     */
  Manager.prototype.loadContract = function _loadContract(name, abi) {
    return new Promise((resolve, reject) => {
      const self = this;
      self.contracts[name] = {};
      self.contracts[name].abi = abi || getAbi(process.env.API_ABI_DIRECTORY, name);
      if (log.isDebugEnabled()) {
        log.debug(`Loading contract ${name}`);
      }
      self.doug.lookup(name, (err, data) => {
        if (err) return reject(err);
        let retAddress = data.raw[0].valueOf();
        retAddress = (retAddress.slice(0, 2) === '0x') ? retAddress.slice(2) : retAddress;
        if (Number(retAddress) === 0) return reject(new Error(`DOUG cannot find a registered contract ${name}`));
        self.contracts[name].address = retAddress;
        log.debug(`DOUG resolved contract <${name}> to address: ${self.contracts[name].address}`);
        self.contracts[name].factory = self.db.burrow.contracts.new(self.contracts[name].abi, null, self.contracts[name].address);
        log.info(`Contract <${name}> successfully loaded from DOUG.`);
        return resolve();
      });
    });
  };

  Manager.prototype.events = {};

  module.exports = {
    Manager,
    getAbi,
  };
}());
