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

const app = require('../../app')
const server = require(__common + '/aa-web-api')
const logger = require(__common + '/monax-logger')
const log = logger.getLogger('agreements.tests')
const pool = require(__common + '/postgres-db');

const api = require('./api-helper')(server)
const { rightPad } = require(__common + '/controller-dependencies')

// configure chai
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;

var hoardRef = { address: null, secretKey: null }
var hoardRef2 = { address: null, secretKey: null }

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

const password = 'SugarHockeyIceTea'

var token
var userData
var orgid

describe('hex to string conversions', () => {
  it('Should convert hex to string', (done) => {
    let text1 = 'Test0 Contracts'
    let hex_text1 = global.stringToHex(text1)
    hex_text1 = rightPad(hex_text1, 32)
    let conv_text1 = global.hexToString(hex_text1)
    expect(conv_text1).to.equal(text1)
    done()
  })
})

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

  it('Login as a user to obtain token', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(credentials)
      .end((err, res) => {
        if (err) done(err);
        res.should.have.status(200)
        res.body.should.be.a('object')
        res.body.address.should.match(/[0-9A-Fa-f]{40}/) // match for 20 byte hex
        let cookie = res.headers['set-cookie'][0]
        token = cookie.split('access_token=')[1].split(';')[0]
        expect(token.length).to.be.greaterThan(0)
        userData = res.body
        done()
      })
  })

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
  })
})

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

describe('Hoard', () => {
  it('Should upload a real file to hoard', (done) => {
    request(server)
      .post('/hoard')
      .set('Cookie', [`access_token=${token}`])
      .attach('myfile.js', __dirname + '/web-api-test.js')
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        hoardRef.address = res.body.address.toUpperCase()
        hoardRef.secretKey = res.body.secretKey.toUpperCase()
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
        hoardRef2.address = res.body.address.toUpperCase()
        hoardRef2.secretKey = res.body.secretKey.toUpperCase()
        done()
      })
  })
})

