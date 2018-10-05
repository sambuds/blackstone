const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const util = require('util');
const boom = require('boom');

const logger = require(`${global.__common}/monax-logger`);
const monaxUtils = require(`${global.__common}/monax-utils`);
const monaxDB = require(`${global.__common}/monax-db`);
const monaxApp = require(`${global.__common}/monax-app`);
const SqlCache = require(`${global.__common}/monax-sqlsol`);

const {
  DATA_TYPES,
  ERROR_CODES: ERR,
} = global.__monax_constants;

/**
 * This module provides the application-specific functions for Active Agreements
 */

const log = logger.getLogger('agreements.contracts');

const events = {
  NEW_MESSAGE: 'newMessage',
};

// Set up event emitter
function ChainEventEmitter() {
  EventEmitter.call(this);
}
util.inherits(ChainEventEmitter, EventEmitter);
const chainEvents = new ChainEventEmitter();

// Instantiate connection to node
const serverAccount = global.__settings.monax.accounts.server;
const db = new monaxDB.Connection(
  global.__settings.monax.chain.host || 'localhost',
  global.__settings.monax.chain.port || '32770',
  serverAccount,
);

let appManager;
const cache = new SqlCache(':memory:', serverAccount);

const boomify = (burrowError, message) => {
  const arr = burrowError.message ? burrowError.message.split('::') : [];
  const parsedError = {
    code: arr[0] || '',
    location: arr[1] || '',
    message: arr[2] || '',
  };
  let error;
  switch (parsedError.code) {
    case ERR.UNAUTHORIZED:
      error = boom.unauthorized(`${message}: ${parsedError.message}`);
      break;
    case ERR.RESOURCE_NOT_FOUND:
      error = boom.notFound(`${message}: ${parsedError.message}`);
      break;
    case ERR.RESOURCE_ALREADY_EXISTS:
      error = boom.conflict(`${message}: ${parsedError.message}`);
      break;
    case ERR.INVALID_INPUT || ERR.INVALID_PARAMETER_STATE ||
    ERR.NULL_PARAMETER_NOT_ALLOWED || ERR.OVERWRITE_NOT_ALLOWED:
      error = boom.badRequest(`${message}: ${parsedError.message}`);
      break;
    case ERR.RUNTIME_ERROR || ERR.INVALID_STATE || ERR.DEPENDENCY_NOT_FOUND:
      error = boom.badImplementation(`${message}: ${parsedError.message}`);
      break;
    default:
      error = boom.badImplementation(`${message}: ${burrowError ? parsedError.message : 'Unknown Error'}`);
      break;
  }
  return error;
};

/**
 * Returns the JS representation of the deplopyed contract
 * @param {string} abiPath representing the location of the abi file
 * @param {*} contractName name of the contract with or without the .abi extension
 * @param {*} contractAddress address of the deployed contract
 */
const getContract = (abiPath, contractName, contractAddress) => {
  const abi = monaxApp.getAbi(abiPath, contractName);
  return db.burrow.contracts.new(abi, null, contractAddress);
};

const createEcosystem = name => new Promise((resolve, reject) => {
  log.trace(`Creating new Ecosystem with name ${name}`);
  appManager.contracts['EcosystemRegistry'].factory.createEcosystem(name, (err, data) => {
    if (err || !data.raw) return reject(boomify(err, `Failed to create and register Ecosystem ${name}: ${err.stack}`));
    log.debug(`Created and registered Ecosystem ${name} at ${data.raw[0]}`);
    return resolve(data.raw[0]);
  });
});

const addExternalAddressToEcosystem = externalAddress => new Promise((resolve, reject) => {
  log.trace(`Adding external address ${externalAddress} to Ecosystem at ${appManager.ecosystemAddress}`);
  const ecosystem = getContract(global.__abi, global.__monax_bundles.COMMONS_AUTH.contracts.ECOSYSTEM, appManager.ecosystemAddress);
  ecosystem.addExternalAddress(externalAddress, (err) => {
    if (err) return reject(boom.badImplementation(`Failed to add external address ${externalAddress} to ecosystem at ${appManager.ecosystemAddress}: ${err.stack}`));
    log.debug(`Added external address ${externalAddress} to ecosystem at ${appManager.ecosystemAddress}`);
    return resolve();
  });
});

const setToNameRegistry = (name, value, lease) => new Promise((resolve, reject) => {
  log.trace(`Setting to name registry: ${JSON.stringify({ name, value, lease })}`);
  db.burrow.namereg.set(name, value, lease, (err) => {
    if (err) return reject(boom.badImplementation(`Error setting ${JSON.stringify({ name, value, lease })} to namereg: ${err.stack}`));
    log.debug(`Set name-value pair ${name}:${value} to namereg`);
    return resolve();
  });
});

const getFromNameRegistry = name => new Promise((resolve, reject) => {
  log.trace(`Getting from name registry: ${name}`);
  db.burrow.namereg.get(name, (err, result) => {
    if (err && err.code !== 2) { // 2 UNKNOWN = entry does not exist
      return reject(boom.badImplementation(`Error getting entry for <${name}> from namereg: ${err.stack}`));
    }
    log.debug(`Get name-value pair ${name}:${JSON.stringify(result)} from namereg`);
    return resolve((result && result.Data) ? result.Data : undefined);
  });
});

/**
 * Uses the configuration 'monax.contracts.load' in the settings to create a number of promises, each loading one of the configured contracts from
 * the DOUG contract and populating the contracts[] in the appManager.
 */
const load = () => new Promise((resolve, reject) => {
  // Get DOUG address first
  db.burrow.namereg.get('DOUG', (error, DOUG) => {
    if (error) return reject(error);
    log.debug(`Creating AppManager with DOUG at address: ${DOUG}`);
    appManager = new monaxApp.Manager(db, DOUG.Data);
    return resolve(DOUG);
  });
}).then(() => {
  // Then load the modules
  let modules = [];
  // load registered modules from settings
  if (global.__settings.monax.contracts && global.__settings.monax.contracts.load) {
    modules = monaxUtils.getArrayFromString(global.__settings.monax.contracts.load);
    log.debug(`Detected ${modules.length} contract modules to be loaded from DOUG: ${modules}`);
  }
  // create promises to load the contracts
  const loadPromises = [];
  modules.forEach(m => loadPromises.push(appManager.loadContract(m)));
  return Promise.all(loadPromises);
}).then(() => new Promise(async (resolve, reject) => {
  // Lastly, ensure Ecosystem setup
  // Resolve the Ecosystem address for this ContractsManager
  if (global.__settings.monax.ecosystem) {
    const ecosystemName = global.__settings.monax.ecosystem;
    log.trace(`Looking up address for Ecosystem ${ecosystemName} in NameReg`);
    try {
      appManager.ecosystemAddress = await getFromNameRegistry(ecosystemName);
      if (!appManager.ecosystemAddress) {
        log.info(`No registered address found for Ecosystem ${ecosystemName}. Attempting to create and register it ...`);
        appManager.ecosystemAddress = await createEcosystem(ecosystemName);
        await addExternalAddressToEcosystem(db.burrow.account);
        await setToNameRegistry(ecosystemName, appManager.ecosystemAddress, 0);
      }
      // This should not happen, but just in case, double-check the AppManager.ecosystemAddress
      if (!appManager.ecosystemAddress) {
        return reject(boom.badImplementation('Failed to configure the AppManager with an ecosystem address'));
      }
      log.info(`AppManager configured for Ecosystem ${ecosystemName} at address ${appManager.ecosystemAddress}`);
      resolve();
    } catch (err) {
      return reject(err);
    }
  }
  return reject(boom.badImplementation('No Ecosystem name set. Unable to start API ...'));
}));

