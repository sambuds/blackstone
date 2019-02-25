const path = require('path');
const boom = require('boom');
const { splitMeta } = require(`${global.__common}/controller-dependencies`);
const parser = require(path.resolve(global.__lib, 'bpmn-parser.js'));
const { getModelFromHoard } = require(`${global.__controllers}/hoard-controller`);
const sqlCache = require('./postgres-query-helper');
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('monax.controllers');

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

const getActivityDetailsFromBpmn = async (pmAddress, processId, activityId) => {
  try {
    const model = (await sqlCache.getProcessModelData(pmAddress))[0];
    const diagram = await getModelFromHoard(model.modelFileReference);
    const data = splitMeta(diagram);
    const { processes } = await parseBpmnModel(data.data.toString());
    const targetProcess = processes.filter(p => p.id === processId)[0];
    return {
      name: targetProcess.activityMap[activityId],
      processName: targetProcess.name,
    };
  } catch (err) {
    throw new Error(`Failed to get activity name for activity with id ${activityId} in process with id ${processId} in model at ${pmAddress}. ${err.stack}`);
  }
};

const coalesceActivityName = activity => new Promise(async (resolve, reject) => {
  if (!activity.modelId || !activity.processDefinitionId) { return reject(boom.badImplementation('Properties modelId and/or processDefinitionId not supplied')); }
  try {
    let activityDetails;
    // check if activity is in postgres cache
    const data = await sqlCache.getActivityDetailsFromCache(activity.activityId, activity.modelId, activity.processDefinitionId);
    if (data.activityName) {
      // activity is in postgres cache, get name from cache
      Object.assign(activity, { name: data.activityName, processName: data.processName });
    } else {
      // activity is not in postgres cache, get activity name from bpmn and subsequently save in cache
      try {
        activityDetails = await getActivityDetailsFromBpmn(activity.modelAddress, activity.processDefinitionId, activity.activityId);
        Object.assign(activity, activityDetails);
        await sqlCache.updateActivityDetailsCache(activity.modelId, activity.processDefinitionId, activity.processName, activity.activityId, activity.name);
      } catch (err) {
        log.error(err.stack);
        if (!activity.name) Object.assign(activity, { name: activity.activityId, processName: activity.processDefinitionId });
      }
    }
    return resolve(activity);
  } catch (err) {
    return reject(boom.badImplementation(`Failed to get task name for activity id ${activity.activityId} in process definition with id ${activity.processDefinitionId}: ${err}`));
  }
});

const populateTaskNames = tasks => new Promise((resolve, reject) => {
  const promises = [];
  tasks.forEach(async (task) => {
    promises.push(coalesceActivityName(task));
  });
  Promise.all(promises)
    .then(response => resolve(response))
    .catch(err => reject(err));
});

const getProcessNameFromBpmn = async (pmAddress, processId) => {
  try {
    const model = (await sqlCache.getProcessModelData(pmAddress))[0];
    const diagram = await getModelFromHoard(model.modelFileReference);
    const data = splitMeta(diagram);
    const { processes } = await parseBpmnModel(data.data.toString());
    const targetProcess = processes.filter(p => p.id === processId)[0];
    if (targetProcess.name) return targetProcess.name;
    throw new Error('Process Name not found in BPMN');
  } catch (err) {
    throw new Error(`Failed to get process name from BPMN for process with id ${processId} in model at ${pmAddress}. ${err.stack}`);
  }
};

const coalesceProcessName = _processDefn => new Promise(async (resolve, reject) => {
  if (!_processDefn.modelId || !_processDefn.processDefinitionId) { return reject(boom.badImplementation('Properties modelId and/or processDefinitionId not supplied')); }
  try {
    // check if process is in postgres cache
    const _process = Object.assign({}, _processDefn);
    const data = await sqlCache.getProcessDetailsFromCache(_processDefn.modelId, _processDefn.processDefinitionId);
    if (data.processName) {
      // if it is, get name from postgres cache
      _process.processName = data.processName;
    } else {
      // otherwise, get process name from bpmn and subsequently save in postgres cache
      try {
        _process.processName = await getProcessNameFromBpmn(_process.modelAddress, _process.processDefinitionId);
        await sqlCache.updateProcessDetailsCache(_process.modelId, _process.processDefinitionId, _process.processName);
      } catch (err) {
        log.error(err.stack);
        if (!_process.processName) Object.assign(_process, { processName: _process.processDefinitionId });
      }
    }
    return resolve(_process);
  } catch (err) {
    return reject(boom.badImplementation(`Failed to get process name for process with id ${_processDefn.processDefinitionId}: ${err}`));
  }
});

const populateProcessNames = processDefinitions => new Promise((resolve, reject) => {
  const promises = [];
  processDefinitions.forEach(async (def) => {
    promises.push(coalesceProcessName(def));
  });
  Promise.all(promises)
    .then(response => resolve(response))
    .catch(err => reject(err));
});

module.exports = {
  populateTaskNames,
  populateProcessNames,
};
