import { Client } from './lib/client';

import { ErrorsLib } from './commons-base/ErrorsLib';
import { TypeUtilsLib } from './commons-utils/TypeUtilsLib';
import { ArrayUtilsLib } from './commons-utils/ArrayUtilsLib';
import { MappingsLib } from './commons-collections/MappingsLib';
import { DataStorageUtils } from './commons-collections/DataStorageUtils';
import { ERC165Utils } from './commons-standards/ERC165Utils';
import { BpmModelLib } from './bpm-model/BpmModelLib';
import { BpmRuntimeLib } from './bpm-runtime/BpmRuntimeLib';
import { AgreementsAPI } from './agreements/AgreementsAPI';
import { DataTypesAccess } from './commons-utils/DataTypesAccess';

import { DefaultDoug } from './commons-management/DefaultDoug';
import { DougProxy } from './commons-management/DougProxy';
import { DOUG } from './commons-management/DOUG';
import { DefaultArtifactsRegistry } from './commons-management/DefaultArtifactsRegistry';
import { OwnedDelegateUnstructuredProxy } from './commons-management/OwnedDelegateUnstructuredProxy';
import { DefaultEcosystemRegistry } from './commons-auth/DefaultEcosystemRegistry';
import { EcosystemRegistryDb } from './commons-auth/EcosystemRegistryDb';
import { UpgradeOwned } from './commons-management/UpgradeOwned';
import { DefaultParticipantsManager } from './commons-auth/DefaultParticipantsManager';
import { ParticipantsManagerDb } from './commons-auth/ParticipantsManagerDb';
import { DefaultOrganization } from './commons-auth/DefaultOrganization';
import { DefaultUserAccount } from './commons-auth/DefaultUserAccount';
import { DefaultEcosystem } from './commons-auth/DefaultEcosystem';
import { DefaultProcessModelRepository } from './bpm-model/DefaultProcessModelRepository';
import { ProcessModelRepositoryDb } from './bpm-model/ProcessModelRepositoryDb';
import { DefaultApplicationRegistry } from './bpm-runtime/DefaultApplicationRegistry';
import { ApplicationRegistryDb } from './bpm-runtime/ApplicationRegistryDb';
import { DefaultBpmService } from './bpm-runtime/DefaultBpmService';
import { BpmServiceDb } from './bpm-runtime/BpmServiceDb';
import { DefaultProcessModel } from './bpm-model/DefaultProcessModel';
import { DefaultProcessDefinition } from './bpm-model/DefaultProcessDefinition';
import { DefaultProcessInstance } from './bpm-runtime/DefaultProcessInstance';
import { DefaultArchetypeRegistry } from './agreements/DefaultArchetypeRegistry';
import { ArchetypeRegistryDb } from './agreements/ArchetypeRegistryDb';
import { DefaultActiveAgreementRegistry } from './agreements/DefaultActiveAgreementRegistry';
import { ActiveAgreementRegistryDb } from './agreements/ActiveAgreementRegistryDb';
import { DefaultArchetype } from './agreements/DefaultArchetype';
import { DefaultActiveAgreement } from './agreements/DefaultActiveAgreement';
import { IsoCountries100 } from './commons-standards/IsoCountries100';
import { IsoCurrencies100 } from './commons-standards/IsoCurrencies100';
import { AgreementSignatureCheck } from './agreements/AgreementSignatureCheck';
import { ApplicationRegistry } from './bpm-runtime/ApplicationRegistry';
import { TotalCounterCheck } from './active-agreements/TotalCounterCheck';
import { SetToNameRegistry } from './lib/utils';
import { CONTRACTS } from './lib/constants';
import { CallTx } from '@hyperledger/burrow/proto/payload_pb';

function assert(left: string, right: string) {
    if (left != right) throw new Error(`Expected to match: ${left} != ${right}`);
}

