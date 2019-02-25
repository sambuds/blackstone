const path = require('path');
const boom = require('boom');
const contracts = require(`${global.__controllers}/contracts-controller`);
const {
  format,
  addMeta,
  splitMeta,
  asyncMiddleware,
  byteLength,
} = require(`${global.__common}/controller-dependencies`);
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('agreements.bpm');
const parser = require(path.resolve(global.__lib, 'bpmn-parser.js'));
const {
  hoard,
  hoardPut,
  getModelFromHoard,
} = require(`${global.__controllers}/hoard-controller`);
const sqlCache = require('./postgres-query-helper');
const pgCache = require('./postgres-cache-helper');
const dataStorage = require(path.join(`${global.__controllers}/data-storage-controller`));
const { createOrFindAccountsWithEmails } = require(path.join(`${global.__controllers}/agreements-controller`));
const { PARAM_TYPE_TO_DATA_TYPE_MAP, DATA_TYPES } = require(`${global.__common}/monax-constants`);
const getActivityInstances = asyncMiddleware(async (req, res) => {
  const data = await sqlCache.getActivityInstances(req.query);
  const activities = await pgCache.populateTaskNames(data);
  return res.status(200).json(activities);
});

const _validateDataMappings = (dataMappings) => {
  dataMappings.forEach((dataMapping) => {
    const errMessage = `Value ${dataMapping.value} not valid input for data type ${dataMapping.dataType}`;
    switch (dataMapping.dataType) {
      case 1:
        // bool
        if (dataMapping.value !== true && dataMapping.value !== false) {
          throw boom.badRequest(errMessage);
        }
        break;
      case 2:
        // string
        if (typeof dataMapping.value !== 'string') {
          throw boom.badRequest(errMessage);
        }
        break;
      case 59:
        // bytes32
        if (typeof dataMapping.value === 'string' && byteLength(dataMapping.value) > 32) {
          throw boom.badRequest(errMessage);
        }
        break;
      case 8:
        // uint
        if (typeof dataMapping.value !== 'number' || dataMapping.value < 0) {
          throw boom.badRequest(errMessage);
        }
        break;
      case 18:
        // int
        if (typeof dataMapping.value !== 'number') {
          throw boom.badRequest(errMessage);
        }
        break;
      case 40:
        // address
        if (!dataMapping.value.match(/^[0-9A-Fa-f]{40}$/)) {
          throw boom.badRequest(errMessage);
        }
        break;
      default:
        break;
    }
  });
};

const getValuesForDataMappings = (userAddress, activityInstanceId, dataMappings) => {
  const getValuePromises = dataMappings
    .map(async (data) => {
      if (data.direction === 0) {
        let value = await dataStorage.activityInDataGetters[data.dataType](userAddress, activityInstanceId, data.dataMappingId);
        if (data.dataType === DATA_TYPES.ADDRESS && Number(value) === 0) value = null;
        if (data.parameterType === 5) value /= 100;
        return {
          ...data,
          value,
        };
      }
      return data;
    });
  return Promise.all(getValuePromises);
};

const addDataTypes = dataMappings => dataMappings.map(dm => ({
  ...dm,
  dataType: PARAM_TYPE_TO_DATA_TYPE_MAP[dm.parameterType].dataType,
}));

const getActivityInstance = asyncMiddleware(async (req, res) => {
  let activityInstanceResult = (await sqlCache.getActivityInstanceData(req.params.id, req.user.address))[0];
  if (!activityInstanceResult) throw boom.notFound(`Activity instance ${req.params.id} not found or user not authorized`);
  activityInstanceResult = (await pgCache.populateTaskNames([activityInstanceResult]))[0];
  activityInstanceResult.data = await sqlCache.getDataMappingsForActivity(req.params.id);
  activityInstanceResult.data = addDataTypes(activityInstanceResult.data);
  try {
    activityInstanceResult.data = await getValuesForDataMappings(req.user.address, req.params.id, activityInstanceResult.data);
  } catch (err) {
    throw boom.badImplementation(`Failed to get values for IN data mappings for activity instance id ${req.params.id}: ${err}`);
  }
  return res.status(200).json(activityInstanceResult);
});

