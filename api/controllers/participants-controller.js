const boom = require('boom');
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const _ = require('lodash');
const crypto = require('crypto');
const sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
const sqlCache = require('./postgres-query-helper');

const {
  format,
  pgUpdate,
  setUserIds,
  getNamesOfOrganizations,
  asyncMiddleware,
  getSHA256Hash,
} = require(`${global.__common}/controller-dependencies`);
const contracts = require('./contracts-controller');
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('participants');
const { app_db_pool } = require(`${global.__common}/postgres-db`);
const userSchema = require(`${global.__schemas}/user`);
const userProfileSchema = require(`${global.__schemas}/userProfile`);

const getOrganizations = asyncMiddleware(async (req, res) => {
  if (req.query.approver === 'true') {
    req.query.approver_address = req.user.address;
    delete req.query.approver;
  }
  try {
    const data = await sqlCache.getOrganizations(req.query);
    // Vent query has join that results in multiple rows for each org
    // Consolidate data by storing in object 'aggregated'
    const aggregated = {};
    data.forEach(({ address, organizationKey, approver }) => {
      if (!aggregated[address]) {
        aggregated[address] = { address, organizationKey, approvers: [] };
      }
      aggregated[address].approvers.push(approver);
    });
    const organizations = await getNamesOfOrganizations(Object.values(aggregated));
    return res.json(organizations);
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
});

const getOrganization = asyncMiddleware(async (req, res) => {
  try {
    const data = await sqlCache.getOrganization(req.params.address);
    // Vent query has left join that results in multiple rows for the org for each approver, user, department, and department member
    // Consolidate data by storing approvers and users in objects
    let approvers = {};
    let users = {};
    let departments = {};
    const departmentUserKeys = {};
    data.forEach(({
      approver, user, department, departmentName, departmentUserKey,
    }) => {
      if (approver && !approvers[approver]) {
        approvers[approver] = { address: approver };
      }
      if (user && !users[user]) {
        users[user] = { address: user, departments: [] };
      }
      const { id } = format('Department', { id: department });
      if (department && !departments[id]) {
        departments[id] = { id, name: departmentName, users: [] };
        departmentUserKeys[id] = {};
      }
      if (departmentUserKey && !departmentUserKeys[id][departmentUserKey]) {
        departments[id].users.push(departmentUserKey);
        users[user].departments.push(id);
        departmentUserKeys[id][departmentUserKey] = true;
      }
    });
    approvers = Object.values(approvers);
    users = Object.values(users);
    departments = Object.values(departments);
    if (!approvers.find(({ address }) => address === req.user.address) && !users.find(({ address }) => address === req.user.address)) {
      throw boom.forbidden('User is not an approver or member of this organization and not allowed access');
    }
    const { address, organizationKey } = data[0];
    const { 0: { name } } = await getNamesOfOrganizations([{ address }]);
    const org = {
      address, organizationKey, name, approvers, users, departments,
    };
    org.approvers = await setUserIds(org.approvers);
    org.users = await setUserIds(org.users);
    return res.status(200).send(org);
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
});

const createOrganization = asyncMiddleware(async (req, res) => {
  const org = req.body;
  if (!org.name) throw boom.badRequest('Organization name is required');
  log.info(`Request to create new organization: ${org.name}`);
  if (!org.approvers || org.approvers.length === 0) {
    log.debug(`No approvers provided for new organization. Setting current user ${req.user.address} as approver.`);
    org.approvers = [req.user.address];
  }
  try {
    const address = await contracts.createOrganization(org);
    await app_db_pool.query({
      text: 'INSERT INTO organizations(address, name) VALUES($1, $2);',
      values: [address, org.name],
    });
    log.info('Added organization name and address to postgres');
    return res.status(200).json({ address, name: org.name });
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
});

const createOrganizationUserAssociation = asyncMiddleware(async (req, res) => {
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': req.params.address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to add users');
  }
  await contracts.addUserToOrganization(req.params.userAddress, req.params.address, req.user.address);
  return res.status(200).send();
});

const deleteOrganizationUserAssociation = asyncMiddleware(async (req, res) => {
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': req.params.address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
  }
  await contracts.removeUserFromOrganization(req.params.userAddress, req.params.address, req.user.address);
  return res.status(200).send();
});

