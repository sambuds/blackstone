const logger = require(`${global.__common}/monax-logger`);
const contracts = require('../controllers/contracts-controller');
const CONTRACT_ACTIVE_AGREEMENT = global.__monax_bundles.AGREEMENTS.contracts.ACTIVE_AGREEMENT;
const { PARAMETER_TYPES: PARAM_TYPE, DATA_TYPES } = global.__monax_constants;
const { chainPool } = require(`${global.__common}/postgres-db`);
const log = logger.getLogger('agreements.data-storage');

/* **********************************************************
 *       PARAMETER TYPES TO SOLIDITY DATA TYPES MAPPING
 *       dataTypes match DataTypes.sol uint8 data types
 *       parameterTypes match DataTypes.ParameterType enums
 ********************************************************** */

const agreementDataSetters = {};
const agreementDataGetters = {};
const activityOutDataSetters = {};
const activityInDataGetters = {};

/* **********************************
 *      AGREEMENT DATA SETTERS
 ********************************** */

const setDataValueAsBool = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsBool(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const setDataValueAsString = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsString(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const setDataValueAsUint = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsUint(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const setDataValueAsInt = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsInt(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const setDataValueAsAddress = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsAddress(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

const setDataValueAsBytes32 = (agreementAddr, fieldName, fieldValue) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.setDataValueAsBytes32(fieldName, fieldValue, (err) => {
    if (err) reject(err);
    else resolve();
  });
});

/* **********************************
 *       AGREEMENT DATA GETTERS
 ********************************** */

const getDataValueAsBool = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsBool(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: data.raw[0].valueOf(),
    });
  });
});

const getDataValueAsString = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsString(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: data.raw[0].valueOf(),
    });
  });
});

const getDataValueAsUint = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsUint(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: parseInt(data.raw[0].valueOf(), 10),
    });
  });
});

const getDataValueAsInt = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsInt(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: parseInt(data.raw[0].valueOf(), 10),
    });
  });
});

const getDataValueAsAddress = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsAddress(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: data.raw[0].valueOf(),
    });
  });
});

const getDataValueAsBytes32 = (agreementAddr, fieldName) => new Promise((resolve, reject) => {
  const agreement = contracts.getContract(global.__abi, CONTRACT_ACTIVE_AGREEMENT, agreementAddr);
  agreement.getDataValueAsBytes32(fieldName, (err, data) => {
    if (err) return reject(err);
    return resolve({
      name: global.hexToString(fieldName),
      value: global.hexToString(data.raw[0].valueOf()),
    });
  });
});

/* **********************************
 *     ACTIVITY IN-DATA GETTERS
 ********************************** */

const getActivityInDataAsBool = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as bool value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsBool.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data bool return: %s', JSON.stringify(processInstance.getActivityInDataAsBool.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsBool.decode(returnData).raw[0]);
  } catch (error) {
    return reject(error);
  }
});

const getActivityInDataAsString = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as string value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsString.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data string return: %s', JSON.stringify(processInstance.getActivityInDataAsString.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsString.decode(returnData).raw[0].valueOf());
  } catch (error) {
    return reject(error);
  }
});

const getActivityInDataAsBytes32 = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as bytes32 value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsBytes32.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data bytes32 return: %s', JSON.stringify(processInstance.getActivityInDataAsBytes32.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsBytes32.decode(returnData).raw[0].valueOf());
  } catch (error) {
    return reject(error);
  }
});

const getActivityInDataAsUint = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as uint value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsUint.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data uint return: %s', JSON.stringify(processInstance.getActivityInDataAsUint.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsUint.decode(returnData).raw[0].valueOf());
  } catch (error) {
    return reject(error);
  }
});

const getActivityInDataAsInt = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as int value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsInt.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data int return: %s', JSON.stringify(processInstance.getActivityInDataAsInt.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsInt.decode(returnData).raw[0].valueOf());
  } catch (error) {
    return reject(error);
  }
});

const getActivityInDataAsAddress = (userAddr, activityInstanceId, dataMappingId) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s reading IN data %s as string value on activity instance ID %s', userAddr, dataMappingId, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.getActivityInDataAsAddress.encode(activityInstanceId, dataMappingId);
    const returnData = await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    log.trace('Activity data address return: %s', JSON.stringify(processInstance.getActivityInDataAsAddress.decode(returnData)));
    return resolve(processInstance.getActivityInDataAsAddress.decode(returnData).raw[0].valueOf());
  } catch (error) {
    return reject(error);
  }
});

/* **********************************
 *     ACTIVITY OUT-DATA SETTERS
 ********************************** */

const setActivityOutDataAsBool = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as bool value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsBool.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

const setActivityOutDataAsString = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as string value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    log.info('PI Address: %s, type: %s', piAddress, typeof piAddress);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsString.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

const setActivityOutDataAsBytes32 = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as bytes32 value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    log.info('PI Address: %s, type: %s', piAddress, typeof piAddress);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsBytes32.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

const setActivityOutDataAsUint = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as uint value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    log.info('PI Address: %s, type: %s', piAddress, typeof piAddress);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsUint.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

const setActivityOutDataAsInt = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as int value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsInt.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

const setActivityOutDataAsAddress = (userAddr, activityInstanceId, dataMappingId, value) => new Promise(async (resolve, reject) => {
  try {
    log.trace('User %s setting OUT data %s as address value %s on activity instance ID %s', userAddr, dataMappingId, value, activityInstanceId);
    const piAddress = await contracts.getBpmService().factory.getProcessInstanceForActivity(activityInstanceId).then(result => result.raw[0]);
    const processInstance = contracts.getProcessInstance(piAddress);
    const payload = processInstance.setActivityOutDataAsAddress.encode(activityInstanceId, dataMappingId, value);
    await contracts.callOnBehalfOf(userAddr, piAddress, payload);
    return resolve();
  } catch (error) {
    return reject(error);
  }
});

