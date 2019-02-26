const path = require('path');
const boom = require('boom');
const Joi = require('joi');
const _ = require('lodash');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pgCache = require('./postgres-cache-helper');

const {
  encrypt,
  format,
  splitMeta,
  addMeta,
  asyncMiddleware,
  getBooleanFromString,
  getSHA256Hash,
  getParticipantNames,
} = require(`${global.__common}/controller-dependencies`);
const { app_db_pool } = require(`${global.__common}/postgres-db`);
const contracts = require('./contracts-controller');
const dataStorage = require(path.join(global.__controllers, 'data-storage-controller'));
const archetypeSchema = require(`${global.__schemas}/archetype`);
const agreementSchema = require(`${global.__schemas}/agreement`);
const { hoardGet, hoardPut } = require(`${global.__controllers}/hoard-controller`);
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('agreements');
const sqlCache = require('./postgres-query-helper');
const { PARAMETER_TYPES: PARAM_TYPE, AGREEMENT_PARTIES } = global.__monax_constants;

const getArchetypes = asyncMiddleware(async (req, res) => {
  const retData = [];
  const archData = await sqlCache.getArchetypeData(req.query, req.user.address);
  const jurisData = await sqlCache.getArchetypeJurisdictionsAll();
  archData.forEach((_archetype) => {
    const archetype = Object.assign(_archetype, { countries: [] });
    jurisData.forEach((juris) => {
      if (juris.address === archetype.address) archetype.countries.push(juris.country);
    });
    retData.push(format('Archetype', archetype));
  });
  res.json(retData);
});

const getArchetype = asyncMiddleware(async (req, res) => {
  const password = req.query.password || null;
  let data;
  if (!req.params.address) throw boom.badRequest('Archetype address is required');
  data = await sqlCache.getArchetypeDataWithProcessDefinitions(req.params.address, req.user.address);
  if (!data) throw boom.notFound(`Archetype at ${req.params.address} not found or user has insufficient privileges`);
  data = format('Archetype', data);
  let formationProcess;
  let executionProcess;
  if (data.formationProcessId) {
    formationProcess = await pgCache.populateProcessNames([
      {
        modelId: data.formationModelId,
        modelAddress: data.formationModelAddress,
        processDefinitionId: data.formationProcessId,
      }]);
  }
  if (data.executionProcessId) {
    executionProcess = await pgCache.populateProcessNames([
      {
        modelId: data.executionModelId,
        modelAddress: data.executionModelAddress,
        processDefinitionId: data.executionProcessId,
      }]);
  }
  data.formationProcessName = formationProcess ? formationProcess[0].processName : null;
  data.executionProcessName = executionProcess ? executionProcess[0].processName : null;
  delete data.formationModelId;
  delete data.formationProcessId;
  delete data.executionModelId;
  delete data.executionProcessId;
  data.parameters = await sqlCache.getArchetypeParameters(req.params.address);
  // Early return if you only are fetching meta data
  if (getBooleanFromString(req.query.meta)) {
    data.documents = [];
    return res.json(data);
  }
  data.jurisdictions = await sqlCache.getArchetypeJurisdictions(req.params.address);
  data.documents = await sqlCache.getArchetypeDocuments(req.params.address);
  data.packages = await sqlCache.getPackagesOfArchetype(req.params.address);
  const governingArchetypes = await sqlCache.getGoverningArchetypes(req.params.address);
  data.governingArchetypes = governingArchetypes.map(arch => format('Archetype', arch));
  return res.status(200).json(data);
});