async function DeployDOUG(client: Client, errorsLib: Promise<string>, eRC165Utils: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const eRC165UtilsAddress = await eRC165Utils;

    const defaultArtifactsRegistryAddress = await DefaultArtifactsRegistry.Deploy(client, errorsLibAddress);
    const artifactsRegistryAddress = await OwnedDelegateUnstructuredProxy.Deploy(client, errorsLibAddress, defaultArtifactsRegistryAddress);
    const defaultArtifactsRegistry = new DefaultArtifactsRegistry.Contract(client, artifactsRegistryAddress);
    await defaultArtifactsRegistry.initialize();

    const defaultDougAddress = await DefaultDoug.Deploy(client, errorsLibAddress, eRC165UtilsAddress);
    const dougProxyAddress = await DougProxy.Deploy(client, errorsLibAddress, defaultDougAddress)
    const defaultDoug = new DefaultDoug.Contract(client, dougProxyAddress);

    await defaultArtifactsRegistry.transferSystemOwnership(dougProxyAddress);
    await defaultDoug.setArtifactsRegistry(artifactsRegistryAddress);

    const getArtifactsRegistryFromProxy = await defaultDoug.getArtifactsRegistry().then(data => data[0]);
    assert(artifactsRegistryAddress, getArtifactsRegistryFromProxy);

    return new DOUG.Contract(client, dougProxyAddress);
}

async function DeployEcosystemRegistry(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, mappingsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    
    const ecosystemRegistryAddress = await DefaultEcosystemRegistry.Deploy(client, errorsLibAddress);
    const ecosystemRegistry = new DefaultEcosystemRegistry.Contract(client, ecosystemRegistryAddress);
    const ecosystemRegistryDbAddress = await EcosystemRegistryDb.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const ecosystemRegistryDb = new EcosystemRegistryDb.Contract(client, ecosystemRegistryDbAddress);

    await ecosystemRegistryDb.transferSystemOwnership(ecosystemRegistryAddress);
    await ecosystemRegistry.acceptDatabase(ecosystemRegistryDb.address);
    const upgradeEcosystemOwnership = new UpgradeOwned.Contract(client, ecosystemRegistry.address);
    await upgradeEcosystemOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.EcosystemRegistry, ecosystemRegistry.address);
    return ecosystemRegistry;
}

async function DeployParticipantsManager(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, mappingsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;

    const participantsManagerAddress = await DefaultParticipantsManager.Deploy(client, errorsLibAddress);
    const participantsManager = new DefaultParticipantsManager.Contract(client, participantsManagerAddress);
    const participantsManagerDbAddress = await ParticipantsManagerDb.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const participantsManagerDb = new ParticipantsManagerDb.Contract(client, participantsManagerDbAddress);

    await participantsManagerDb.transferSystemOwnership(participantsManager.address);
    await participantsManager.acceptDatabase(participantsManagerDb.address);
    const upgradeParticipantsOwnership = new UpgradeOwned.Contract(client, participantsManager.address);
    await upgradeParticipantsOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.ParticipantsManager, participantsManager.address);
    return participantsManager;
}

async function RegisterEcosystemAndParticipantClasses(client: Client, 
    doug: DOUG.Contract<CallTx>, 
    participantsManager: Promise<DefaultParticipantsManager.Contract<CallTx>>, 
    ecosystemRegistry: Promise<DefaultEcosystemRegistry.Contract<CallTx>>,
    errorsLib: Promise<string>, mappingsLib: Promise<string>, arrayUtilsLib: Promise<string>) {

    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    const arrayUtilsLibAddress = await arrayUtilsLib;

    const participants = await participantsManager;
    const ecosystem = await ecosystemRegistry;

    const defaultOrganizationAddress = await DefaultOrganization.Deploy(client, errorsLibAddress, mappingsLibAddress, arrayUtilsLibAddress);
    const objectClassOrganization = await participants.OBJECT_CLASS_ORGANIZATION().then(data => data[0]);
    await doug.register(objectClassOrganization, defaultOrganizationAddress);
    const defaultUserAccountAddress = await DefaultUserAccount.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const objectClassUserAccount = await participants.OBJECT_CLASS_USER_ACCOUNT().then(data => data[0]);
    await doug.register(objectClassUserAccount, defaultUserAccountAddress);
    const defaultEcosystemAddress = await DefaultEcosystem.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const objectClassEcosystem = await ecosystem.OBJECT_CLASS_ECOSYSTEM().then(data => data[0]);
    await doug.register(objectClassEcosystem, defaultEcosystemAddress);
}

