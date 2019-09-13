const CONTRACTS = 'EcosystemRegistry, ParticipantsManager, ArchetypeRegistry, ActiveAgreementRegistry, ProcessModelRepository, ApplicationRegistry, BpmService';

const BUNDLES = {
  AGREEMENTS: {
    contracts: {
      ACTIVE_AGREEMENT: 'ActiveAgreement',
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
      PROCESS_INSTANCE: 'ProcessInstance',
    },
  },
  COMMONS_AUTH: {
    contracts: {
      ECOSYSTEM: 'Ecosystem',
      USER_ACCOUNT: 'UserAccount',
    },
  },
  PARTICIPANTS_MANAGER: {
    contracts: {
      ORGANIZATION: 'Organization',
    },
  },
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

module.exports = {
  CONTRACTS,
  BUNDLES,
  DATA_TYPES,
  DIRECTION,
  ERROR_CODES,
};