/* **********************************
 *            UTILS
 ********************************** */

const getAgreementValidParameters = agreementAddr => new Promise((resolve, reject) => {
  const queryStr = `select encode(ap.parameter_name::bytea, 'hex') AS parameter_key, ap.parameter_type AS "parameterType"
  from AGREEMENTS ag
  join ARCHETYPE_PARAMETERS ap on ag.archetype_address = ap.archetype_address
  where ag.agreement_address = $1;`;
  chainPool.query(queryStr, [agreementAddr], (err, data) => {
    if (err) return reject(err);
    return resolve(data.rows.map(_field => Object.assign(_field, { name: _field.parameter_key })));
  });
});

const getArchetypeValidParameters = archetypeAddr => new Promise((resolve, reject) => {
  const queryStr = `select ap.parameter_name AS parameter_key, ap.parameter_type AS "parameterType"
  from ARCHETYPE_PARAMETERS ap
  where ap.archetype_address = $1;`;
  chainPool.query(queryStr, [archetypeAddr], (err, data) => {
    if (err) return reject(err);
    return resolve(data.rows.map(_field => Object.assign(_field, { name: _field.parameter_key })));
  });
});

agreementDataSetters[`${PARAM_TYPE.BOOLEAN}`] = setDataValueAsBool;
agreementDataSetters[`${PARAM_TYPE.STRING}`] = setDataValueAsString;
agreementDataSetters[`${PARAM_TYPE.NUMBER}`] = setDataValueAsInt;
agreementDataSetters[`${PARAM_TYPE.DATE}`] = setDataValueAsUint;
agreementDataSetters[`${PARAM_TYPE.DATETIME}`] = setDataValueAsUint;
agreementDataSetters[`${PARAM_TYPE.MONETARY_AMOUNT}`] = setDataValueAsInt;
agreementDataSetters[`${PARAM_TYPE.USER_ORGANIZATION}`] = setDataValueAsAddress;
agreementDataSetters[`${PARAM_TYPE.CONTRACT_ADDRESS}`] = setDataValueAsAddress;
agreementDataSetters[`${PARAM_TYPE.SIGNING_PARTY}`] = setDataValueAsAddress;
agreementDataSetters[`${PARAM_TYPE.BYTES32}`] = setDataValueAsBytes32;
agreementDataSetters[`${PARAM_TYPE.DOCUMENT}`] = setDataValueAsString;
agreementDataSetters[`${PARAM_TYPE.LARGE_TEXT}`] = setDataValueAsString;
agreementDataSetters[`${PARAM_TYPE.POSITIVE_NUMBER}`] = setDataValueAsUint;

agreementDataGetters[`${PARAM_TYPE.BOOLEAN}`] = getDataValueAsBool;
agreementDataGetters[`${PARAM_TYPE.STRING}`] = getDataValueAsString;
agreementDataGetters[`${PARAM_TYPE.NUMBER}`] = getDataValueAsUint;
agreementDataGetters[`${PARAM_TYPE.DATE}`] = getDataValueAsUint;
agreementDataGetters[`${PARAM_TYPE.DATETIME}`] = getDataValueAsUint;
agreementDataGetters[`${PARAM_TYPE.MONETARY_AMOUNT}`] = getDataValueAsInt;
agreementDataGetters[`${PARAM_TYPE.USER_ORGANIZATION}`] = getDataValueAsAddress;
agreementDataGetters[`${PARAM_TYPE.CONTRACT_ADDRESS}`] = getDataValueAsAddress;
agreementDataGetters[`${PARAM_TYPE.SIGNING_PARTY}`] = getDataValueAsAddress;
agreementDataGetters[`${PARAM_TYPE.BYTES32}`] = getDataValueAsBytes32;
agreementDataGetters[`${PARAM_TYPE.DOCUMENT}`] = getDataValueAsString;
agreementDataGetters[`${PARAM_TYPE.LARGE_TEXT}`] = getDataValueAsString;
agreementDataGetters[`${PARAM_TYPE.POSITIVE_NUMBER}`] = getDataValueAsUint;

activityInDataGetters[`${DATA_TYPES.BOOLEAN}`] = getActivityInDataAsBool;
activityInDataGetters[`${DATA_TYPES.STRING}`] = getActivityInDataAsString;
activityInDataGetters[`${DATA_TYPES.BYTES32}`] = getActivityInDataAsBytes32;
activityInDataGetters[`${DATA_TYPES.UINT}`] = getActivityInDataAsUint;
activityInDataGetters[`${DATA_TYPES.INT}`] = getActivityInDataAsInt;
activityInDataGetters[`${DATA_TYPES.ADDRESS}`] = getActivityInDataAsAddress;

activityOutDataSetters[`${DATA_TYPES.BOOLEAN}`] = setActivityOutDataAsBool;
activityOutDataSetters[`${DATA_TYPES.STRING}`] = setActivityOutDataAsString;
activityOutDataSetters[`${DATA_TYPES.BYTES32}`] = setActivityOutDataAsBytes32;
activityOutDataSetters[`${DATA_TYPES.UINT}`] = setActivityOutDataAsUint;
activityOutDataSetters[`${DATA_TYPES.INT}`] = setActivityOutDataAsInt;
activityOutDataSetters[`${DATA_TYPES.ADDRESS}`] = setActivityOutDataAsAddress;


module.exports = {
  agreementDataSetters,
  agreementDataGetters,
  activityOutDataSetters,
  activityInDataGetters,
  getAgreementValidParameters,
  getArchetypeValidParameters,
};