/**
 * Loads information from contracts into the sql cache as configured via the sqlsol/ directory.
 * Note: The contract matching the .json filename must already be loaded in the appManager.
 */
const initCache = () => {
  const cachePromises = [];
  fs.readdirSync(global.__sqlsol).forEach((file) => {
    if (file.endsWith('.json')) {
      if (log.isDebugEnabled()) {
        log.debug(`Processing SQLSOL configuration: ${file}`);
      }
      const structDef = JSON.parse(fs.readFileSync(`${global.__sqlsol}/${file}`));
      const { name } = path.parse(file);
      cachePromises.push(cache.add(appManager.contracts[name].factory, structDef, name));
    }
  });
  return Promise.all(cachePromises);
};

const getBpmService = () => appManager.contracts['BpmService'].address;

const getWorkflowUserAccount = userAddr => getContract(global.__abi, global.__monax_bundles.BPM_RUNTIME.contracts.WORKFLOW_USER_ACCOUNT, userAddr);

const getOrganization = orgAddr => getContract(global.__abi, global.__monax_bundles.PARTICIPANTS_MANAGER.contracts.ORGANIZATION, orgAddr);

/**
 * Creates a promise to create a new organization and add to Accounts Manager.
 * @param organization
 */
const createOrganization = org => new Promise((resolve, reject) => {
  log.trace(`Creating organization with: ${JSON.stringify(org)}`);
  appManager.contracts['ParticipantsManager'].factory.createOrganization(org.approvers ? org.approvers : [], org.defaultDepartmentName || '', (error, data) => {
    if (error || !data.raw) return reject(boom.badImplementation(`Failed to create organization ${org.name}: ${error}`));
    if (parseInt(data.raw[0], 10) === 1002) return reject(boom.badRequest('Organization id must be unique'));
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom.badImplementation(`Error code creating new organization: ${data.raw[0]}`));
    }
    log.info(`Created new organization at address ${data.raw[1]}, with approvers ${org.approvers}`);
    return resolve(data.raw[1]);
  });
});

const createArchetype = (type) => {
  const archetype = type;
  archetype.isPrivate = archetype.isPrivate || false;

  // TODO remove once the UI updates
  archetype.formationProcessDefinition = archetype.formationProcessDefinition ||
    'A043C06EB2FB91F4811F51F6500744906FD0903E';
  archetype.executionProcessDefinition = archetype.executionProcessDefinition ||
    '81A817870C6C6A209150FA26BC52D835CA6E17D2';

  archetype.price = Math.floor(archetype.price * 100); // monetary unit conversion to cents which is the recorded unit on chain

  return new Promise((resolve, reject) => {
    log.trace(`Creating archetype with: ${JSON.stringify(archetype)}`);
    appManager.contracts['ArchetypeRegistry'].factory.createArchetype(
      archetype.price,
      archetype.isPrivate,
      archetype.active,
      archetype.name,
      archetype.author,
      archetype.description,
      archetype.formationProcessDefinition,
      archetype.executionProcessDefinition,
      archetype.packageId,
      archetype.governingArchetypes,
      (error, data) => {
        if (error || !data.raw) return reject(boomify(error, `Failed to create archetype ${archetype.name}`));
        log.info(`Created new archetype ${archetype.name} at address ${data.raw[0]}`);
        return resolve(data.raw[0]);
      },
    );
  });
};

const isActiveArchetype = (archetypeAddress) => {
  const archetype = getContract(global.__abi, global.__monax_bundles.AGREEMENTS.contracts.ARCHETYPE, archetypeAddress);
  return new Promise((resolve, reject) => {
    archetype.isActive((err, data) => {
      if (err || !data.raw) {
        return reject(boom.badImplementation(`Failed to determine if archetype at ${archetypeAddress} is active: ${err}`));
      }
      return resolve(data.raw[0]);
    });
  });
};

const getArchetypeAuthor = (archetypeAddress) => {
  const archetype = getContract(global.__abi, global.__monax_bundles.AGREEMENTS.contracts.ARCHETYPE, archetypeAddress);
  return new Promise((resolve, reject) => {
    archetype.getAuthor((err, data) => {
      if (err || !data.raw) {
        return reject(boom.badImplementation(`Failed to get author of archetype at ${archetypeAddress}: ${err}`));
      }
      return resolve(data.raw[0]);
    });
  });
};

const activateArchetype = (archetypeAddress, userAccount) => {
  log.trace(`Activating archetype at ${archetypeAddress} by user at ${userAccount}`);
  return new Promise((resolve, reject) => {
    appManager.contracts['ArchetypeRegistry'].factory.activate(archetypeAddress, userAccount, (err) => {
      if (err) return reject(boomify(err, `Failed to activate archetype at ${archetypeAddress} by user ${userAccount}`));
      log.info(`Archetype at ${archetypeAddress} activated by user at ${userAccount}`);
      return resolve();
    });
  });
};

const deactivateArchetype = (archetypeAddress, userAccount) => {
  log.trace(`Deactivating archetype at ${archetypeAddress} by user at ${userAccount}`);
  return new Promise((resolve, reject) => {
    appManager.contracts['ArchetypeRegistry'].factory.deactivate(archetypeAddress, userAccount, (err) => {
      if (err) return reject(boomify(err, `Failed to activate archetype at ${archetypeAddress} by user ${userAccount}`));
      log.info(`Archetype at ${archetypeAddress} deactivated by user at ${userAccount}`);
      return resolve();
    });
  });
};

const setArchetypeSuccessor = (archetypeAddress, successorAddress, userAccount) => {
  log.trace(`Setting successor to ${successorAddress} for archetype at ${archetypeAddress} by user at ${userAccount}`);
  return new Promise((resolve, reject) => {
    appManager.contracts['ArchetypeRegistry'].factory.setArchetypeSuccessor(archetypeAddress, successorAddress, userAccount, (err) => {
      if (err) return reject(boomify(err, `Failed to set successor to ${successorAddress} for archetype at ${archetypeAddress} by user at ${userAccount}`));
      log.info(`Successfully set successor to ${successorAddress} for archetype at ${archetypeAddress} by user at ${userAccount}`);
      return resolve();
    });
  });
};

