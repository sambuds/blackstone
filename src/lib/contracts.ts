import { Client } from './client';
import { Manager, NewManager } from './manager';
import { GetFromNameRegistry, SetToNameRegistry } from './utils';
import { HexFromString, HexToString, CallOnBehalfOf } from './utils'

import { ActiveAgreement } from '../agreements/ActiveAgreement';
import { Archetype } from '../agreements/Archetype';
import { ProcessModel } from '../bpm-model/ProcessModel';
import { ProcessDefinition } from '../bpm-model/ProcessDefinition';
import { ProcessInstance }from '../bpm-runtime/ProcessInstance';
import { Direction, ErrorCode } from './constants';
import { CallTx } from '@hyperledger/burrow/proto/payload_pb';
import { Ecosystem_v1_0_1 as Ecosystem } from '../commons-auth/Ecosystem_v1_0_1';
import { Organization } from '../commons-auth/Organization';
import {
    Agreement as agreement,
    Archetype as archetype,
    Parameter,
    DataType,
} from './types';

export async function RegisterEcosystem(client: Client, manager: Manager, account: string, name: string) {
    const address = await manager.EcosystemRegistry
        .createEcosystem(name)
        .then(data => data[0]);
    await new Ecosystem.Contract(client, address).addExternalAddress(account);
    await SetToNameRegistry(client, name, address);
    return address;
}

export class Contracts {
    client: Client;
    manager: Manager;
    account: string;
    ecosystem: string;

    constructor(client: Client, manager: Manager, ecosystem: string) {
        this.client = client;
        this.account = client.account;
        this.manager = manager;
        this.ecosystem = ecosystem;
    }

    async createAgreement(agreement: agreement) {
        const {
            archetype,
            creator,
            owner,
            privateParametersFileReference,
            parties,
            collectionId,
            governingAgreements,
        } = agreement;
        const isPrivate = agreement.isPrivate || false;

        return this.manager.ActiveAgreementRegistry
            .createAgreement(archetype, creator, owner, privateParametersFileReference, isPrivate, parties, Buffer.from(collectionId), governingAgreements)
            .then(data => data.activeAgreement);
    }
    
