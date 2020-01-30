import { HexFromString, HexToString, CallOnBehalfOf } from './utils'
import { ProcessModel } from '../bpm-model/ProcessModel';
import { ProcessDefinition } from '../bpm-model/ProcessDefinition';
import { ProcessInstance }from '../bpm-runtime/ProcessInstance';
import { Client } from './client';
import { Manager } from './manager';
import { Controller } from './control';
import { DATA_TYPES, DIRECTION } from './constants';
import { CallTx } from '@hyperledger/burrow/proto/payload_pb';

export class BPMController extends Controller {
    constructor(client: Client, manager: Manager) {
        super(client, manager);
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

        await new ProcessModel.Contract(this.client, pmAddress).addParticipant(participantIdHex, accountAddress, dataPathHex, dataStorageIdHex, dataStorageAddress);
    }

    async createProcessDefinition(modelAddress: string, processDefnId: string) {
        const processDefnIdHex = HexFromString(processDefnId);
        return this.manager.ProcessModelRepository
                .createProcessDefinition(modelAddress, processDefnIdHex) 
                .then(value => value[0]);
    }

    async addProcessInterfaceImplementation(pmAddress: string, pdAddress: string, interfaceId: string) {
        const interfaceIdHex = HexFromString(interfaceId);
        await new ProcessDefinition.Contract(this.client, pdAddress)
            .addProcessInterfaceImplementation(pmAddress, interfaceIdHex)
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
                HexFromString(subProcessDefinitionId));
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

    async createTransitionCondition(processAddress: string, dataType: DATA_TYPES, gatewayId: string, activityId: string, dataPath: string, dataStorageId: string, dataStorage: string, operator: number, value: string) {
        const processDefinition = new ProcessDefinition.Contract(this.client, processAddress);

        switch (dataType) {
            case DATA_TYPES.BOOLEAN:
                await processDefinition.createTransitionConditionForBool(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, Boolean(value)
                );
            case DATA_TYPES.STRING:
                    await processDefinition.createTransitionConditionForString(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, value
                );
            case DATA_TYPES.BYTES32:
                    await processDefinition.createTransitionConditionForBytes32(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, HexFromString(value)
                );
            case DATA_TYPES.UINT:
                    await processDefinition.createTransitionConditionForUint(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DATA_TYPES.INT:
                    await processDefinition.createTransitionConditionForInt(
                    HexFromString(gatewayId), HexFromString(activityId), HexFromString(dataPath),
                    HexFromString(dataStorageId), dataStorage, operator, parseInt(value, 10)
                );
            case DATA_TYPES.ADDRESS:
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
        return new ProcessDefinition.Contract(this.client, processAddress).validate();
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

    async getDataMappingKeys(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, direction: DIRECTION) {
        const countPromise = direction === DIRECTION.IN ?
            processDefinition.getInDataMappingKeys :
            processDefinition.getOutDataMappingKeys;

        return countPromise(HexFromString(activityId))
            .then(data => data[0]);
    }

    async getDataMappingDetails(processDefinition: ProcessDefinition.Contract<CallTx>, activityId: string, dataMappingIds: Array<Buffer>, direction: DIRECTION) {
        const dataPromises: Promise<{
            dataMappingId: Buffer;
            accessPath: Buffer;
            dataPath: Buffer;
            dataStorageId: Buffer;
            dataStorage: string;        
        }>[] = [];
        dataMappingIds.forEach((dataMappingId) => {
            const getter = direction === DIRECTION.IN ?
                processDefinition.getInDataMappingDetails : processDefinition.getOutDataMappingDetails;
                dataPromises.push(getter(HexFromString(activityId), dataMappingId));
        });
        return Promise.all(dataPromises);
    }

    async getDataMappingDetailsForActivity(pdAddress: string, activityId: string, dataMappingIds: Array<Buffer>, direction: DIRECTION) {
        const processDefinition = new ProcessDefinition.Contract(this.client, pdAddress)

        // NOTE: activityId are hex converted inside getDataMappingKeys and not here
        const keys = dataMappingIds || (await this.getDataMappingKeys(processDefinition, activityId, direction));
        // NOTE: activityId and dataMappingIds are hex converted inside getDataMappingDetails and not here
        const details = await this.getDataMappingDetails(processDefinition, activityId, keys, direction);
        return details;
    }

    async getActivityInstanceData(piAddress: string, activityInstanceId: Buffer) {
        const data = await this.manager.BpmService.getActivityInstanceData(piAddress, activityInstanceId)
        return {
            activityId: data.activityId,
            created: data.created,
            completed: data.completed,
            performer: data.performer,
            completedBy: data.completedBy,
            state: data.state,
        };
    }

    async completeActivity(actingUserAddress: string, activityInstanceId: Buffer, dataMappingId: string | null, dataType: number, value = null) {
        const piAddress = await this.manager.BpmService
            .getProcessInstanceForActivity(activityInstanceId)
            .then(data => data[0]);

        const bpmService = this.manager.BpmService.address;
        let payload: string;
        if (dataMappingId) {
            const hexDataMappingId = HexFromString(dataMappingId);
            switch (dataType) {
                case DATA_TYPES.BOOLEAN:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithBoolData(activityInstanceId, bpmService, hexDataMappingId, value)
                    break;
                case DATA_TYPES.STRING:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithStringData(activityInstanceId, bpmService, hexDataMappingId, value);
                    break;
                case DATA_TYPES.BYTES32:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithBytes32Data(activityInstanceId, bpmService, hexDataMappingId, value);
                    break;
                case DATA_TYPES.UINT:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithUintData(activityInstanceId, bpmService, hexDataMappingId, value);
                    break;
                case DATA_TYPES.INT:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithIntData(activityInstanceId, bpmService, hexDataMappingId, value);
                    break;
                case DATA_TYPES.ADDRESS:
                    payload = ProcessInstance.Encode(this.client).completeActivityWithAddressData(activityInstanceId, bpmService, hexDataMappingId, value);
                    break;
                default:
                    throw new Error(`Unsupported dataType parameter: ${dataType}`)
            }
        } else {
            payload = ProcessInstance.Encode(this.client).completeActivity(activityInstanceId, bpmService);
        }

        const returnData = await CallOnBehalfOf(this.client, actingUserAddress, piAddress, payload);
        const data = ProcessInstance.Decode(this.client, returnData).completeActivity();
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

}
