const fs = require('fs');
const path = require('path');
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('agreements.notifications');
const {
  listen,
  events,
} = require(`${global.__controllers}/contracts-controller`);
const sqlCache = require('./sqlsol-query-helper');
const pgCache = require('./postgres-cache-helper');

if (!fs.existsSync(path.resolve(`${global.__plugins}/mp-notifications`))) {
  log.warn('Notifications plugin not found. Slack notifications will be disabled.');
} else {
  const {
    sendSlackNotification,
  } = require(`${global.__plugins}/mp-notifications`);
  listen.on(events.USER_CREATED, (e) => {
    sendSlackNotification(e.address, 'hello world');
  });

  listen.on(events.AGREEMENT_CREATED, async ({
    name,
    creator,
  }) => {
    const {
      email: creatorEmail,
    } = await pgCache.getUserDetails(creator);
    sendSlackNotification(creatorEmail, `You have successfully created agreement: ${name}`);
  });

  listen.on(events.ARCHETYPE_CREATED, async ({
    name,
    author,
  }) => {
    const {
      email: authorEmail,
    } = await pgCache.getUserDetails(author);
    sendSlackNotification(authorEmail, `You have successfully created archetype: ${name}`);
  });

  listen.on(events.AGREEMENT_SIGNED, async ({
    userAddr,
    agreementAddr,
  }) => {
    const {
      email: signatoryEmail,
      firstname: signatoryFirstName,
      lastname: signatoryLastName,
    } = await pgCache.getUserDetails(userAddr);
    const {
      name: agreementName,
    } = await sqlCache.getAgreementData(agreementAddr, userAddr);
    sendSlackNotification(signatoryEmail, `Thanks for signing agreement: ${agreementName}!`);
    const parties = (await sqlCache.getAgreementParties(agreementAddr)) || [];
    parties.forEach(async (party) => {
      const {
        email: partyEmail,
      } = await pgCache.getUserDetails(party.address);
      sendSlackNotification(partyEmail, `${signatoryFirstName} ${signatoryLastName} has signed agreement: ${agreementName}.`);
    });
  });
}