const getDataMappings = asyncMiddleware(async ({ user, params: { activityInstanceId, dataMappingId } }, res) => {
  let dataMappings = await sqlCache.getDataMappingsForActivity(activityInstanceId, dataMappingId);
  if (dataMappingId && !dataMappings[0]) throw boom.notFound(`Data mapping with id ${dataMappingId} for activity instance ${activityInstanceId} does not exist`);
  dataMappings = addDataTypes(dataMappings);
  try {
    dataMappings = await getValuesForDataMappings(user.address, activityInstanceId, dataMappings);
  } catch (err) {
    let msg = `Failed to get values for IN data mappings for activity instance id ${activityInstanceId}: ${err.stack}`;
    if (dataMappingId) msg = `Failed to get IN values for activity instance id ${activityInstanceId} and data mapping id ${dataMappingId}: ${err.stack}`;
    throw boom.badImplementation(msg);
  }
  return res.status(200).json(dataMappingId ? dataMappings[0] : dataMappings);
});

const setDataMappings = asyncMiddleware(async ({ user, params: { activityInstanceId, dataMappingId }, body }, res) => {
  let dataMappings;
  if (dataMappingId) {
    dataMappings = [Object.assign(body, { id: dataMappingId })];
  } else {
    dataMappings = body;
    if (!Array.isArray(dataMappings)) throw boom.badRequest('Expected array of data mapping objects');
  }
  dataMappings = await createOrFindAccountsWithEmails(dataMappings, 'parameterType');
  _validateDataMappings(dataMappings);
  const setValuePromises = dataMappings.map(data => dataStorage.activityOutDataSetters[`${data.dataType}`](user.address, activityInstanceId, data.id, data.value));
  await Promise.all(setValuePromises)
    .then(() => res.sendStatus(200))
    .catch((err) => {
      throw boom.badImplementation(`Failed to set data mapping values for activity ${activityInstanceId}: ${err.stack}`);
    });
});

const getTasksForUser = asyncMiddleware(async ({ user: { address } }, res) => {
  if (!address) throw boom.badRequest('No logged in user found');
  const data = await sqlCache.getTasksByUserAddress(address);
  const tasks = await pgCache.populateTaskNames(data);
  return res.status(200).json(tasks);
});

const getModels = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  const retData = [];
  const models = await sqlCache.getModels(req.user.address);
  models.forEach((model) => {
    retData.push(format('Model', model));
  });
  return res.status(200).json(retData);
});

const getApplications = asyncMiddleware(async (req, res) => {
  const applications = await sqlCache.getApplications();
  const appObj = {};
  applications.forEach((_app) => {
    const app = format('Application', _app);
    if (!appObj[app.id]) {
      app.accessPoints = [];
      appObj[app.id] = app;
    }
    if (app.accessPointId) {
      const accessPoint = format('Access Point', {
        accessPointId: app.accessPointId,
        direction: app.direction,
        dataType: app.dataType,
      });
      appObj[app.id].accessPoints.push(accessPoint);
    }
    delete appObj[app.id].accessPointId;
    delete appObj[app.id].direction;
    delete appObj[app.id].dataType;
  });
  return res.status(200).json(Object.values(appObj));
});

const validateProcess = asyncMiddleware(async (req, res) => {
  if (!req.body.address) throw boom.badRequest('Process definition address required');
  const isValid = await contracts.isValidProcess(req.body.address);
  return res.status(200).json({ processIsValid: isValid });
});

const writeDataForActivity = (userAddr, activityInstanceId, dataMappings) => {
  const promises = dataMappings.map((mapping) => {
    const setter = dataStorage.activityOutDataSetters[mapping.dataType];
    return setter(userAddr, activityInstanceId, mapping.id, mapping.value);
  });
  return Promise.all(promises)
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(err));
};

const completeActivity = asyncMiddleware(async (req, res) => {
  const { activityInstanceId } = req.params;
  const userAddr = req.user.address;
  let { data } = req.body;
  if (!activityInstanceId) throw boom.badRequest('Activity instance Id required');
  if (data) {
    data = await createOrFindAccountsWithEmails(data, 'parameterType');
    _validateDataMappings(data);
    if (data.length === 1) {
      // if only one data mapping then writing data and completing activity
      // are carried out as part of a single transaction in solidity
      // via the appropriately mapped function in
      // contracts-controller.js::getCompletionFunctionByParamType
      await contracts.completeActivity(userAddr, activityInstanceId,
        data[0].id, data[0].dataType, data[0].value);
    } else {
      // in case of multiple data mappings, they are written as a series of promises
      // and then the activity is completed as a separate transaction
      await writeDataForActivity(userAddr, activityInstanceId, data);
      await contracts.completeActivity(userAddr, activityInstanceId);
    }
  } else {
    await contracts.completeActivity(userAddr, activityInstanceId);
  }
  return res.sendStatus(200);
});

