const path = require('path');
const boom = require('boom');
const Joi = require('joi');
const _ = require('lodash');
const pgCache = require('./postgres-cache-helper');

const {
  format,
  splitMeta,
  asyncMiddleware,
  getBooleanFromString,
  getParticipantNames,
} = require(`${global.__common}/controller-dependencies`);
const contracts = require('./contracts-controller');
const dataStorage = require(path.join(global.__controllers, 'data-storage-controller'));
const archetypeSchema = require(`${global.__schemas}/archetype`);
const agreementSchema = require(`${global.__schemas}/agreement`);
const { hoardGet, hoardPut } = require(`${global.__controllers}/hoard-controller`);
const { parseBpmnModel } = require(`${global.__controllers}/bpm-controller`);
const { createOrFindAccountsWithEmails } = require(`${global.__controllers}/participants-controller`);
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('agreements');
const sqlCache = require('./postgres-query-helper');
const { PARAMETER_TYPES: PARAM_TYPE, AGREEMENT_PARTIES, AGREEMENT_ATTACHMENT_CONTENT_TYPES } = global.__monax_constants;

const AGREEMENT_DATA_ID = 'agreement';

const _createPrivatePublicArrays = (parameters, paramsRequired) => {
  const privateParams = [];
  const publicParams = [];
  parameters.forEach((param) => {
    if (paramsRequired[param.name]) {
      publicParams.push(param);
    } else {
      privateParams.push(param);
    }
  });
  return { privateParams, publicParams };
};

const _increment = (paramsRequired, param, count) => {
  /*  eslint-disable no-param-reassign */
  paramsRequired[param] = true;
  /*  eslint-enable no-param-reassign */
  return count + 1;
};

const _checkObjectsForParamUse = (
  objArray,
  parametersLength,
  paramsRequired,
  paramsRequiredCount,
  dataStorageIdFieldName = 'dataStorageId',
  dataPathFieldName = 'dataPath',
) => {
  if (!objArray || !objArray.length || parametersLength === paramsRequiredCount) return paramsRequiredCount;
  const { [dataStorageIdFieldName]: dataStorageId, [dataPathFieldName]: dataPath } = objArray.pop();
  let newCount = paramsRequiredCount;
  if (dataStorageId === AGREEMENT_DATA_ID && dataPath !== AGREEMENT_PARTIES && !paramsRequired[dataPath]) {
    newCount = _increment(paramsRequired, dataPath, paramsRequiredCount);
  }
  return _checkObjectsForParamUse(objArray, parametersLength, paramsRequired, newCount, dataStorageIdFieldName, dataPathFieldName);
};

const _checkTasksForParamUse = (tasks, parametersLength, paramsRequired, paramsRequiredCount) => {
  if (!tasks.length || parametersLength === paramsRequiredCount) return paramsRequiredCount;
  let newCount = paramsRequiredCount;
  const { dataMappings } = tasks.pop();
  newCount = _checkObjectsForParamUse(dataMappings, parametersLength, paramsRequired, newCount);
  return _checkTasksForParamUse(tasks, parametersLength, paramsRequired, newCount);
};

const _checkProcessForParamUse = async (process, paramsRequired, parametersLength, paramsRequiredCount = 0) => {
  let newCount = paramsRequiredCount;
  newCount = _checkObjectsForParamUse(process.participants, parametersLength, paramsRequired, newCount);
  ['tasks', 'userTasks', 'sendTasks', 'serviceTasks'].forEach((taskType) => {
    newCount = _checkTasksForParamUse(process[taskType], parametersLength, paramsRequired, newCount);
  });
  newCount = _checkObjectsForParamUse(
    process.transitions
      .filter(({ condition }) => condition)
      .map(({ condition }) => condition),
    parametersLength,
    paramsRequired,
    newCount,
    'lhDataStorageId',
    'lhDataPath',
  );
  return newCount;
};

const _getParsedModel = async (modelFileRef) => {
  let xml = await hoardGet(modelFileRef);
  xml = splitMeta(xml);
  const { model: { dataStoreFields }, processes } = await parseBpmnModel(xml.data.toString());
  return { dataStoreFields, processes };
};

