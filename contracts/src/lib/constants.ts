export enum CONTRACTS {
  DOUG = 'DOUG',
  EcosystemRegistry = 'EcosystemRegistry',
  ParticipantsManager = 'ParticipantsManager',
  ArchetypeRegistry = 'ArchetypeRegistry',
  ActiveAgreementRegistry = 'ActiveAgreementRegistry',
  ProcessModelRepository = 'ProcessModelRepository',
  ApplicationRegistry = 'ApplicationRegistry',
  BpmService = 'BpmService',
}

export enum DATA_TYPES {
  BOOLEAN = 1,
  STRING = 2,
  BYTES32 = 59,
  UINT = 8,
  INT = 18,
  ADDRESS = 40,
};

export enum DIRECTION {
  IN = 0,
  OUT,
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