const signAndCompleteActivity = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  if (!req.params.activityInstanceId) throw boom.badRequest('Activity instance Id required');
  if (!req.params.agreementAddress) throw boom.badRequest('agreemenrAddress is required');
  const id = req.params.activityInstanceId;
  const agreementAddr = req.params.agreementAddress;
  const userAddr = req.user.address;
  await contracts.signAgreement(userAddr, agreementAddr);
  await contracts.completeActivity(userAddr, id);
  return res.sendStatus(200);
});

const getProcessInstanceCount = asyncMiddleware(async (req, res) => {
  let count = await contracts.getProcessInstanceCount();
  count = parseInt(count, 10);
  return res.status(200).json({ count });
});

const getDefinitions = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  const data = await sqlCache.getProcessDefinitions(req.user.address, req.query);
  const processes = await pgCache.populateProcessNames(data);
  return res.status(200).json(processes);
});

const getDefinition = asyncMiddleware(async (req, res) => {
  const processDefn = (await sqlCache.getProcessDefinitionData(req.params.address))[0];
  const profileData = (await sqlCache.getProfile(req.user.address))[0];
  if (!processDefn) throw boom.notFound(`Data for process definition ${req.params.address} not found`);
  if (processDefn.isPrivate &&
    processDefn.author !== req.user.address &&
    !profileData.find(({ organization }) => organization === processDefn.author)) {
    throw boom.forbidden('You are not authorized to view process details from this private model');
  }
  // retData = format('Definition', processDefn);
  const data = await pgCache.populateProcessNames([processDefn]);
  return res.status(200).json(data[0]);
});

const parseBpmnModel = async (rawXml) => {
  const anParser = parser.getNewParser();
  try {
    await anParser.parse(rawXml);
    const model = anParser.getModel();
    const processes = anParser.getProcesses();
    return { model, processes };
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    else throw boom.badImplementation(`Failed to parse xml: ${err}`);
  }
};

const getModelDiagram = asyncMiddleware(async (req, res) => {
  const model = (await sqlCache.getProcessModelData(req.params.address))[0];
  if (!model) throw boom.notFound(`Data for process model ${req.params.address} not found`);
  const profileData = (await sqlCache.getProfile(req.user.address))[0];
  if (model.isPrivate &&
    model.author !== req.user.address &&
    !profileData.find(({ organization }) => organization === model.author)) {
    throw boom.forbidden('You are not authorized to view this private model');
  }
  const diagram = await getModelFromHoard(model.modelFileReference);
  const data = splitMeta(diagram);
  if (req.headers.accept.includes('application/xml')) {
    res.attachment(data.meta.name);
    return res.status(200).send(data.data);
  }
  if (req.headers.accept.includes('application/json')) {
    const parsedModel = await parseBpmnModel(data.data.toString());
    return res.status(200).json(parsedModel);
  }
  throw boom.badRequest(`${req.headers.accept} format not supported`);
});

/* ************************************************************************
 * Controller functions specific to model & process generation from BPMN
 ************************************************************************ */

const pushModelXmlToHoard = async (rawXml) => {
  let hoardGrant;
  try {
    const meta = {
      name: 'bpmn_xml',
      mime: 'application/xml',
    };
    hoardGrant = await hoardPut(meta, Buffer.from(rawXml));
    return hoardGrant;
  } catch (err) {
    throw boom.badImplementation(`Failed to upload data to hoard: ${err}`);
  }
};

const setDefaultTransitions = (pdAddress, defaultTransitions = []) => {
  const promises = defaultTransitions.map(t => contracts.setDefaultTransition(pdAddress, t.gateway, t.activity));
  return Promise.all(promises)
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(boom.badImplementation(err)));
};