const _checkModelsForRequiredParameters = async (archetypeAddress) => {
  try {
    const {
      formationModelFileReference, executionModelFileReference, formationProcessId, executionProcessId,
    } = (await sqlCache.getArchetypeModelFileReferences(archetypeAddress))[0];
    const paramsRequired = {};
    let dataStoreFields;
    let processes;
    let parametersLength;
    let paramsRequiredCount;
    if (formationModelFileReference) {
      ({ dataStoreFields, processes } = await _getParsedModel(formationModelFileReference));
      parametersLength = dataStoreFields.filter(({ dataStorageId }) => dataStorageId === AGREEMENT_DATA_ID).length;
      // Each of the _check functions will update the `paramsRequired` obj and increment a `paramsRequiredCount`
      // They will return early once `paramsRequiredCount` meets `parametersLength`, ie all parameters are required
      paramsRequiredCount = await _checkProcessForParamUse(
        processes.find(({ id }) => id === formationProcessId), paramsRequired, parametersLength,
      );
    }
    if (!executionModelFileReference) return paramsRequired;
    if (formationModelFileReference !== executionModelFileReference) {
      // Only get model data and reset count if execution uses a different model
      ({ dataStoreFields, processes } = await _getParsedModel(executionModelFileReference));
      parametersLength = dataStoreFields.filter(({ dataStorageId }) => dataStorageId === AGREEMENT_DATA_ID).length;
      paramsRequiredCount = 0;
    } else if (paramsRequiredCount === parametersLength) {
      // Models are the same and we've already found that all data store fields are required
      return paramsRequired;
    }
    await _checkProcessForParamUse(
      processes.find(({ id }) => id === executionProcessId), paramsRequired, parametersLength, paramsRequiredCount,
    );
    return paramsRequired;
  } catch (err) {
    if (err.isBoom) throw err;
    throw boom.badImplementation(`Failed to get parameters required by models for archetype ${archetypeAddress}: ${JSON.stringify(err)}`);
  }
};

const getArchetypes = asyncMiddleware(async (req, res) => {
  const retData = [];
  const archData = await sqlCache.getArchetypes(req.query, req.user.address);
  archData.forEach((_archetype) => {
    retData.push(format('Archetype', _archetype));
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
    await contracts.addArchetypeDocuments(archetypeAddress, type.documents);
  }
  if (type.jurisdictions) {
    await contracts.addJurisdictions(archetypeAddress, type.jurisdictions);
  }
  await sqlCache.insertArchetypeDetails({ address: archetypeAddress, name: req.body.name, description: _.escape(req.body.description) });
  res.data = { archetypeAddress };
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
  const archetypeData = await sqlCache.getArchetypeData(archetypeAddress, req.user.address);
  if (!archetypeData) {
    throw boom.forbidden(`Archetype at ${archetypeAddress} not found or user at ${req.user.address} is not the author of the private archetype at ${archetypeAddress} ` +
      `and thus not allowed to add it to the package with id ${packageId}`);
  }
  if (req.user.address !== packageData.author) throw boom.forbidden(`Package with id ${packageId} is not modifiable by user at address ${req.user.address}`);
  if (archetypeData.isPrivate && !packageData.isPrivate) throw boom.badRequest(`Archetype at ${archetypeAddress} is private and cannot be added to public package with id ${packageId}`);
  await contracts.addArchetypeToPackage(packageId, archetypeAddress);
  res.sendStatus(200);
});

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
  const _parameters = req.body.parameters || [];
  const { parameters, newUsers } = await createOrFindAccountsWithEmails(_parameters, 'type');
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
  const paramsRequired = await _checkModelsForRequiredParameters(agreement.archetype);
  const { privateParams, publicParams } = _createPrivatePublicArrays(parameters, paramsRequired);
  agreement.privateParametersFileReference = await hoardPut({ name: 'privateParameters.json' }, JSON.stringify(privateParams));
  delete agreement.name; // Don't store name on chain
  const agreementAddress = await contracts.createAgreement(agreement);
  await contracts.setMaxNumberOfAttachments(agreementAddress, parseInt(req.body.maxNumberOfAttachments, 10));
  await setAgreementParameters(agreementAddress, req.body.archetype, publicParams);
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
  res.data = { agreementAddress, archetypeAddress: agreement.archetype, newUsers };
  res
    .status(200)
    .set('content-type', 'application/json')
    .json({ address: agreementAddress });
});

const _generateParamGetterPromises = (agreementAddr, agreementParams) => {
  const promises = [];
  const invalidParams = [];
  agreementParams.forEach((param) => {
    const getterFunction = dataStorage.agreementDataGetters[`${param.parameterType}`];
    if (getterFunction) {
      log.debug(`Getting value of parameter: ${param.name} in agremeement at address ${agreementAddr}`);
      promises.push(getterFunction(agreementAddr, param.name));
    } else {
      log.error(`No getter function found for parameter name ${param.name} with parameter type ${param.parameterType}`);
    }
  });
  return { promises, invalidParams };
};

const _getPrivateAgreementParameters = async (fileRef) => {
  const parameters = await hoardGet(fileRef);
  return JSON.parse(splitMeta(parameters).data.toString());
};