    async setLegalState(agreementAddress: string, legalState: number) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        const permissionId = await agreement.ROLE_ID_LEGAL_STATE_CONTROLLER().then(data => data[0]);
        const hasPermission = (await agreement.hasPermission(permissionId, this.account))[0];
        if (!hasPermission) await agreement.grantPermission(permissionId, this.account);
        await agreement.setLegalState(legalState);
        await agreement.revokePermission(permissionId, this.account);
    }
    
    async initializeObjectAdministrator(agreementAddress: string) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        await agreement.initializeObjectAdministrator(this.account)
    }

    async setMaxNumberOfAttachments(agreementAddress: string, maxNumberOfAttachments: number) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        await agreement.setMaxNumberOfEvents(maxNumberOfAttachments)
    }

    async setAddressScopeForAgreementParameters(agreementAddress: string, parameters: Array<{ name: string, value: string, scope: Buffer }>) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);

        return parameters.map(({ name, value, scope }) => new Promise((resolve, reject) => {
            return agreement.setAddressScope(value, HexFromString(name), scope, Buffer.from(''), Buffer.from(''), '0x0')
        }));
    }

    async updateAgreementFileReference(fileKey: any, agreementAddress: string, hoardGrant: string) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        switch (fileKey) {
            case 'EventLog':
                await agreement.setEventLogReference(hoardGrant);
                break;
            case 'SignatureLog':
                await agreement.setSignatureLogReference(hoardGrant);
                break;
            case 'PrivateParameters':
                await agreement.setPrivateParametersReference(hoardGrant);
                break;
        }
    }

    async createAgreementCollection(author: string, collectionType: number, packageId: Buffer) {
        return this.manager.ActiveAgreementRegistry
            .createAgreementCollection(author, collectionType, packageId);
    }

    async addAgreementToCollection(collectionId: Buffer, agreement: string) {
        return this.manager.ActiveAgreementRegistry
            .addAgreementToCollection(collectionId, agreement);
    }

    async signAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).sign()
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async isAgreementSignedBy(agreementAddress: string, userAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).isSignedBy(userAddress);
        const response = await CallOnBehalfOf(this.client, userAddress, agreementAddress, payload);
        const data = ActiveAgreement.Decode(this.client, HexFromString(response)).isSignedBy();
        const isSignedBy = data[0].valueOf();
        return isSignedBy;
    }

    async cancelAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).cancel();
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async redactAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).redact();
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async getActiveAgreementData(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .getActiveAgreementData(agreementAddress);
    }

    async startProcessFromAgreement(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .startProcessLifecycle(agreementAddress)
            .then(data => data.processInstance);
    }

    async createArchetype(archetype: archetype) {
        const {
            price,
            active,
            author,
            owner,
            formationProcess,
            executionProcess,
            packageId,
            governingArchetypes,
        } = archetype;
        const isPrivate = archetype.isPrivate || false;

        return this.manager.ArchetypeRegistry
            .createArchetype(price, isPrivate, active, author, owner, formationProcess, executionProcess, Buffer.from(packageId), governingArchetypes)
            .then(value => value.archetype);
    }

    async isActiveArchetype(archetypeAddress: string) {
        return new Archetype.Contract(this.client, archetypeAddress)
            .isActive()
            .then(value => value[0]);
    }

    async getArchetypeAuthor(archetypeAddress: string) {
        return new Archetype.Contract(this.client, archetypeAddress)
            .getAuthor()
            .then(value => value.author);
    }

    async activateArchetype(archetypeAddress: string, userAccount: string) {
        const payload = Archetype.Encode(this.client).activate();
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async deactivateArchetype(archetypeAddress: string, userAccount: string) {
        const payload = Archetype.Encode(this.client).deactivate();
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async setArchetypeSuccessor(archetypeAddress: string, successorAddress: string, userAccount: string) {
        const payload = Archetype.Encode(this.client).setSuccessor(successorAddress);
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async getArchetypeSuccessor(archetypeAddress: string) {
        return this.manager.ArchetypeRegistry
            .getArchetypeSuccessor(archetypeAddress)
            .then(data => data[0]);
    }

    async addArchetypeParameters(address: string, parameters: Array<Parameter>) {
        const paramTypes: number[] = [];
        const paramNames: Buffer[] = [];
        for (let i = 0; i < parameters.length; i += 1) {
          paramTypes[i] = parameters[i].type;
          paramNames[i] = HexFromString(parameters[i].name);
        }
        return this.manager.ArchetypeRegistry
            .addParameters(address, paramTypes, paramNames)
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR);
                else return;
            });
    }
    
    async addArchetypeDocument(address: string, fileReference: string) {
        return this.manager.ArchetypeRegistry
            .addDocument(address, fileReference);
    }
    
    async addArchetypeDocuments(archetypeAddress: string, documents: Array<{ grant: string }>) {
        const resolvedDocs = await Promise.all(documents.map(async ({ grant }) => {
          const result = await this.addArchetypeDocument(archetypeAddress, grant);
          return result;
        }));
        return resolvedDocs;
    }
    
    async setArchetypePrice(address: string, price: number) {
        const priceInCents = Math.floor(price * 100); // monetary unit conversion to cents which is the recorded unit on chain
        return this.manager.ArchetypeRegistry
            .setArchetypePrice(address, priceInCents);
    }
    
    async createArchetypePackage(author: string, isPrivate: boolean, active: boolean) {
        return this.manager.ArchetypeRegistry
            .createArchetypePackage(author, isPrivate, active)
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR);
                else return data.id;
            })
      }
    
    async activateArchetypePackage(packageId: Buffer, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .activatePackage(packageId, userAccount);
    }
    
    async deactivateArchetypePackage(packageId: Buffer, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .deactivatePackage(packageId, userAccount);

    }

    async addArchetypeToPackage(packageId: Buffer, archetype: string) {
        return this.manager.ArchetypeRegistry
            .addArchetypeToPackage(packageId, archetype);
    }

    async addJurisdictions(address: string, jurisdictions: Array<{ country: string, regions: Array<string>}>) {
        const countries: Buffer[] = [];
        const regions: Buffer[] = [];
        jurisdictions.forEach((item) => {
            if (item.regions.length > 0) {
                item.regions.forEach((region) => {
                    countries.push(HexFromString(item.country));
                    regions.push(HexFromString(region));
                });
            } else {
                countries.push(HexFromString(item.country));
                regions.push(Buffer.from(''));
            }
        });

        return this.manager.ArchetypeRegistry
            .addJurisdictions(address, countries, regions);
    }


    async getArchetypeProcesses(archAddress: string) {
        const data = await this.manager.ArchetypeRegistry.getArchetypeData(archAddress)
        return {
            formation: data.formationProcessDefinition,
            execution: data.executionProcessDefinition,
        }
    }

    async createProcessModel(modelId: string, modelVersion: [number, number, number], author: string, isPrivate: boolean, modelFileReference: string) {
        const modelIdHex = HexFromString(modelId);
        return this.manager.ProcessModelRepository
            .createProcessModel(modelIdHex, modelVersion, author, isPrivate, modelFileReference)
            .then(value => value.modelAddress);
    }

    async addDataDefinitionToModel(pmAddress: string, dataStoreField: { dataStorageId: string, dataPath: string, parameterType: number }) {        
        const dataIdHex = HexFromString(dataStoreField.dataStorageId);
        const dataPathHex = HexFromString(dataStoreField.dataPath);

        await new ProcessModel.Contract(this.client, pmAddress).addDataDefinition(dataIdHex, dataPathHex, dataStoreField.parameterType);
        return dataStoreField;
    }

    async addProcessInterface(pmAddress: string, interfaceId: string) {
        const interfaceIdHex = HexFromString(interfaceId);
        return new ProcessModel.Contract(this.client, pmAddress)
            .addProcessInterface(interfaceIdHex)
            .then(value => value.error);
    }

    async addParticipant(pmAddress: string, participantId: string, accountAddress: string, dataPath: string, dataStorageId: string, dataStorageAddress: string) {
        const participantIdHex = HexFromString(participantId);
        const dataPathHex = HexFromString(dataPath);
        const dataStorageIdHex = HexFromString(dataStorageId);

        await new ProcessModel.Contract(this.client, pmAddress)
            .addParticipant(participantIdHex, accountAddress, dataPathHex, dataStorageIdHex, dataStorageAddress)
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR);
            })
    }

    async createProcessDefinition(modelAddress: string, processDefnId: string) {
        const processDefnIdHex = HexFromString(processDefnId);
        return this.manager.ProcessModelRepository
                .createProcessDefinition(modelAddress, processDefnIdHex) 
                .then(value => value.newAddress);
    }

    async addProcessInterfaceImplementation(pmAddress: string, pdAddress: string, interfaceId: string) {
        const interfaceIdHex = HexFromString(interfaceId);
        await new ProcessDefinition.Contract(this.client, pdAddress)
            .addProcessInterfaceImplementation(pmAddress, interfaceIdHex)
            .then(data => {
                if (data.error === 1001) throw new Error(`InterfaceId ${interfaceId} for process at ${pdAddress} is not registered to the model at ${pmAddress}`);
                else if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR); 
            });
    }

    async createActivityDefinition(processAddress: string, activityId: string, activityType: number, 
        taskType: number, behavior: number, assignee: string, multiInstance: boolean, application: string, 
        subProcessModelId: string, subProcessDefinitionId: string) {

        await new ProcessDefinition.Contract(this.client, processAddress)
            .createActivityDefinition(
                HexFromString(activityId), 
                activityType, 
                taskType, 
                behavior,
                HexFromString(assignee), 
                multiInstance, 
                HexFromString(application), 
                HexFromString(subProcessModelId),
                HexFromString(subProcessDefinitionId))
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR); 
            });
    
    }

    async createDataMapping(processAddress: string, id: string, direction: number, accessPath: string, 
        dataPath: string, dataStorageId: string, dataStorage: string) {

        await new ProcessDefinition.Contract(this.client, processAddress)
            .createDataMapping(HexFromString(id), direction, HexFromString(accessPath),
                HexFromString(dataPath), HexFromString(dataStorageId), dataStorage);
    }

    async createGateway(processAddress: string, gatewayId: string, gatewayType: number) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .createGateway(HexFromString(gatewayId), gatewayType);
    }

    async createTransition(processAddress: string, sourceGraphElement: string, targetGraphElement: string) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .createTransition(HexFromString(sourceGraphElement), HexFromString(targetGraphElement));
    }

    async setDefaultTransition(processAddress: string, gatewayId: string, activityId: string) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .setDefaultTransition(HexFromString(gatewayId), HexFromString(activityId));
    }

    async createTransitionCondition(processAddress: string, dataType: DataType, gatewayId: string, activityId: string, dataPath: string, dataStorageId: string, dataStorage: string, operator: number, value: string) {
        const processDefinition = new ProcessDefinition.Contract(this.client, processAddress);

        switch (dataType) {
            case DataType.BOOLEAN:
                await processDefinition.createTransitionConditionForBool(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, Boolean(value)
                );
            case DataType.STRING:
                    await processDefinition.createTransitionConditionForString(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, value
                );
            case DataType.BYTES32:
                    await processDefinition.createTransitionConditionForBytes32(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, HexFromString(value)
                );
            case DataType.UINT:
                    await processDefinition.createTransitionConditionForUint(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DataType.INT:
                    await processDefinition.createTransitionConditionForInt(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DataType.ADDRESS:
                    await processDefinition.createTransitionConditionForAddress(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, value
                );
        }
    }

    async getModelAddressFromId(modelId: string) {
        return this.manager.ProcessModelRepository
            .getModel(HexFromString(modelId))
            .then(data => data[0]);
    }

    async getProcessDefinitionAddress(modelId: string, processId: string) {
        const modelIdHex = HexFromString(modelId);
        const processIdHex = HexFromString(processId);

        return this.manager.ProcessModelRepository
            .getProcessDefinition(modelIdHex, processIdHex)
            .then(data => data[0]);
    }

    async isValidProcess(processAddress: string) {
        return new ProcessDefinition.Contract(this.client, processAddress).validate()
            .then(data => {
                if (!data.result) throw new Error(`Invalid process definition at ${processAddress}: ${HexToString(data.errorMessage)}`);
                else return true;
            });
    }

    async getStartActivity(processAddress: string) {
        return new ProcessDefinition.Contract(this.client, processAddress)
            .getStartActivity()
            .then(data => HexToString(data[0]));
    }

    async getProcessInstanceCount() {
        return this.manager.BpmService
            .getNumberOfProcessInstances()
            .then(data => data.size);
    }

    async getProcessInstanceForActivity(activityInstanceId: Buffer) {
        return this.manager.BpmService
            .getProcessInstanceForActivity(activityInstanceId)
            .then(data => data[0]);
    }

    async getDataMappingKeys(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, direction: Direction) {
        const countPromise = direction === Direction.IN ?
            processDefinition.getInDataMappingKeys :
            processDefinition.getOutDataMappingKeys;

        return countPromise(HexFromString(activityId))
            .then(data => data[0]);
    }

    async getDataMappingDetails(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, dataMappingIds: Array<Buffer>, direction: Direction) {
        const dataPromises: Promise<{
            dataMappingId: Buffer;
            accessPath: Buffer;
            dataPath: Buffer;
            dataStorageId: Buffer;
            dataStorage: string;        
        }>[] = [];
        dataMappingIds.forEach((dataMappingId) => {
            const getter = direction === Direction.IN ?
                processDefinition.getInDataMappingDetails : processDefinition.getOutDataMappingDetails;
                dataPromises.push(getter(HexFromString(activityId), dataMappingId));
        });
        return Promise.all(dataPromises);
    }

    async getDataMappingDetailsForActivity(pdAddress: string, activityId: string, dataMappingIds: Array<Buffer>, direction: Direction) {
        const processDefinition = new ProcessDefinition.Contract(this.client, pdAddress)

        // NOTE: activityId are hex converted inside getDataMappingKeys and not here
        const keys = dataMappingIds || (await this.getDataMappingKeys(processDefinition, activityId, direction));
        // NOTE: activityId and dataMappingIds are hex converted inside getDataMappingDetails and not here
        const details = await this.getDataMappingDetails(processDefinition, activityId, keys, direction);
        return details;
    }

    async getActivityInstanceData(piAddress: string, activityInstanceId: string) {
        const data = await this.manager.BpmService.getActivityInstanceData(piAddress, HexFromString(activityInstanceId));
        return {
            activityId: data.activityId,
            created: data.created,
            completed: data.completed,
            performer: data.performer,
            completedBy: data.completedBy,
            state: data.state,
        };
    }

    async getActivityInstanceIDAtIndex(piAddress: string, index: number) {
        return new ProcessInstance.Contract(this.client, piAddress)
            .getActivityInstanceAtIndex(index).then(data => data[0])
    }

    // TODO: type guard value
    async completeActivity(actingUserAddress: string, activityInstanceId: Buffer, dataMappingId?: string | null, dataType?: DataType, value?: boolean | string | Buffer | number) {
        const piAddress = await this.manager.BpmService
            .getProcessInstanceForActivity(activityInstanceId)
            .then(data => data[0]);

        const bpmService = this.manager.BpmService.address;
        let payload: string;
        if (dataMappingId) {
            const hexDataMappingId = HexFromString(dataMappingId);
            switch (dataType) {
                case DataType.BOOLEAN:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithBoolData(activityInstanceId, bpmService, hexDataMappingId, value as boolean)
                    break;
                case DataType.STRING:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithStringData(activityInstanceId, bpmService, hexDataMappingId, value as string);
                    break;
                case DataType.BYTES32:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithBytes32Data(activityInstanceId, bpmService, hexDataMappingId, value as Buffer);
                    break;
                case DataType.UINT:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithUintData(activityInstanceId, bpmService, hexDataMappingId, value as number);
                    break;
                case DataType.INT:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithIntData(activityInstanceId, bpmService, hexDataMappingId, value as number);
                    break;
                case DataType.ADDRESS:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithAddressData(activityInstanceId, bpmService, hexDataMappingId, value as string);
                    break;
                default:
                    throw new Error(`Unsupported dataType parameter: ${dataType}`)
            }
        } else {
            payload = ProcessInstance.Encode(this.client).completeActivity(activityInstanceId, bpmService);
        }
        const returnData = await CallOnBehalfOf(this.client, actingUserAddress, piAddress, payload);
        const data = ProcessInstance.Decode(this.client, HexFromString(returnData)).completeActivity();
        const error = data.error.valueOf();

        switch(error) {
            case 0:
                return
            case 1001:
                throw new Error(`No activity instance found with ID ${activityInstanceId}`);
            case 4103:
                throw new Error(`User ${actingUserAddress} not authorized to complete activity ID ${activityInstanceId}`);
            default:
                throw new Error(`Completing activity instance ID ${activityInstanceId} by user ${actingUserAddress} returned error code: ${error}`);
        }
    }

    async addExternalAddressToEcosystem(externalAddress: string, ecosystemAddress: string) {
        await new Ecosystem.Contract(this.client, ecosystemAddress).addExternalAddress(externalAddress);
    }

    async createUserInEcosystem(user: { username: Buffer; }, ecosystemAddress: string) {
        return this.manager.ParticipantsManager
            .createUserAccount(user.username, '0x0', ecosystemAddress)
            .then(data => data.userAccount);
    }

    async createUser(user: { username: Buffer; }) {
        return this.createUserInEcosystem(user, this.ecosystem);
    }

    async getUserByIdAndEcosystem(id: Buffer, ecosystemAddress: string) {
        return new Ecosystem.Contract(this.client, ecosystemAddress)
            .getUserAccount(id)
            .then(data => data._account)
    }

    async getUserByUsername(username: Buffer) {
        return this.getUserByIdAndEcosystem(username, this.ecosystem);
    }

    async getUserByUserId(userid: Buffer) {
        return this.getUserByIdAndEcosystem(userid, this.ecosystem);
    }

    async addUserToEcosystem(username: Buffer, address: string) {
        return new Ecosystem.Contract(this.client, this.ecosystem)
            .addUserAccount(username, address);
    }

    async migrateUserAccountInEcosystem(userAddress: string, migrateFromId: Buffer, migrateToId: Buffer) {
        return new Ecosystem.Contract(this.client, this.ecosystem)
            .migrateUserAccount(userAddress, migrateFromId, migrateToId);
    }

    async createOrganization(org: { approvers: string[]; defaultDepartmentId: Buffer; }) {
        return this.manager.ParticipantsManager
            .createOrganization(org.approvers ? org.approvers : [], org.defaultDepartmentId)
            .then(value => value[0]);
    }

    async addUserToOrganization(userAddress: any, organizationAddress: any, actingUserAddress: any) {
        const payload = Organization.Encode(this.client).addUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).addUser();
        return data.successful;
    }

    async removeUserFromOrganization(userAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).removeUser();
        return data.successful;
    }

    async addApproverToOrganization(approverAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addApprover(approverAddress);
        await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
    }

    async removeApproverFromOrganization(approverAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeApprover(approverAddress);
        return CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
    }

    async createDepartment(organizationAddress: string, id: Buffer, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addDepartment(id);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).addDepartment();
        return data[0];
    }

    async removeDepartment(organizationAddress: string, id: Buffer, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeDepartment(id);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).removeDepartment();
        return data.successful;
    }

    async addDepartmentUser(organizationAddress: string, depId: Buffer, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addUserToDepartment(userAddress, depId);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).addUserToDepartment();
        return data.successful;
    }

    async removeDepartmentUser(organizationAddress: string, depId: Buffer, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUserFromDepartment(userAddress, depId);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, HexFromString(response)).removeUserFromDepartment();
        return data[0];
    }
}

export async function Load(url: string, account: string, ecosystemName: string): Promise<Contracts> {
    const client = new Client(url, account);
    const manager = await NewManager(client);
    
    let ecosystemAddress = await GetFromNameRegistry(client, ecosystemName);
    if (!ecosystemAddress) {
        ecosystemAddress = await RegisterEcosystem(client, manager, account, ecosystemName);
    }
    
    return new Contracts(client, manager, ecosystemAddress);
}