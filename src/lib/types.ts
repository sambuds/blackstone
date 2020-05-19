export type Agreement = {
    archetype?: string,
    creator: string
    owner: string
    privateParametersFileReference: string
    isPrivate?: boolean
    parties: string[]
    collectionId: string
    governingAgreements: string[]
    address?: string
};

export type Archetype = {
    price: number
    isPrivate?: boolean
    active: boolean
    author: string
    owner: string
    formationProcess: string
    executionProcess: string
    packageId: string
    governingArchetypes: string[]
    address?: string
};

type version = [number, number, number];

export type Model = {
    id: string,
    address: string,
    version: version,    
};

export enum DataType {
    BOOLEAN = 1,
    STRING = 2,
    BYTES32 = 59,
    UINT = 8,
    INT = 18,
    ADDRESS = 40,
};

export enum ParameterType {
    BOOLEAN,
    STRING,
    NUMBER,
    DATE,
    DATETIME,
    MONETARY_AMOUNT,
    USER_ORGANIZATION,
    CONTRACT_ADDRESS,
    SIGNING_PARTY,
    BYTES32,
    DOCUMENT,
    LARGE_TEXT,
    POSITIVE_NUMBER,
    TIME_DURATION,
    TIME_CYCLE,
    REPRESENTATIVES,
    APPROVER
};
  
export type Parameter = {
    name: string
    type: ParameterType
};

// ProcessInstanceState reflects enum in BpmRuntime.sol contract
export enum ProcessInstanceState {
    CREATED,
    ABORTED,
    ACTIVE,
    COMPLETED,
};

// ActivityInstanceState reflects enum in BpmRuntime.sol contract
export enum ActivityInstanceState {
    CREATED,
    ABORTED,
    COMPLETED,
    INTERRUPTED,
    SUSPENDED,
};

export enum LegalState {
    DRAFT,
    FORMULATED,
    EXECUTED,
    FULFILLED,
    DEFAULT,
    CANCELED,
    UNDEFINED,
    REDACTED
};

export enum CollectionType {
    CASE,
    DEAL,
    DOSSIER,
    FOLDER,
    MATTER,
    PACKAGE,
    PROJECT
};

export type HexString = string;
