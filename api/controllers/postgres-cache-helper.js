const path = require('path');
const boom = require('boom');
const { splitMeta } = require(`${global.__common}/controller-dependencies`);
const parser = require(path.resolve(global.__lib, 'bpmn-parser.js'));
const { getModelFromHoard } = require(`${global.__controllers}/hoard-controller`);
const sqlCache = require('./sqlsol-query-helper');
const pool = require(`${global.__common}/postgres-db`);

const getUserDetails = async (userAddress) => {
  const { rows } = await pool.query({
    text: 'SELECT username, email, first_name as firstname, last_name as lastname FROM USERS WHERE address = $1',
    values: [userAddress],
  });
  return rows[0];
};

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
  const model = await sqlCache.getProcessModelData(pmAddress);
  const diagram = await getModelFromHoard(model.diagramAddress, model.diagramSecret);
  const data = splitMeta(diagram);
  const { processes } = await parseBpmnModel(data.data.toString());
  const targetProcess = processes.filter(p => p.id === processId)[0];
  return {
    name: targetProcess.activityMap[activityId],
    processName: targetProcess.name,
  };
};

const coalesceActivityName = activity => new Promise(async (resolve, reject) => {
  if (!activity.modelId || !activity.processDefinitionId) { return reject(boom.badImplementation('Properties modelId and/or processDefinitionId not supplied')); }
  const cachedActivities = {};
  try {
    // check if activity is in postgres cache
    const { rows } = await pool.query({
      text: 'SELECT activity_id, process_name, activity_name FROM ACTIVITY_DETAILS WHERE model_id = $1 AND process_id = $2;',
      values: [activity.modelId, activity.processDefinitionId],
    });
    rows.forEach((a) => {
      cachedActivities[a.activity_id] = { name: a.activity_name, processName: a.process_name };
    });
    if (cachedActivities[activity.activityId]) {
      // activity is in postgres cache, get name from cache
      Object.assign(activity, cachedActivities[activity.activityId]);
    } else {
      // activity is not in postgres cache, get activity name from bpmn and subsequently save in cache
      const activityDetails = await getActivityDetailsFromBpmn(activity.modelAddress, activity.processDefinitionId, activity.activityId);
      Object.assign(activity, activityDetails);
      await pool.query({
        text: 'INSERT INTO ACTIVITY_DETAILS (model_id, process_id, process_name, activity_id, activity_name) VALUES($1, $2, $3, $4, $5) ' +
            'ON CONFLICT ON CONSTRAINT activity_details_pkey DO UPDATE SET activity_name = $5',
        values: [activity.modelId, activity.processDefinitionId, activity.processName, activity.activityId, activity.name],
      });
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
  const model = await sqlCache.getProcessModelData(pmAddress);
  const diagram = await getModelFromHoard(model.diagramAddress, model.diagramSecret);
  const data = splitMeta(diagram);
  const { processes } = await parseBpmnModel(data.data.toString());
  const targetProcess = processes.filter(p => p.id === processId)[0];
  return targetProcess.name || '';
};

const coalesceProcessName = _processDefn => new Promise(async (resolve, reject) => {
  if (!_processDefn.modelId || !_processDefn.processDefinitionId) { return reject(boom.badImplementation('Properties modelId and/or processDefinitionId not supplied')); }
  try {
    // check if process is in postgres cache
    const { rows } = await pool.query({
      text: 'SELECT process_id, process_name FROM PROCESS_DETAILS WHERE model_id = $1 AND process_id = $2;',
      values: [_processDefn.modelId, _processDefn.processDefinitionId],
    });
    const _process = Object.assign({}, _processDefn);
    if (rows[0]) {
      // if it is, get name from postgres cache
      _process.processName = rows[0].process_name;
    } else {
      // otherwise, get process name from bpmn and subsequently save in postgres cache
      _process.processName = await getProcessNameFromBpmn(_process.modelAddress, _process.processDefinitionId);
      await pool.query({
        text: 'INSERT INTO PROCESS_DETAILS (model_id, process_id, process_name) VALUES($1, $2, $3) ' +
            'ON CONFLICT ON CONSTRAINT process_details_pkey DO UPDATE SET process_name = $3',
        values: [_process.modelId, _process.processDefinitionId, _process.processName],
      });
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
  getUserDetails,
};