const getAgreementParameters = async (agreementAddr, parametersFileRef) => {
  try {
    const agreementParams = await dataStorage.getAgreementValidParameters(agreementAddr);
    const { promises, invalidParams } = _generateParamGetterPromises(agreementAddr, agreementParams);
    if (invalidParams.length > 0) {
      throw boom.badRequest(`Given parameter name(s) do not exist in archetype: ${invalidParams}`);
    }
    const paramsFromChain = await Promise.all(promises);
    const parameters = {};
    paramsFromChain.forEach(({ name, value }, i) => {
      parameters[name] = { name, value, type: agreementParams[i].parameterType };
    });
    const privateParams = await _getPrivateAgreementParameters(parametersFileRef);
    // paramsFromChain includes all parameters from archetype, so "private" ones will also be included with empty values
    // these empty values must be filled in with the private values retrieved from hoard
    privateParams.forEach(({ name, value, type }) => {
      parameters[name] = { name, value, type };
    });
    return Object.values(parameters);
  } catch (err) {
    if (err.isBoom) throw err;
    throw boom.badImplementation(`Failed to get agreement parameters: ${err}`);
  }
};

const getAgreements = asyncMiddleware(async (req, res) => {
  const retData = [];
  const forCurrentUser = req.query.forCurrentUser === 'true';
  delete req.query.forCurrentUser;
  const data = await sqlCache.getAgreements(req.query, forCurrentUser, req.user.address);
  data.forEach((elem) => { retData.push(format('Agreement', elem)); });
  return res.json(retData);
});

const getAgreement = async (agrAddress, userAddress) => {
  let data = await sqlCache.getAgreementData(agrAddress, userAddress);
  if (!data) throw boom.notFound(`Agreement at ${agrAddress} not found or user has insufficient privileges`);
  data.parties = await sqlCache.getAgreementParties(agrAddress);
  data.documents = await sqlCache.getArchetypeDocuments(data.archetype);
  const parameters = await getAgreementParameters(agrAddress, data.privateParametersFileReference);
  const withNames = await getParticipantNames(parameters, 'value');
  const withNamesObj = {};
  withNames.forEach(({ value, displayName }) => {
    if (displayName) withNamesObj[value] = { displayValue: displayName };
  });
  data.parameters = parameters.map(param => Object.assign(param, withNamesObj[param.value] || {}));
  data.governingAgreements = await sqlCache.getGoverningAgreements(agrAddress);
  data = format('Agreement', data);
  return data;
};

const getAgreementHandler = asyncMiddleware(async (req, res) => {
  const agreement = await getAgreement(req.params.address, req.user.address);
  return res.status(200).json(agreement);
});

const updateAgreementAttachments = asyncMiddleware(async (req, res) => {
  const { address } = req.params;
  const data = await sqlCache.getAgreementData(address, req.user.address, false);
  if (!data) throw boom.notFound(`Agreement at ${address} not found or user has insufficient privileges`);
  let name;
  let content;
  let contentType;
  if (req.headers['content-type'].startsWith('multipart/form-data')) {
    // Receiving file - upload to hoard and get grant
    if (!req.files) throw boom.badRequest('No file received for attachment');
    const file = req.files[0];
    name = file.originalname;
    const meta = {
      name,
      mime: file.mimetype,
    };
    content = await hoardPut(meta, file.buffer);
    contentType = AGREEMENT_ATTACHMENT_CONTENT_TYPES.fileReference;
  } else {
    ({ name, content } = req.body);
    if (!name || !content) throw boom.badRequest('Name and content are required fields');
    contentType = AGREEMENT_ATTACHMENT_CONTENT_TYPES.plaintext;
  }
  let attachments;
  if (!data.attachmentsFileReference) {
    // No reference stored- start new attachments
    attachments = [];
  } else {
    // Get existing data with reference
    attachments = await hoardGet(data.attachmentsFileReference);
    attachments = splitMeta(attachments);
    attachments = JSON.parse(attachments.data);
  }
  if (attachments.length < data.maxNumberOfAttachments) {
    attachments.push({
      name,
      submitter: req.user.address,
      timestamp: Date.now(),
      content,
      contentType,
    });
    // Store new data in hoard
    const hoardGrant = await hoardPut({ agreement: address, name: 'agreement_attachments.json' }, JSON.stringify(attachments));
    await contracts.updateAgreementAttachments(address, hoardGrant);
    return res.status(200).json({ attachmentsFileReference: hoardGrant, attachments });
  }
  throw boom.badRequest(`Cannot add attachment. Max number of attachments (${data.maxNumberOfAttachments}) has been reached.`);
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
  getAgreementHandler,
  updateAgreementAttachments,
  signAgreement,
  cancelAgreement,
};
