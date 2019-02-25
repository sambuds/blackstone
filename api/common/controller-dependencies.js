const crypto = require('crypto');
const _ = require('lodash');
const boom = require('boom');

const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('monax.controllers');
const { app_db_pool, chain_db_pool } = require(`${global.__common}/postgres-db`);
const {
  DATA_TYPES,
  PARAMETER_TYPES,
} = global.__monax_constants;

const trimBufferPadding = (buf) => {
  let lo = 0;
  let hi = buf.length;
  for (let i = 0; i < buf.length && buf[i] === 0; i += 1) {
    lo = i + 1;
  }
  for (let i = buf.length - 1; i > 0 && buf[i] === 0; i -= 1) {
    hi = i;
  }
  return buf.slice(lo, hi);
};
const hexToString = (hex = '') => trimBufferPadding(Buffer.from(hex, 'hex')).toString('utf8');
const stringToHex = (str = '') => Buffer.from(str).toString('hex');

const dependencies = {
  rightPad: (hex, len) => {
    const need = 2 * len - hex.length;
    let paddedHex = hex;
    for (let i = 0; i < need; i += 1) {
      paddedHex += '0';
    }
    return paddedHex;
  },

  formatItem: (item) => {
    if (typeof item === 'object') {
      return `'${JSON.stringify(item)}'`;
    }
    if (typeof item === 'string') {
      return `'${item}'`;
    }
    return item;
  },

  /**
   * Formats selected fields of the given object depending on
   * the specified type and returns the object.
   */
  format: (type, obj) => {
    const element = Object.assign({}, obj);
    const err = new Error();
    switch (type) {
      case 'Access Point':
        element.accessPointId = hexToString(element.accessPointId);
        break;
      case 'Archetype':
        if (!_.isEmpty(element.description)) element.description = _.unescape(element.description);
        if (element.successor) element.successor = Number(element.successor) === 0 ? null : element.successor;
        if (element.price) element.price = parseInt(element.price, 10) / 100; // converting to dollars from cents (recorded uint on chain)
        if (Number(element.formationProcessDefinition) === 0) element.formationProcessDefinition = null;
        if (Number(element.executionProcessDefinition) === 0) element.executionProcessDefinition = null;
        break;
      case 'Archetype Package':
        element.active = Boolean(element.active);
        element.isPrivate = Boolean(element.isPrivate);
        break;
      case 'Agreement':
        element.isPrivate = Boolean(element.isPrivate);
        break;
      case 'Application':
        element.id = hexToString(element.id);
        element.webForm = hexToString(element.webForm);
        break;
      case 'Country': // TODO Temporary until front-end is updated to rely on alpha2
        element.country = element.alpha2;
        break;
      case 'Currency':
        element.currency = hexToString(element.currency);
        element.alpha3 = hexToString(element.alpha3);
        element.m49 = hexToString(element.m49);
        break;
      case 'Data':
        if (element.dataType === DATA_TYPES.BYTES32) element.value = hexToString(element.value);
        break;
      case 'Data Mapping':
        if (element.accessPath) element.accessPath = hexToString(element.accessPath);
        if (element.dataMappingId) element.dataMappingId = hexToString(element.dataMappingId);
        if (element.dataPath) element.dataPath = hexToString(element.dataPath);
        if (element.dataStorageId) element.dataStorageId = hexToString(element.dataStorageId);
        break;
      case 'Parameter':
        element.name = hexToString(element.name);
        element.label = hexToString(element.label);
        break;
      case 'Party':
        if (element.signatureTimestamp) element.signatureTimestamp *= 1000;
        if (element.organizationName) element.organizationName = hexToString(element.organizationName);
        break;
      case 'Model':
        if ('active' in element) element.active = element.active === 1;
        element.isPrivate = Boolean(element.isPrivate);
        break;
      case 'Region':
        element.country = hexToString(element.country);
        element.alpha2 = hexToString(element.alpha2);
        element.code2 = hexToString(element.code2);
        element.code3 = hexToString(element.code3);
        break;
      case 'Definition':
        if (element.processDefinitionId != null) element.processDefinitionId = hexToString(element.processDefinitionId);
        if (element.interfaceId != null) element.interfaceId = hexToString(element.interfaceId);
        if (element.modelId != null) element.modelId = hexToString(element.modelId);
        element.isPrivate = Boolean(element.isPrivate);
        break;
      case 'ParameterType':
        element.label = hexToString(element.label || '');
        break;
      case 'Parameter Value': {
        err.status = 400;
        const paramTypeInt = parseInt(element.parameterType, 10);
        if (paramTypeInt === PARAMETER_TYPES.BOOLEAN) {
          if (element.value === 'false' || element.value === '0' || !element.value) {
            element.value = 0;
          } else if (element.value === '1' || element.value === true || element.value === 'true') {
            element.value = 1;
          } else {
            err.message = 'Invalid boolean value';
            throw err;
          }
        } else if (paramTypeInt === PARAMETER_TYPES.STRING && typeof element.value !== 'string') {
          element.value = JSON.stringify(element.value);
        } else if (paramTypeInt === PARAMETER_TYPES.NUMBER) {
          if (typeof element.value === 'string') {
            element.value = parseFloat(element.value, 10);
          }
          if (!Number.isInteger(element.value)) {
            err.message = 'Number values must be integers';
            throw err;
          }
        } else if (paramTypeInt === PARAMETER_TYPES.DATE || paramTypeInt === PARAMETER_TYPES.DATETIME) {
          if (typeof element.value === 'string') {
            element.value = new Date(element.value).getTime();
            if (Number.isNaN(parseInt(element.value, 10))) {
              err.message = 'Date format not readable';
              throw err;
            }
          }
        } else if (paramTypeInt === PARAMETER_TYPES.MONETARY_AMOUNT) {
          if (typeof element.value === 'string') {
            element.value = parseFloat(element.value, 10);
          }
          element.value = Math.round(element.value * 100);
        } else if (paramTypeInt === PARAMETER_TYPES.USER_ORGANIZATION ||
          paramTypeInt === PARAMETER_TYPES.CONTRACT_ADDRESS ||
          paramTypeInt === PARAMETER_TYPES.SIGNING_PARTY) {
          if (typeof element.value !== 'string' || !element.value.match(/^[0-9A-Fa-f]{40}$/)) {
            err.message = 'Accounts must be 40-digit hexadecimals';
            throw err;
          }
        } else if (paramTypeInt === PARAMETER_TYPES.POSITIVE_NUMBER) {
          if (typeof element.value === 'string') element.value = Number(element.value);
          if (element.value < 0) {
            err.message = 'Value must be positive';
            throw err;
          }
        }
        return element;
      }
      default:
        log.warn('Invoked format() function with unknown type. Returning same object!');
    }
    return element;
  },

  encrypt: (buffer, password) => {
    if (password == null) return buffer;
    const cipher = crypto.createCipher('aes-256-ctr', password);
    const crypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return crypted;
  },

  decrypt: (buffer, password) => {
    if (password == null) return buffer;
    const decipher = crypto.createDecipher('aes-256-ctr', password);
    const dec = Buffer.concat([decipher.update(buffer), decipher.final()]);
    return dec;
  },

  addMeta: (meta, data) => {
    const dataBuf = Buffer.from(data);
    const metaBuf = Buffer.from(JSON.stringify(meta));
    const size = Buffer.alloc(4);
    size.writeUIntBE(metaBuf.length, 0, 4);
    return Buffer.concat([size, metaBuf, dataBuf]);
  },

  splitMeta: (data) => {
    const _data = data.data;
    let retdata;
    try {
      const outSize = _data.readUIntBE(0, 4);
      retdata = {
        meta: JSON.parse(_data.slice(4, outSize + 4).toString()),
        data: _data.slice(outSize + 4),
      };
    } catch (err) {
      retdata = { data: _data };
    }
    return retdata;
  },

  where: (criteria, skipWhere) => {
    // log.debug("whereing")
    // log.debug(criteria)
    if (criteria === undefined) return '';

    let where = skipWhere ? 'AND ' : 'WHERE ';
    const conds = [];

    Object.keys(criteria).forEach((key, i) => {
      // skip 'token' query param
      if (key === 'token') return;

      if (/^null$/i.exec(criteria[key]) != null) {
        conds.push(`${key} IS NULL`);
      } else if (/^notnull$/i.exec(criteria[key]) != null) {
        conds.push(`${key} IS NOT NULL`);
      } else if (/^true$/i.exec(criteria[key]) != null) {
        conds.push(`${key}=1`);
      } else if (/^false$/i.exec(criteria[key]) != null) {
        conds.push(`${key}=0`);
      } else {
        conds.push(`${key} = ${dependencies.formatItem(criteria[key])}`);
      }
    });

    if (conds.length === 0) return '';

    for (let i = 0; i < conds.length; i += 1) {
      if (i !== 0) {
        where += ' AND ';
      }
      where += conds[i];
    }

    return where;
  },

  pgWhere: (obj) => {
    let columns = Object.keys(obj);
    const values = columns.map(col => obj[col]);
    columns = columns.map(col => _.snakeCase(col));
    const text = `WHERE ${columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')}`;
    return {
      text,
      values,
    };
  },

  pgUpdate: (tableName, obj) => {
    let columns = Object.keys(obj);
    const values = columns.map(col => obj[col]);
    columns = columns.map(col => _.snakeCase(col));
    const text = `UPDATE ${tableName} SET ${columns.map((col, i) => `${col} = $${i + 1}`).join(', ')}`;
    return {
      text,
      values,
    };
  },

  getParticipantNames: async (participants, registeredUsersOnly, addressKey = 'address') => {
    const text = `SELECT username AS id, NULL AS name, address, external_user FROM users
    UNION
    SELECT NULL AS id, name, address, FALSE AS external_user FROM organizations
    WHERE address = ANY($1)
    ${registeredUsersOnly ? ' AND external_user = false;' : ';'}`;
    try {
      const { rows: withNames } = await app_db_pool.query({
        text,
        values: [participants.map(({ [addressKey]: address }) => address)],
      });
      const names = {};
      withNames.forEach(({ address, id, name }) => {
        names[address] = {};
        if (id) names[address].id = id;
        if (name) names[address].name = name;
      });
      const returnData = participants.map(account => Object.assign({}, account, names[account[addressKey]]));
      if (registeredUsersOnly) return returnData.filter(({ id, name }) => id || name);
      return returnData;
    } catch (err) {
      throw boom.badImplementation(err);
    }
  },

  /**
   * Wrapper for async route handlers to catch promise rejections
   * and pass them to express error handler
   */
  asyncMiddleware: fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (!err.isBoom) {
        return next(boom.badImplementation(err));
      }
      return next(err);
    });
  },

  byteLength: string => string.split('').reduce((acc, el) => {
    const newSum = acc + Buffer.byteLength(el, 'utf8');
    return newSum;
  }, 0),

  getBooleanFromString: (val) => {
    if (val && val.constructor.name === 'Boolean') return val;
    if (val && val.constructor.name === 'String') {
      return val === 'true';
    }
    return false;
  },

  getSHA256Hash: data => crypto.createHash('sha256').update(data).digest('hex'),

  prependHttps: (host) => {
    if (!String(host).startsWith('http')) {
      // eslint-disable-next-line no-param-reassign
      host = process.env.MONAX_ENV === 'local' ? `http://${host}` : `https://${host}`;
      return host;
    }
    return host;
  },

  trimBufferPadding,
  hexToString,
  stringToHex,
};

module.exports = dependencies;