describe('Organizations', () => {
  // Variables for each entity
  const acme = {
    name: 'ACME Corp',
  };
  const accounting = {
    id: 'accounting',
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
          // verify organization in sqlsol
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
        }, 2000);
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
                res.body.departments.should.have.length(1);
                res.body.departments[0].should.be.a('object');
                res.body.departments[0].id.should.exist;
                res.body.departments[0].id.should.equal(accounting.id);
                res.body.departments[0].name.should.exist;
                res.body.departments[0].name.should.equal(accounting.name);
                res.body.departments[0].users.should.be.a('array');
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
            res.body.departments[0].users[0].should.equal(accountant.address);
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

    it('Should login a non-member of the organization', (done) => {
      chai
      .request(server)
      .put('/users/login')
      .send(nonEmployee)
      .end((err, res) => {
        if (err) return done(err);
        res.should.have.status(200);
        const cookie = res.headers['set-cookie'][0];
        orgTestToken = cookie.split('access_token=')[1].split(';')[0];
        done();
      });
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

describe('Users', () => {
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
  }).timeout(2000)
})

describe('Archetypes', () => {
  var currentSize;
  let testArchetype = {
    name: 'TestType Complex',
    description: 'Complex',
    parameters: [
      { name: 'parameter1', type: 0 },
      { name: 'parameter2', type: 1 },
      { name: 'parameter3', type: 2 },
      { name: 'parameter4', type: 3 },
      { name: 'parameter5', type: 4 },
      { name: 'parameter6', type: 5 }
    ],
    jurisdictions: [
      { country: 'CA', regions: ['0798FDAD71114ABA2A3CD6B4BD503410F8EF6B9208B889CC0BB33CD57CEEAA9C', '9CD6EEC0C135A0DEC4176812CE66259A61CB5075E1494A123383E2A12A45691C'] },
      {
        country: 'US',
        regions: []
      }
    ],
    formationProcessDefinition: '',
    executionProcessDefinition: ''
  }

  let simpleArchetype, complexArchetype;

  it('Should create a model and process definitions', async () => {
    // DEPLOY FORMATION MODEL
    let formXml = api.generateModelXml(formation.id, formation.filePath);
    let formationDeploy = await api.createAndDeployModel(formXml, token);
    expect(formationDeploy).to.exist;
    Object.assign(formation, formationDeploy.model);
    Object.assign(formation.process, formationDeploy.processes[0]);
    testArchetype.formationProcessDefinition = formation.process.address;
    expect(String(testArchetype.formationProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
    // DEPLOY EXECUTION MODEL
    let execXml = api.generateModelXml(execution.id, execution.filePath);
    let executionDeploy = await api.createAndDeployModel(execXml, token);
    expect(executionDeploy).to.exist;
    Object.assign(execution, executionDeploy.model);
    Object.assign(execution.process, executionDeploy.processes[0]);
    testArchetype.executionProcessDefinition = execution.process.address;
    expect(String(testArchetype.executionProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
    expect(String(testArchetype.executionProcessDefinition).match(/[0-9A-Fa-f]{40}/)).to.exist;
  }).timeout(30000);

  it('GET all archetypes', (done) => {
    chai
      .request(server)
      .get('/archetypes')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        currentSize = res.body.length
        done()
      })
  }).timeout(2000)

  it('POST a new simple archetype', (done) => {
    try {
      const newObject = {
        name: 'TestType1',
        description: 'Test',
        formationProcessDefinition: formation.process.address,
        executionProcessDefinition: execution.process.address
      }
      chai
        .request(server)
        .post('/archetypes')
        .set('Cookie', [`access_token=${token}`])
        .send(newObject)
        .end((err, res) => {
          res.should.have.status(200)
          res.body.address.should.exist
          res.body.address.should.match(/[0-9A-Fa-f]{40}/) // match for 20 byte hex
          simpleArchetype = res.body.address
          log.debug('Address: ' + simpleArchetype)
          done()
        })
    } catch (err) {
      done(err);
    }
  }).timeout(10000);

  it('POST a new complex archetype', (done) => {
    testArchetype.documents = [{
      name: 'doc1.pdf',
      hoardAddress: hoardRef.address,
      secretKey: hoardRef.secretKey
    },
    {
      name: 'doc2.pdf',
      hoardAddress: hoardRef2.address,
      secretKey: hoardRef2.secretKey
    }]
    chai
      .request(server)
      .post('/archetypes')
      .set('Cookie', [`access_token=${token}`])
      .send(testArchetype)
      .end((err, res) => {
        if (err) done(err);
        try {
          res.should.have.status(200);
          res.body.address.should.exist;
          res.body.address.should.match(/[0-9A-Fa-f]{40}/) // match for 20 byte hex
          complexArchetype = res.body.address
          log.debug('Address: ' + complexArchetype)
          done();
        } catch (error) {
          done(error);
        }
      });
  }).timeout(8000);

  it('should GET complex archetype', done => {
    setTimeout(() => {
      chai
        .request(server)
        .get('/archetypes/' + complexArchetype)
        .set('Cookie', [`access_token=${token}`])
        .end((err, res) => {
          if (err) done(err)
          expect(res.body).to.exist
          expect(res.body.name).to.equal(testArchetype.name)
          expect(res.body.description).to.equal(testArchetype.description)
          expect(res.body.parameters.length).to.equal(6)
          expect(res.body.documents.length).to.equal(2)
          expect(res.body.jurisdictions.length).to.equal(2)
          expect(res.body.jurisdictions[0].regions.length).to.equal(2)
          done()
        })
    }, 5000)
  }).timeout(10000)

  it('should set archetype successor', async() => {
    await api.setArchetypeSuccessor(simpleArchetype, complexArchetype, token);
  }).timeout(10000);

  it('should validate predecessor archetype is inactive', done => {
    setTimeout(async () => {
      try {
        const data = await api.getArchetype(simpleArchetype, token);
        expect(data.successor).to.equal(complexArchetype);
        expect(data.active).to.be.false;
        done();
      } catch (err) {
        done(err);
      }
    }, 3000);
  }).timeout(10000);

  it('should fail to activate archetype that has a successor', async () => {
    await assert.isRejected(api.activateArchetype(simpleArchetype, token));
  }).timeout(10000);

  it('should fail when setting a circular succession dependency', async () => {
    await assert.isRejected(api.setArchetypeSuccessor(complexArchetype, simpleArchetype, token));
  });

  //     it('POST an archetype with jurisdictions and verify its jurisdictions', (done) => {
  //         const emptyRegion = '0000000000000000000000000000000000000000000000000000000000000000';
  //         const newObject = {
  //             name: 'TestType Jurisdiction',
  //             description: 'Archetype with jurisdictions',
  //             fields: [
  //                 { name: 'field1', type: 3 },
  //                 { name: 'field2', type: 2 }
  //             ],
  //             jurisdictions: [
  //                 { country: "CA", regions: ['0798FDAD71114ABA2A3CD6B4BD503410F8EF6B9208B889CC0BB33CD57CEEAA9C', '9CD6EEC0C135A0DEC4176812CE66259A61CB5075E1494A123383E2A12A45691C'] },
  //                 {
  //                     country: "US",
  //                     regions: []
  //                 }
  //             ],
  //             formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //             executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656'
  //         };
  //         chai.request(server)
  //             .post('/archetypes?token=' + token)
  //             .send(newObject)
  //             .end((portErr, postRes) => {
  //                 postRes.should.have.status(200);
  //                 postRes.should.be.text;
  //                 postRes.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //                 objAddress = postRes.text;
  //                 log.info('Address: ' + objAddress);
  //                 setTimeout(function () {
  //                     chai.request(server)
  //                         .get('/archetypes/' + objAddress + '?password=' + password)
  //                         .end((getErr, getRes) => {
  //                             getRes.should.have.status(200);
  //                             getRes.body.should.be.an('object');
  //                             log.info(getRes.body);
  //                             let jurisdictions = getRes.body.jurisdictions;
  //                             expect(jurisdictions.length).to.equal(2);
  //                             jurisdictions.forEach(j => {
  //                                 if (j.country === 'US') {
  //                                     expect(j.regions.length).to.equal(1);
  //                                     expect(j.regions[0]).to.equal(emptyRegion);
  //                                 } else if (j.country === 'CA') {
  //                                     expect(j.regions.length).to.equal(2);
  //                                     expect(j.regions.includes(newObject.jurisdictions[0].regions[0])).to.be.true;
  //                                     expect(j.regions.includes(newObject.jurisdictions[0].regions[1])).to.be.true;
  //                                 } else {
  //                                     assert.fail();
  //                                 }
  //                             });
  //                             done();
  //                         });
  //                 }, 5000);
  //             });
  //     }).timeout(12000);

  //     /**
  //      * TODO: The field labels in this test object are incorrect (for now) in order for the tests to pass.
  //      * Once the data_types table has correct data these need to be updated to match the correct labels.
  //      */
  //     var testObject = {
  //         name: 'TestType2',
  //         active: false,
  //         description: 'Test',
  //         fields: [{ name: 'field1', type: 3, label: "8-bit Unsigned Integer" }, { name: 'field2', type: 2, label: "String" }],
  //         isPrivate: 1,
  //         jurisdictions: [],
  //         formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //         executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656',
  //         formationProcessName: null,
  //         executionProcessName: null
  //     }

  //     it('POST a new complex PRIVATE archetype', (done) => {
  //         const newObject = {
  //             name: 'TestType2',
  //             description: 'Test',
  //             fields: [{ name: 'field1', type: 3 }, { name: 'field2', type: 2 }],
  //             isPrivate: true,
  //             password: password,
  //             documents: [{
  //                 name: 'doc1',
  //                 hoardAddress: hoardRef.address,
  //                 secretKey: hoardRef.secretKey
  //             }, {
  //                 name: 'doc2',
  //                 hoardAddress: hoardRef2.address,
  //                 secretKey: hoardRef2.secretKey
  //             }],
  //             formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //             executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656'
  //         }
  //         chai.request(server)
  //             .post('/archetypes?token=' + token)
  //             .send(newObject)
  //             .end((err, res) => {
  //                 res.should.have.status(200);
  //                 res.should.be.text;
  //                 res.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //                 objAddress = res.text;
  //                 testObject.address = objAddress
  //                 testObject.author = userData.address;
  //                 log.info('Address: ' + objAddress);
  //                 done();
  //             });
  //     }).timeout(8000);

  //     it('Should get the PRIVATE archetype', (done) => {
  //         testObject.documents = [{
  //             name: 'web-api-test.js',
  //             hoardAddress: hoardRef.address,
  //             secretKey: hoardRef.secretKey
  //         }, {
  //             name: 'app.js',
  //             hoardAddress: hoardRef2.address,
  //             secretKey: hoardRef2.secretKey
  //         }]

  //         setTimeout(function () {
  //             chai.request(server)
  //                 .get('/archetypes/' + objAddress + '?password=' + password)
  //                 .end((err, res) => {
  //                     res.should.have.status(200);
  //                     res.body.should.be.an('object');
  //                     try {
  //                         res.body.should.be.deep.equal(testObject)
  //                     } catch (err) {
  //                         testObject.documents = [{
  //                             name: 'app.js',
  //                             hoardAddress: hoardRef2.address,
  //                             secretKey: hoardRef2.secretKey
  //                         }, {
  //                             name: 'web-api-test.js',
  //                             hoardAddress: hoardRef.address,
  //                             secretKey: hoardRef.secretKey
  //                         }]
  //                         res.body.should.be.deep.equal(testObject)
  //                     }

  //                     done()

  //                 })
  //         }, 3000);
  //     }).timeout(8000);

  //     it('Should 401 and fail to get the PRIVATE archetype if provided wrong password', (done) => {
  //         setTimeout(function () {
  //             chai.request(server)
  //                 .get('/archetypes/' + objAddress + '?password=wrongpassword')
  //                 .end((err, res) => {
  //                     res.should.have.status(401);
  //                     done();
  //                 });
  //         }, 3000);
  //     }).timeout(8000);

  //     // TODO archetype configuration currently not supported until new specification is clear, i.e. which fields are included in the configuration
  // 	// it('PUT an archetype configuration', (done) => {
  //  //        const newObject = {
  //  //                name: 'TestType2',
  //  //                author: '0x6EDC6101F0B44446ED867BAE925F6CD240635656',
  //  //                description: 'Test2'
  //  //            }
  //  //        const config = {
  //  //        	numberOfParticipants: 2,
  //  //        	termination: false,
  //  //        	fulfillment: false,
  //  //        	amount: true,
  //  //        	currency: 4
  //  //        }
  //  //        chai.request(server)
  //  //        .post('/archetypes')
  //  //        .send(newObject)
  //  //        .end((err, res) => {
  //  //        	let newAddress = res.text;
  //  //        	log.debug('New Address: '+newAddress);
  // 	//         chai.request(server)
  // 	//             .put('/archetypes/'+newAddress+'/configuration')
  // 	//             .send(newObject)
  // 	//             .end((err, res) => {
  // 	//                 res.should.have.status(200);
  // 	//                 done();
  // 	//             });
  //  //        });
  //  //      }).timeout(10000);

  //     it('PUT custom fields', (done) => {
  //         const newObject = {
  //             name: 'TestType3',
  //             description: 'Test3',
  //             formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //             executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656'
  //         }
  //         const fields = [{
  //             name: 'custom1',
  //             type: 4
  //         },
  //         {
  //             name: 'custom2',
  //             type: 1
  //         }]
  //         chai.request(server)
  //             .post('/archetypes?token=' + token)
  //             .send(newObject)
  //             .end((err, res) => {
  //                 let newAddress = res.text;
  //                 chai.request(server)
  //                     .put('/archetypes/' + newAddress + '/fields?token=' + token)
  //                     .send(fields)
  //                     .end((err, res) => {
  //                         res.should.have.status(200);
  //                         done();
  //                     });
  //             });
  //     }).timeout(10000);

  //     it('PUT documents', (done) => {
  //         const newObject = {
  //                 name: 'TestType4',
  //                 description: 'Add Documents Test',
  //                 formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //                 executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656'
  //             };
  //         const documents = [{
  //             name: 'doc1',
  //             hoardAddress: hoardRef.address,
  //             secretKey: hoardRef.secretKey
  //         },
  //         {
  //             name: 'doc2',
  //             hoardAddress: hoardRef2.address,
  //             secretKey: hoardRef2.secretKey
  //         }]
  //         chai.request(server)
  //             .post('/archetypes?token=' + token)
  //         .send(newObject)
  //         .end((err, res) => {
  //             let newAddress = res.text;
  //             chai.request(server)
  //                     .put('/archetypes/' + newAddress + '/documents?token=' + token)
  //                 .send(documents)
  //                 .end((err, res) => {
  //                     res.should.have.status(200);
  //                     done();
  //                 });
  //         });
  //     }).timeout(10000);
})

describe('Agreements', () => {
  var currentSize
  var agreementAddr
  var objAddress
  const date = new Date().getMilliseconds()

  var newObject = {
    archetype: '0x0',
    name: 'Agreement No. ' + date,
    // values: {
    //   doge: 'coin',
    //   billy: 'bob',
    //   hero: 6,
    // },
    parameters: [],
    isPrivate: false,
    parties: [
      '0x6EDC6101F0B64156ED867BAE925F6CD240635656',
      '0x888C6101F0B64156ED867BAE925F6CD240635656'
    ],
    maxNumberOfEvents: 5
  }

  // Because for some reason input shape and output shapes are not the same
  var testObject = {
    address: '0x0',
    name: 'Agreement No. ' + date,
    // values: {
    //   doge: 'coin',
    //   billy: 'bob',
    //   hero: 6,
    // },
    parameters: [],
    isPrivate: 0,
    parties: [
      { partyAddress: '6EDC6101F0B64156ED867BAE925F6CD240635656' },
      { partyAddress: '888C6101F0B64156ED867BAE925F6CD240635656' }
    ],
    maxNumberOfEvents: 5
  }

  it('GET all agreements', (done) => {
    chai
      .request(server)
      .get('/agreements')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        currentSize = res.body.length
        done()
      })
  }).timeout(2000)

  // it('POST a new agreement', (done) => {
  //   const newArchetype = {
  //     name: 'MyArchie1',
  //     description: 'Agreements Test',
  //     formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //     executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656',
  //   };

  //   chai
  //     .request(server)
  //     .post('/archetypes?token=' + token)
  //     .send(newArchetype)
  //     .end((err, res) => {
  //       let archetypeAddress = res.text;
  //       newObject.archetype = archetypeAddress;
  //       testObject.archetype = archetypeAddress;
  //       setTimeout(() => {
  //         chai
  //           .request(server)
  //           .post('/agreements?token=' + token)
  //           .send(newObject)
  //           .end((err, res) => {
  //             res.should.have.status(200);
  //             res.should.be.text;
  //             res.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //             objAddress = res.text;
  //             log.info('New Agreement Address: ' + objAddress);
  //             agreementAddr = objAddress;
  //             testObject.address = objAddress;
  //             testObject.creator = userData.address;
  //             done();
  //           });
  //       }, 2000);
  //     });
  // }).timeout(10000);

  // it('Get should retrieve the agreement', (done) => {
  //   setTimeout(function() {
  //     chai
  //       .request(server)
  //       .get('/agreements/' + agreementAddr)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         res.body.should.be.an('object');
  //         res.body.should.be.deep.equal(testObject);
  //         done();
  //       });
  //   }, 3000);
  // }).timeout(5000);

  // it('POST a new PRIVATE agreement', (done) => {
  //   const newArchetype = {
  //     name: 'MyArchie2',
  //     description: 'Agreements Test',
  //     formationProcessDefinition: '888C6101F0B64156ED867BAE925F6CD240635656',
  //     executionProcessDefinition: '999C6101F0B64156ED867BAE925F6CD240635656',
  //   };

  //   newObject.isPrivate = true;
  //   testObject.isPrivate = 1;
  //   newObject.password = password;

  //   chai
  //     .request(server)
  //     .post('/archetypes?token=' + token)
  //     .send(newArchetype)
  //     .end((err, res) => {
  //       let archetypeAddress = res.text;
  //       newObject.archetype = archetypeAddress;
  //       testObject.archetype = archetypeAddress;
  //       setTimeout(() => {
  //         chai
  //           .request(server)
  //           .post('/agreements?token=' + token)
  //           .send(newObject)
  //           .end((err, res) => {
  //             res.should.have.status(200);
  //             res.should.be.text;
  //             res.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //             objAddress = res.text;
  //             log.info('New Agreement Address: ' + objAddress);
  //             agreementAddr = objAddress;
  //             testObject.address = objAddress;
  //             testObject.creator = userData.address;
  //             done();
  //           });
  //       }, 2000);
  //     });
  // }).timeout(10000);

  // it('Get should retrieve the PRIVATE agreement', (done) => {
  //   setTimeout(function() {
  //     chai
  //       .request(server)
  //       .get('/agreements/' + agreementAddr + '?password=' + password)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         res.body.should.be.an('object');
  //         res.body.should.be.deep.equal(testObject);
  //         done();
  //       });
  //   }, 3000);
  // }).timeout(5000);

  // TODO: No agreement values are being saved to hoard, so no password check is being done.
  // Eventually provide option to password-protect some custom field values

  // it('Get should 401 if password wrong password when retrieving the PRIVATE agreement', (done) => {
  //   setTimeout(function() {
  //     chai
  //       .request(server)
  //       .get('/agreements/' + agreementAddr + '?password=wrongpassword')
  //       .end((err, res) => {
  //         res.should.have.status(401);
  //         done();
  //       });
  //   }, 3000);
  // }).timeout(5000);

  // it('Should retrieve agreements created by this user... AGAIN', (done) => {
  //     chai.request(server)
  //         .get('/users/' + userData.address + '/agreements')
  //         .end((err, res)=>{
  //             res.should.have.status(200);
  //             res.body.should.be.a('array');
  //             res.body.should.have.length(2)
  //             done()
  //         })
  // })
})

describe('Agreement with parameters', () => {
  const date = new Date().getMilliseconds()
  const newArchetype = {
    name: 'SaveParamTest',
    description: 'Test to save params',
    parameters: [
      { name: 'boolParam', type: 0 },
      { name: 'textParam', type: 1 },
      { name: 'uintParam', type: 2 },
      { name: 'addrParam', type: 6 }
    ],
    isPrivate: true,
    password: password,
    formationProcessDefinition: formation.process.address,
    executionProcessDefinition: execution.process.address
  }
  const newAgreement = {
    archetype: '0x0',
    name: 'Agreement No. ' + date,
    parameters: {},
    isPrivate: false,
    parties: [
      '0x6EDC6101F0B64156ED867BAE925F6CD240635656',
      '0x888C6101F0B64156ED867BAE925F6CD240635656'
    ],
    maxNumberOfEvents: 5
  }
  const fieldValues = [
    { name: 'boolParam', value: false },
    { name: 'textParam', value: 'hello world' },
    { name: 'uintParam', value: 100 },
    { name: 'addrParam', value: '0x1040e6521541daB4E7ee57F21226dD17Ce9F0Fb7' }
  ]

  // it('POSTs a new complex PRIVATE archetype and instantiates it', (done) => {
  //   chai
  //     .request(server)
  //     .post('/archetypes?token=' + token)
  //     .send(newArchetype)
  //     .end((err, res) => {
  //       res.should.have.status(200);
  //       res.should.be.text;
  //       res.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //       objAddress = res.text;
  //       newArchetype.address = objAddress;
  //       newAgreement.archetype = objAddress;
  //       newArchetype.author = userData.address;
  //       log.info('Archetype Address: ' + objAddress);
  //       setTimeout(() => {
  //         chai
  //           .request(server)
  //           .post('/agreements?token=' + token)
  //           .send(newAgreement)
  //           .end((err, res) => {
  //             res.should.have.status(200);
  //             res.should.be.text;
  //             res.text.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
  //             objAddress = res.text;
  //             log.info('New Agreement Address: ' + objAddress);
  //             newAgreement.address = objAddress;
  //             newAgreement.creator = userData.address;
  //             done();
  //           });
  //       }, 3000);
  //     });
  // }).timeout(12000);

  // it('POSTs custom field values to the instantiated agreement', (done) => {
  //   setTimeout(() => {
  //     chai
  //       .request(server)
  //       .post(
  //         `/agreements/${newAgreement.address}/customfields?token=${token}`,
  //       )
  //       .send(fieldValues)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         done();
  //       });
  //   }, 5000);
  // }).timeout(15000);

  // it('GETs custom field values from the instantiated agreement', (done) => {
  //   const reqUrl =
  //     `/agreements/${newAgreement.address}/customfields` +
  //     `?fields[]=boolField&fields[]=intField&fields[]=uintField&fields[]=textField&fields[]=addrField`;
  //   setTimeout(() => {
  //     chai
  //       .request(server)
  //       .get(reqUrl)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         res.body.length.should.equal(5);
  //         let boolField, intField, uintField, textField, addrField;
  //         res.body.forEach((pair) => {
  //           if (pair.name === 'boolField') boolField = pair;
  //           if (pair.name === 'intField') intField = pair;
  //           if (pair.name === 'uintField') uintField = pair;
  //           if (pair.name === 'textField') textField = pair;
  //           if (pair.name === 'addrField') addrField = pair;
  //         });
  //         assert.equal(boolField.value, false);
  //         assert.equal(uintField.value, 100);
  //         assert.equal(intField.value, -128);
  //         assert.equal(textField.value, 'hello world');
  //         assert.equal(
  //           String.prototype.toUpperCase(addrField.value),
  //           String.prototype.toUpperCase(
  //             '1040e6521541daB4E7ee57F21226dD17Ce9F0Fb7',
  //           ),
  //         );
  //         done();
  //       });
  //   }, 5000);
  // }).timeout(10000);

  // it('Fails gracefully when invalid fields are requested', (done) => {
  //   const reqUrl =
  //     `/agreements/${newAgreement.address}/customfields` +
  //     `?fields[]=boolField&fields[]=intField&fields[]=dummyField&fields[]=uintField&fields[]=textField&fields[]=addrField` +
  //     `&token=${token}`;
  //   setTimeout(() => {
  //     chai
  //       .request(server)
  //       .get(reqUrl)
  //       .end((err, res) => {
  //         res.should.have.status(400);
  //         res.body.length.should.equal(1);
  //         res.body[0].should.equal('dummyField');
  //         done();
  //       });
  //   }, 5000);
  // }).timeout(10000);

  // it('GETs agreement along with custom field data', (done) => {
  //   setTimeout(() => {
  //     chai
  //       .request(server)
  //       .get(`/agreements/${newAgreement.address}`)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         done();
  //       });
  //   }, 5000);
  // });

  // it('GETs agreement along with custom field data', done => {
  //   setTimeout(() => {
  //     chai.request(server)
  //       .get(`/agreements/${newAgreement.address}`)
  //       .end((err, res) => {
  //         res.should.have.status(200);
  //         done();
  //       });
  //   }, 5000);
  // });
})

// describe('BPM user task completion', () => {
//   const modelId = rid(16, "aA0");
//   let xml = fs.readFileSync(path.resolve('test/data/Sample-example-3.bpmn'), 'utf8');
//   xml = _.replace(xml, '###MODEL_ID###', modelId);
//   const user1 = { user: rid(10, 'aA0'), password: 'johndoe' };
//   const user2 = { user: rid(10, 'aA0'), password: 'janedoe' };
//   const processId = 'process1';
//   const participant1 = "Participant1";

//   let user1Token, user2Token, pmAddress, pdAddress, piAddress, activityId, aiId;

//   it('Should register user1', done => {
//     chai
//       .request(server)
//       .post('/register')
//       .send(user1)
//       .end((err, res) => {
//         if (err) assert.fail(err);
//         res.should.have.status(200);
//         assert.ok(res.body.token);
//         user1Token = res.body.token;
//         assert.ok(res.body.user);
//         res.body.user.address.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
//         user1.address = res.body.user.address;
//         done();
//       });
//   }).timeout(10000);

//   it('Should register user2', done => {
//     chai
//       .request(server)
//       .post('/register')
//       .send(user2)
//       .end((err, res) => {
//         if (err) assert.fail(err);
//         res.should.have.status(200);
//         assert.ok(res.body.token);
//         user2Token = res.body.token;
//         assert.ok(res.body.user);
//         res.body.user.address.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
//         user2.address = res.body.user.address;
//         done();
//       });
//   }).timeout(10000);

//   it('Should login user 1', done => {
//     setTimeout(() => {
//       chai
//         .request(server)
//         .post('/login')
//         .send(user1)
//         .end((err, res) => {
//           res.should.have.status(200);
//           res.body.should.be.a('object');
//           res.body.should.have.property('token');
//           user1Token = res.body.token;
//           xml = _.replace(xml, '###USER_ADDRESS###', user1.address);
//           done();
//         });
//     }, 3000);
//   }).timeout(10000);

//   it('Should create a new process model from bpmn xml', done => {
//     setTimeout(() => {
//       chai
//         .request(server)
//         .post(`/bpmn/model?token=${user1Token}`)
//         .send(xml)
//         .end((err, res) => {
//           if (err) assert.fail(err);
//           res.should.have.status(200);
//           assert.ok(res.body);
//           let model = res.body.model;
//           let process1 = res.body.processes[0];
//           expect(model).to.exist;
//           expect(process1).to.exist;
//           model.address.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
//           process1.address.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
//           process1.id.should.equal(processId);
//           activityId = process1.id;
//           pmAddress = model.address;
//           pdAddress = process1.address;
//           done();
//         });
//     }, 2000);
//   }).timeout(20000);

//   it('Should start the process', done => {
//     setTimeout(() => {
//       chai
//         .request(server)
//         .post(`/startProcess?token=${user1Token}`)
//         .send({ modelId: modelId, processId: processId })
//         .end((err, res) => {
//           if (err) assert.fail(err);
//           res.should.have.status(200);
//           res.body.piAddress.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
//           piAddress = res.body.piAddress;
//           done();
//         });
//     }, 3000);
//   }).timeout(10000);

//   it('Should have a suspended activity for user 1', done => {
//     // TODO bypassing the getTaskForUser REST API call since that query retrieve empty array for some reason,
//     // although the data is there in sqlsol cache. This may be a timing issue with the test.
//     setTimeout(() => {
//       chai
//         .request(server)
//         .get(`/activity-instances?processInstance=${piAddress}&token=${user1Token}`)
//         .end((err, res) => {
//           if (err) assert.fail(err);
//           res.should.have.status(200);
//           res.body.length.should.equal(1);
//           res.body[0].performer.should.equal(user1.address);
//           res.body[0].processAddress.should.equal(piAddress);
//           res.body[0].state.should.equal(4); //SUSPENDED
//           aiId = res.body[0].activityInstanceId;
//           done();
//         });
//     }, 3000);
//   }).timeout(20000);

//   it('Should complete pending user activity', done => {
//     setTimeout(() => {
//       chai
//         .request(server)
//         .put(`/tasks/${aiId}/complete?token=${user1Token}`)
//         .end((err, res) => {
//           if (err) assert.fail(err);
//           res.should.have.status(200);
//           done();
//         });
//     }, 3000);
//   }).timeout(10000);
// });