const getArchetypeSuccessor = (archetypeAddress) => {
  log.trace(`Getting successor for archetype at ${archetypeAddress}`);
  return new Promise((resolve, reject) => {
    appManager.contracts['ArchetypeRegistry'].factory.getArchetypeSuccessor(archetypeAddress, (err, data) => {
      if (err) return reject(boomify(err, `Failed to get successor for archetype at ${archetypeAddress}`));
      log.info(`Successfully retrieved successor for archetype at ${archetypeAddress}`);
      return resolve(data.raw[0]);
    });
  });
};

// TODO configuration currently not supported until new specification is clear, i.e. which fields will be included in the configuration
// const configureArchetype = (address, config) => {
//   return new Promise(function (resolve, reject) {
//     log.trace(`Configuring archetype at address ${address} with: ${JSON.stringify(config)}`);
//     appManager.contracts['ArchetypeRegistry'].factory.configure(
//       address,
//       config.numberOfParticipants,
//       config.termination,
//       config.fulfillment,
//       config.amount,
//       config.currency,
//       (error, data) => {
//         if (error) {
//           return reject(boom.badImplementation(
//             `Failed to configure archetype at ${address}: ${error}`));
//         }
//         if (data.raw[0] != 1) {
//           return reject(boom.badImplementation(
//             'Error code configuring archetype ' + address + ': ' + data.raw[0]));
//         }
//         return resolve();
//       });
//   });
// };

const addArchetypeParameters = (address, parameters) => new Promise((resolve, reject) => {
  const paramTypes = [];
  const paramNames = [];
  for (let i = 0; i < parameters.length; i += 1) {
    paramTypes[i] = parseInt(parameters[i].type, 10);
    paramNames[i] = global.stringToHex(parameters[i].name);
  }
  log.trace(`Adding archetype parameters to archetype add address ${address}. ` +
    `Parameter Types: ${JSON.stringify(paramTypes)}, Parameter Names: ${JSON.stringify(paramNames)}`);
  appManager
    .contracts['ArchetypeRegistry']
    .factory.addParameters(address, paramTypes, paramNames, (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to add parameters to archetype at ${address}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code adding parameter to archetype at ${address}: ${data.raw[0]}`));
      }
      log.info(`Added parameters ${paramNames} to archetype at ${address}`);
      return resolve();
    });
});

const addArchetypeDocument = (address, name, hoardAddress, secretKey) => new Promise((resolve, reject) => {
  appManager
    .contracts['ArchetypeRegistry']
    .factory.addDocument(address, name, hoardAddress, secretKey, (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to add document to archetype at ${address}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code adding document to archetype at ${address}: ${data.raw[0]}`));
      }
      log.info(`Added document to archetype ${address}`);
      return resolve();
    });
});

const addArchetypeDocuments = async (address, documents) => {
  log.trace(`Adding archetype documents to archetype at ${address}: ${JSON.stringify(documents)}`);
  const resolvedDocs = await Promise.all(documents.map(async (doc) => {
    const result = await addArchetypeDocument(address, doc.name, doc.hoardAddress, doc.secretKey);
    return result;
  }));
  return resolvedDocs;
};

const setArchetypePrice = (address, price) => new Promise((resolve, reject) => {
  log.trace(`Setting price to ${price} for archetype at ${address}`);
  const priceInCents = Math.floor(price * 100); // monetary unit conversion to cents which is the recorded unit on chain
  appManager.contracts['ArchetypeRegistry'].factory.setArchetypePrice(address, priceInCents, (err) => {
    if (err) return reject(boom.badImplementation(`Failed to set price to ${price} for archetype at ${address}`));
    log.info(`Set price to ${price} for archetype at ${address}`);
    return resolve();
  });
});

const createArchetypePackage = (name, description, author, isPrivate, active) => new Promise((resolve, reject) => {
  log.trace(`Adding a ${(isPrivate ? 'private' : 'public')}, ${(active ? 'active' : 'inactive')} archetype package with name ${name}, ` +
    `and description ${description}, created by user at ${author}`);
  appManager
    .contracts['ArchetypeRegistry']
    .factory.createArchetypePackage(name, description, author, isPrivate, active, (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to add archetype package ${name}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code adding archetype package ${name}: ${data.raw[0]}`));
      }
      log.info(`Created new archetype package ${name} with id ${data.raw[1]}`);
      return resolve(data.raw[1]);
    });
});

const activateArchetypePackage = (packageId, userAccount) => new Promise((resolve, reject) => {
  log.trace(`Activating archetype package with id ${packageId} by user at ${userAccount}`);
  appManager.contracts['ArchetypeRegistry'].factory.activatePackage(packageId, userAccount, (err) => {
    if (err) {
      return reject(boomify(err, `Failed to activate archetype package with id ${packageId} by user ${userAccount}`));
    }
    log.info(`Archetype package with id ${packageId} activated by user at ${userAccount}`);
    return resolve();
  });
});

const deactivateArchetypePackage = (packageId, userAccount) => new Promise((resolve, reject) => {
  log.trace(`Deactivating archetype package with id ${packageId} by user at ${userAccount}`);
  appManager
    .contracts['ArchetypeRegistry'].factory.deactivatePackage(packageId, userAccount, (err) => {
      if (err) {
        return reject(boomify(err, `Failed to deactivate archetype package with id ${packageId} by user ${userAccount}`));
      }
      log.info(`Archetype package with id ${packageId} deactivated by user at ${userAccount}`);
      return resolve();
    });
});

const addArchetypeToPackage = (packageId, archetype) => new Promise((resolve, reject) => {
  log.trace(`Adding archetype at ${archetype} to package ${packageId}`);
  appManager
    .contracts['ArchetypeRegistry']
    .factory.addArchetypeToPackage(packageId, archetype, (err) => {
      if (err) {
        return reject(boomify(err, `Failed to add archetype at ${archetype} to package ${packageId}`));
      }
      log.info(`Added archetype at ${archetype} to package with id ${packageId}`);
      return resolve();
    });
});

const addJurisdictions = (address, jurisdictions) => new Promise((resolve, reject) => {
  const countries = [];
  const regions = [];
  jurisdictions.forEach((item) => {
    if (item.regions.length > 0) {
      item.regions.forEach((region) => {
        countries.push(global.stringToHex(item.country));
        regions.push(region);
      });
    } else {
      countries.push(global.stringToHex(item.country));
      regions.push('');
    }
  });
  log.trace(`Adding jurisdictions to archetype at ${address}. ` +
    `Countries: ${JSON.stringify(countries)}, Regions: ${JSON.stringify(regions)}`);
  appManager.contracts['ArchetypeRegistry'].factory.addJurisdictions(
    address,
    countries,
    regions,
    (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to add juridictions to archetype at ${address}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code adding jurisdictions to archetype at ${address}: ${data.raw[0]}`));
      }
      log.info(`Added jurisdictions to archetype at ${address}`);
      return resolve();
    },
  );
});