const createArchetype = asyncMiddleware(async (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) throw boom.badRequest('Archetype data required');
  let type = { ...req.body };
  type.parameters = type.parameters || [];
  // TODO: Revisit setting of archetype author
  // The author is overwritten with the logged-in-user's address for now
  // since we do not yet have a review/approval process
  // for changes made to an organization-authored archetype
  // by a user who is part of that organization
  type.author = req.user.address;
  log.debug(`Request to create new archetype: ${type.name}`);
  const { value, error } = Joi.validate(type, archetypeSchema, { abortEarly: false });
  if (error) throw boom.badRequest(`Required fields missing or malformed: ${error}`);
  type = value;
  type.governingArchetypes = type.governingArchetypes || [];
  type.price = parseFloat(type.price, 10);
  type.active = type.active || false;
  if (type.packageId) {
    let packageData;
    try {
      packageData = await sqlCache.getArchetypePackage(type.packageId, req.user.address);
    } catch (err) {
      if (err.isBoom && err.output.statusCode === 404) {
        throw boom.badRequest(`Given packageId ${type.packageId} does not exist, or may not be accessible to user`);
      }
      throw boom.badImplementation(err);
    }
    if (packageData.author !== req.user.address) throw boom.forbidden(`Package with id ${type.packageId} is not modifiable by user at address ${req.user.address}`);
    if (type.isPrivate && !packageData.isPrivate) throw boom.badRequest(`Private archetype ${type.name} cannot be added to public package with id ${type.packageId}`);
  }
  delete type.name; // don't save these parameters on chain
  delete type.description;
  const archetypeAddress = await contracts.createArchetype(type);
  if (type.parameters.length > 0) {
    await contracts.addArchetypeParameters(archetypeAddress, type.parameters);
  }
  if (type.documents) {
    const docs = [];
    type.documents.forEach((_obj) => {
      // Set document name to hoard address
      const obj = Object.assign({}, _obj);
      obj.name = obj.name || `document_${Date.now()}`;
      docs.push(obj);
    });
    await contracts.addArchetypeDocuments(archetypeAddress, docs);
  }
  if (type.jurisdictions) {
    await contracts.addJurisdictions(archetypeAddress, type.jurisdictions);
  }
  await sqlCache.insertArchetypeDetails({ address: archetypeAddress, name: req.body.name, description: _.escape(req.body.description) });

  return res
    .status(200)
    .set('content-type', 'application/json')
    .json({ address: archetypeAddress });
});

const activateArchetype = asyncMiddleware(async (req, res) => {
  const archetype = req.params.address;
  const user = req.user.address;
  const author = await contracts.getArchetypeAuthor(archetype);
  if (user !== author) throw boom.unauthorized(`User at ${user} is not authorized to activate archetype at ${archetype}`);
  await contracts.activateArchetype(archetype, user);
  return res.sendStatus(200);
});

const deactivateArchetype = asyncMiddleware(async (req, res) => {
  const archetype = req.params.address;
  const user = req.user.address;
  const author = await contracts.getArchetypeAuthor(archetype);
  if (user !== author) throw boom.unauthorized(`User at ${user} is not authorized to deactivate archetype at ${archetype}`);
  await contracts.deactivateArchetype(archetype, user);
  return res.sendStatus(200);
});

const setArchetypeSuccessor = asyncMiddleware(async (req, res) => {
  const { address: archetype, successor } = req.params;
  if (!archetype) throw boom.badRequest('Archetype address must be supplied');
  await contracts.setArchetypeSuccessor(archetype, successor || 0x0, req.user.address);
  return res.sendStatus(200);
});

const getArchetypeSuccessor = asyncMiddleware(async (req, res) => {
  const { archetype } = req.params;
  if (!archetype) throw boom.badRequest('Archetype address must be supplied');
  const successor = await contracts.getArchetypeSuccessor(archetype, req.user.address);
  return res.sendStatus({ address: successor });
});

const updateArchetypeConfiguration = asyncMiddleware(async (req, res) => {
  if (!req.params.address) throw boom.badRequest('Archetype address required');
  if (!req.body || Object.keys(req.body).length === 0) {
    throw boom.badRequest('Archetype configuration data required');
  }
  await contracts.configureArchetype(req.params.address, req.body);
  return res.sendStatus(200);
});