async function DeployProcessModelRepository(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, mappingsLib: Promise<string>, arrayUtilsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    const arrayUtilsLibAddress = await arrayUtilsLib;

    const processModelRepositoryAddress = await DefaultProcessModelRepository.Deploy(client, errorsLibAddress);    
    const processModelRepository = new DefaultProcessModelRepository.Contract(client, processModelRepositoryAddress);    
    const processModelRepositoryDbAddress = await ProcessModelRepositoryDb.Deploy(client, errorsLibAddress, mappingsLibAddress, arrayUtilsLibAddress);
    const processModelRepositoryDb = new ProcessModelRepositoryDb.Contract(client, processModelRepositoryDbAddress)

    await processModelRepositoryDb.transferSystemOwnership(processModelRepository.address);
    await processModelRepository.acceptDatabase(processModelRepositoryDb.address);
    const upgradeProcessModelOwnership = new UpgradeOwned.Contract(client, processModelRepository.address);
    await upgradeProcessModelOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.ProcessModelRepository, processModelRepository.address);
    return processModelRepository;
}

async function DeployApplicationRegistry(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;

    const applicationRegistryAddress = await DefaultApplicationRegistry.Deploy(client, errorsLibAddress);    
    const applicationRegistry = new DefaultApplicationRegistry.Contract(client, applicationRegistryAddress);    
    const applicationRegistryDbAddress = await ApplicationRegistryDb.Deploy(client, errorsLibAddress);
    const applicationRegistryDb = new ApplicationRegistryDb.Contract(client, applicationRegistryDbAddress);

    await applicationRegistryDb.transferSystemOwnership(applicationRegistry.address);
    await applicationRegistry.acceptDatabase(applicationRegistryDb.address);
    const upgradeApplicationRegistryOwnership = new UpgradeOwned.Contract(client, applicationRegistry.address);
    await upgradeApplicationRegistryOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.ApplicationRegistry, applicationRegistry.address);
    return applicationRegistry;
}

async function DeployBpmService(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, mappingsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;

    const bpmServiceAddress = await DefaultBpmService.Deploy(client, errorsLibAddress, CONTRACTS.ProcessModelRepository, CONTRACTS.ApplicationRegistry);    
    const bpmService = new DefaultBpmService.Contract(client, bpmServiceAddress);    
    const bpmServiceDbAddress = await BpmServiceDb.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const bpmServiceDb = new BpmServiceDb.Contract(client, bpmServiceDbAddress);

    await bpmServiceDb.transferSystemOwnership(bpmService.address);
    await bpmService.acceptDatabase(bpmServiceDb.address);
    const upgradeBpmServiceOwnership = new UpgradeOwned.Contract(client, bpmService.address);
    await upgradeBpmServiceOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.BpmService, bpmService.address);
    return bpmService;
}

async function RegisterProcessModelRepositoryClasses(client: Client, 
    doug: DOUG.Contract<CallTx>, 
    contract: Promise<DefaultProcessModelRepository.Contract<CallTx>>, 
    service: Promise<DefaultBpmService.Contract<CallTx>>,

    errorsLib: Promise<string>,
    mappingsLib: Promise<string>,
    arrayUtilsLib: Promise<string>,
    bpmModelLib: Promise<string>,
    typeUtilsLib: Promise<string>,

){
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    const bpmModelLibAddress = await bpmModelLib;
    const arrayUtilsLibAddress = await arrayUtilsLib;
    const typeUtilsLibAddress = await typeUtilsLib;

    const processModelRepository = await contract;
    const bpmService = await service;

    const getModelRepositoryFromBpmService = await bpmService.getProcessModelRepository().then(data => data[0]);
    assert(getModelRepositoryFromBpmService, processModelRepository.address);

    const defaultProcessModelImplementationAddress = await DefaultProcessModel.Deploy(client, errorsLibAddress, mappingsLibAddress);
    const objectClassProcessModel = await processModelRepository.OBJECT_CLASS_PROCESS_MODEL().then(data => data[0]);
    await doug.register(objectClassProcessModel, defaultProcessModelImplementationAddress);

    const defaultProcessDefinitionImplementationAddress = await DefaultProcessDefinition.Deploy(client, bpmModelLibAddress, errorsLibAddress, arrayUtilsLibAddress, typeUtilsLibAddress);
    const objectClassProcessDefinition = await processModelRepository.OBJECT_CLASS_PROCESS_DEFINITION().then(data => data[0]);
    await doug.register(objectClassProcessDefinition, defaultProcessDefinitionImplementationAddress);
}

