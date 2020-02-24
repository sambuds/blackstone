import { Client } from './client';
import { Manager, NewManager } from './manager';
import { GetFromNameRegistry, SetToNameRegistry, DecodeHex } from './utils';
import { BytesFromString, BytesToString, CallOnBehalfOf } from './utils'
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

    async getFromNameRegistry(name: string) {
        return GetFromNameRegistry(this.client, name);
    }
    
    async setToNameRegistry(name: string, value: string) {
        return SetToNameRegistry(this.client, name, value);
    }

    callOnBehalfOf(userAddress: string, targetAddress: string, payload: string) {
        return CallOnBehalfOf(this.client, userAddress, targetAddress, payload);
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
            .createAgreement(archetype, creator, owner, privateParametersFileReference, isPrivate, parties, BytesFromString(collectionId), governingAgreements)
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

    async setAddressScopeForAgreementParameters(agreementAddress: string, parameters: Array<{ name: string, value: string, scope: string }>) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);

        parameters.map(async ({ name, value, scope }) => {
            await agreement.setAddressScope(value, BytesFromString(name), BytesFromString(scope), BytesFromString(''), BytesFromString(''), '0x0')
        });
    }

    async updateAgreementFileReference(fileKey: string, agreementAddress: string, hoardGrant: string) {
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

    async createAgreementCollection(author: string, collectionType: number, packageId: string) {
        return this.manager.ActiveAgreementRegistry
            .createAgreementCollection(author, collectionType, BytesFromString(packageId));
    }

    async addAgreementToCollection(collectionId: string, agreement: string) {
        return this.manager.ActiveAgreementRegistry
            .addAgreementToCollection(BytesFromString(collectionId), agreement);
    }

    async signAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).sign()
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async isAgreementSignedBy(agreementAddress: string, userAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).isSignedBy(userAddress);
        const response = await CallOnBehalfOf(this.client, userAddress, agreementAddress, payload);
        const data = ActiveAgreement.Decode(this.client, DecodeHex(response)).isSignedBy();
        const isSignedBy = data[0].valueOf();
        return isSignedBy;
    }

    async cancelAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).cancel();
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async redactAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).redact();
        const data = await CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
        return ActiveAgreement.Decode(this.client, DecodeHex(data)).redact()[0];
    }

    async getActiveAgreementData(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .getActiveAgreementData(agreementAddress);
    }

    getActiveAgreement(address: string) {
        return new ActiveAgreement.Contract(this.client, address);
    }

    async startProcessFromAgreement(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .startProcessLifecycle(agreementAddress)
            .then(data => {
                if (data.error!==1) throw new Error(ErrorCode.RUNTIME_ERROR);
                else return data.processInstance;
            });
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
            .createArchetype(price, isPrivate, active, author, owner, formationProcess, executionProcess, BytesFromString(packageId), governingArchetypes)
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
          paramNames[i] = BytesFromString(parameters[i].name);
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

    async upgradeOwnerPermission(address: string, owner: string) {
        return new Archetype.Contract(this.client, address)
            .upgradeOwnerPermission(owner);
    }

    async createArchetypePackage(author: string, isPrivate: boolean, active: boolean) {
        return this.manager.ArchetypeRegistry
            .createArchetypePackage(author, isPrivate, active)
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR);
                else return data.id;
            })
      }
    
    async activateArchetypePackage(packageId: string, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .activatePackage(BytesFromString(packageId), userAccount);
    }
    
    async deactivateArchetypePackage(packageId: string, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .deactivatePackage(BytesFromString(packageId), userAccount);
    }

    async addArchetypeToPackage(packageId: string, archetype: string) {
        return this.manager.ArchetypeRegistry
            .addArchetypeToPackage(BytesFromString(packageId), archetype);
    }

    async addJurisdictions(address: string, jurisdictions: Array<{ country: string, regions: Array<string>}>) {
        const countries: Buffer[] = [];
        const regions: Buffer[] = [];
        jurisdictions.forEach((item) => {
            if (item.regions.length > 0) {
                item.regions.forEach((region) => {
                    countries.push(BytesFromString(item.country));
                    regions.push(BytesFromString(region));
                });
            } else {
                countries.push(BytesFromString(item.country));
                regions.push(BytesFromString(''));
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
        return this.manager.ProcessModelRepository
            .createProcessModel(BytesFromString(modelId), modelVersion, author, isPrivate, modelFileReference)
            .then(value => value.modelAddress);
    }

    async addDataDefinitionToModel(pmAddress: string, dataStoreField: { dataStorageId: string, dataPath: string, parameterType: number }) {
        await new ProcessModel.Contract(this.client, pmAddress)
            .addDataDefinition(BytesFromString(dataStoreField.dataStorageId), BytesFromString(dataStoreField.dataPath), dataStoreField.parameterType);
        return dataStoreField;
    }

    async addProcessInterface(pmAddress: string, interfaceId: string) {
        return new ProcessModel.Contract(this.client, pmAddress)
            .addProcessInterface(BytesFromString(interfaceId))
            .then(value => value.error);
    }

    async addParticipant(pmAddress: string, participantId: string, accountAddress: string, dataPath: string, dataStorageId: string, dataStorageAddress: string) {
        await new ProcessModel.Contract(this.client, pmAddress)
            .addParticipant(BytesFromString(participantId), accountAddress, BytesFromString(dataPath), BytesFromString(dataStorageId), dataStorageAddress)
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR);
            })
    }

    async createProcessDefinition(modelAddress: string, processDefnId: string) {
        return this.manager.ProcessModelRepository
                .createProcessDefinition(modelAddress, BytesFromString(processDefnId)) 
                .then(value => value.newAddress);
    }

    async addProcessInterfaceImplementation(pmAddress: string, pdAddress: string, interfaceId: string) {
        await new ProcessDefinition.Contract(this.client, pdAddress)
            .addProcessInterfaceImplementation(pmAddress, BytesFromString(interfaceId))
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
                BytesFromString(activityId), 
                activityType, 
                taskType, 
                behavior,
                BytesFromString(assignee), 
                multiInstance, 
                BytesFromString(application), 
                BytesFromString(subProcessModelId),
                BytesFromString(subProcessDefinitionId))
            .then(data => {
                if (data.error !== 1) throw new Error(ErrorCode.RUNTIME_ERROR); 
            });
    }

    async createDataMapping(processAddress: string, id: string, direction: number, accessPath: string, 
        dataPath: string, dataStorageId: string, dataStorage: string) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .createDataMapping(BytesFromString(id), direction, BytesFromString(accessPath),
                BytesFromString(dataPath), BytesFromString(dataStorageId), dataStorage);
    }

    async createGateway(processAddress: string, gatewayId: string, gatewayType: number) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .createGateway(BytesFromString(gatewayId), gatewayType);
    }

    async createTransition(processAddress: string, sourceGraphElement: string, targetGraphElement: string) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .createTransition(BytesFromString(sourceGraphElement), BytesFromString(targetGraphElement));
    }

    async setDefaultTransition(processAddress: string, gatewayId: string, activityId: string) {
        await new ProcessDefinition.Contract(this.client, processAddress)
            .setDefaultTransition(BytesFromString(gatewayId), BytesFromString(activityId));
    }

    async createTransitionCondition(processAddress: string, dataType: DataType, gatewayId: string, activityId: string, dataPath: string, dataStorageId: string, dataStorage: string, operator: number, value: string) {
        const processDefinition = new ProcessDefinition.Contract(this.client, processAddress);

        switch (dataType) {
            case DataType.BOOLEAN:
                await processDefinition.createTransitionConditionForBool(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, Boolean(value)
                );
            case DataType.STRING:
                    await processDefinition.createTransitionConditionForString(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, value
                );
            case DataType.BYTES32:
                    await processDefinition.createTransitionConditionForBytes32(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, BytesFromString(value)
                );
            case DataType.UINT:
                    await processDefinition.createTransitionConditionForUint(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DataType.INT:
                    await processDefinition.createTransitionConditionForInt(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DataType.ADDRESS:
                    await processDefinition.createTransitionConditionForAddress(
                    BytesFromString(gatewayId), BytesFromString(activityId), BytesFromString(dataPath),
                    BytesFromString(dataStorageId), dataStorage, operator, value
                );
        }
    }

    async getModelAddressFromId(modelId: string) {
        return this.manager.ProcessModelRepository
            .getModel(BytesFromString(modelId))
            .then(data => data[0]);
    }

    async isValidProcess(processAddress: string) {
        return new ProcessDefinition.Contract(this.client, processAddress).validate()
            .then(data => {
                if (!data.result) throw new Error(`Invalid process definition at ${processAddress}: ${BytesToString(data.errorMessage)}`);
                else return true;
            });
    }

    async getStartActivity(processAddress: string) {
        return new ProcessDefinition.Contract(this.client, processAddress)
            .getStartActivity()
            .then(data => BytesToString(DecodeHex(BytesToString(data[0]))));
    }

    async getProcessInstanceCount() {
        return this.manager.BpmService
            .getNumberOfProcessInstances()
            .then(data => data.size);
    }

    async getProcessInstanceForActivity(activityInstanceId: string) {
        return this.manager.BpmService
            .getProcessInstanceForActivity(DecodeHex(activityInstanceId))
            .then(data => data[0]);
    }

    getProcessInstance(piAddress: string) {
        return new ProcessInstance.Contract(this.client, piAddress);
    }

    async getActivityInDataAsBool(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsBool(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsBool()[0];
    };
    
    async getActivityInDataAsString(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsString(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsString()[0];
    };
    
    async getActivityInDataAsBytes32(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsBytes32(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsBytes32()[0];
    };
    
    async getActivityInDataAsUint(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsUint(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsUint()[0];
    };

    async getActivityInDataAsInt(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsInt(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsInt()[0];
    };

    async getActivityInDataAsAddress(userAddr: string, activityInstanceId: string, dataMappingId: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).getActivityInDataAsAddress(DecodeHex(activityInstanceId), BytesFromString(dataMappingId));
        const response = await this.callOnBehalfOf(userAddr, piAddress, payload);
        return ProcessInstance.Decode(this.client, DecodeHex(response)).getActivityInDataAsAddress()[0];
    };

    async setActivityOutDataAsBool(userAddr: string, activityInstanceId: string, dataMappingId: string, value: boolean) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsBool(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async setActivityOutDataAsString(userAddr: string, activityInstanceId: string, dataMappingId: string, value: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsString(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async setActivityOutDataAsBytes32(userAddr: string, activityInstanceId: string, dataMappingId: string, value: Buffer) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsBytes32(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async setActivityOutDataAsUint(userAddr: string, activityInstanceId: string, dataMappingId: string, value: number) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsUint(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async setActivityOutDataAsInt(userAddr: string, activityInstanceId: string, dataMappingId: string, value: number) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsInt(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async setActivityOutDataAsAddress(userAddr: string, activityInstanceId: string, dataMappingId: string, value: string) {
        const piAddress = await this.getProcessInstanceForActivity(activityInstanceId);
        const payload = ProcessInstance.Encode(this.client).setActivityOutDataAsString(DecodeHex(activityInstanceId), BytesFromString(dataMappingId), value);
        await this.callOnBehalfOf(userAddr, piAddress, payload);
    };
    
    async getDataMappingKeys(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, direction: Direction) {
        const countPromise = direction === Direction.IN ?
            processDefinition.getInDataMappingKeys :
            processDefinition.getOutDataMappingKeys;

        return countPromise(BytesFromString(activityId))
            .then(data => data[0].map(key => BytesToString(key)));
    }

    async getDataMappingDetails(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, dataMappingIds: Array<string>, direction: Direction) {
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
            dataPromises.push(getter(BytesFromString(activityId), BytesFromString(dataMappingId)));
        });
        return Promise.all(dataPromises);
    }

    async getDataMappingDetailsForActivity(pdAddress: string, activityId: string, dataMappingIds: Array<string>, direction: Direction) {
        const processDefinition = new ProcessDefinition.Contract(this.client, pdAddress)

        // NOTE: activityId are hex converted inside getDataMappingKeys and not here
        const keys = dataMappingIds || (await this.getDataMappingKeys(processDefinition, activityId, direction));
        // NOTE: activityId and dataMappingIds are hex converted inside getDataMappingDetails and not here
        const details = await this.getDataMappingDetails(processDefinition, activityId, keys, direction);
        return details;
    }

    async getActivityInstanceData(piAddress: string, activityInstanceId: string) {
        const data = await this.manager.BpmService.getActivityInstanceData(piAddress, DecodeHex(activityInstanceId));
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
            .then(data => BytesToString(data));
    }

    // TODO: type guard value
    async completeActivity(actingUserAddress: string, activityInstanceId: string, dataMappingId?: string | null, dataType?: DataType, value?: boolean | string | Buffer | number) {
        const activityInstanceID = DecodeHex(activityInstanceId);
        
        const piAddress = await this.manager.BpmService
            .getProcessInstanceForActivity(activityInstanceID)
            .then(data => data[0]);

        const bpmService = this.manager.BpmService.address;
        let payload: string;
        if (dataMappingId) {
            const hexDataMappingId = BytesFromString(dataMappingId);
            switch (dataType) {
                case DataType.BOOLEAN:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithBoolData(activityInstanceID, bpmService, hexDataMappingId, value as boolean)
                    break;
                case DataType.STRING:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithStringData(activityInstanceID, bpmService, hexDataMappingId, value as string);
                    break;
                case DataType.BYTES32:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithBytes32Data(activityInstanceID, bpmService, hexDataMappingId, value as Buffer);
                    break;
                case DataType.UINT:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithUintData(activityInstanceID, bpmService, hexDataMappingId, value as number);
                    break;
                case DataType.INT:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithIntData(activityInstanceID, bpmService, hexDataMappingId, value as number);
                    break;
                case DataType.ADDRESS:
                    payload = ProcessInstance.Encode(this.client)
                        .completeActivityWithAddressData(activityInstanceID, bpmService, hexDataMappingId, value as string);
                    break;
                default:
                    throw new Error(`Unsupported dataType parameter: ${dataType}`)
            }
        } else {
            payload = ProcessInstance.Encode(this.client).completeActivity(activityInstanceID, bpmService);
        }
        const returnData = await CallOnBehalfOf(this.client, actingUserAddress, piAddress, payload);
        const data = ProcessInstance.Decode(this.client, DecodeHex(returnData)).completeActivity();
        const error = data.error.valueOf();

        switch(error) {
            case 1:
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

    async createUserInEcosystem(user: { username: string; }, ecosystemAddress: string) {
        return this.manager.ParticipantsManager
            .createUserAccount(DecodeHex(user.username), '0x0', ecosystemAddress)
            .then(data => data.userAccount);
    }

    async createUser(user: { username: string; }) {
        return this.createUserInEcosystem(user, this.ecosystem);
    }

    async getUserByIdAndEcosystem(id: string, ecosystemAddress: string) {
        return new Ecosystem.Contract(this.client, ecosystemAddress)
            .getUserAccount(DecodeHex(id))
            .then(data => data._account)
    }

    async getUserByUsername(username: string) {
        return this.getUserByIdAndEcosystem(username, this.ecosystem);
    }

    async getUserByUserId(userid: string) {
        return this.getUserByIdAndEcosystem(userid, this.ecosystem);
    }

    async addUserToEcosystem(username: string, address: string) {
        return new Ecosystem.Contract(this.client, this.ecosystem)
            .addUserAccount(DecodeHex(username), address);
    }

    async migrateUserAccountInEcosystem(userAddress: string, migrateFromId: string, migrateToId: string) {
        return new Ecosystem.Contract(this.client, this.ecosystem)
            .migrateUserAccount(userAddress, DecodeHex(migrateFromId), DecodeHex(migrateToId));
    }

    async createOrganization(org: { approvers: string[]; defaultDepartmentId: string; }) {
        return this.manager.ParticipantsManager
            .createOrganization(org.approvers ? org.approvers : [], DecodeHex(org.defaultDepartmentId))
            .then(value => value[1]);
    }

    async addUserToOrganization(userAddress: any, organizationAddress: any, actingUserAddress: any) {
        const payload = Organization.Encode(this.client).addUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).addUser();
        return data.successful;
    }

    async removeUserFromOrganization(userAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).removeUser();
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

    async createDepartment(organizationAddress: string, id: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addDepartment(DecodeHex(id));
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).addDepartment();
        return data[0];
    }

    async removeDepartment(organizationAddress: string, id: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeDepartment(DecodeHex(id));
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).removeDepartment();
        return data.successful;
    }

    async addDepartmentUser(organizationAddress: string, depId: string, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addUserToDepartment(userAddress, DecodeHex(depId));
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).addUserToDepartment();
        return data.successful;
    }

    async removeDepartmentUser(organizationAddress: string, depId: string, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUserFromDepartment(userAddress, DecodeHex(depId));
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, DecodeHex(response)).removeUserFromDepartment();
        return data[0];
    }
}

export async function NewContracts(url: string, account: string, ecosystemName: string): Promise<Contracts> {
    const client = new Client(url, account);
    const manager = await NewManager(client);
    
    let ecosystemAddress = await GetFromNameRegistry(client, ecosystemName);
    if (!ecosystemAddress) {
        ecosystemAddress = await RegisterEcosystem(client, manager, account, ecosystemName);
    }
    
    return new Contracts(client, manager, ecosystemAddress);
}