import { Contracts, Load } from '../lib/contracts';
import { Archetype, Agreement, Model } from '../lib/types';
import rid = require('random-id');
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SHA3 } from '../lib/utils';
import { load } from './before';
chai.use(chaiAsPromised);
const { expect, assert } = chai;

let contracts: Contracts;

before(function (done) {
  this.timeout(99999999);
  load().then(loaded => { contracts = loaded; done(); })
        .catch(error => done(error));
});

describe('CONTRACTS', () => {
  let pmAddress: string;
  let pdFormAddress: string;
  let pdExecAddress: string;
  let archAddress: string;
  let agrAddress: string;
  const formationInterface = 'Agreement Formation';
  const executionInterface = 'Agreement Execution';
  const model: Model = { 
    id: rid(16, 'aA0'), 
    version: [1, 0, 0],
    address: '',
  };
  const formationProcess = { id: 'testProcessDefn1', name: 'Formation Process' };
  const executionProcess = { id: 'testProcessDefn2', name: 'Execution Process' };
  const pAccount = {
    id: 'participantAcct',
    address: '',
  };
  const pConditional = {
    id: 'participantCond',
    dataPath: 'AGREEMENT_PARTIES',
    dataStorageId: 'agreement',
  };
  const userTask1 = {
    id: 'userActivity1',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: 'participantAcct',
    multiInstance: false,
    application: 'AgreementSignatureCheck',
    completionFunction: '',
    subProcessModelId: '',
    subProcessDefinitionId: '',
  };
  const userTask2 = {
    id: 'userActivity2',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: 'participantCond',
    multiInstance: false,
    application: '',
    subProcessModelId: '',
    subProcessDefinitionId: '',
  };
  const dummyTask1 = {
    id: 'dummyTask1',
    activityType: 0,
    taskType: 0,
    behavior: 0,
    assignee: '',
    multiInstance: false,
    application: '',
    subProcessModelId: '',
    subProcessDefinitionId: '',
  };
  const dummyTask2 = {
    id: 'dummyTask2',
    activityType: 0,
    taskType: 0,
    behavior: 0,
    assignee: '',
    multiInstance: false,
    application: '',
    subProcessModelId: '',
    subProcessDefinitionId: '',
  };
  const dataMapping = {
    activityId: 'userActivity1',
    direction: 0,
    accessPath: 'agreement',
    dataPath: 'agreement',
    dataStorageId: '',
    dataStorage: 0x0,
  };
  const archetype: Archetype = {
    price: 10,
    active: true,
    author: '',
    owner: '',
    formationProcess: '',
    executionProcess: '',
    packageId: Buffer.from(''),
    governingArchetypes: [],
  };
  const agreement: Agreement = {
    archetype: '',
    creator: '',
    owner: '',
    privateParametersFileReference: '',
    parties: [],
    collectionId: Buffer.from(''),
    governingAgreements: [],
  };

  it('Should create a user', async () => {
    const res = await contracts.createUser({
      username: Buffer.from(SHA3(rid(16, 'aA0')))
    });
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pAccount.address = res;

    archetype.author = pAccount.address;
    archetype.owner = pAccount.address;

    agreement.owner = pAccount.address;
    agreement.creator = pAccount.address;
    agreement.parties = [pAccount.address];
  }).timeout(10000);

  it('Should create a process model', async () => {
    const res = await contracts.createProcessModel(model.id, model.version, archetype.author, false, 'hoard-grant');
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pmAddress = res;
  }).timeout(10000);

  it('Should add process interface implementations', async () => {
    await contracts.addProcessInterface(pmAddress, formationInterface);
    await contracts.addProcessInterface(pmAddress, executionInterface);
  }).timeout(10000);

  it('Should create a formation process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, formationProcess.id);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pdFormAddress = res;
    archetype.formationProcess = pdFormAddress;
  }).timeout(10000);

  it('Should create a execution process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, executionProcess.id);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pdExecAddress = res;
    archetype.executionProcess = pdExecAddress;
  }).timeout(10000);

  it('Should add formation process interface implementation', () => {
    return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdFormAddress, formationInterface));
  }).timeout(10000);

  it('Should add execution process interface implementation', () => {
    return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdExecAddress, executionInterface));
  }).timeout(10000);

  it('Should add a participant with account address', async () => {
    await assert.isFulfilled(contracts.addParticipant(pmAddress, pAccount.id, pAccount.address, '', '', ''));
  }).timeout(10000);

  it('Should add a conditional performer', () => {
    return assert.isFulfilled(contracts.addParticipant(
          pmAddress,
          pConditional.id,
          "",
          pConditional.dataPath,
          pConditional.dataStorageId,
          ""
    ));
  }).timeout(10000);

  // // it('Should create first activity definition', () => {
  // //   return assert.isFulfilled(contracts.createActivityDefinition(
  // //         pdAddress,
  // //         userTask1.id,
  // //         userTask1.activityType,
  // //         userTask1.taskType,
  // //         userTask1.behavior,
  // //         userTask1.assignee,
  // //         userTask1.multiInstance,
  // //         userTask1.application,
  // //         userTask1.subProcessModelId,
  // //         userTask1.subProcessDefinitionId
  // //   ));
  // // }).timeout(10000);

  // // it('Should create second activity definition', () => {
  // //   return assert.isFulfilled(contracts.createActivityDefinition(
  // //         pdAddress,
  // //         userTask2.id,
  // //         userTask2.activityType,
  // //         userTask2.taskType,
  // //         userTask2.behavior,
  // //         userTask2.assignee,
  // //         userTask2.multiInstance,
  // //         userTask2.application,
  // //         userTask2.subProcessModelId,
  // //         userTask2.subProcessDefinitionId
  // //   ));
  // // }).timeout(10000);

  it('Should create first activity definition', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        pdFormAddress,
        dummyTask1.id,
        dummyTask1.activityType,
        dummyTask1.taskType,
        dummyTask1.behavior,
        dummyTask1.assignee,
        dummyTask1.multiInstance,
        dummyTask1.application,
        dummyTask1.subProcessModelId,
        dummyTask1.subProcessDefinitionId,
      ),
    );
  }).timeout(10000);

  it('Should create second activity definition', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        pdExecAddress,
        dummyTask2.id,
        dummyTask2.activityType,
        dummyTask2.taskType,
        dummyTask2.behavior,
        dummyTask2.assignee,
        dummyTask2.multiInstance,
        dummyTask2.application,
        dummyTask2.subProcessModelId,
        dummyTask2.subProcessDefinitionId,
      ),
    );
  }).timeout(10000);

  // // it('Should create data mapping', () => {
  // //   return assert.isFulfilled(
  // //     contracts.createDataMapping(pdAddress, dataMapping.activityId,
  // //       dataMapping.direction, dataMapping.accessPath, dataMapping.dataPath,
  // //       dataMapping.dataStorageId, dataMapping.dataStorage));
  // // }).timeout(10000);

  // // it('Should create a transition', () => {
  // //   return assert.isFulfilled(
  // //     contracts.createTransition(pdAddress, userTask1.id, userTask2.id));
  // // }).timeout(10000);

  it('Should validate formation process', async () => {
    await expect(contracts.isValidProcess(pdFormAddress)).to.eventually.equal(true);
  }).timeout(10000);

  it('Should validate execution process', async () => {
    await expect(contracts.isValidProcess(pdExecAddress)).to.eventually.equal(true);
  }).timeout(10000);

  it('Should get formation start activity', async () => {
    await expect(contracts.getStartActivity(pdFormAddress)).to.eventually.equal('dummyTask1');
  }).timeout(10000);

  it('Should get execution start activity', async () => {
    await expect(contracts.getStartActivity(pdExecAddress)).to.eventually.equal('dummyTask2');
  }).timeout(10000);

  it('Should fail to create archetype with fake package id', async () => {
    archetype.packageId = Buffer.from('abc123');
    await assert.isRejected(contracts.createArchetype(archetype));
  }).timeout(10000);

  // it('Should create a package', async () => {
  //   archetype.packageId = await contracts.createArchetypePackage(
  //     archetype.author,
  //     false,
  //     true,
  //   );
  //   expect(archetype.packageId).to.exist;
  //   await contracts.activateArchetypePackage(archetype.packageId, archetype.author);
  // }).timeout(10000);

  it('Should create an archetype', async () => {
    archetype.packageId = Buffer.from('');
    const res = await contracts.createArchetype(archetype);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    archAddress = res;
    agreement.archetype = archAddress;
  }).timeout(10000);

  it('Should create an agreement', async () => {
    const res = await contracts.createAgreement(agreement);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    agrAddress = res;
  }).timeout(10000);

  // it('Should get agreement name', async () => {
  //   let name = await contracts.getDataFromAgreement(agrAddress);
  //   expect(name).to.equal(agreement.name);
  // }).timeout(10000);

  it('Should create a process instance from agreement', async () => {
    const res = await contracts.startProcessFromAgreement(agrAddress);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
  }).timeout(10000);

  it('Should update the event log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('EventLog', agrAddress, 'hoard-grant'));
  }).timeout(10000);

  it('Should update the signature log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('SignatureLog', agrAddress, 'hoard-grant'));
  }).timeout(10000);

  // it('Should cancel an agreement', async () => {
  //   await assert.isFulfilled(contracts.cancelAgreement(pAccount.address, agrAddress));
  // }).timeout(10000);
});