async function RegisterApplicationRepositoryClasses(client: Client, 
    doug: DOUG.Contract<CallTx>, 
    contract: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
    service: Promise<DefaultBpmService.Contract<CallTx>>,

    errorsLib: Promise<string>,
    bpmRuntimeLib: Promise<string>,
    dataStorageUtils: Promise<string>,
){
    const applicationRegistry = await contract;
    const bpmService = await service;

    const errorsLibAddress = await errorsLib;
    const bpmRuntimeLibAddress = await bpmRuntimeLib;
    const dataStorageUtilsAddress = await dataStorageUtils;


    const getApplicationRegistryFromBpmService = await bpmService.getApplicationRegistry().then(data => data[0]);
    assert(getApplicationRegistryFromBpmService, applicationRegistry.address);

    const defaultProcessInstanceImplementationAddress = await DefaultProcessInstance.Deploy(client, bpmRuntimeLibAddress, errorsLibAddress, dataStorageUtilsAddress);
    const objectClassProcessInstance = await bpmService.OBJECT_CLASS_PROCESS_INSTANCE().then(data => data[0]);
    await doug.register(objectClassProcessInstance, defaultProcessInstanceImplementationAddress);
}

async function DeployArchetypeRegistry(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, mappingsLib: Promise<string>, arrayUtilsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    const arrayUtilsLibAddress = await arrayUtilsLib;

    const archetypeRegistryAddress = await DefaultArchetypeRegistry.Deploy(client, errorsLibAddress);
    const archetypeRegistry = new DefaultArchetypeRegistry.Contract(client, archetypeRegistryAddress);
    const archetypeRegistryDbAddress = await ArchetypeRegistryDb.Deploy(client, errorsLibAddress, mappingsLibAddress, arrayUtilsLibAddress);
    const archetypeRegistryDb = new ArchetypeRegistryDb.Contract(client, archetypeRegistryDbAddress);

    await archetypeRegistryDb.transferSystemOwnership(archetypeRegistry.address);
    await archetypeRegistry.acceptDatabase(archetypeRegistryDb.address);
    const upgradeArchetypeRegistryOwnership = new UpgradeOwned.Contract(client, archetypeRegistry.address);
    await upgradeArchetypeRegistryOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.ArchetypeRegistry, archetypeRegistry.address);
    return archetypeRegistry;
}

async function DeployActiveAgreementRegistry(client: Client, doug: DOUG.Contract<CallTx>, errorsLib: Promise<string>, dataStorageUtils: Promise<string>, mappingsLib: Promise<string>, arrayUtilsLib: Promise<string>) {
    const errorsLibAddress = await errorsLib;
    const dataStorageUtilsAddress = await dataStorageUtils;
    const mappingsLibAddress = await mappingsLib;
    const arrayUtilsLibAddress = await arrayUtilsLib;

    const activeAgreementRegistryAddress = await DefaultActiveAgreementRegistry.Deploy(client, errorsLibAddress, dataStorageUtilsAddress, CONTRACTS.ArchetypeRegistry, CONTRACTS.BpmService);
    const activeAgreementRegistry = new DefaultActiveAgreementRegistry.Contract(client, activeAgreementRegistryAddress);
    const activeAgreementRegistryDbAddress = await ActiveAgreementRegistryDb.Deploy(client, errorsLibAddress, mappingsLibAddress, arrayUtilsLibAddress);
    const activeAgreementRegistryDb = new ActiveAgreementRegistryDb.Contract(client, activeAgreementRegistryDbAddress);
    
    await activeAgreementRegistryDb.transferSystemOwnership(activeAgreementRegistry.address);
    await activeAgreementRegistry.acceptDatabase(activeAgreementRegistryDb.address);
    const upgradeActiveAgreementRegistryOwnership = new UpgradeOwned.Contract(client, activeAgreementRegistry.address);
    await upgradeActiveAgreementRegistryOwnership.transferUpgradeOwnership(doug.address);
    await doug.deploy(CONTRACTS.ActiveAgreementRegistry, activeAgreementRegistry.address);
    return activeAgreementRegistry;
}

