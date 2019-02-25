const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised');
const request = require('supertest')
const rid = require('random-id')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const hexToString = require('@monax/burrow').utils.hexToAscii;
const stringToHex = require('@monax/burrow').utils.asciiToHex;
const crypto = require('crypto');

const app = require('../../app')();
const server = require(__common + '/aa-web-api')();
const logger = require(__common + '/monax-logger')
const log = logger.getLogger('agreements.tests');

const api = require('./api-helper')(server)
const { rightPad } = require(__common + '/controller-dependencies')

const contracts = require(`${global.__controllers}/contracts-controller`);

// configure chai
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;

var hoardGrant;
var hoardGrant2;

// wait for the app to be fully bootstrapped
before(function (done) {
  this.timeout(99999999)
  app.eventEmitter.on(app.events.STARTED, () => {
    log.info('Application started. Running REST API Test Suite ...');
    done();
  });
});

const credentials = {
  username: rid(10, 'aA0'),
  password: 'IREALLYLOVEBOATS',
  email: `${rid(10, 'aA0')}@test.com`
}

const baduser = {
  username: 'Bob',
  password: 'Thisdoesntmatteryet'
}

const badcredentials = {
  wrong: 'field'
}

var token
var userData

describe('hex to string conversions', () => {
  it('Should convert hex to string', (done) => {
    const text1 = 'Test0 Contracts00!;'
    const emptyString = '';
    const spaces = '   ';
    const in_noPaddedHex = '41737369676e6565';
    const in_evenLeftPaddedHex = '00000041737369676e6565';
    const in_evenRightPaddedHex = '41737369676e6565000000';
    const in_oddLeftPaddedHex = '00041737369676e6565';
    const in_oddRightPaddedHex = '41737369676e6565000';
    const in_nullHex = '000000000000';
    const in_noPadMultiByteHex = '6964656e7469666963616369f36e';
    const in_paddedMultiByteHex = '62e47200000000';
    const out_str_assignee = 'Assignee';
    const out_str_identification = 'identificación';
    const out_str_bear = 'bär';
    
    // plain old string to hex
    let hex_text1 = global.stringToHex(text1)
    hex_text1 = rightPad(hex_text1, 32)
    const conv_text1 = global.hexToString(hex_text1)
    expect(conv_text1).to.equal(text1)

    // expect null hex to match empty string
    expect(hexToString(in_nullHex)).to.equal(emptyString);
    
    // expect empty string to match empty hex 
    expect(stringToHex(emptyString)).to.equal('');
    
    // expect spaces roundtrip to spaces to pass
    expect(hexToString(stringToHex(spaces))).to.equal(spaces);

    // expect no padded hex to match no padded string
    expect(hexToString(in_noPaddedHex)).to.equal(out_str_assignee);

    // expect even left padded hex to match string
    expect(hexToString(in_evenLeftPaddedHex)).to.equal(out_str_assignee);

    // expect even right padded hex to match string
    expect(hexToString(in_evenRightPaddedHex)).to.equal(out_str_assignee);

    // expect odd left padded hex to NOT match string
    expect(hexToString(in_oddLeftPaddedHex)).to.not.equal(out_str_assignee);

    // expect odd right padded hex to match string
    expect(hexToString(in_oddRightPaddedHex)).to.equal(out_str_assignee)

    // expect multibyte hex to match string 
    expect(hexToString(in_noPadMultiByteHex)).to.equal(out_str_identification);

    // expect padded multibyte hex to match string
    expect(hexToString(in_paddedMultiByteHex)).to.equal(out_str_bear);

    done();
  });
});

/**
 * ######## USER REGISTRATION / LOGIN #########################################################################################
 */