const addParametersToArchetype = asyncMiddleware(async (req, res) => {
  if (!req.params.address) throw boom.badRequest('Archetype address required');
  if (!req.body || Object.keys(req.body).length === 0) {
    throw boom.badRequest('Archetype parameter data required');
  }
  await contracts.addArchetypeParameters(req.params.address, req.body);
  return res.sendStatus(200);
});

const setArchetypePrice = asyncMiddleware(async (req, res) => {
  if (!req.params.address) throw boom.badRequest('Archetype address must be supplied');
  if (!req.body.price) throw boom.badRequest('Archetype price must be supplied');
  await contracts.setArchetypePrice(req.params.address, req.body.price);
  return res.sendStatus(200);
});

const createArchetypePackage = asyncMiddleware(async (req, res) => {
  const { name, description } = req.body;
  let { author, isPrivate, active } = req.body;
  if (!name) throw boom.badRequest('Archetype package name is required');
  if (!name.length > 255) throw boom.badRequest('Archetype package name cannot exceed 255 characters');
  if (!description) throw boom.badRequest('Archetype package description is required');
  author = author || req.user.address;
  isPrivate = isPrivate || false;
  active = active || false;
  const id = await contracts.createArchetypePackage(author, isPrivate, active);
  await sqlCache.insertPackageDetails({ id, name, description });
  res.status(200).json({ id });
});

const activateArchetypePackage = asyncMiddleware(async (req, res) => {
  const packageId = req.params.id;
  const user = req.user.address;
  await contracts.activateArchetypePackage(packageId, user);
  return res.sendStatus(200);
});

const deactivateArchetypePackage = asyncMiddleware(async (req, res) => {
  const packageId = req.params.id;
  const user = req.user.address;
  await contracts.deactivateArchetypePackage(packageId, user);
  return res.sendStatus(200);
});

const getArchetypePackages = asyncMiddleware(async (req, res) => {
  let packages = await sqlCache.getArchetypePackages(req.query, req.user.address);
  packages = packages.map(pkg => format('Archetype Package', pkg));
  res.status(200).json(packages);
});

const getArchetypePackage = asyncMiddleware(async (req, res) => {
  const { id } = req.params;
  const archPackage = await sqlCache.getArchetypePackage(id, req.user.address);
  if (!archPackage) throw boom.notFound(`Archetype Package with id ${id} not found or user has insufficient privileges`);
  const archetypes = await sqlCache.getArchetypesInPackage(id);
  archPackage.archetypes = archetypes.map(elem => ({
    name: elem.name,
    address: elem.address,
    active: Boolean(elem.active),
  }));
  res.status(200).json(format('Archetype Package', archPackage));
});

const addArchetypeToPackage = asyncMiddleware(async (req, res) => {
  const { packageId, archetypeAddress } = req.params;
  if (!packageId || !archetypeAddress) throw boom.badRequest('Package id and archetype address are required');
  const packageData = (await sqlCache.getArchetypePackage(packageId, req.user.address));
  const archetypeData = (await sqlCache.getArchetypeData({ archetype_address: archetypeAddress }, req.user.address))[0];
  if (!archetypeData) {
    throw boom.forbidden(`User at ${req.user.address} is not the author of the private archetype at ${archetypeAddress} ` +
      `and thus not allowed to add it to the package with id ${packageId}`);
  }
  if (req.user.address !== packageData.author) throw boom.forbidden(`Package with id ${packageId} is not modifiable by user at address ${req.user.address}`);
  if (archetypeData.isPrivate && !packageData.isPrivate) throw boom.badRequest(`Archetype at ${archetypeAddress} is private and cannot be added to public package with id ${packageId}`);
  await contracts.addArchetypeToPackage(packageId, archetypeAddress);
  res.sendStatus(200);
});

