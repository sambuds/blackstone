require('../constants');
const rid = require('random-id');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();
const { expect, assert } = chai;
const crypto = require('crypto');

const logger = require('../../common/logger');
const log = logger.getLogger('tests.Harness');

const contracts = require('../../controllers/contracts-controller');

before(function (done) { // eslint-disable-line func-names
  this.timeout(99999999);
  contracts
    .load()
    .then(() => {
      log.info('Contracts loaded.');
      log.info('Application started. Running Contracts Test Suite ...');
      done();
    })
    .catch((error) => {
      log.error(`Unexpected error initializing the test harness: ${error.message}`);
      done(error);
    });
});

describe('CONTRACTS', () => {
  let pmAddress;
  let pdFormAddress;
  let pdExecAddress;
  let archAddress;
  let agrAddress;
  const formationInterface = 'Agreement Formation';
  const executionInterface = 'Agreement Execution';
  const model = { id: rid(16, 'aA0'), name: 'Model With User Task', version: [1, 0, 0] };
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
  const arch = {
    name: 'TestType1',
    description: 'Test1',
    price: 10,
    isPrivate: false,
    active: true,
    governingArchetypes: [],
  };
  const agreement = {
    name: 'Agreement 1',
    isPrivate: false,
    values: [],
    governingAgreements: [],
  };

  it('Should create a user', async () => {
    const user = { username: rid(16, 'aA0') };
    const res = await contracts.createUser({
      username: crypto
        .createHash('sha256')
        .update(user.username)
        .digest('hex'),
    });
    res.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
    pAccount.address = res;
    arch.author = pAccount.address;
    agreement.creator = pAccount.address;
    agreement.parties = [pAccount.address];
  }).timeout(10000);

  it('Should create a process model', async () => {
    const res = await contracts.createProcessModel(model.id, model.version, arch.author, false, 'hoard-grant');
    res.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
    pmAddress = res;
  }).timeout(10000);

  it('Should add process interface implementations', async () => {
    await contracts.addProcessInterface(pmAddress, formationInterface);
    await contracts.addProcessInterface(pmAddress, executionInterface);
  }).timeout(10000);

  it('Should create a formation process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, formationProcess.id, formationProcess.name);
    res.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
    pdFormAddress = res;
    arch.formationProcessDefinition = pdFormAddress;
  }).timeout(10000);

  it('Should create a execution process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, executionProcess.id, executionProcess.name);
    res.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
    pdExecAddress = res;
    arch.executionProcessDefinition = pdExecAddress;
  }).timeout(10000);

  // it('Should add formation process interface implmentation', () => {
  //   return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdFormAddress, formationInterface));
  // }).timeout(10000);

  // it('Should add execution process interface implmentation', () => {
  //   return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdExecAddress, executionInterface));
  // }).timeout(10000);

  it('Should add a participant with account address', async () => {
    await assert.isFulfilled(contracts.addParticipant(pmAddress, pAccount.id, pAccount.address));
  }).timeout(10000);

  // it('Should add a conditional performer', () => {
  //   return assert.isFulfilled(contracts.addParticipant(
  //         pmAddress,
  //         pConditional.id,
  //         "",
  //         pConditional.dataPath,
  //         pConditional.dataStorageId,
  //         ""
  //   ));
  // }).timeout(10000);

  // it('Should create first activity definition', () => {
  //   return assert.isFulfilled(contracts.createActivityDefinition(
  //         pdAddress,
  //         userTask1.id,
  //         userTask1.activityType,
  //         userTask1.taskType,
  //         userTask1.behavior,
  //         userTask1.assignee,
  //         userTask1.multiInstance,
  //         userTask1.application,
  //         userTask1.subProcessModelId,
  //         userTask1.subProcessDefinitionId
  //   ));
  // }).timeout(10000);

  // it('Should create second activity definition', () => {
  //   return assert.isFulfilled(contracts.createActivityDefinition(
  //         pdAddress,
  //         userTask2.id,
  //         userTask2.activityType,
  //         userTask2.taskType,
  //         userTask2.behavior,
  //         userTask2.assignee,
  //         userTask2.multiInstance,
  //         userTask2.application,
  //         userTask2.subProcessModelId,
  //         userTask2.subProcessDefinitionId
  //   ));
  // }).timeout(10000);

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

  // it('Should create data mapping', () => {
  //   return assert.isFulfilled(
  //     contracts.createDataMapping(pdAddress, dataMapping.activityId,
  //       dataMapping.direction, dataMapping.accessPath, dataMapping.dataPath,
  //       dataMapping.dataStorageId, dataMapping.dataStorage));
  // }).timeout(10000);

  // it('Should create a transition', () => {
  //   return assert.isFulfilled(
  //     contracts.createTransition(pdAddress, userTask1.id, userTask2.id));
  // }).timeout(10000);

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
    arch.packageId = 'abc123';
    await assert.isRejected(contracts.createArchetype(arch));
  }).timeout(10000);

  it('Should create a package', async () => {
    arch.packageId = await contracts.createArchetypePackage(
      'sale of goods package',
      'a package with archetypes for sale of goods',
      arch.author,
      false,
    );
    expect(arch.packageId).to.exist;
  }).timeout(10000);

  it('Should create an archetype', async () => {
    const res = await contracts.createArchetype(arch);
    res.should.match(/[0-9A-Fa-f]{40}/);
    archAddress = res;
    agreement.archetype = archAddress;
  }).timeout(10000);

  it('Should create an agreement', async () => {
    const res = await contracts.createAgreement(agreement);
    res.should.match(/[0-9A-Fa-f]{40}/);
    agrAddress = res;
  }).timeout(10000);

  // it('Should get agreement name', async () => {
  //   let name = await contracts.getDataFromAgreement(agrAddress);
  //   expect(name).to.equal(agreement.name);
  // }).timeout(10000);

  it('Should create a process instance from agreement', async () => {
    const res = await contracts.startProcessFromAgreement(agrAddress);
    res.should.match(/[0-9A-Fa-f]{40}/);
  }).timeout(10000);

  it('Should update the event log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('EventLog', agrAddress, 'hoard-grant'));
  }).timeout(10000);

  it('Should update the signature log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('SignatureLog', agrAddress, 'hoard-grant'));
  }).timeout(10000);

  it('Should cancel an agreement', async () => {
    await assert.isFulfilled(contracts.cancelAgreement(pAccount.address, agrAddress));
  }).timeout(10000);
});
