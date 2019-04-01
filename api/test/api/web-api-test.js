require('../constants');
const chai = require('chai')
const chaiHttp = require('chai-http')
const chaiAsPromised = require('chai-as-promised');
const request = require('supertest')
const rid = require('random-id')
const path = require('path')
const fs = require('fs')
const _ = require('lodash')
const crypto = require('crypto');

const app = require('../../app')();
const server = require(__common + '/aa-web-api')();
const logger = require(__common + '/monax-logger')
const log = logger.getLogger('agreements.tests');

const api = require('./api-helper')(server)
const { rightPad } = require(__common + '/controller-dependencies')

// configure chai
chai.use(chaiHttp);
chai.use(chaiAsPromised);
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;

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
    const in_noPadMultiByteHex = '6964656e7469666963616369c3b36e';
    const in_paddedMultiByteHex = '62c3a472000000';
    const out_str_assignee = 'Assignee';
    const out_str_identification = 'identificación';
    const out_str_bear = 'bär';

    // plain old string to hex
    let hex_text1 = global.stringToHex(text1)
    hex_text1 = rightPad(hex_text1, 32)
    const conv_text1 = global.hexToString(hex_text1)
    expect(conv_text1).to.equal(text1)

    // expect null hex to match empty string
    expect(global.hexToString(in_nullHex)).to.equal(emptyString);

    // expect empty string to match empty hex
    expect(global.stringToHex(emptyString)).to.equal('');

    // expect spaces roundtrip to spaces to pass
    expect(global.hexToString(global.stringToHex(spaces))).to.equal(spaces);

    // expect no padded hex to match no padded string
    expect(global.hexToString(in_noPaddedHex)).to.equal(out_str_assignee);

    // expect even left padded hex to match string
    expect(global.hexToString(in_evenLeftPaddedHex)).to.equal(out_str_assignee);

    // expect even right padded hex to match string
    expect(global.hexToString(in_evenRightPaddedHex)).to.equal(out_str_assignee);

    // expect odd left padded hex to NOT match string
    expect(global.hexToString(in_oddLeftPaddedHex)).to.not.equal(out_str_assignee);

    // expect odd right padded hex to match string
    expect(global.hexToString(in_oddRightPaddedHex)).to.equal(out_str_assignee)

    // expect multibyte hex to match string
    expect(global.hexToString(in_noPadMultiByteHex)).to.equal(out_str_identification);

    // expect padded multibyte hex to match string
    expect(global.hexToString(in_paddedMultiByteHex)).to.equal(out_str_bear);

    done();
  });
});

/**
 * ######## USER REGISTRATION / LOGIN #########################################################################################
 */

describe('Registration/ Login', () => {
  it('Should register a new user', function (done) {
    // this.timeout(10000)
    chai
      .request(server)
      .post('/users')
      .send(credentials)
      .end((err, res) => {
        res.should.have.status(200)
        done();
      });
  });

  it('Should fail to register an existing user', function (done) {
    // this.timeout(10000)
    chai
      .request(server)
      .post('/users')
      .send(credentials)
      .end((err, res) => {
        res.should.have.status(422)
        done();
      });
  });

  it('Should fail if credentials not passed', (done) => {
    chai
      .request(server)
      .post('/users')
      .send(badcredentials)
      .end((err, res) => {
        res.should.have.status(400)
        done();
      });
  });

  it('Should fail to login if user is not activated', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(credentials)
      .end((err, res) => {
        if (err) done(err);
        res.should.have.status(401);
        done();
      });
  });

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
  }).timeout(5000);

  it('Should fail to login as non-existent user', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(baduser)
      .end((err, res) => {
        res.should.have.status(401);
        done();
      });
  });

  it('Should fail if credentials not passed', (done) => {
    chai
      .request(server)
      .put('/users/login')
      .send(badcredentials)
      .end((err, res) => {
        res.should.have.status(400);
        done();
      });
  });

  it('GET all users', (done) => {
    chai
      .request(server)
      .get('/users')
      .set('Cookie', [`access_token=${token}`])
      .end((err, res) => {
        res.should.have.status(200)
        res.body.should.be.a('array')
        done();
      });
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
  });

  it('Should retrieve the logged in user\'s profile', (done) => {
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
  });

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
        });
    }).timeout(5000);

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
            }, global.ventCatchUpMS);
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
            }, global.ventCatchUpMS);
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
            }, global.ventCatchUpMS);
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
            }, global.ventCatchUpMS);
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
            }, global.ventCatchUpMS);
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
        }, global.ventCatchUpMS);
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
        }, global.ventCatchUpMS);
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
        }, global.ventCatchUpMS);
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
});