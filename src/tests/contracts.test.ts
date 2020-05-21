import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {Contracts, NewSync, SyncContracts} from '../lib/contracts';
import {Agreement, Archetype, Model} from '../lib/types';
import {SHA3} from '../lib/utils';
import {VentListener} from "../lib/vent";
import {load} from './before';
import rid = require('random-id');

chai.use(chaiAsPromised);
const {expect, assert} = chai;

const bd = 'blackstone_development'

const connectionString = `postgres://${process.env.POSTGRES_DB_USER || bd}:${process.env.POSTGRES_DB_PASSWORD || bd}@${process.env.POSTGRES_DB_HOST || 'localhost'}:${process.env.POSTGRES_DB_PORT || 5432}/${process.env.POSTGRES_DB_DATABASE || bd}`;

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
  const formationProcess = {id: 'testProcessDefn1', name: 'Formation Process'};
  const executionProcess = {id: 'testProcessDefn2', name: 'Execution Process'};
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
    packageId: '',
    governingArchetypes: [],
  };
  const agreement: Agreement = {
    archetype: '',
    creator: '',
    owner: '',
    privateParametersFileReference: '',
    parties: [],
    collectionId: '',
    governingAgreements: [],
  };

  let contracts: Contracts;
  let vent: VentListener;
  let syncContracts: SyncContracts;

  before(async () => {
    contracts = await load()
    vent = new VentListener(connectionString, 5000)
    syncContracts = await NewSync(contracts, vent)
  });

  after(async () => {
    await vent.close()
  })


  it('Should create a user', async () => {
    const res = await contracts.createUser({
      username: SHA3(rid(16, 'aA0'))
    });
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pAccount.address = res;

    archetype.author = pAccount.address;
    archetype.owner = pAccount.address;

    agreement.owner = pAccount.address;
    agreement.creator = pAccount.address;
    agreement.parties = [pAccount.address];
  });

  it('Should create a process model (and sync with VentListener)', async () => {
    // Smoke test for vent listener
    await syncContracts.do(async c => {
      const res = await c.createProcessModel(model.id, model.version, archetype.author, false, 'hoard-grant');
      expect(res).to.match(/[0-9A-Fa-f]{40}/);
      pmAddress = res;
    });
  });

  it('Should add process interface implementations', async () => {
    await contracts.addProcessInterface(pmAddress, formationInterface);
    await contracts.addProcessInterface(pmAddress, executionInterface);
  });

  it('Should create a formation process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, formationProcess.id);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pdFormAddress = res;
    archetype.formationProcess = pdFormAddress;
  });

  it('Should create a execution process definition', async () => {
    const res = await contracts.createProcessDefinition(pmAddress, executionProcess.id);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    pdExecAddress = res;
    archetype.executionProcess = pdExecAddress;
  });

  it('Should add formation process interface implementation', () => {
    return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdFormAddress, formationInterface));
  });

  it('Should add execution process interface implementation', () => {
    return assert.isFulfilled(contracts.addProcessInterfaceImplementation(pmAddress, pdExecAddress, executionInterface));
  });

  it('Should add a participant with account address', async () => {
    await assert.isFulfilled(contracts.addParticipant(pmAddress, pAccount.id, pAccount.address, '', '', ''));
  });

  it('Should add a conditional performer', () => {
    return assert.isFulfilled(contracts.addParticipant(
      pmAddress,
      pConditional.id,
      "",
      pConditional.dataPath,
      pConditional.dataStorageId,
      ""
    ));
  });

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
  // // });

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
  // // });

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
  });

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
  });

  // // it('Should create data mapping', () => {
  // //   return assert.isFulfilled(
  // //     contracts.createDataMapping(pdAddress, dataMapping.activityId,
  // //       dataMapping.direction, dataMapping.accessPath, dataMapping.dataPath,
  // //       dataMapping.dataStorageId, dataMapping.dataStorage));
  // // });

  // // it('Should create a transition', () => {
  // //   return assert.isFulfilled(
  // //     contracts.createTransition(pdAddress, userTask1.id, userTask2.id));
  // // });

  it('Should validate formation process', async () => {
    await expect(contracts.isValidProcess(pdFormAddress)).to.eventually.equal(true);
  });

  it('Should validate execution process', async () => {
    await expect(contracts.isValidProcess(pdExecAddress)).to.eventually.equal(true);
  });

  it('Should get formation start activity', async () => {
    await expect(contracts.getStartActivity(pdFormAddress)).to.eventually.equal('dummyTask1');
  });

  it('Should get execution start activity', async () => {
    await expect(contracts.getStartActivity(pdExecAddress)).to.eventually.equal('dummyTask2');
  });

  it('Should fail to create archetype with fake package id', async () => {
    archetype.packageId = 'abc123';
    await assert.isRejected(contracts.createArchetype(archetype));
  });

  // it('Should create a package', async () => {
  //   archetype.packageId = await contracts.createArchetypePackage(
  //     archetype.author,
  //     false,
  //     true,
  //   );
  //   expect(archetype.packageId).to.exist;
  //   await contracts.activateArchetypePackage(archetype.packageId, archetype.author);
  // });

  it('Should create an archetype', async () => {
    archetype.packageId = '';
    const res = await contracts.createArchetype(archetype);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    archAddress = res;
    agreement.archetype = archAddress;
  });

  it('Should create an agreement', async () => {
    const res = await contracts.createAgreement(agreement);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
    agrAddress = res;
  });

  // it('Should get agreement name', async () => {
  //   let name = await contracts.getDataFromAgreement(agrAddress);
  //   expect(name).to.equal(agreement.name);
  // });

  it('Should create a process instance from agreement', async () => {
    const res = await contracts.startProcessFromAgreement(agrAddress);
    expect(res).to.match(/[0-9A-Fa-f]{40}/);
  });

  it('Should update the event log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('EventLog', agrAddress, 'hoard-grant'));
  });

  it('Should update the signature log hoard reference of an agreement', async () => {
    await assert.isFulfilled(contracts.updateAgreementFileReference('SignatureLog', agrAddress, 'hoard-grant'));
  });

  // it('Should cancel an agreement', async () => {
  //   await assert.isFulfilled(contracts.cancelAgreement(pAccount.address, agrAddress));
  // });
});
