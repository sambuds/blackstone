import { Contracts } from '../lib/contracts';
import { Archetype, Agreement, Parameter, ParameterType, Model, DataType, ActivityInstanceState, LegalState } from '../lib/types';
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

describe('FORMATION - EXECUTION with 1 User Task each', () => {
  let piAddress: string;
  let aiId: Buffer;

  const model: Model = {
    id: rid(5, 'aA0'),
    version: [1, 0, 0],
    address: '',
  };
  
  const INTERFACE_FORMATION = 'Agreement Formation';
  const INTERFACE_EXECUTION = 'Agreement Execution';

  let buyer = {
    username: `buyer${rid(5, 'aA0')}`,
    address: '',
  };

  let seller = {
    username: `seller${rid(5, 'aA0')}`,
    address: '',
  };

  let buyProcessID = 'buy';
  let sellProcessID = 'sell';

  const archetype: Archetype = {
    price: 10,
    isPrivate: true,
    active: true,
    author: '',
    owner: '',
    formationProcess: '',
    executionProcess: '',
    packageId: '',
    governingArchetypes: [],
  };

  const parameters: Array<Parameter> = [
    { 
      type: ParameterType.SIGNING_PARTY, 
      name: 'Buyer' 
    }, 
    { 
      type: ParameterType.USER_ORGANIZATION, 
      name: 'Seller' 
    }
  ];

  const agreement: Agreement = {
    // name: 'user tasks agreement',
    archetype: '',
    creator: '',
    owner: '',
    privateParametersFileReference: '',
    parties: [],
    collectionId: '',
    governingAgreements: [],
  };

  let buyTask = {
    activityId: 'buy',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: buyer.username,
    multiInstance: false,
  };

  let sellTask = {
    activityId: 'sell',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: seller.username,
    multiInstance: false,
  };

  it('Should create a buyer and a seller', async () => {
    let resBuyer = await contracts.createUser({
      username: SHA3(buyer.username)
    });
    let resSeller = await contracts.createUser({
      username: SHA3(seller.username)
    });
    expect(resBuyer).to.match(/[0-9A-Fa-f]{40}/);
    expect(resSeller).to.match(/[0-9A-Fa-f]{40}/);
    buyer.address = resBuyer;
    seller.address = resSeller;
    archetype.owner = buyer.address;
    archetype.author = buyer.address;
    agreement.creator = buyer.address;
    // agreement.parameters[0].value = buyer.address;
    // agreement.parameters[1].value = seller.address;
  }).timeout(10000);

  /******************************
   *  DEPLOY MODEL AND PROCESSES
   ******************************/

  it('Should create a process model', async () => {
    model.address = await contracts.createProcessModel(model.id, model.version, buyer.address, false, '');
    expect(model.address).to.match(/[0-9A-Fa-f]{40}/);
  }).timeout(10000);

  it('Should add process model interfaces', async () => {
    await assert.isFulfilled(contracts.addProcessInterface(model.address, INTERFACE_FORMATION));
    await assert.isFulfilled(contracts.addProcessInterface(model.address, INTERFACE_EXECUTION));
  }).timeout(10000);

  it('Should add participants', async () => {
    await assert.isFulfilled(contracts.addParticipant(model.address, buyer.username, '', 'Buyer', 'agreement', ''));
    await assert.isFulfilled(contracts.addParticipant(model.address, seller.username, '', 'Seller', 'agreement', ''));
  }).timeout(10000);

  it('Should add formation process', async () => {
    const buyProcessAddress = await contracts.createProcessDefinition(model.address, buyProcessID);
    expect(buyProcessAddress).to.match(/[0-9A-Fa-f]{40}/);
    archetype.formationProcess = buyProcessAddress;
  }).timeout(10000);

  it('Should add execution process', async () => {
    const sellProcessAddress = await contracts.createProcessDefinition(model.address, sellProcessID);
    expect(sellProcessAddress).to.match(/[0-9A-Fa-f]{40}/);
    archetype.executionProcess = sellProcessAddress;
  }).timeout(10000);

  it('Should add process interface implementations', async () => {
    await assert.isFulfilled(
      contracts.addProcessInterfaceImplementation(model.address, archetype.formationProcess, INTERFACE_FORMATION),
    );
    await assert.isFulfilled(
      contracts.addProcessInterfaceImplementation(model.address, archetype.executionProcess, INTERFACE_EXECUTION),
    );
  }).timeout(10000);

  it('Should add buy task to Agreement Formation', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        archetype.formationProcess,
        buyTask.activityId,
        buyTask.activityType,
        buyTask.taskType,
        buyTask.behavior,
        buyTask.assignee,
        buyTask.multiInstance,
        '',
        '',
        '',
      ),
    );
  }).timeout(10000);

  it('Should add sell task to Agreement Execution', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        archetype.executionProcess,
        sellTask.activityId,
        sellTask.activityType,
        sellTask.taskType,
        sellTask.behavior,
        sellTask.assignee,
        sellTask.multiInstance,
        '',
        '',
        '',
      ),
    );
  }).timeout(10000);

  it('Should validate formation process', async () => {
    const processIsValid = await contracts.isValidProcess(archetype.formationProcess);
    expect(processIsValid).to.be.true;
  }).timeout(10000);

  it('Should validate execution process', async () => {
    const processIsValid = await contracts.isValidProcess(archetype.executionProcess);
    expect(processIsValid).to.be.true;
  }).timeout(10000);

  /**********************************
   *  CREATE ARCHETYPE AND AGREEMENT
   **********************************/

  it('Should create an archetype', async () => {
    archetype.address = await contracts.createArchetype(archetype);
    expect(archetype.address).to.match(/[0-9A-Fa-f]{40}/);
    agreement.archetype = archetype.address;
    await contracts.addArchetypeParameters(archetype.address, parameters);
  }).timeout(10000);

  it('Should create an agreement', async () => {
    agreement.address = await contracts.createAgreement({
      owner: buyer.address,
      privateParametersFileReference: '',
      collectionId: '',
      archetype: agreement.archetype,
      creator: agreement.creator,
      isPrivate: agreement.isPrivate,
      parties: [buyer.address],
      governingAgreements: [],
    });
    expect(agreement.address).to.match(/[0-9A-Fa-f]{40}/);
  }).timeout(10000);

  /************************************
   *  START PROCESS AND COMPLETE TASKS
   ************************************/

  it('Should start process from agreement', done => {
    setTimeout(async () => {
      piAddress = await contracts.startProcessFromAgreement(agreement.address);
      expect(piAddress).to.match(/[0-9A-Fa-f]{40}/);
      done();
    }, 1000);
  }).timeout(10000);

  it('Should sign agreement by buyer', async () => {
    await assert.isFulfilled(contracts.signAgreement(buyer.address, agreement.address))
  }).timeout(10000);

  // TODO: re-enable!
  // it('Should complete task by buyer', async () => {
  //   aiId = await contracts.getActivityInstanceIDAtIndex(piAddress, 0);
  //   await assert.isFulfilled(contracts.completeActivity(buyer.address, aiId));
  // }).timeout(10000);

  // it('Should confirm NO pending user task for buyer', done => {
  //   setTimeout(async () => {
  //     let tasks = await sqlCache.getTasksByUserAddress(buyer.address);
  //     expect(tasks.length).to.equal(0);
  //     done();
  //   }, 1000);
  // }).timeout(10000);

  // TODO: re-enable!
  // it('Should confirm active agreement state EXECUTED', async () => {
  //   const agreementData = await contracts.getActiveAgreementData(agreement.address);
  //   expect(agreementData.legalState).to.equal(LegalState.EXECUTED);
  // }).timeout(10000);

  // it('Should confirm pending user task for seller', async () => {
  //   let tasks = await sqlCache.getTasksByUserAddress(seller.address);
  //   expect(tasks.length).to.equal(1);
  //   expect(tasks[0].activityId).to.equal(sellTask.activityId);
  //   expect(tasks[0].agreementAddress).to.equal(agreement.address);
  //   expect(tasks[0].state).to.equal(4);
  //   aiId = tasks[0].activityInstanceId;
  // }).timeout(10000);

  // TODO: re-enable!
  // it('Should complete task by seller', async () => {
  //   await assert.isFulfilled(contracts.completeActivity(seller.address, aiId));
  // }).timeout(10000);

  // it('Should confirm NO pending user task for seller', done => {
  //   setTimeout(async () => {
  //     let tasks = await sqlCache.getTasksByUserAddress(seller.address);
  //     expect(tasks.length).to.equal(0);
  //     done();
  //   }, 1000);
  // }).timeout(10000);

  // TODO: re-enable!
  // it('Should confirm active agreement state FULFILLED', async () => {
  //   const agreementData = await contracts.getActiveAgreementData(agreement.address);
  //   expect(agreementData.legalState).to.equal(LegalState.FULFILLED);
  // }).timeout(10000);
});