const createAgreement = agreement => new Promise((resolve, reject) => {
  const {
    archetype,
    name,
    creator,
    hoardAddress,
    hoardSecret,
    parties,
    collectionId,
    governingAgreements,
  } = agreement;
  const isPrivate = agreement.isPrivate || false;
  log.trace(`Creating agreement with following data: ${JSON.stringify(agreement)}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.createAgreement(archetype, name, creator, hoardAddress, hoardSecret, isPrivate,
      parties, collectionId, governingAgreements, (error, data) => {
        if (error || !data.raw) {
          return reject(boomify(error, `Failed to create agreement ${agreement.name} from archetype at ${agreement.archetype}`));
        }
        log.info(`Created agreement ${agreement.name} at address ${data.raw[0]}`);
        return resolve(data.raw[0]);
      });
});

const setMaxNumberOfEvents = (agreementAddress, maxNumberOfEvents) => new Promise((resolve, reject) => {
  log.trace(`Setting max number of events to ${maxNumberOfEvents} for agreement at ${agreementAddress}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.setMaxNumberOfEvents(agreementAddress, maxNumberOfEvents, (error) => {
      if (error) {
        return reject(boom.badImplementation(`Failed to set max number of events to ${maxNumberOfEvents} for agreement at ${agreementAddress}: ${error}`));
      }
      log.info(`Set max number of events to ${maxNumberOfEvents} for agreement at ${agreementAddress}`);
      return resolve();
    });
});

const setAddressScopeForAgreementParameters = async (agreementAddr, parameters) => {
  log.trace(`Adding scopes to agreement ${agreementAddr} parameters: ${JSON.stringify(parameters)}`);
  const agreement = getContract(global.__abi, global.__monax_bundles.AGREEMENTS.contracts.ACTIVE_AGREEMENT, agreementAddr);
  const promises = parameters.map(({ name, value, scope }) => new Promise((resolve, reject) => {
    agreement.setAddressScope(value, name, scope, '', '', '0x0', (err) => {
      if (err) {
        return reject(boomify(err, `Failed to add scope ${scope} to address ${value} in context ${name}`));
      }
      return resolve();
    });
  }));
  try {
    await Promise.all(promises);
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
};

const updateAgreementEventLog = (agreementAddress, hoardRef) => new Promise((resolve, reject) => {
  log.trace(`Updating event log hoard reference for agreement at ${agreementAddress} with new hoard reference ${JSON.stringify(hoardRef)}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.setEventLogReference(agreementAddress, hoardRef.address, hoardRef.secretKey, (error) => {
      if (error) {
        return reject(boom.badImplementation(`Failed to update event log for agreement at ${agreementAddress}: ${error}`));
      }
      log.info(`Event log hoard reference updated for agreement at ${agreementAddress}`);
      return resolve();
    });
});

const cancelAgreement = (userAddr, agreementAddr) => new Promise((resolve, reject) => {
  const userAccount = getContract(global.__abi, global.__monax_bundles.AGREEMENTS.contracts.AGREEMENT_PARTY_ACCOUNT, userAddr);
  log.trace(`Canceling agreement at address ${agreementAddr}, by user at address: ${userAddr}`);
  userAccount.cancelAgreement(agreementAddr, (err) => {
    if (err) {
      return reject(boomify(err, `Failed to cancel agreement at ${agreementAddr}`));
    }
    log.info(`Agreement at ${agreementAddr} canceled by user at ${userAddr}`);
    return resolve();
  });
});

const createAgreementCollection = (name, author, collectionType, packageId) => new Promise((resolve, reject) => {
  log.trace(`Adding agreement collection ${name} with type ${collectionType} ` +
    `and packageId ${packageId} created by user at ${author}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.createAgreementCollection(name, author, collectionType, packageId, (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to add agreement collection ${name}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code adding agreement collection ${name}: ${data.raw[0]}`));
      }
      log.info(`Created new agreement collection ${name} with id ${data.raw[1]}`);
      return resolve(data.raw[1]);
    });
});

const addAgreementToCollection = (collectionId, agreement) => new Promise((resolve, reject) => {
  log.trace(`Adding agreement at ${agreement} to collection ${collectionId}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.addAgreementToCollection(collectionId, agreement, (err) => {
      if (err) {
        return reject(boomify(err, `Failed to add agreement at ${agreement} to collection ${collectionId}`));
      }
      log.info(`Added agreement at ${agreement} to collection with id ${collectionId}`);
      return resolve();
    });
});

const createUser = user => new Promise((resolve, reject) => {
  log.trace(`Creating a new user with ID: ${user.id}`);
  const accountsManager = appManager.contracts['ParticipantsManager'].address;
  const idHex = global.stringToHex(user.id);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.createUserAccount(accountsManager, idHex, '0x0', appManager.ecosystemAddress, (error, data) => {
      if (error || !data.raw) {
        return reject(boom.badImplementation(`Failed to create user ${user.id}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom.badImplementation(`Error code creating new user with id ${user.id}: ${data.raw[0]}`));
      }
      log.info(`Created new user ${user.id} at address ${data.raw[1]}`);
      return resolve(data.raw[1]);
    });
});

const getUserById = userId => new Promise((resolve, reject) => {
  // TODO: If decided later that address in sqlsol does not need to be checked against address on chain
  // when loggin in, this function should be modified so it just returns the address of the user
  // using ['ParticipantsManager'].factory.getUserAccount(id)
  // getUserAccountDataById was added so we can get the hashed id to query sqlsol
  log.trace(`Getting user by Id: ${userId}`);
  const idHex = global.stringToHex(userId);
  appManager
    .contracts['ParticipantsManager']
    .factory.getUserAccountDataById(idHex, (error, data) => {
      if (error || !data.raw) return reject(boom.badImplementation(`Failed to get data for user ${userId}: ${error}`));
      if (parseInt(data.raw[0], 10) === 1001) return reject(boom.notFound(`User ${userId} not found`));
      if (parseInt(data.raw[0], 10) !== 1) return reject(boom.badImplementation(`Error code validating user: ${data.raw[0]}`));
      return resolve({
        address: data.raw[1],
        hashedId: data.raw[2],
      });
    });
});

const addUserToOrganization = (userAccount, organization) => new Promise((resolve, reject) => {
  log.trace(`Adding user ${userAccount} to organization ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.addUser(userAccount, (error, data) => {
    if (error || !data.raw) {
      return reject(boom.badImplementation(`Failed to add user at ${userAccount} to organization at ${organization}: ${error}`));
    }
    if (data.raw[0] !== true) {
      return reject(boom.badImplementation(`Expected addUser ${userAccount} to ${organization} to return true`));
    }
    log.info(`User at ${userAccount} added to organization at ${organization}`);
    return resolve();
  });
});

const removeUserFromOrganization = (userAccount, organization) => new Promise((resolve, reject) => {
  log.trace(`Removing user ${userAccount} from organization ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.removeUser(userAccount, (error, data) => {
    if (error || !data.raw) {
      return reject(boom.badImplementation(`Failed to remove user at ${userAccount} from organization at ${organization}: ${error}`));
    }
    if (data.raw[0] === false) {
      return reject(boom.badRequest(`${userAccount} not a member of ${organization}`));
    }
    log.info(`User at ${userAccount} removed from organization at ${organization}`);
    return resolve();
  });
});

const createDepartment = (organization, { id, name }) => new Promise((resolve, reject) => {
  log.trace(`Creating department ${id} with name ${name} under organization at ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.addDepartment(id, name, (error, data) => {
    if (error || !data || !data.raw) {
      return reject(boom.badImplementation(`Failed to add department to organization at ${organization}`));
    }
    if (parseInt(data.raw[0], 10) === 1002) {
      return reject(boom.badRequest(`Department with id ${id} already exists in organization at ${organization}`));
    }
    log.info(`Department ${id} added to organization at ${organization}`);
    return resolve();
  });
});

const removeDepartment = (organization, depId) => new Promise((resolve, reject) => {
  log.trace(`Removing department ${depId} from organization at ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.removeDepartment(depId, (error, data) => {
    if (error || !data || !data.raw) {
      return reject(boom.badImplementation(`Failed to remove department from organization at ${organization}`));
    }
    if (data.raw[0] === false) {
      return reject(boom.badRequest(`Department ${depId} does not exist in organization ${organization}`));
    }
    log.info(`Department ${depId} removed from organization at ${organization}`);
    return resolve();
  });
});

const addDepartmentUser = (organization, depId, userAccount) => new Promise((resolve, reject) => {
  log.trace(`Adding user ${userAccount} to department ${depId} under organization at ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.addUserToDepartment(userAccount, depId, (error, data) => {
    if (error || !data || !data.raw) {
      return reject(boom.badImplementation(`Failed to add user ${userAccount} to department ${depId} in organization ${organization}`));
    }
    if (data.raw[0] === false) {
      return reject(boom.badRequest(`User ${userAccount} already belongs to department ${depId} or ${depId} does not exist`));
    }
    log.info(`User ${userAccount} added to department ${depId} in organization at ${organization}`);
    return resolve();
  });
});

const removeDepartmentUser = (organization, depId, userAccount) => new Promise((resolve, reject) => {
  log.trace(`Removing user ${userAccount} from department ${depId} under organization at ${organization}`);
  const orgContract = getOrganization(organization);
  orgContract.removeUserFromDepartment(userAccount, depId, (error, data) => {
    if (error || !data || !data.raw) {
      return reject(boom.badImplementation(`Failed to remove user ${userAccount} from department ${depId} in organization ${organization}`));
    }
    if (data.raw[0] === false) {
      return reject(boom.badRequest(`User ${userAccount} is not a member of department ${depId}`));
    }
    log.info(`User ${userAccount} removed from department ${depId} in organization at ${organization}`);
    return resolve();
  });
});

const createProcessModel = (modelId, modelName, modelVersion, author, isPrivate, hoardAddress, hoardSecret) => new Promise((resolve, reject) => {
  log.trace(`Creating process model with following data: ${JSON.stringify({
    modelId, modelName, modelVersion, author, isPrivate, hoardAddress, hoardSecret,
  })}`);
  const modelIdHex = global.stringToHex(modelId);
  const modelNameHex = global.stringToHex(modelName);
  appManager
    .contracts['ProcessModelRepository']
    .factory.createProcessModel(modelIdHex, modelNameHex, modelVersion, author,
      isPrivate, hoardAddress, hoardSecret, (error, data) => {
        if (error || !data.raw) {
          return reject(boom
            .badImplementation(`Failed to create process model ${modelName} with id ${modelId}: ${error}`));
        }
        if (parseInt(data.raw[0], 10) === 1002) {
          return reject(boom.badRequest(`Model with id ${modelId} already exists`));
        }
        if (parseInt(data.raw[0], 10) !== 1) {
          return reject(boom
            .badImplementation(`Error code creating model ${modelName} with id ${modelId}: ${data.raw[0]}`));
        }
        log.info(`Model ${modelName} with Id ${modelId} created at ${data.raw[1]}`);
        return resolve(data.raw[1]);
      });
});

const addProcessInterface = (pmAddress, interfaceId) => new Promise((resolve, reject) => {
  const processModel = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_MODEL, pmAddress);
  log.trace(`Adding process interface ${interfaceId} to process model at ${pmAddress}`);
  const interfaceIdHex = global.stringToHex(interfaceId);
  processModel.addProcessInterface(interfaceIdHex, (err, data) => {
    if (err || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to add process interface ${interfaceId}to model at ${pmAddress}: ${err}`));
    }
    if (parseInt(data.raw[0], 10) === 1002) {
      // interfaceId already registered to model
      return resolve();
    }
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom
        .badImplementation(`Error code while adding process interface ${interfaceId} to model at ${pmAddress}: ${data.raw[0]}`));
    }
    log.info(`Interface ${interfaceId} added to Process Model at ${pmAddress}`);
    return resolve();
  });
});

const addParticipant = (pmAddress, participantId, accountAddress, dataPath, dataStorageId, dataStorageAddress) => new Promise((resolve, reject) => {
  const processModel = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_MODEL, pmAddress);
  log.trace(`Adding participant ${participantId} to process model at ${pmAddress} with data: ${JSON.stringify({
    accountAddress, dataPath, dataStorageId, dataStorageAddress,
  })}`);
  const participantIdHex = global.stringToHex(participantId);
  const dataPathHex = global.stringToHex(dataPath);
  const dataStorageIdHex = global.stringToHex(dataStorageId);
  log.debug(`Adding a participant with ID: ${participantId}`);
  processModel.addParticipant(participantIdHex, accountAddress, dataPathHex,
    dataStorageIdHex, dataStorageAddress, (err, data) => {
      if (err || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to add participant ${participantId} to model ${pmAddress}: ${err}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom
          .badImplementation(`Error code while adding participant ${participantId} to model ${pmAddress}: ${data.raw[0]}`));
      }
      log.info(`Participant ${participantId} added to model ${pmAddress}`);
      return resolve();
    });
});

const createProcessDefinition = (modelAddress, processDefnId) => new Promise((resolve, reject) => {
  const processModel = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_MODEL, modelAddress);
  log.trace(`Creating process definition with Id ${processDefnId} for process model ${modelAddress}`);
  const processDefnIdHex = global.stringToHex(processDefnId);
  processModel.createProcessDefinition(processDefnIdHex, (error, data) => {
    if (error || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to create process definition ${processDefnId} in model at ${modelAddress}: ${error}`));
    }
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom
        .badImplementation(`Error code creating process definition ${processDefnId} in model at ${modelAddress}: ${data.raw[0]}`));
    }
    log.info(`Process definition ${processDefnId} in model at ${modelAddress} created at ${data.raw[1]}`);
    return resolve(data.raw[1]);
  });
});

const addProcessInterfaceImplementation = (pmAddress, pdAddress, interfaceId) => new Promise((resolve, reject) => {
  log.trace(`Adding process interface implementation ${interfaceId} to process definition ${pdAddress} for process model ${pmAddress}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, pdAddress);
  const interfaceIdHex = global.stringToHex(interfaceId);
  processDefinition.addProcessInterfaceImplementation(pmAddress, interfaceIdHex, (err, data) => {
    if (err || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to add interface implementation ${interfaceId} to process at ${pdAddress}: ${err}`));
    }
    if (parseInt(data.raw[0], 10) === 1001) {
      return reject(boom
        .badData(`InterfaceId ${interfaceId} for process at ${pdAddress} is not registered to the model at ${pmAddress}`));
    }
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom
        .badImplementation(`Error code while adding process interface implementation ${interfaceId} to process at ${pdAddress}: ${data.raw[0]}`));
    }
    log.info(`Interface implementation ${interfaceId} added to Process Definition at ${pdAddress}`);
    return resolve();
  });
});

const createActivityDefinition = (processAddress, activityId, activityType, taskType, behavior, assignee, multiInstance, application, subProcessModelId, subProcessDefinitionId) => new Promise((resolve, reject) => {
  log.trace(`Creating activity definition with data: ${JSON.stringify({
    processAddress, activityId, activityType, taskType, behavior, assignee, multiInstance, application, subProcessModelId, subProcessDefinitionId,
  })}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition.createActivityDefinition(global.stringToHex(activityId), activityType, taskType, behavior,
    global.stringToHex(assignee), multiInstance, global.stringToHex(application), global.stringToHex(subProcessModelId),
    global.stringToHex(subProcessDefinitionId), (error, data) => {
      if (error || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to create activity definition ${activityId} in process at ${processAddress}: ${error}`));
      }
      if (parseInt(data.raw[0], 10) !== 1) {
        return reject(boom
          .badImplementation(`Error code creating activity definition ${activityId} in process at ${processAddress}: ${data.raw[0]}`));
      }
      log.info(`Activity definition ${activityId} created in process at ${processAddress}`);
      return resolve();
    });
});