const createDepartment = asyncMiddleware(async (req, res) => {
  const { id, name, users = [] } = req.body;
  const { address } = req.params;
  if (!id || !name) {
    throw boom.badRequest('Id and name are required for organization');
  } else if (!/^[a-zA-Z0-9_]+/.test(id)) {
    throw boom.badRequest('Id cannot include spaces');
  }
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to create departments');
  }
  await contracts.createDepartment(address, { id, name }, req.user.address);
  // Optionally also add users in the same request
  const addUserPromises = users.map(user => contracts.addDepartmentUser(address, id, user, req.user.address));
  await Promise.all(addUserPromises)
    .then(() => res.status(200).send({ id, name, users }))
    .catch((err) => {
      if (boom.isBoom(err)) throw err;
      throw boom.badImplementation(err);
    });
});

const removeDepartment = asyncMiddleware(async (req, res) => {
  const { address, id } = req.params;
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove departments');
  }
  await contracts.removeDepartment(address, id, req.user.address);
  res.status(200).send();
});

const addDepartmentUsers = asyncMiddleware(async (req, res) => {
  const { address, id } = req.params;
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to add users to departments');
  }
  const { users } = req.body;
  const addUserPromises = users.map(user => contracts.addDepartmentUser(address, id, user, req.user.address));
  await Promise.all(addUserPromises)
    .then(() => res.status(200).send())
    .catch((err) => {
      if (boom.isBoom(err)) throw err;
      throw boom.badImplementation(err);
    });
});

const removeDepartmentUser = asyncMiddleware(async (req, res) => {
  const { address, id, userAddress } = req.params;
  const orgData = await sqlCache.getOrganizations({ 'o.organization_address': address });
  if (!orgData.find(({ approver }) => approver === req.user.address)) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to add users to departments');
  }
  await contracts.removeDepartmentUser(address, id, userAddress, req.user.address);
  res.status(200).send();
});

const _userExistsOnChain = async (id) => {
  try {
    await contracts.getUserById(getSHA256Hash(id));
    return true;
  } catch (err) {
    if (err.output.statusCode === 404) {
      return false;
    }
    throw boom.badImplementation(err);
  }
};

const upgradeExternalUser = async (client, {
  username,
  email,
  passwordDigest,
  isProducer,
}) => {
  try {
    const queryString = `UPDATE users
    SET external_user = false, username = $1, password_digest = $2, is_producer = $3
    WHERE email = $4
    RETURNING id, address;`;
    const { rows } = await client.query({ text: queryString, values: [username, passwordDigest, isProducer, email] });
    await contracts.addUserToEcosystem(getSHA256Hash(username), rows[0].address);
    return rows[0];
  } catch (err) {
    client.release();
    if (err.isBoom) throw err;
    throw boom.badImplementation(`Failed to upgrade external user to regular user: ${err.stack}`);
  }
};