async function RegisterAgreementClasses(client: Client, 
    doug: DOUG.Contract<CallTx>, 
    agreement: Promise<DefaultActiveAgreementRegistry.Contract<CallTx>>,
    archetype: Promise<DefaultArchetypeRegistry.Contract<CallTx>>,
    service: Promise<DefaultBpmService.Contract<CallTx>>,

    errorsLib: Promise<string>,
    mappingsLib: Promise<string>,
    eRC165Utils: Promise<string>,
    arrayUtilsLib: Promise<string>,
    agreementsAPI: Promise<string>,
    dataStorageUtils: Promise<string>,

){
    const activeAgreementRegistry = await agreement;
    const archetypeRegistry = await archetype;
    const bpmService = await service;

    const errorsLibAddress = await errorsLib;
    const mappingsLibAddress = await mappingsLib;
    const eRC165UtilsAddress = await eRC165Utils;
    const arrayUtilsLibAddress = await arrayUtilsLib;
    const agreementsAPIAddress = await agreementsAPI;
    const dataStorageUtilsAddress = await dataStorageUtils;

    const getBpmServiceFromAgreementRegistry = await activeAgreementRegistry.getBpmService().then(data => data.location);
    assert(getBpmServiceFromAgreementRegistry, bpmService.address);
    const getArchetypeRegistryFromAgreementRegistry = await activeAgreementRegistry.getArchetypeRegistry().then(data => data.location);
    assert(getArchetypeRegistryFromAgreementRegistry, archetypeRegistry.address);

    const defaultArchetypeImplementationAddress = await DefaultArchetype.Deploy(client, errorsLibAddress, mappingsLibAddress, eRC165UtilsAddress, arrayUtilsLibAddress);
    const objectClassArchetype = await archetypeRegistry.OBJECT_CLASS_ARCHETYPE().then(data => data[0]);
    await doug.register(objectClassArchetype, defaultArchetypeImplementationAddress);
    const defaultActiveAgreementImplementationAddress = await DefaultActiveAgreement.Deploy(client, agreementsAPIAddress, errorsLibAddress, dataStorageUtilsAddress, mappingsLibAddress, eRC165UtilsAddress, arrayUtilsLibAddress);
    const objectClassActiveAgreement = await activeAgreementRegistry.OBJECT_CLASS_AGREEMENT().then(data => data[0]);
    await doug.register(objectClassActiveAgreement, defaultActiveAgreementImplementationAddress);
}

async function DeployOne<Addr>(cli: Client, addr: Promise<Addr>, call: (client: Client, arg1: Addr) => Promise<Addr>): Promise<Addr> {
    return await call(cli, await addr);
}

async function DeployTwo(cli: Client, addr1: Promise<string>, addr2: Promise<string>, call: (client: Client, arg1: string, arg2: string) => Promise<string>): Promise<string> {
    return await call(cli, await addr1, await addr2);
}