const createDataMapping = (processAddress, id, direction, accessPath, dataPath, dataStorageId, dataStorage) => new Promise((resolve, reject) => {
  log.trace(`Creating data mapping with data: ${JSON.stringify({
    processAddress, id, direction, accessPath, dataPath, dataStorageId, dataStorage,
  })}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition
    .createDataMapping(global.stringToHex(id), direction, global.stringToHex(accessPath),
      global.stringToHex(dataPath), global.stringToHex(dataStorageId), dataStorage, (error) => {
        if (error) {
          return reject(boom
            .badImplementation(`Failed to create data mapping for activity ${id} in process at ${processAddress}: ${error}`));
        }
        log.info(`Data mapping created for activityId ${id} in process at ${processAddress}`);
        return resolve();
      });
});

const createGateway = (processAddress, gatewayId, gatewayType) => new Promise((resolve, reject) => {
  log.trace(`Creating gateway with data: ${JSON.stringify({ processAddress, gatewayId, gatewayType })}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition.createGateway(global.stringToHex(gatewayId), gatewayType, (error) => {
    if (error) {
      return reject(boom
        .badImplementation(`Failed to create gateway with id ${gatewayId} and type ${gatewayType} in process at ${processAddress}: ${error}`));
    }
    log.info(`Gateway created with id ${gatewayId} and type ${gatewayType} in process at ${processAddress}`);
    return resolve();
  });
});

const createTransition = (processAddress, sourceGraphElement, targetGraphElement) => new Promise((resolve, reject) => {
  log.trace(`Creating transition with data: ${JSON.stringify({
    processAddress, sourceGraphElement, targetGraphElement,
  })}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition.createTransition(global.stringToHex(sourceGraphElement), global.stringToHex(targetGraphElement), (error, data) => {
    if (error || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to create transition from ${sourceGraphElement} to ${targetGraphElement} in process at ${processAddress}: ${error}`));
    }
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom
        .badImplementation(`Error code creating transition from ${sourceGraphElement} to ${targetGraphElement} in process at ${processAddress}: ${data.raw[0]}`));
    }
    log.info(`Transition created from ${sourceGraphElement} to ${targetGraphElement} in process at ${processAddress}`);
    return resolve();
  });
});