const createOrFindAccountsWithEmails = async (params, typeKey) => {
  const newParams = {
    notAccountOrEmail: [],
    withEmail: [],
    forExistingUser: [],
    forNewUser: [],
  };
  params.forEach((param) => {
    if (param[typeKey] !== PARAM_TYPE.USER_ORGANIZATION && param[typeKey] !== PARAM_TYPE.SIGNING_PARTY) {
      // Ignore non-account parameters
      newParams.notAccountOrEmail.push({ ...param });
    } else if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(param.value)) {
      // Select parameters with email values
      newParams.withEmail.push({ ...param });
    } else {
      // Ignore parameters with non-email values
      newParams.notAccountOrEmail.push({ ...param });
    }
  });
  const client = await app_db_pool.connect();
  try {
    if (newParams.withEmail.length) {
      const { rows } = await client.query({
        text: `SELECT LOWER(email) AS email, address FROM users WHERE LOWER(email) IN (${newParams.withEmail.map((param, i) => `LOWER($${i + 1})`)});`,
        values: newParams.withEmail.map(({ value }) => value),
      });
      newParams.forNewUser = {};
      newParams.withEmail.forEach((param) => {
        const emailAddr = param.value.toLowerCase();
        const existingUser = rows.find(({ email }) => emailAddr === email);
        if (existingUser) {
          // Use existing accounts info if email already registered
          newParams.forExistingUser.push({ ...param, value: existingUser.address });
        } else if (newParams.forNewUser[emailAddr]) {
          // Consolidate users that need to be registered into obj in case the same email was entered for multiple parameters
          // Also save the parameters that each email was used for
          newParams.forNewUser[emailAddr].push(param);
        } else {
          newParams.forNewUser[emailAddr] = [param];
        }
      });
      const createNewUserPromises = (Object.keys(newParams.forNewUser)).map(async (email) => {
        // Create user on chain
        const address = await contracts.createUser({ id: getSHA256Hash(email) });
        const password = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        // Create user in db
        const queryString = `INSERT INTO users(
          address, username, email, password_digest, is_producer, external_user
          ) VALUES(
            $1, $2, $3, $4, $5, $6
            );`;
        await client.query({ text: queryString, values: [address, email, email, hash, false, true] });
        return { email, address };
      });
      const newUsers = await Promise.all(createNewUserPromises);
      newParams.forNewUser = Object.keys(newParams.forNewUser).reduce((acc, emailAddr) => {
        const { address } = newUsers.find(({ email }) => email === emailAddr);
        const newUserParams = newParams.forNewUser[emailAddr].map(param => ({ ...param, value: address }));
        return acc.concat(newUserParams);
      }, []);
    }
    // Release client
    client.release();
    // Return all parameters
    return newParams.notAccountOrEmail.concat(newParams.forExistingUser).concat(newParams.forNewUser);
  } catch (err) {
    client.release();
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
};

const _generateParamSetterPromises = (agreementAddr, archetypeParamDetails, agreementParams) => {
  const promises = [];
  const invalidParams = [];
  agreementParams.forEach((param) => {
    log.trace('Processing parameter data for agreement %s: %s', agreementAddr, JSON.stringify(param));
    const matchingParam = archetypeParamDetails.filter(item => param.name === item.name)[0];
    if (matchingParam) {
      const setterFunction = dataStorage.agreementDataSetters[`${matchingParam.parameterType}`];
      if (setterFunction) {
        log.debug('Setting value: %s for parameter %s with type %d in agremeement %s', param.value, matchingParam.name, matchingParam.parameterType, agreementAddr);
        const formattedParam = format('Parameter Value', { parameterType: matchingParam.parameterType, value: param.value });
        promises.push(setterFunction(agreementAddr, matchingParam.name, formattedParam.value));
      } else {
        throw boom.badImplementation(`No setter function found for parameter name ${matchingParam.name} with parameter type ${matchingParam.parameterType}`);
      }
    } else {
      invalidParams.push(param.name);
    }
  });
  return { promises, invalidParams };
};