describe('Registration/ Login', () => {
  it('Should register a new user', function (done) {
    this.timeout(10000)
    chai
      .request(server)
      .post('/users')
      .send(credentials)
      .end((err, res) => {
        res.should.have.status(200)
        setTimeout(function () {
          done()
        }, 3000)
      })
  })

  it('Should fail to register an existing user', function (done) {
    this.timeout(10000)
    chai
      .request(server)
      .post('/users')
      .send(credentials)
      .end((err, res) => {
        res.should.have.status(422)
        done()
      })
  })

  it('Should fail if credentials not passed', (done) => {
    chai
      .request(server)
      .post('/users')
      .send(badcredentials)
      .end((err, res) => {
        res.should.have.status(400)
        done()
      })
  })

  it('Should fail to login if user is not activated', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(credentials)
      .end((err, res) => {
        if (err) done(err);
        res.should.have.status(401)
        done()
      })
  })

  it('Login as a user to obtain token', async () => {
    try {
      await api.activateUser(credentials);
    } catch (err) {
      throw err;
    }
    let loginResult = await api.loginUser(credentials);
    expect(loginResult.token).to.exist;
    userData = loginResult.loggedInUser;
    token = loginResult.token;
  }).timeout(10000);

  it('Should fail to login as non-existent user', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(baduser)
      .end((err, res) => {
        res.should.have.status(401)
        done()
      })
  })

  it('Should fail if credentials not passed', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(badcredentials)
      .end((err, res) => {
        res.should.have.status(400)
        done()
      })
  });

  it('GET all users', (done) => {
    chai
      .request(server)
      .get('/users')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        done()
      })
  }).timeout(2000);

})

/**
 * ######## USER PROFILE #########################################################################################
 */

describe('User Profile', () => {
  const newProfileInfo = {
    firstName: 'Bobby',
    lastName: 'Tables',
    country: 'US',
    region: 'ABCDEF123ABCDEF123',
    isProducer: true,
    onboarding: false
  }

  it('Should update the logged in user\'s profile', (done) => {
    request(server)
      .put('/users/profile')
      .set('Cookie', [`access_token=${token}`])
      .send(newProfileInfo)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        res.body.should.be.a('object')
        res.body.address.toUpperCase().should.equal(userData.address)
        done()
      })
  })

  it('Should retrieve the logged in user\'s profile', (done) => {
    setTimeout(() => {
      request(server)
        .get('/users/profile')
        .set('Cookie', [`access_token=${token}`])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          res.body.should.be.a('object')
          res.body.address.toUpperCase().should.equal(userData.address)
          res.body.id.should.equal(credentials.username)
          res.body.email.should.equal(credentials.email)
          res.body.firstName.should.equal(newProfileInfo.firstName)
          res.body.lastName.should.equal(newProfileInfo.lastName)
          res.body.should.have.property('firstName')
          res.body.should.have.property('lastName')
          res.body.country.should.equal(newProfileInfo.country)
          res.body.region.should.equal(newProfileInfo.region)
          res.body.isProducer.should.equal(true)
          res.body.onboarding.should.equal(false)
          res.body.organizations.should.be.a('array')
          res.body.createdAt.should.exist
          done();
        });
    }, 3000);
  });
});

/**
 * ######## HOARD #########################################################################################
 */

describe('Hoard', () => {
  it('Should upload a real file to hoard', (done) => {
    request(server)
      .post('/hoard')
      .set('Cookie', [`access_token=${token}`])
      .attach('myfile.js', __dirname + '/web-api-test.js')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        hoardGrant = res.body.grant;
        done()
      })
  })

  it('Should upload a second real file to hoard', (done) => {
    request(server)
      .post('/hoard')
      .set('Cookie', [`access_token=${token}`])
      .attach('myfile.js', __dirname + '/../../app.js')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        hoardGrant2 = res.body.grant;
        done()
      })
  })
})

/**
 * ######## ORGANIZATIONS #########################################################################################
 */