const addTransitionsFromBpmn = (pdAddress, transitions) => {
  const transitionPromises = [];
  transitions.forEach((transition) => {
    if (!transition.source || !transition.target) {
      throw boom
        .badRequest(`Transition source and target IDs are required for transition id ${transition.id} in process definition at ${pdAddress}`);
    }
    transitionPromises.push(contracts.createTransition(pdAddress, transition.source, transition.target));
  });
  // TODO - Implemented chaining of individual promises in the loop above. - this seems to have solved the out of sequence creation of transitions and transition conditions
  // Need to keep an eye out for the time being to ensure we don't get such failure with the above strategy
  return Promise.all(transitionPromises)
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(boom.badImplementation(`Failed to create transition(s): ${err.stack}`)));
};

const addTransitionConditionsFromBpmn = (pdAddress, transitions) => {
  const conditionPromises = [];
  transitions.forEach((transition) => {
    if (transition.condition) {
      conditionPromises.push(
        contracts.createTransitionCondition(
          pdAddress,
          transition.condition.dataType,
          transition.source,
          transition.target,
          transition.condition.lhDataPath,
          transition.condition.lhDataStorageId,
          0x0,
          transition.condition.operator,
          transition.condition.rhValue,
        ),
      );
    }
  });
  // TODO - Implemented chaining of individual promises in the loop above. - this seems to have solved the out of sequence creation of transitions and transition conditions
  // Need to keep an eye out for the time being to ensure we don't get such failure with the above strategy
  return Promise.all(conditionPromises)
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(boom.badImplementation(`Failed to create condition(s): ${err.stack}`)));
};

const addBpmnGateways = (pdAddress, gateways) => {
  const promises = gateways.map((gateway) => {
    if (!gateway.id) {
      throw boom.badRequest(`Gateway in process definition at ${pdAddress} does not have an id`);
    }
    if (!(gateway.type === 0 || gateway.type === 2)) {
      throw boom.badRequest(`Gateway with id ${gateway.id} in process definition at ${pdAddress} has unsupported gateway type of ${gateway.type}`);
    }
    return contracts.createGateway(pdAddress, gateway.id, gateway.type);
  });
  return Promise.all(promises)
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(boom
      .badImplementation(`Failed to create BPMN gateways for process at ${pdAddress}: ${err.stack}`)));
};

const addBpmnFlowElements = (pdAddress, tasks) => {
  const taskPromises = [];
  let dataMappings = [];
  tasks.forEach((task) => {
    taskPromises.push(contracts.createActivityDefinition(
      pdAddress,
      task.id,
      task.activityType,
      task.taskType,
      task.behavior,
      task.assignee,
      task.multiInstance,
      task.application,
      task.subProcessModelId,
      task.subProcessDefinitionId,
    ));
    if (task.dataMappings) {
      dataMappings = dataMappings.concat(task.dataMappings.map(m => Object.assign(m, { taskId: task.id })));
    }
  });
  return Promise.all(taskPromises)
    .then(() => Promise.all(dataMappings.map(m => contracts.createDataMapping(
      pdAddress, m.taskId, m.direction, m.id, m.dataPath, m.dataStorageId, 0x0,
    ))))
    .then(() => Promise.resolve())
    .catch(err => Promise.reject(boom
      .badImplementation(`Failed to create BPMN activities and/or data-mappings in process at ${pdAddress}: ${err.stack}`)));
};

const addParticipantsFromBpmn = (pmAddress, participants) => new Promise((resolve, reject) => {
  const promises = participants.map((participant) => {
    if (Object.prototype.hasOwnProperty.call(participant, 'account') &&
      Object.prototype.hasOwnProperty.call(participant, 'conditionalPerformer')) {
      return reject(boom.badRequest(`Participant ${participant.id} has both account and conditional performer`));
    }
    if (Object.prototype.hasOwnProperty.call(participant, 'account')) {
      return contracts.addParticipant(pmAddress, participant.id, participant.account, '', '', '');
    }
    if (Object.prototype.hasOwnProperty.call(participant, 'conditionalPerformer')) {
      if (!Object.prototype.hasOwnProperty.call(participant, 'dataPath') ||
        !Object.prototype.hasOwnProperty.call(participant, 'dataStorageId')) {
        return reject(boom
          .badRequest(`Participant ${participant.id} is designated as a conditional performer but does not have dataPath or dataStorageId`));
      }
      return contracts.addParticipant(pmAddress, participant.id, '', participant.dataPath, participant.dataStorageId, '');
    }
    return reject(boom
      .badRequest(`Participant ${participant.id} has neither an account address or been designated as a conditional performer - one or the other is required`));
  });
  Promise.all(promises)
    .then(() => resolve())
    .catch(err => reject(boom.badImplementation(err)));
});