const setAgreementParameters = async (agreeAddr, archAddr, parameters) => {
  const getterFunc = archAddr
    ? dataStorage.getArchetypeValidParameters
    : dataStorage.getAgreementValidParameters;
  const archetypeParamDetails = await getterFunc(archAddr || agreeAddr);
  return new Promise((resolve, reject) => {
    const params = Array.isArray(parameters) ? parameters : [];
    const { promises, invalidParams } = _generateParamSetterPromises(agreeAddr, archetypeParamDetails, params);
    if (invalidParams.length > 0) {
      return reject(boom.badRequest(`Given parameter name(s) do not exist in archetype: ${invalidParams}`));
    }
    return Promise.all(promises)
      .then(() => resolve())
      .catch(err => reject(boom.badImplementation(`Failed to set agreement parameters: ${err}`)));
  });
};

const createAgreement = asyncMiddleware(async (req, res) => {
  let parameters = req.body.parameters || [];
  parameters = await createOrFindAccountsWithEmails(parameters, 'type');
  const parties = req.body.parties || [];
  parameters.forEach((param) => {
    if (parseInt(param.type, 10) === PARAM_TYPE.SIGNING_PARTY) parties.push(param.value);
  });
  let agreement = {
    name: req.body.name,
    archetype: req.body.archetype,
    creator: req.user.address,
    isPrivate: req.body.isPrivate,
    parties,
    privateParametersFileReference: JSON.stringify(''), // see TODO below- once we're saving private params to hoard, the returned ref should be passed here
    collectionId: req.body.collectionId,
    governingAgreements: req.body.governingAgreements || [],
  };
  const { value, error } = Joi.validate(agreement, agreementSchema, { abortEarly: false });
  if (error) { throw boom.badRequest(error); }
  agreement = value;

  // validate if archetype is active - only active archetypes can be instantiated into an agreement
  if (!contracts.isActiveArchetype(agreement.archetype)) {
    throw boom.badRequest(`Cannot instantiate inactive archetype at ${agreement.archetype} for agreement ${agreement.name}`);
  }
  // TODO: Hoard stuff- implement later for saving private field values. Currently saving all values to chain.
  // plaintextIn = {
  //   data: new Buffer(JSON.stringify(req.body.values)),
  // };
  // hoard
  //   .put(plaintextIn)
  //   .then((ref) => {
  //     ref.address = ref.address.toString('hex');
  //     ref.secretKey = encrypt(ref.secretKey, password).toString('hex');

  //     agreement.hoardAddress = ref.address;
  //     agreement.hoardSecret = ref.secretKey;
  delete agreement.name; // Don't store name on chain
  const agreementAddress = await contracts.createAgreement(agreement);
  await contracts.setMaxNumberOfEvents(agreementAddress, parseInt(req.body.maxNumberOfEvents, 10));
  await setAgreementParameters(agreementAddress, req.body.archetype, parameters);
  await contracts.setAddressScopeForAgreementParameters(agreementAddress, parameters.filter(({ scope }) => scope));
  await contracts.setAddressScopeForAgreementParameters(agreementAddress, parameters
    .filter(({ scope, value: paramVal }) => scope && parties.includes(paramVal))
    .map(param => ({ ...param, name: AGREEMENT_PARTIES })));
  const { formation } = await contracts.getArchetypeProcesses(req.body.archetype);
  if (!formation) {
    throw boom.badImplementation(`No formation process found for archetype ${req.body.archetype}`);
  }
  await sqlCache.insertAgreementDetails({ address: agreementAddress, name: req.body.name });
  const piAddress = await contracts.startProcessFromAgreement(agreementAddress);
  log.debug(`Process Instance Address: ${piAddress}`);
  res
    .status(200)
    .set('content-type', 'application/json')
    .json({ address: agreementAddress });
});