const setDefaultTransition = (processAddress, gatewayId, activityId) => new Promise((resolve, reject) => {
  log.trace(`Setting default transition with data: ${JSON.stringify({ processAddress, gatewayId, activityId })}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition.setDefaultTransition(gatewayId, activityId, (error) => {
    if (error) {
      return reject(boom
        .badImplementation(`Failed to set default transition between gateway ${gatewayId} and activity ${activityId} in process at ${processAddress}: ${error}`));
    }
    log.info(`Default transition set between gateway ${gatewayId} and activity ${activityId} in process at ${processAddress}`);
    return resolve();
  });
});

const getTransitionConditionFunctionByDataType = (processAddress, dataType) => {
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  const functions = {};
  functions[`${DATA_TYPES.BOOLEAN}`] = processDefinition.createTransitionConditionForBool;
  functions[`${DATA_TYPES.STRING}`] = processDefinition.createTransitionConditionForString;
  functions[`${DATA_TYPES.BYTES32}`] = processDefinition.createTransitionConditionForBytes32;
  functions[`${DATA_TYPES.UINT}`] = processDefinition.createTransitionConditionForUint;
  functions[`${DATA_TYPES.INT}`] = processDefinition.createTransitionConditionForInt;
  functions[`${DATA_TYPES.ADDRESS}`] = processDefinition.createTransitionConditionForAddress;
  return functions[dataType];
};

const createTransitionCondition = (processAddress, dataType, gatewayId, activityId, dataPath, dataStorageId, dataStorage, operator, value) => new Promise((resolve, reject) => {
  log.trace(`Creating transition condition with data: ${JSON.stringify({
    processAddress, dataType, gatewayId, activityId, dataPath, dataStorageId, dataStorage, operator, value,
  })}`);
  const createFunction = getTransitionConditionFunctionByDataType(processAddress, dataType);
  createFunction(gatewayId, activityId, dataPath, dataStorageId, dataStorage, operator, value, (error) => {
    if (error) {
      return reject(boom.badImplementation('Failed to add transition condition for gateway id ' +
        `${gatewayId} and activity id ${activityId} in process at address ${processAddress}: ${error}`));
    }
    log.info(`Transition condition created for gateway id ${gatewayId} and activity id ${activityId} in process at address ${processAddress}`);
    return resolve();
  });
});

const signAgreementByUser = (userAddr, agreementAddr) => new Promise((resolve, reject) => {
  log.trace(`Signing agreement at address ${agreementAddr} by user at address ${userAddr}`);
  const userAccount = getContract(global.__abi, global.__monax_bundles.AGREEMENTS.contracts.AGREEMENT_PARTY_ACCOUNT, userAddr);
  userAccount.signAgreement(agreementAddr, (err) => {
    if (err) {
      return reject(boomify(err, `Failed to sign agreement ${agreementAddr} by user at ${userAccount}`));
    }
    log.info(`Agreement at ${agreementAddr} signed by user at ${userAddr}`);
    return resolve();
  });
});

const getCompletionFunctionByParamType = (userAddr, dataType) => {
  const userAccount = getContract(global.__abi, global.__monax_bundles.BPM_RUNTIME.contracts.WORKFLOW_USER_ACCOUNT, userAddr);
  if (!dataType) return userAccount.completeActivity;
  const completionFunctions = {};
  completionFunctions[`${DATA_TYPES.BOOLEAN}`] = userAccount.completeActivityWithBoolData;
  completionFunctions[`${DATA_TYPES.STRING}`] = userAccount.completeActivityWithStringData;
  completionFunctions[`${DATA_TYPES.BYTES32}`] = userAccount.completeActivityWithBytes32Data;
  completionFunctions[`${DATA_TYPES.UINT}`] = userAccount.completeActivityWithUintData;
  completionFunctions[`${DATA_TYPES.INT}`] = userAccount.completeActivityWithIntData;
  completionFunctions[`${DATA_TYPES.ADDRESS}`] = userAccount.completeActivityWithAddressData;
  return completionFunctions[dataType];
};

const completeActivityByUser = (userAddr, activityInstanceId, dataMappingId = null, dataType = null, value = null) => new Promise(async (resolve, reject) => {
  const bpmService = appManager.contracts['BpmService'].address;
  log.trace(`Completing task ${activityInstanceId} by user at address ${userAddr}`);
  const completionFunction = getCompletionFunctionByParamType(userAddr, dataType);
  try {
    let data;
    if (dataMappingId) {
      data = await completionFunction(activityInstanceId, bpmService, dataMappingId, value);
    } else {
      data = await completionFunction(activityInstanceId, bpmService);
    }
    if (!data.raw) return reject(boom.badImplementation(`Failed to complete activity ${activityInstanceId} by user at ${userAddr}`));
    if (parseInt(data.raw[0], 10) === 1001) return reject(boom.notFound(`No activity instance found with id ${activityInstanceId}`));
    if (parseInt(data.raw[0], 10) === 4103) return reject(boom.forbidden('User not authorized to complete activity'));
    if (parseInt(data.raw[0], 10) !== 1) return reject(boom.badImplementation(`Error code completing activity ${activityInstanceId} by user at ${userAddr}: ${data.raw[0]}`));
    log.info(`Activity ${activityInstanceId} completed by user ar ${userAddr}`);
    return resolve();
  } catch (err) {
    return reject(boom.badImplementation(`Failed to complete activity ${activityInstanceId} by user at ${userAddr}: ${err}`));
  }
});

const getModelAddressFromId = (modelId) => {
  log.trace(`Getting model address for model id ${modelId}`);
  return new Promise((resolve, reject) => {
    appManager.contracts['ProcessModelRepository'].factory.getModel(
      global.stringToHex(modelId),
      (error, data) => {
        if (error || !data.raw) return reject(boom.badImplementation(`Failed to get address of model with id ${modelId}: ${error}`));
        return resolve(data.raw[0]);
      },
    );
  });
};

const getProcessDefinitionAddress = (modelId, processId) => new Promise((resolve, reject) => {
  log.trace(`Getting process definition address for model Id ${modelId} and process Id ${processId}`);
  const modelIdHex = global.stringToHex(modelId);
  const processIdHex = global.stringToHex(processId);
  appManager.contracts['ProcessModelRepository']
    .factory.getProcessDefinition(modelIdHex, processIdHex, (error, data) => {
      if (error || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to get address of process definition with id ${processId} in model ${modelId}: ${error}`));
      }
      return resolve(data.raw[0]);
    });
});