const addProcessToModel = (pmAddress, pd) => new Promise(async (resolve, reject) => {
  const proc = {
    processDefinitionId: pd.id,
    interfaceId: pd.interface,
    processName: pd.name,
    modelAddress: pmAddress,
  };
  try {
    proc.address = await contracts.createProcessDefinition(pmAddress, pd.id);
    await contracts.addProcessInterface(pmAddress, pd.interface);
    await contracts.addProcessInterfaceImplementation(pmAddress, proc.address, pd.interface);
    await addParticipantsFromBpmn(pmAddress, pd.participants);
    await addBpmnFlowElements(proc.address, pd.tasks);
    await addBpmnFlowElements(proc.address, pd.userTasks);
    await addBpmnFlowElements(proc.address, pd.subProcesses);
    await addBpmnFlowElements(proc.address, pd.sendTasks);
    await addBpmnFlowElements(proc.address, pd.serviceTasks);
    await addBpmnGateways(proc.address, pd.xorGateways);
    await addBpmnGateways(proc.address, pd.andGateways);
    await addTransitionsFromBpmn(proc.address, pd.transitions);
    await addTransitionConditionsFromBpmn(proc.address, pd.transitions);
    await setDefaultTransitions(proc.address, pd.defaultTransitions);
    await contracts.isValidProcess(proc.address);
    await contracts.getStartActivity(proc.address);
    return resolve(proc);
  } catch (err) {
    return reject(boom.badImplementation(`Error while adding process [ ${pd.name} ] with id: [ ${pd.id} ]: ${err}`));
  }
});

const addProcessesToModel = (modelAddress, processes) => new Promise((resolve, reject) => {
  const processPromises = processes.map(p => addProcessToModel(modelAddress, p));
  Promise.all(processPromises)
    .then(processResponses => resolve(processResponses))
    .catch(error => reject(boom.badImplementation(`Failed to add processes to model at [ ${modelAddress} ]: ${error}`)));
});

/**
 * Adds the provided dataStoreFields to the model contract specified by the given address.
 */
const addDataDefinitionsToModel = (modelAddress, dataStoreFields) => new Promise((resolve, reject) => {
  const dataDefinitionPromises = dataStoreFields.map(field => contracts.addDataDefinitionToModel(modelAddress, field));
  Promise.all(dataDefinitionPromises)
    .then(dataDefinitionResponses => resolve(dataDefinitionResponses))
    .catch(error => reject(boom.badImplementation(`Failed to add data definitions to model at [ ${modelAddress} ]: ${error}`)));
});

const createModelFromBpmn = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  if (req.query.format && req.query.format !== 'bpmn') {
    throw boom.notAcceptable(`${req.query.format} format not supported`);
  }
  const rawXml = req.body;
  if (!rawXml) throw boom.badRequest('rawXml required');
  const response = {
    model: {},
    processes: [],
  };
  const parsedResponse = await parseBpmnModel(rawXml);
  const { model, processes } = parsedResponse;
  model.author = req.user.address;
  response.model.id = model.id;
  const hoardGrant = await pushModelXmlToHoard(rawXml);
  response.model.address = await contracts.createProcessModel(model.id, model.version, model.author, model.private, hoardGrant);
  response.model.dataStoreFields = await addDataDefinitionsToModel(response.model.address, model.dataStoreFields);
  response.processes = await addProcessesToModel(response.model.address, processes);
  response.processes = response.processes.map(_proc => Object.assign(_proc, { isPrivate: model.isPrivate, author: model.author }));
  response.parsedDiagram = parsedResponse;
  return res.status(200).json(response);
});

/* *****************************************************************************
 * END -- Controller functions specific to model & process generation from BPMN
 ***************************************************************************** */

module.exports = {
  createModelFromBpmn,
  validateProcess,
  completeActivity,
  signAndCompleteActivity,
  getProcessInstanceCount,
  getActivityInstances,
  getActivityInstance,
  getDataMappings,
  setDataMappings,
  addDataTypes,
  getValuesForDataMappings,
  getTasksForUser,
  getModels,
  getApplications,
  getDefinitions,
  getDefinition,
  getModelDiagram,
  parseBpmnModel,
  pushModelXmlToHoard,
  addProcessesToModel,
};