const _generateParamGetterPromises = (agreementAddr, agreementParams, reqParams) => {
  const promises = [];
  const invalidParams = [];
  reqParams.forEach(({ name }) => {
    const matchingParam = agreementParams.filter(item => name === item.name)[0];
    if (matchingParam) {
      const getterFunction = dataStorage.agreementDataGetters[`${matchingParam.parameterType}`];
      if (getterFunction) {
        log.debug(`Getting value of parameter: ${matchingParam.name} in agremeement at address ${agreementAddr}`);
        promises.push(getterFunction(agreementAddr, matchingParam.name));
      } else {
        log.error(`No getter function found for parameter name ${matchingParam.name} with parameter type ${matchingParam.parameterType}`);
      }
    } else {
      invalidParams.push(name);
    }
  });
  return { promises, invalidParams };
};

const getAgreementParameters = async (agreementAddr, reqParams) => {
  const agreementParams = await dataStorage.getAgreementValidParameters(agreementAddr);
  return new Promise((resolve, reject) => {
    const params = reqParams || [];
    if (params.length === 0) {
      agreementParams.forEach((param) => {
        params.push(param);
      });
    }
    const { promises, invalidParams } = _generateParamGetterPromises(agreementAddr, agreementParams, params);
    if (invalidParams.length > 0) {
      return reject(boom.badRequest(`Given parameter name(s) do not exist in archetype: ${invalidParams}`));
    }
    return Promise.all(promises)
      .then(results => resolve(results.map(({ name, value }, i) => ({ name, value, type: params[i].parameterType }))))
      .catch(err => reject(boom.badImplementation(`Failed to get agreement parameters: ${err}`)));
  });
};

const getAgreements = asyncMiddleware(async (req, res) => {
  const retData = [];
  const forCurrentUser = req.query.forCurrentUser === 'true';
  delete req.query.forCurrentUser;
  const queryParams = Object.keys(req.query).length ? req.query : null;
  const data = await sqlCache.getAgreements(queryParams, forCurrentUser, req.user.address);
  data.forEach((elem) => { retData.push(format('Agreement', elem)); });
  return res.json(retData);
});

const getAgreement = asyncMiddleware(async (req, res) => {
  if (!req.params.address) throw boom.badRequest('Agreement address is required');
  const addr = req.params.address;
  let data = (await sqlCache.getAgreementData(addr, req.user.address))[0];
  if (!data) throw boom.notFound(`Agreement at ${addr} not found or user has insufficient privileges`);
  const parameters = await getAgreementParameters(addr, null);
  const parties = await sqlCache.getAgreementParties(addr);
  data = format('Agreement', data);
  data.documents = await sqlCache.getArchetypeDocuments(data.archetype);
  const withNames = await getParticipantNames(parameters, false, 'value');
  const withNamesObj = {};
  withNames.forEach(({ value, id, name }) => {
    if (id || name) withNamesObj[value] = { value, displayValue: id || name };
  });
  data.parameters = parameters.map(param => Object.assign(param, withNamesObj[param.value] || {}));
  data.parties = parties.map(party => format('Parameter Value', party));
  data.governingAgreements = await sqlCache.getGoverningAgreements(req.params.address);
  return res.status(200).json(data);
});

const updateAgreementEventLog = asyncMiddleware(async ({ params: { address }, body: { eventName, content }, user }, res) => {
  if (!address) throw boom.badRequest('Agreement address is required');
  if (!eventName) throw boom.badRequest('eventName is required');
  const data = await sqlCache.getAgreementEventLogDetails(address);
  const newEvent = {
    name: eventName,
    submitter: user.address,
    timestamp: Date.now(),
    content: content || '',
  };
  let eventLog;
  if (!data.eventLogFileReference) {
    // No reference stored- start new event log
    eventLog = { data: [] };
  } else {
    // Get existing data with reference
    eventLog = await hoardGet(data.eventLogFileReference);
    eventLog = splitMeta(eventLog);
    eventLog.data = JSON.parse(eventLog.data);
  }
  if (eventLog.data.length < data.maxNumberOfEvents) {
    eventLog.data.push(newEvent);
    // Store new data in hoard
    const hoardGrant = await hoardPut({ agreement: address }, JSON.stringify(eventLog.data));
    await contracts.updateAgreementEventLog(address, hoardGrant);
    return res.status(200).json({ grant: hoardGrant });
  }
  throw boom.badRequest(`Cannot log event. Max number of events (${data.maxNumberOfEvents}) has been reached.`);
});