const registerUser = async (userData) => {
  let address;
  let userId;
  let existingEmail;
  let isExternalUser; // indicates user already exists as "external user"
  const client = await app_db_pool.connect();
  const { error, value } = Joi.validate(userData, userSchema, { abortEarly: false });
  if (error) throw boom.badRequest(`Required fields missing or malformed: ${error}`);
  const {
    username, email, password, isProducer,
  } = value;
  // check if email or username already registered in pg
  try {
    const { rows } = await client.query({
      text: 'SELECT LOWER(email) AS email, LOWER(username) AS username, external_user AS "externalUser" FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2);',
      values: [email, username],
    });
    if (rows[0]) existingEmail = rows[0].email;
    isExternalUser = rows[0] && rows[0].externalUser && rows[0].email === email.toLowerCase();
    if (rows[0] && !isExternalUser) {
      if (rows[0].email === email.toLowerCase()) {
        throw boom.badData(`Email ${email} already registered`);
      } else if (rows[0].username === username.toLowerCase()) {
        throw boom.badData(`Username ${username} already registered`);
      }
    }
  } catch (err) {
    client.release();
    if (err.isBoom) throw err;
    throw boom.badImplementation(`Failed to validate if username already registered : ${err.stack}`);
  }

  if (!isExternalUser) {
    // check if username is registered on chain
    try {
      const userInCache = await _userExistsOnChain(username);
      if (userInCache) throw boom.badData(`Username ${username} already exists`);
    } catch (err) {
      client.release();
      if (err.isBoom) throw err;
      throw boom.badImplementation(`Failed to validate if user exists on chain: ${err.stack}`);
    }

    // create user on chain
    try {
      address = await contracts.createUser({ id: getSHA256Hash(username) });
    } catch (err) {
      client.release();
      throw boom.badImplementation(`Failed to create user on chain: ${err.stack}`);
    }
  }
  const salt = await bcrypt.genSalt(10);
  let hash = await bcrypt.hash(password, salt);

  if (isExternalUser) {
    ({ id: userId, address } = await upgradeExternalUser(client, {
      username,
      email: existingEmail,
      passwordDigest:
      hash,
      isProducer,
    }));
  } else {
    // insert in user db
    try {
      const queryString = `INSERT INTO users(
        address, username, email, password_digest, is_producer
        ) VALUES(
          $1, $2, $3, $4, $5
        ) RETURNING id;`;
      const { rows } = await client.query({ text: queryString, values: [address, username, email, hash, isProducer] });
      userId = rows[0].id;
    } catch (err) {
      client.release();
      throw boom.badImplementation(`Failed to save user in db: ${err.stack}`);
    }
  }

  // generate and persist activation code
  hash = crypto.createHash('sha256');
  const activationCode = crypto.randomBytes(32).toString('hex');
  hash.update(activationCode);
  try {
    await client.query({
      text: 'INSERT INTO user_activation_requests (user_id, activation_code_digest) VALUES($1, $2);',
      values: [userId, hash.digest('hex')],
    });
    log.info(`Saved activation code ${activationCode} for user at address ${address}`);
  } catch (err) {
    client.release();
    throw boom.badImplementation(`Failed to save user activation code: ${err.stack}`);
  }

  client.release();
  return {
    address, username, email, activationCode,
  };
};

const sendUserActivationEmail = async (userEmail, senderEmail, webappName, apiUrl, activationCode) => {
  const message = {
    to: userEmail,
    from: `${senderEmail}`,
    subject: `${webappName} - Activate Account`,
    text: `Your account has been successfully created on the ${webappName}. In order to login please activate your user account by clicking <a href="${apiUrl}/users/activate/${activationCode}">here</a>.`,
    html: `Your account has been successfully created on the ${webappName}. In order to login please activate your user account by clicking <a href="${apiUrl}/users/activate/${activationCode}">here</a>.`,
  };
  await sendgrid.send(message);
};

const registrationHandler = asyncMiddleware(async ({ body }, res) => {
  const result = await registerUser(body);
  if (process.env.WEBAPP_EMAIL && process.env.WEBAPP_URL) {
    await sendUserActivationEmail(
      result.email,
      process.env.WEBAPP_EMAIL,
      process.env.WEBAPP_NAME,
      process.env.API_URL,
      result.activationCode,
    );
  }
  return res.status(200).json({
    address: result.address,
    username: result.username,
  });
});

