const rid = require('random-id');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const crypto = require('crypto');
const nanoid = require('nanoid');
const logger = require('../../common/logger');
const log = logger.getLogger('tests.Harness');

const contracts = require('../../controllers/contracts-controller');

before(function(done) {
  this.timeout(99999999);
  contracts
    .load()
    .then(() => {
      log.info('Contracts loaded.');
      log.info('Application started. Running Contracts Test Suite ...');
      done();
    })
    .catch(error => {
      log.error('Unexpected error initializing the test harness: ' + error.message);
      done(error);
    });
});

describe('USER MIGRATION', () => {
  const user = {
    userid: `monax_test|${nanoid()}`,
    useridHash: null,
    username: `${rid(5, 'aA0')}`,
    usernameHash: null,
    address: '',
  };

  it('Should create a user account', async () => {
    user.usernameHash = crypto
      .createHash('sha256')
      .update(user.username)
      .digest('hex');
    let address = await contracts.createUser({
      username: user.usernameHash,
    });
    address.should.match(/[0-9A-Fa-f]{40}/); // match for 20 byte hex
    user.address = address;
  }).timeout(10000);

  it('Should migrate user account from username to userid', async () => {
    user.useridHash = crypto
      .createHash('sha256')
      .update(user.userid)
      .digest('hex');
    await contracts.migrateUserAccountInEcosystem(user.address, user.usernameHash, user.useridHash);
    const res = await contracts.getUserByUserId(user.useridHash);
    expect(user.address).to.equal(res.address);
  }).timeout(10000);

});