const signAgreement = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  if (!req.params.address) throw boom.badRequest('Agreement address required');
  const userAddr = req.user.address;
  const agreementAddr = req.params.address;
  await contracts.signAgreement(userAddr, agreementAddr);
  log.debug(`Signed agreement ${agreementAddr} by user ${userAddr}`);
  res.status(200).send();
});

const cancelAgreement = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  if (!req.params.address) throw boom.badRequest('Agreement address required');
  const agrAddr = req.params.address;
  const userAddr = req.user.address;
  await contracts.cancelAgreement(userAddr, agrAddr);
  return res.status(200).send();
});

const createAgreementCollection = asyncMiddleware(async (req, res) => {
  const { name, collectionType, packageId } = req.body;
  let { author } = req.body;
  if (!name) throw boom.badRequest('Agreement collection name required');
  if (name.length > 255) throw boom.badRequest('Agreement collection name cannot exceed 255 characters');
  if (collectionType === undefined) throw boom.badRequest('Agreement collection type required');
  if (!packageId) throw boom.badRequest('Archetype packageId required');
  author = author || req.user.address;
  const id = await contracts.createAgreementCollection(author, collectionType, packageId);
  await sqlCache.insertCollectionDetails({ id, name });
  res.status(200).json({ id });
});

const getAgreementCollections = asyncMiddleware(async (req, res) => {
  const collections = await sqlCache.getAgreementCollections(req.user.address);
  res.status(200).json(collections);
});

const getAgreementCollection = asyncMiddleware(async (req, res) => {
  if (!req.params.id) throw boom.badRequest('Agreement collectionId required');
  const queryRes = await sqlCache.getAgreementCollectionData(req.params.id);
  const profileData = await sqlCache.getProfile(req.user.address);
  if (queryRes[0].author !== req.user.address && !profileData.find(({ organization }) => organization === queryRes[0].author)) {
    throw boom.forbidden(`User is not authorized to read collection ${req.params.id}`);
  }
  let collection;
  queryRes.forEach(({
    id, name, author, collectionType, packageId, agreementAddress, agreementName, archetype,
  }, i) => {
    if (i === 0) {
      collection = {
        id, name, author, collectionType, packageId, agreements: [],
      };
    }
    if (agreementAddress) {
      const agrName = agreementName;
      collection.agreements.push({
        address: agreementAddress, name: agrName, archetype,
      });
    }
  });
  res.status(200).json(collection);
});

const addAgreementToCollection = asyncMiddleware(async (req, res) => {
  if (!req.body.collectionId || !req.body.agreement) throw boom.badRequest('Collection id and agreement address are required');
  await contracts.addAgreementToCollection(req.body.collectionId, req.body.agreement);
  res.sendStatus(200);
});

module.exports = {
  getArchetypes,
  getArchetype,
  createArchetype,
  activateArchetype,
  deactivateArchetype,
  setArchetypeSuccessor,
  getArchetypeSuccessor,
  updateArchetypeConfiguration,
  addParametersToArchetype,
  createOrFindAccountsWithEmails,
  setArchetypePrice,
  createArchetypePackage,
  activateArchetypePackage,
  deactivateArchetypePackage,
  getArchetypePackage,
  getArchetypePackages,
  addArchetypeToPackage,
  createAgreementCollection,
  getAgreementCollections,
  getAgreementCollection,
  addAgreementToCollection,
  createAgreement,
  setAgreementParameters,
  getAgreementParameters,
  getAgreements,
  getAgreement,
  updateAgreementEventLog,
  signAgreement,
  cancelAgreement,
};