export async function Register(client: Client) {
    const errorsLib = ErrorsLib.Deploy(client);
    const typeUtilsLib = TypeUtilsLib.Deploy(client);
    const arrayUtilsLib = ArrayUtilsLib.Deploy(client);
    const mappingsLib = DeployTwo(client, arrayUtilsLib, typeUtilsLib, MappingsLib.Deploy)
    const dataStorageUtils = DeployTwo(client, errorsLib, typeUtilsLib, DataStorageUtils.Deploy)
    const eRC165Utils = ERC165Utils.Deploy(client);
    const bpmModelLib = DeployTwo(client, errorsLib, dataStorageUtils, BpmModelLib.Deploy)
    const bpmRuntimeLib = DeployTwo(client, errorsLib, eRC165Utils, BpmRuntimeLib.Deploy)
    const agreementsAPI = DeployOne(client, eRC165Utils, AgreementsAPI.Deploy)
    const dataTypesAccess = DataTypesAccess.Deploy(client)

    const doug = await DeployDOUG(client, errorsLib, eRC165Utils);
    const ecosystemRegistry = DeployEcosystemRegistry(client, doug, errorsLib, mappingsLib);
    const participantsManager = DeployParticipantsManager(client, doug, errorsLib, mappingsLib);
    const processModelRepository = DeployProcessModelRepository(client, doug, errorsLib, mappingsLib, arrayUtilsLib);
    const applicationRegistry = DeployApplicationRegistry(client, doug, errorsLib);
    const bpmService = DeployBpmService(client, doug, errorsLib, mappingsLib);
    const archetypeRegistry = DeployArchetypeRegistry(client, doug, errorsLib, mappingsLib, arrayUtilsLib);
    const activeAgreementRegistry = DeployActiveAgreementRegistry(client, doug, errorsLib, dataStorageUtils, mappingsLib, arrayUtilsLib);

    await Promise.all([
        SetToNameRegistry(client, CONTRACTS.DOUG, doug.address),
        RegisterEcosystemAndParticipantClasses(client, doug, participantsManager, ecosystemRegistry, errorsLib, mappingsLib, arrayUtilsLib),
        RegisterProcessModelRepositoryClasses(client, doug, processModelRepository, bpmService, errorsLib, mappingsLib, arrayUtilsLib, bpmModelLib, typeUtilsLib),
        RegisterApplicationRepositoryClasses(client, doug, applicationRegistry, bpmService, errorsLib, bpmRuntimeLib, dataStorageUtils),
        RegisterAgreementClasses(client, doug, activeAgreementRegistry, archetypeRegistry, bpmService, errorsLib, mappingsLib, eRC165Utils, arrayUtilsLib, agreementsAPI, dataStorageUtils),
        DeployOne(client, errorsLib, IsoCountries100.Deploy),
        DeployOne(client, errorsLib, IsoCurrencies100.Deploy),
    ])
    
    // Applications
    // ApplicationTypes Enum: {0=EVENT, 1=SERVICE, 2=WEB}

    const appRegistry = new ApplicationRegistry.Contract(client, (await applicationRegistry).address);
    const agreementSignatureCheckAddress = await AgreementSignatureCheck.Deploy(client);
    const totalCounterCheckAddress = await TotalCounterCheck.Deploy(client);

    await Promise.all([
        appRegistry.addApplication(Buffer.from("AgreementSignatureCheck"), 2, agreementSignatureCheckAddress, Buffer.from(""), Buffer.from("SigningWebFormWithSignatureCheck")),
        appRegistry.addAccessPoint(Buffer.from("AgreementSignatureCheck"), Buffer.from("agreement"), 59, 0),
        appRegistry.addApplication(Buffer.from("TotalCounterCheck"), 1, totalCounterCheckAddress, Buffer.from(""), Buffer.from("")),
        appRegistry.addAccessPoint(Buffer.from("TotalCounterCheck"), Buffer.from("numberIn"), 8, 0),
        appRegistry.addAccessPoint(Buffer.from("TotalCounterCheck"), Buffer.from("totalIn"), 8, 0),
        appRegistry.addAccessPoint(Buffer.from("TotalCounterCheck"), Buffer.from("numberOut"), 8, 1),
        appRegistry.addAccessPoint(Buffer.from("TotalCounterCheck"), Buffer.from("completedOut"), 1, 1),
    ])

}

async function main() {
    const client = new Client('localhost:10997', '1CA0D665087CACE1B965F6B04873D96EC5C7F8BA');
    try {
        await Register(client);
    } catch (err) {
        console.log(err)
        process.exit(1);
    }
}

main();