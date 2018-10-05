const MONAX_BUNDLES = {
  AGREEMENTS: {
    contracts: {
      ACTIVE_AGREEMENT: 'ActiveAgreement',
      AGREEMENT_PARTY_ACCOUNT: 'AgreementPartyAccount',
      ARCHETYPE: 'Archetype',
    },
  },
  BPM_MODEL: {
    contracts: {
      PROCESS_DEFINITION: 'ProcessDefinition',
      PROCESS_MODEL: 'ProcessModel',
    },
  },
  BPM_RUNTIME: {
    contracts: {
      WORKFLOW_USER_ACCOUNT: 'WorkflowUserAccount',
    },
  },
  COMMONS_AUTH: {
    contracts: {
      ECOSYSTEM: 'Ecosystem',
    },
  },
  PARTICIPANTS_MANAGER: {
    contracts: {
      ORGANIZATION: 'Organization',
    },
  },
};

const PARAM_TYPE_TO_DATA_TYPE_MAP = {
  0: { label: 'Boolean', dataType: 1, parameterType: 0 },
  1: { label: 'Text', dataType: 2, parameterType: 1 },
  2: { label: 'Number', dataType: 8, parameterType: 2 },
  3: { label: 'Date', dataType: 8, parameterType: 3 },
  4: { label: 'Datetime', dataType: 8, parameterType: 4 },
  5: { label: 'Monetary Amount', dtaType: 8, parameterType: 5 },
  6: { label: 'User/Organization', dtaType: 40, parameterType: 6 },
  7: { label: 'Contract Address', dtaType: 40, parameterType: 7 },
  8: { label: 'Signatory', dataType: 40, parameterType: 8 },
};

const PARAMETER_TYPE = {
  BOOLEAN: 0,
  STRING: 1,
  NUMBER: 2,
  DATE: 3,
  DATETIME: 4,
  MONETARY_AMOUNT: 5,
  USER_ORGANIZATION: 6,
  CONTRACT_ADDRESS: 7,
  SIGNING_PARTY: 8,
};

const DATA_TYPES = {
  BOOLEAN: 1,
  STRING: 2,
  BYTES32: 59,
  UINT: 8,
  INT: 18,
  ADDRESS: 40,
};

const DIRECTION = {
  IN: 0,
  OUT: 1,
};

const COMPARISON_OPERATOR = {
  EQ: 0,
  LT: 1,
  GT: 2,
  LTE: 3,
  GTE: 4,
  NEQ: 5,
};

const ERROR_CODES = {
  UNAUTHORIZED: 'ERR403',
  RESOURCE_NOT_FOUND: 'ERR404',
  RESOURCE_ALREADY_EXISTS: 'ERR409',
  INVALID_INPUT: 'ERR422',
  RUNTIME_ERROR: 'ERR500',
  INVALID_STATE: 'ERR600',
  INVALID_PARAMETER_STATE: 'ERR601',
  OVERWRITE_NOT_ALLOWED: 'ERR610',
  NULL_PARAMETER_NOT_ALLOWED: 'ERR611',
  DEPENDENCY_NOT_FOUND: 'ERR704',
};

const AGREEMENT_PARTIES = 'AGREEMENT_PARTIES';
const DEFAULT_DEPARTMENT_ID = 'DEFAULT_DEPARTMENT';

module.exports = {
  MONAX_BUNDLES,
  PARAMETER_TYPE,
  DATA_TYPES,
  DIRECTION,
  PARAM_TYPE_TO_DATA_TYPE_MAP,
  COMPARISON_OPERATOR,
  ERROR_CODES,
  AGREEMENT_PARTIES,
  DEFAULT_DEPARTMENT_ID,
};