const isValidProcess = processAddress => new Promise((resolve, reject) => {
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  log.trace(`Validating process definition at address: ${processAddress}`);
  processDefinition.validate((error, data) => {
    if (error || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to validate process at ${processAddress}: ${error}`));
    }
    if (!data.raw[0]) {
      return reject(boom
        .badImplementation(`Invalid process definition at ${processAddress}: ${global.hexToString(data.raw[1].valueOf())}`));
    }
    log.info(`Process Definition at ${processAddress} validated`);
    return resolve(data.raw[0]);
  });
});

const startProcessFromAgreement = agreementAddress => new Promise((resolve, reject) => {
  log.trace(`Starting formation process from agreement at address: ${agreementAddress}`);
  appManager.contracts['ActiveAgreementRegistry'].factory.startFormation(agreementAddress, (error, data) => {
    if (error || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to start formation process from agreement at ${agreementAddress}: ${error}`));
    }
    if (parseInt(data.raw[0], 10) !== 1) {
      return reject(boom
        .badImplementation(`Error code creating/starting process instance for agreement at ${agreementAddress}: ${data.raw[0]}`));
    }
    log.info(`Formation process for agreement at ${agreementAddress} created and started at address: ${data.raw[1]}`);
    return resolve(data.raw[1]);
  });
});

const getStartActivity = processAddress => new Promise((resolve, reject) => {
  log.trace(`Getting start activity id for process at address: ${processAddress}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, processAddress);
  processDefinition.getStartActivity((err, data) => {
    if (err || !data.raw) return reject(boom.badImplementation(`Failed to get start activity for process: ${err}`));
    return resolve(global.hexToString(data.raw[0]));
  });
});

const getProcessInstanceCount = () => new Promise((resolve, reject) => {
  log.trace('Fetching process instance count');
  appManager.contracts['BpmService']
    .factory.getNumberOfProcessInstances((error, data) => {
      if (error || !data.raw) return reject(boom.badImplementation(`Failed to get process instance count: ${error}`));
      return resolve(data.raw[0]);
    });
});

const getProcessInstanceForActivity = activityInstanceId => new Promise((resolve, reject) => {
  log.trace(`Fetching process instance for activity ${activityInstanceId}`);
  appManager
    .contracts['BpmService']
    .factory.getProcessInstanceForActivity(activityInstanceId, (error, data) => {
      if (error || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to get process instance for activity with id ${activityInstanceId}: ${error}`));
      }
      return resolve(data.raw[0].valueOf());
    });
});