const activateUser = asyncMiddleware(async (req, res) => {
  log.info(`Activation request received with code: ${req.params.activationCode}`);
  const hash = crypto.createHash('sha256');
  hash.update(req.params.activationCode);
  const codeHex = hash.digest('hex');
  const rows = await sqlCache.getUserByActivationCode(codeHex);
  if (!rows.length) {
    throw boom.badRequest('Activation code does not match any user account');
  }
  try {
    await sqlCache.updateUserActivation(rows[0].address, rows[0].userId, true, codeHex);
    res.redirect('/?activated=true');
  } catch (err) {
    log.error(`Failed to activate user account at ${rows[0].address}: ${err}`);
    res.redirect('/help');
  }
});

const getUsers = asyncMiddleware(async (req, res) => {
  const data = await sqlCache.getUsers();
  return res.status(200).json(data);
});

const getProfile = asyncMiddleware(async (req, res) => {
  if (!req.user.address) throw boom.badRequest('No logged in user found');
  const userAddress = req.user.address;
  const data = await sqlCache.getProfile(userAddress);
  const user = { address: userAddress };
  // Multiple rows returned because of left join for organization departments.
  // Consolidating data in object.
  const organizations = {};
  data.forEach(({
    organization, organizationKey, department, departmentName,
  }) => {
    if (organization && !organizations[organization]) {
      organizations[organization] = { address: organization, organizationKey, departments: [] };
    }
    if (department) {
      const { id } = format('Department', { id: department });
      organizations[organization].departments.push({ id, name: departmentName });
    }
  });
  user.organizations = await getNamesOfOrganizations(Object.values(organizations));
  try {
    const { rows } = await app_db_pool.query({
      text: 'SELECT username AS id, email, created_at, first_name, last_name, country, region, is_producer, onboarding ' +
        'FROM users WHERE address = $1',
      values: [userAddress],
    });
    _.merge(user, rows[0]);
    return res.status(200).json(format('User', user));
  } catch (err) {
    throw boom.badImplementation(`Failed to get profile data for user at ${userAddress}: ${err}`);
  }
});

const editProfile = asyncMiddleware(async (req, res) => {
  const userAddress = req.user.address;
  const { error } = Joi.validate(req.body, userProfileSchema, { abortEarly: false });
  if (error) throw boom.badRequest(`Required fields missing or malformed: ${error}`);
  if (req.body.email || req.body.id) throw boom.notAcceptable('Email and username cannot be changed');
  if (req.body.password) throw boom.notAcceptable('Password can only be updated by providing currentPassword and newPassword fields');
  let client;
  try {
    client = await app_db_pool.connect();
    await client.query('BEGIN');
    if (req.body.newPassword) {
      const { rows } = await client.query({
        text: 'SELECT password_digest FROM users WHERE address = $1',
        values: [userAddress],
      });
      const { password_digest: pwDigest } = rows[0];
      const isPassword = await bcrypt.compare(req.body.currentPassword, pwDigest);
      if (!isPassword) throw boom.forbidden('Invalid password provided');
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(req.body.newPassword, salt);
      delete req.body.currentPassword;
      delete req.body.newPassword;
      req.body.passwordDigest = hash;
    }
    const { text, values } = pgUpdate('users', req.body);
    values.push(userAddress);
    await client.query({
      text: `${text} WHERE address = $${values.length}`,
      values,
    });
    await client.query('COMMIT');
    if (client) client.release();
    return res.status(200).json({ address: userAddress });
  } catch (err) {
    if (err.isBoom) throw err;
    throw boom.badImplementation(`Error editing profile: ${err}`);
  }
});

module.exports = {
  getOrganizations,
  getOrganization,
  createOrganization,
  createOrganizationUserAssociation,
  deleteOrganizationUserAssociation,
  createDepartment,
  removeDepartment,
  addDepartmentUsers,
  removeDepartmentUser,
  getUsers,
  getProfile,
  editProfile,
  registrationHandler,
  registerUser,
  activateUser,
};
