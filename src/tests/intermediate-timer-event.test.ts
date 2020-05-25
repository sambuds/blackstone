import { Contracts } from '../lib/contracts';
import { Archetype, Agreement, Parameter, ParameterType, Model, DataType, ActivityInstanceState, LegalState } from '../lib/types';
import rid = require('random-id');
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SHA3 } from '../lib/utils';
import { load } from './before';
import { BytesFromString } from '../lib/utils';
import { pool } from './data/pool';
chai.use(chaiAsPromised);
const { expect, assert } = chai;

let contracts: Contracts;

before(function (done) {
  this.timeout(99999999);
  load().then(loaded => { contracts = loaded; done(); })
    .then(() => pool.query('SELECT 1'))
    .catch(error => done(error));
});

describe(':: Intermediate Timer Event Test ::', () => {
  let piAddress: string;
  let aiId: Buffer;

  const model: Model = {
    id: rid(5, 'aA0'),
    version: [1, 0, 0],
    address: '',
  };

  const formationProcessId = 'WaitTimerFormation';
  const executionProcessId = 'NoOpExecution';
  
  const INTERFACE_FORMATION = 'Agreement Formation';
  const INTERFACE_EXECUTION = 'Agreement Execution';

  const assignee = {
    username: `assignee_${rid(5, 'aA0')}`,
    address: '',
  };

  const reviewer = {
    username: `reviewer_${rid(5, 'aA0')}`,
    address: '',
  };

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

  const participants = [
    {
      id: 'Lane1',
      name: 'Parties',
      dataStorageId: 'agreement',
      dataPath: 'AGREEMENT_PARTIES'
    },
    {
      id: 'Lane2',
      name: 'Reviewer',
      dataStorageId: 'agreement',
      dataPath: 'Reviewer'
    },
  ]

  const parameters: Array<Parameter> = [
    { 
      type: ParameterType.SIGNING_PARTY, 
      name: 'Assignee'
    },
    { 
      type: ParameterType.USER_ORGANIZATION, 
      name: 'Reviewer'
    }
  ];

  const agreement: Agreement = {
    archetype: '',
    creator: '',
    owner: '',
    privateParametersFileReference: '',
    parties: [],
    collectionId: '',
    governingAgreements: [],
  };

  const signTask = {
    activityId: 'Sign',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: participants[0].id, // matches the participant id i.e. the lane id
    multiInstance: true,
    application: 'AgreementSignatureCheck',
  };

  const intermediateTimer = {
    eventId: 'WaitBeforeRenewal',
    eventType: 1, /* EventType.TIMER_DURATION */
    eventBehavior: 0, /* IntermediateEventBehavior.CATCHING */
    timestampConstant: null, /* Timestamp until which it will wait - null because Lair will resove it*/
    dataPath: 'ACTION_CONFIG',
    dataStorageId: 'agreement'
  }

  const renewTask = {
    activityId: 'Renew',
    activityType: 0,
    taskType: 1,
    behavior: 1,
    assignee: participants[1].id,
    multiInstance: false,
  };

  const noOpTask = {
    activityId: 'NoOp',
    activityType: 0,
    taskType: 0,
    behavior: 0,
    multiInstance: false
  };

  it('Should create a assignee and a reviewer', async () => {
    let resAssignee = await contracts.createUser({
      username: SHA3(assignee.username)
    });
    expect(resAssignee).to.match(/[0-9A-Fa-f]{40}/);
    assignee.address = resAssignee;
    archetype.owner = assignee.address;
    archetype.author = assignee.address;
    agreement.creator = assignee.address;

    let resReviewer = await contracts.createUser({
      username: SHA3(reviewer.username)
    });
    expect(resReviewer).to.match(/[0-9A-Fa-f]{40}/);
    reviewer.address = resReviewer;
  }).timeout(10000);

  /******************************
   *  DEPLOY MODEL AND PROCESSES
   ******************************/

  it('Should create a process model', async () => {
    model.address = await contracts.createProcessModel(model.id, model.version, assignee.address, false, '');
    expect(model.address).to.match(/[0-9A-Fa-f]{40}/);
  }).timeout(10000);

  it('Should add data definitions to model', async () => {
    await contracts.addDataDefinitionToModel(model.address, {
      dataPath: 'agreement',
      dataStorageId: 'PROCESS_INSTANCE',
      parameterType: 7
    });
    await contracts.addDataDefinitionToModel(model.address, {
      dataPath: 'Assignee',
      dataStorageId: 'agreement',
      parameterType: 8
    });
    await contracts.addDataDefinitionToModel(model.address, {
      dataPath: 'Reviewer',
      dataStorageId: 'agreement',
      parameterType: 6
    });
    await contracts.addDataDefinitionToModel(model.address, {
      dataPath: 'ACTION_CONFIG',
      dataStorageId: 'agreement',
      parameterType: 1
    });
  }).timeout(10000);

  it('Should add process model interfaces', async () => {
    await assert.isFulfilled(contracts.addProcessInterface(model.address, INTERFACE_FORMATION));
    await assert.isFulfilled(contracts.addProcessInterface(model.address, INTERFACE_EXECUTION));
  }).timeout(10000);

  it('Should add participants', async () => {
    await assert.isFulfilled(contracts.addParticipant(model.address, participants[0].id, '', participants[0].dataPath, participants[0].dataStorageId, ''));
    await assert.isFulfilled(contracts.addParticipant(model.address, participants[1].id, '', participants[1].dataPath, participants[1].dataStorageId, ''));
  }).timeout(10000);

  it('Should add formation process', async () => {
    const formationProcessAddress = await contracts.createProcessDefinition(model.address, formationProcessId);
    expect(formationProcessAddress).to.match(/[0-9A-Fa-f]{40}/);
    archetype.formationProcess = formationProcessAddress;
  }).timeout(10000);

  it('Should add execution process', async () => {
    const executionProcessAddress = await contracts.createProcessDefinition(model.address, executionProcessId);
    expect(executionProcessAddress).to.match(/[0-9A-Fa-f]{40}/);
    archetype.executionProcess = executionProcessAddress;
  }).timeout(10000);

  it('Should add process interface implementations', async () => {
    await assert.isFulfilled(
      contracts.addProcessInterfaceImplementation(model.address, archetype.formationProcess, INTERFACE_FORMATION),
    );
    await assert.isFulfilled(
      contracts.addProcessInterfaceImplementation(model.address, archetype.executionProcess, INTERFACE_EXECUTION),
    );
  }).timeout(10000);

  it('Should add Sign task to Agreement Formation', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        archetype.formationProcess,
        signTask.activityId,
        signTask.activityType,
        signTask.taskType,
        signTask.behavior,
        signTask.assignee,
        signTask.multiInstance,
        signTask.application,
        '',
        '',
      ),
    );
  }).timeout(10000);

  it('Should add agreement data mapping', async() => {
    await contracts.createDataMapping(
      archetype.formationProcess,
      signTask.activityId,
      0,
      'agreement',
      'agreement',
      '',
      '0x0');
  }).timeout(10000);

  // it('Should add an intermediate timer event to Agreement Formation', async () => {
  //   await assert.isFulfilled(
  //     contracts.createIntermediateEvent(
  //       archetype.formationProcess,
  //       intermediateTimer.eventId,
  //       intermediateTimer.eventType,
  //       intermediateTimer.eventBehavior,
  //       intermediateTimer.dataPath, /* ACTION_CONFIG */
  //       intermediateTimer.dataStorageId, /* agreement */
  //       '',
  //       0,
  //       ''
  //     )
  //   )
  // }).timeout(10000);

  it('Should add Renew task to Agreement Formation', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        archetype.formationProcess,
        renewTask.activityId,
        renewTask.activityType,
        renewTask.taskType,
        renewTask.behavior,
        renewTask.assignee,
        renewTask.multiInstance,
        '',
        '',
        '',
      ),
    );
  }).timeout(10000);

  it('Should create transitions', async () => {
    await assert.isFulfilled(
      contracts.createTransition(
        archetype.formationProcess,
        signTask.activityId,
        renewTask.activityId
      )
    );
    // await assert.isFulfilled(
    //   contracts.createTransition(
    //     archetype.formationProcess,
    //     intermediateTimer.eventId,
    //     renewTask.activityId
    //   )
    // );
  }).timeout(10000);

  it('Should validate formation process', async () => {
    const processIsValid = await contracts.isValidProcess(archetype.formationProcess);
    expect(processIsValid).to.be.true;
  }).timeout(10000);

  it('Should add a NOOP task to Agreement Execution', async () => {
    await assert.isFulfilled(
      contracts.createActivityDefinition(
        archetype.executionProcess,
        noOpTask.activityId,
        noOpTask.activityType,
        noOpTask.taskType,
        noOpTask.behavior,
        '',
        false,
        '',
        '',
        ''
      ),
    );
  }).timeout(10000);

  it('Should validate execution process', async () => {
    const processIsValid = await contracts.isValidProcess(archetype.executionProcess);
    expect(processIsValid).to.be.true;
  }).timeout(10000);

  // /**********************************
  //  *  CREATE ARCHETYPE AND AGREEMENT
  //  **********************************/

  it('Should create an archetype', async () => {
    archetype.address = await contracts.createArchetype(archetype);
    expect(archetype.address).to.match(/[0-9A-Fa-f]{40}/);
    agreement.archetype = archetype.address;
    parameters[0].value = assignee.address;
    parameters[1].value = reviewer.address;
    await contracts.addArchetypeParameters(archetype.address, parameters);
  }).timeout(10000);

  it('Should create an agreement', async () => {
    agreement.address = await contracts.createAgreement({
      owner: archetype.owner,
      privateParametersFileReference: '',
      collectionId: '',
      archetype: agreement.archetype,
      creator: agreement.creator,
      isPrivate: agreement.isPrivate,
      parties: [assignee.address],
      governingAgreements: [],
    });
    expect(agreement.address).to.match(/[0-9A-Fa-f]{40}/);
    await contracts.initializeObjectAdministrator(agreement.address);
  }).timeout(10000);

  it('Should set ACTION_CONFIG on agreement', async () => {
    const agreementContract = contracts.getActiveAgreement(agreement.address);
    agreementContract.setDataValueAsString(BytesFromString('ACTION_CONFIG'), "{\"hello\":\"world\"}");
  }).timeout(10000);

  // /************************************
  //  *  START PROCESS AND COMPLETE TASKS
  //  ************************************/

  it('Should start process from agreement', done => {
    setTimeout(async () => {
      piAddress = await contracts.startProcessFromAgreement(agreement.address);
      expect(piAddress).to.match(/[0-9A-Fa-f]{40}/);
      done();
    }, 1000);
  }).timeout(10000);

  it('Should sign agreement by assignee and complete task', async () => {
    await assert.isFulfilled(contracts.signAgreement(assignee.address, agreement.address));
    const { rows } = await pool.query(`
                              SELECT encode(activity_instance_id::bytea, 'hex') AS sign_task_id
                              FROM data.activity_instances
                              WHERE process_instance_address = $1
                              AND performer = $2
                              AND state = $3`, [piAddress, assignee.address, 4]);
    const { sign_task_id } = rows[0];
    await assert.isFulfilled(contracts.completeActivity(
      assignee.address,
      sign_task_id
    ));
  }).timeout(10000);

  it('Should complete renew task by assignee', (done) => {
    setTimeout(async () => {
      const { rows } = await pool.query(`
                              SELECT encode(activity_instance_id::bytea, 'hex') AS renew_task_id
                              FROM data.activity_instances
                              WHERE process_instance_address = $1
                              AND activity_id = $2`, [piAddress, renewTask.activityId]);
      const { renew_task_id } = rows[0];
      console.log(renew_task_id);
      await assert.isFulfilled(contracts.completeActivity(reviewer.address, renew_task_id));
      done();
    }, 3000);
  }).timeout(10000);

});