const getDataMappingKeys = (processDefinition, activityId, direction) => new Promise((resolve, reject) => {
  const countPromise = direction === global.__monax_constants.DIRECTION.IN ?
    processDefinition.getInDataMappingKeys : processDefinition.getOutDataMappingKeys;
  countPromise(activityId, (err, data) => {
    if (err || !data.raw) {
      return reject(boom
        .badImplementation(`Failed to get ${direction ? 'out-' : 'in-'}data mapping ids for activity ${activityId}: ${err}`));
    }
    if (data.raw[0] && Array.isArray(data.raw[0])) {
      return resolve(data.raw[0].map(elem => global.hexToString(elem)));
    }
    return resolve([]);
  });
});

const getDataMappingDetails = (processDefinition, activityId, dataMappingIds, direction) => new Promise((resolve, reject) => {
  const dataPromises = [];
  dataMappingIds.forEach((id) => {
    const getter = direction === global.__monax_constants.DIRECTION.IN ?
      processDefinition.getInDataMappingDetails : processDefinition.getOutDataMappingDetails;
    dataPromises.push(getter(activityId, id));
  });
  Promise.all(dataPromises)
    .then(data => resolve(data.map(d => d.values)))
    .catch(err => reject(boom
      .badImplementation(`Failed to get ${direction ? 'out-' : 'in-'}data mapping details for activityId ${activityId}: ${err}`)));
});

const getDataMappingDetailsForActivity = async (pdAddress, activityId, dataMappingIds = [], direction) => {
  log.trace(`Fetching ${direction ? 'out-' : 'in-'}data mapping details for activity ${activityId} in process definition at ${pdAddress}`);
  const processDefinition = getContract(global.__abi, global.__monax_bundles.BPM_MODEL.contracts.PROCESS_DEFINITION, pdAddress);
  try {
    const keys = dataMappingIds || (await getDataMappingKeys(processDefinition, activityId, direction));
    const details = await getDataMappingDetails(processDefinition, activityId, keys, direction);
    log.info(`Retrieved ${direction ? 'out-' : 'in-'}data mapping details for activity ${activityId} in process definition at ${pdAddress}`);
    return details;
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    else throw boom.badImplementation(`Failed to get data mapping details for process definition at ${pdAddress} and activityId ${activityId}`);
  }
};

const getArchetypeProcesses = archAddress => new Promise((resolve, reject) => {
  log.trace(`Fetching formation and execution processes for archetype at address ${archAddress}`);
  let formation;
  let execution;
  appManager.contracts['ArchetypeRegistry']
    .factory.getArchetypeData(archAddress, (err, data) => {
      if (err || !data.raw) return reject(boom.badImplementation(`Failed to get archetype processes: ${err}`));
      formation = data.raw[7] ? data.raw[7].valueOf() : '';
      execution = data.raw[10] ? data.raw[10].valueOf() : '';
      return resolve({
        formation,
        execution,
      });
    });
});

const getActivityInstanceData = (piAddress, activityInstanceId) => new Promise((resolve, reject) => {
  log.trace(`Fetching activity instance data for activity id ${activityInstanceId} in process instance at address ${piAddress}`);
  appManager
    .contracts['BpmService']
    .factory.getActivityInstanceData(piAddress, activityInstanceId, (err, data) => {
      if (err || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to get data for activity instance with id ${activityInstanceId} in process instance at ${piAddress}: ${err}`));
      }
      return resolve({
        activityId: data.raw[0] ? data.raw[0].valueOf() : '',
        created: data.raw[1] ? data.raw[1].valueOf() : '',
        completed: data.raw[2] ? data.raw[2].valueOf() : '',
        performer: data.raw[3] ? data.raw[3].valueOf() : '',
        completedBy: data.raw[4] ? data.raw[4].valueOf() : '',
        state: data.raw[5] ? data.raw[5].valueOf() : '',
      });
    });
});

const getActiveAgreementData = agreementAddress => new Promise((resolve, reject) => {
  log.trace(`Fetching data for agreement at address ${agreementAddress}`);
  appManager
    .contracts['ActiveAgreementRegistry']
    .factory.getActiveAgreementData(agreementAddress, (err, data) => {
      if (err || !data.raw) {
        return reject(boom
          .badImplementation(`Failed to get data of agreement at ${agreementAddress}: ${err}`));
      }
      return resolve({
        archetype: data.raw[0] ? data.raw[0].valueOf() : '',
        name: data.raw[1] ? global.hexToString(data.raw[1].valueOf()) : '',
        creator: data.raw[2] ? data.raw[2].valueOf() : '',
        maxNumberOfEvents: data.raw[7] ? data.raw[7].valueOf() : '',
        isPrivate: data.raw[8] ? data.raw[8].valueOf() : '',
        legalState: data.raw[9] ? data.raw[9].valueOf() : '',
        formationProcessInstance: data.raw[10] ? data.raw[10].valueOf() : '',
        executionProcessInstance: data.raw[11] ? data.raw[11].valueOf() : '',
      });
    });
});

module.exports = {
  load,
  initCache,
  events,
  listen: chainEvents,
  db,
  cache,
  boomify,
  getContract,
  BpmService: getBpmService,
  WorkflowUserAccount: getWorkflowUserAccount,
  createOrganization,
  createArchetype,
  isActiveArchetype,
  getArchetypeAuthor,
  activateArchetype,
  deactivateArchetype,
  setArchetypeSuccessor,
  getArchetypeSuccessor,
  addArchetypeParameters,
  addArchetypeDocuments,
  setArchetypePrice,
  addJurisdictions,
  createArchetypePackage,
  activateArchetypePackage,
  deactivateArchetypePackage,
  addArchetypeToPackage,
  createAgreement,
  setMaxNumberOfEvents,
  setAddressScopeForAgreementParameters,
  updateAgreementEventLog,
  cancelAgreement,
  createAgreementCollection,
  addAgreementToCollection,
  createUser,
  getUserById,
  addUserToOrganization,
  removeUserFromOrganization,
  createDepartment,
  removeDepartment,
  addDepartmentUser,
  removeDepartmentUser,
  createProcessModel,
  addProcessInterface,
  addParticipant,
  createProcessDefinition,
  addProcessInterfaceImplementation,
  createActivityDefinition,
  createDataMapping,
  createGateway,
  createTransition,
  setDefaultTransition,
  createTransitionCondition,
  completeActivityByUser,
  signAgreementByUser,
  getModelAddressFromId,
  getProcessDefinitionAddress,
  isValidProcess,
  startProcessFromAgreement,
  getStartActivity,
  getProcessInstanceCount,
  getProcessInstanceForActivity,
  getDataMappingKeys,
  getDataMappingDetails,
  getDataMappingDetailsForActivity,
  getArchetypeProcesses,
  getActivityInstanceData,
  getActiveAgreementData,
};