describe('Organizations', () => {
  // Variables for each entity
  const acme = {
    name: 'ACME Corp',
  };
  const accounting = {
    name: 'Accounting Department',
  };
  const approver = {
    username: rid(10, 'aA0'),
    email: `${rid(10, 'aA0')}@test.com`,
    password: 'approver',
  };
  const accountant = {
    username: rid(10, 'aA0'),
    email: `${rid(10, 'aA0')}@test.com`,
    password: 'accountant',
  };
  const employee = {
    username: rid(10, 'aA0'),
    email: `${rid(10, 'aA0')}@test.com`,
    password: 'employee',
  };
  const nonEmployee = {
    username: rid(10, 'aA0'),
    email: `${rid(10, 'aA0')}@test.com`,
    password: 'nonemployee',
  };
  let orgTestToken;
  // Register all users and login Accountant
  it('Should register new users and login Accountant', async function () {
    const approverRes = await api.registerUser(approver);
    const accountantRes = await api.registerUser(accountant);
    const employeeRes = await api.registerUser(employee);
    const nonEmployeeRes = await api.registerUser(nonEmployee);
    approver.address = approverRes.address;
    accountant.address = accountantRes.address;
    employee.address = employeeRes.address;
    nonEmployee.address = nonEmployeeRes.address;
    await api.activateUser(accountant);
    const loginRes = await api.loginUser(accountant);
    orgTestToken = loginRes.token;
  });

  it('POST a new organization', (done) => {
    chai
      .request(server)
      .post('/organizations')
      .set('Cookie', [`access_token=${orgTestToken}`])
      .send(acme)
      .end((err, res) => {
        if (err) return done(err);
        res.should.have.status(200);
        res.body.address.should.exist;
        res.body.address.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
        res.body.name.should.exist;
        acme.address = res.body.address;
        setTimeout(function () {
          // verify organization in vent
          chai
          .request(server)
          .get(`/organizations?approver=true`)
          .set('Cookie', [`access_token=${orgTestToken}`])
          .end((err, res) => {
            if (err) return done(err);
            res.should.have.status(200);
            res.body.should.be.a('array');
            const resAcme = res.body.find(({ address }) => address === acme.address);
            resAcme.should.exist;
            done();
          });
        }, 3000);
      });
  }).timeout(10000);

  describe('Test Existing Organization', (done) => {
    beforeEach(function () {
      if (!acme.address) { assert.fail('No existing organization address. Failing dependent test ...') }
    });

    it('PUT user Approver to organization', (done) => {
      chai
        .request(server)
        .put(`/organizations/${acme.address}/users/${approver.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          setTimeout(function () {
            // verify users on this organization
            chai
              .request(server)
              .get(`/organizations/${acme.address}`)
              .set('Cookie', [`access_token=${orgTestToken}`])
              .end((err, res) => {
                if (err) return done(err);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.users.should.be.a('array');
                res.body.users.should.have.length(1);
                res.body.users[0].should.be.a('object');
                res.body.users[0].address.should.exist;
                res.body.users[0].address.should.equal(approver.address);
                res.body.users[0].id.should.exist;
                res.body.users[0].id.should.equal(approver.username);
                done();
              });
          }, 2000);
        });
    }).timeout(10000);
  
    it('PUT user Accountant to organization', (done) => {
      chai
        .request(server)
        .put(`/organizations/${acme.address}/users/${accountant.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          setTimeout(function () {
            // verify users on this organization
            chai
              .request(server)
              .get(`/organizations/${acme.address}`)
              .set('Cookie', [`access_token=${orgTestToken}`])
              .end((err, res) => {
                if (err) return done(err);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.users.should.be.a('array');
                res.body.users.should.have.length(2);
                done();
              });
          }, 2000);
        });
    }).timeout(10000);

    it('PUT user Employee to organization', (done) => {
      chai
        .request(server)
        .put(`/organizations/${acme.address}/users/${employee.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          setTimeout(function () {
            // verify users on this organization
            chai
              .request(server)
              .get(`/organizations/${acme.address}`)
              .set('Cookie', [`access_token=${orgTestToken}`])
              .end((err, res) => {
                if (err) return done(err);
                res.should.have.status(200);
                res.body.users.should.have.length(3);
                done();
              });
          }, 2000);
        });
    }).timeout(10000);

    it('DELETE a User Employee from organization', (done) => {
      chai
        .request(server)
        .delete(`/organizations/${acme.address}/users/${employee.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          setTimeout(function () {
            // verify users on this organization
            chai
              .request(server)
              .get(`/organizations/${acme.address}`)
              .set('Cookie', [`access_token=${orgTestToken}`])
              .end((err, res) => {
                if (err) return done(err);
                res.should.have.status(200);
                res.body.users.should.have.length(2);
                done();
              });
          }, 2000);
        });
    }).timeout(10000);

    it('PUT accounting department to organization', (done) => {
      chai
        .request(server)
        .put(`/organizations/${acme.address}/departments`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .send(accounting)
        .end((err, res) => {
          if (err) return done(err);
          accounting.id = res.body.id;
          res.should.have.status(200);
          setTimeout(function () {
            // verify departments on this organization
            chai
              .request(server)
              .get(`/organizations/${acme.address}`)
              .set('Cookie', [`access_token=${orgTestToken}`])
              .end((err, res) => {
                if (err) return done(err);
                res.should.have.status(200);
                res.body.should.be.a('object');
                res.body.departments.should.be.a('array');
                // Length should be 2 now because the default department should have been created upon organization creation
                res.body.departments.should.have.length(2);
                const acctDep = res.body.departments.find(({ id }) => id === accounting.id);
                acctDep.should.be.a('object');
                acctDep.name.should.exist;
                acctDep.name.should.equal(accounting.name);
                acctDep.users.should.be.a('array');
                done();
              });
          }, 2000);
        });
    }).timeout(10000);

    it('PUT users to accounting department in organization', (done) => {
      setTimeout(() => {
        chai
        .request(server)
        .put(`/organizations/${acme.address}/departments/${accounting.id}/users`)
        .send({ users: [accountant.address] })
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          done();
        });
      }, 2000);
    }).timeout(10000);

    it('should include users in each department in GET organization', (done) => {
      setTimeout(() => {
        chai
          .request(server)
          .get(`/organizations/${acme.address}`)
          .set('Cookie', [`access_token=${orgTestToken}`])
          .end((err, res) => {
            if (err) return done(err);
            res.should.have.status(200);
            const acctDep = res.body.departments.find(({ id }) => id === accounting.id);
            acctDep.users[0].should.equal(accountant.address);
            done();
          });
      }, 2000);
    }).timeout(10000);

    it('DELETE user from accounting department in organization', (done) => {
      setTimeout(() => {
        chai
        .request(server)
        .delete(`/organizations/${acme.address}/departments/${accounting.id}/users/${accountant.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          done();
        });
      }, 2000);
    }).timeout(10000);

    it('Should login a non-member of the organization', async () => {
      await api.activateUser(nonEmployee);
      let loginResult = await api.loginUser(nonEmployee);
      orgTestToken = loginResult.token;
    }).timeout(10000);

    it('GET organizations even for non-member', (done) => {
      chai
        .request(server)
        .get(`/organizations`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          if (err) return done(err);
          res.should.have.status(200);
          res.body.should.be.a('array');
          res.body.should.not.have.length(0);
          done();
        });
    });

    it('Should not allow GET organization if user is not member or approver', (done) => {
      chai
        .request(server)
        .get(`/organizations/${acme.address}`)
        .set('Cookie', [`access_token=${orgTestToken}`])
        .end((err, res) => {
          res.should.have.status(403);
          done();
        });
    });
  });
});

describe(':: External Users ::', () => {
  let externalUser1 = {
    email: `${rid(10, 'aA0')}@test.com`,
  };
  let externalUser2 = {
    email: `${rid(10, 'aA0')}@test.com`,
  };
  let registeredUser = {
    username: `registeredUser${rid(5, 'aA0')}`,
    password: 'registeredUser',
    email: `${rid(10, 'aA0')}@test.com`,
  };

  let formation = {
    filePath: 'test/data/inc-formation.bpmn',
    process: {},
    id: rid(16, 'aA0'),
    name: 'Incorporation-Formation'
  }
  let execution = {
    filePath: 'test/data/inc-execution.bpmn',
    process: {},
    id: rid(16, 'aA0'),
    name: 'Incorporation-Execution'
  }

  let archetype = {
    name: 'Incorporation Archetype',
    description: 'Incorporation Archetype',
    price: 10,
    isPrivate: 1,
    active: 1,
    parameters: [
      { type: 8, name: 'External1Uppercase' },
      { type: 6, name: 'External2' },
      { type: 6, name: 'External1Lowercase' },
      { type: 8, name: 'RegisteredNormal' },
      { type: 6, name: 'RegisteredByEmail' },
    ],
    documents: [{
      name: 'doc1.md',
      grant: '',
    }],
    jurisdictions: [],
    executionProcessDefinition: '',
    formationProcessDefinition: '',
    governingArchetypes: []
  }
  let agreement = {
    name: 'external users agreement',
    archetype: '',
    isPrivate: false,
    parameters: [],
    maxNumberOfEvents: 0,
    governingAgreements: []
  }

  it('Should register user', async () => {
    // REGISTER USER
    const registerResult = await api.registerUser(registeredUser);
    registeredUser.address = registerResult.address;
    expect(registeredUser.address).to.exist
  }).timeout(5000);

  it('Should login user', (done) => {
    // LOGIN USER
    setTimeout(async () => {
      try {
        await api.activateUser(registeredUser);
        const loginResult = await api.loginUser(registeredUser);
        expect(loginResult.token).to.exist;
        registeredUser.token = loginResult.token;
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('Should deploy formation and execution models', async () => {
    // DEPLOY FORMATION MODEL
    let formXml = api.generateModelXml(formation.id, formation.filePath);
    let formationDeploy = await api.createAndDeployModel(formXml, registeredUser.token);
    expect(formationDeploy).to.exist;
    Object.assign(formation, formationDeploy.model);
    Object.assign(formation.process, formationDeploy.processes[0]);
    archetype.formationProcessDefinition = formation.process.address;
    expect(String(archetype.formationProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
    // DEPLOY EXECUTION MODEL
    let execXml = api.generateModelXml(execution.id, execution.filePath);
    let executionDeploy = await api.createAndDeployModel(execXml, registeredUser.token);
    expect(executionDeploy).to.exist;
    Object.assign(execution, executionDeploy.model);
    Object.assign(execution.process, executionDeploy.processes[0]);
    archetype.executionProcessDefinition = execution.process.address;
    expect(String(archetype.executionProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
    expect(String(archetype.executionProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
  }).timeout(30000);

  it('Should create an archetype', done => {
    // CREATE ARCHETYPE
    setTimeout(async () => {
      try {
        archetype.documents[0].grant = hoardGrant;
        Object.assign(archetype, await api.createArchetype(archetype, registeredUser.token));
        expect(String(archetype.address)).match(/[0-9A-Fa-f]{40}/).to.exist;
        agreement.archetype = archetype.address;
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('Should create an agreement with emails in the user/org/signatory parameters', done => {
    // CREATE AGREEMENT
    setTimeout(async () => {
      try {
        /**
         * Should be able to use an email address for a user/org/sig agreement parameter
         * Should create a new user and use their address when given an unknown email address
         * Should use the address of the user with the given email when given a known email address
         * Should be able to accept the same email address for multiple parameters without errors
         * Should be able to handle email addresses in different cAsEs
        */
        agreement.parameters.push({ name: 'External1Uppercase', type: 8, value: externalUser1.email.toUpperCase() });
        agreement.parameters.push({ name: 'External2', type: 6, value: externalUser2.email });
        agreement.parameters.push({ name: 'External1Lowercase', type: 6, value: externalUser1.email.toLowerCase() });
        agreement.parameters.push({ name: 'RegisteredNormal', type: 6, value: registeredUser.address });
        agreement.parameters.push({ name: 'RegisteredByEmail', type: 6, value: registeredUser.email.toLowerCase() });
        Object.assign(agreement, await api.createAgreement(agreement, registeredUser.token));
        expect(String(agreement.address)).match(/[0-9A-Fa-f]{40}/).to.exist;
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('Should create new users when an unknown email is given', done => {
    // CHECK USER CREATION
    setTimeout(async () => {
      try {
        const user1 = await contracts.getUserById(crypto.createHash('sha256').update(externalUser1.email.toLowerCase()).digest('hex'));
        const user2 = await contracts.getUserById(crypto.createHash('sha256').update(externalUser2.email.toLowerCase()).digest('hex'));
        expect(user1).to.be.a('object');
        expect(user2).to.be.a('object');
        expect(/[0-9A-Fa-f]{40}/.test(user1.address)).to.be.true;
        expect(/[0-9A-Fa-f]{40}/.test(user2.address)).to.be.true;
        externalUser1.address = user1.address;
        externalUser2.address = user2.address;
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('Should not create multiple users for the same email address (case insensitive)', done => {
    // CHECK USER CREATION
    setTimeout(async () => {
      try {
        await assert.isRejected(contracts.getUserById(crypto.createHash('sha256').update(externalUser1.email.toUpperCase()).digest('hex')));
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  let parameters;

  it('Should use the address of the already registered user when a known email address is given', done => {
    // CHECK AGREEMENT PARAMETERS
    setTimeout(async () => {
      try {
       ( { parameters } = await api.getAgreement(agreement.address, registeredUser.token));
        expect(parameters.find(({ name }) => name === 'RegisteredByEmail').value).to.equal(registeredUser.address);
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('Should use the addresses of new users for unknown email addresses', done => {
    // CHECK AGREEMENT PARAMETERS
    setTimeout(async () => {
      try {
        expect(parameters.find(({ name }) => name === 'External1Uppercase').value).to.equal(externalUser1.address);
        expect(parameters.find(({ name }) => name === 'External2').value).to.equal(externalUser2.address);
        expect(parameters.find(({ name }) => name === 'External1Lowercase').value).to.equal(externalUser1.address);
        expect(parameters.find(({ name }) => name === 'External1Uppercase').value).to.equal(externalUser1.address);
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);
});