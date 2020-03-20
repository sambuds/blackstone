import { Contracts } from '../lib/contracts';
import { SHA3 } from '../lib/utils';
import rid = require('random-id');
import nanoid = require('nanoid');
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { load } from './before';
chai.use(chaiAsPromised);
const { expect } = chai;

let contracts: Contracts;

before(function (done) {
  this.timeout(99999999);
  load().then(loaded => { contracts = loaded; done(); })
        .catch(error => done(error));
});

describe('USER MIGRATION', () => {
  const user = {
    userid: `monax_test|${nanoid()}`,
    useridHash: '',
    username: `${rid(5, 'aA0')}`,
    usernameHash: '',
    address: '',
  };

  it('Should create a user account', async () => {
    user.usernameHash = SHA3(user.username);
    const address = await contracts.createUser({
      username: user.usernameHash,
    });
    expect(address).to.match(/[0-9A-Fa-f]{40}/);
    user.address = address;
  }).timeout(10000);

  it('Should migrate user account from username to userid', async () => {
    user.useridHash = SHA3(user.userid);
    await contracts.migrateUserAccountInEcosystem(user.address, user.usernameHash, user.useridHash);
    const address = await contracts.getUserByUserId(user.useridHash);
    expect(user.address).to.equal(address);
  }).timeout(10000);
});
