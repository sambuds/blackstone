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
  asyncMiddleware,
  getSHA256Hash,
  prependHttps,
} = require(`${global.__common}/controller-dependencies`);
const contracts = require('./contracts-controller');
const logger = require(`${global.__common}/monax-logger`);
const log = logger.getLogger('participants');
const { app_db_pool } = require(`${global.__common}/postgres-db`);
const { DEFAULT_DEPARTMENT_ID } = require(`${global.__common}/monax-constants`);
const userSchema = require(`${global.__schemas}/user`);
const userProfileSchema = require(`${global.__schemas}/userProfile`);
const { PARAMETER_TYPES: PARAM_TYPE } = global.__monax_constants;

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
    data.forEach(({
      address, name, organizationKey, approver,
    }) => {
      if (!aggregated[address]) {
        aggregated[address] = {
          address, name, organizationKey, approvers: [],
        };
      }
      aggregated[address].approvers.push(approver);
    });
    return res.json(Object.values(aggregated));
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
    const departmentUsers = {};
    data.forEach(({
      approver, approverName, user, userName, department, departmentName, departmentUser,
    }) => {
      if (approver && !approvers[approver]) {
        approvers[approver] = { address: approver, id: approverName };
      }
      if (user && !users[user]) {
        users[user] = { address: user, id: userName, departments: [] };
      }
      if (department && !departments[department]) {
        departments[department] = { id: department, name: departmentName, users: [] };
        departmentUsers[department] = {};
      }
      if (departmentUser && !departmentUsers[department][departmentUser]) {
        departments[department].users.push(departmentUser);
        users[user].departments.push(department);
        departmentUsers[department][departmentUser] = true;
      }
    });
    approvers = Object.values(approvers);
    users = Object.values(users);
    departments = Object.values(departments);
    if (!approvers.find(({ address }) => address === req.user.address) && !users.find(({ address }) => address === req.user.address)) {
      throw boom.forbidden('User is not an approver or member of this organization and not allowed access');
    }
    const { address, name, organizationKey } = data[0];
    const org = {
      address, organizationKey, name, approvers, users, departments,
    };
    return res.status(200).send(org);
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
});

const createOrganization = asyncMiddleware(async (req, res) => {
  const org = req.body;
  if (!org.name) throw boom.badRequest('Organization name is required');
  if (org.name > 255) throw boom.badRequest('Organization name length cannot exceed 255 characters');
  log.info(`Request to create new organization: ${org.name}`);
  if (!org.approvers || org.approvers.length === 0) {
    log.debug(`No approvers provided for new organization. Setting current user ${req.user.address} as approver.`);
    org.approvers = [req.user.address];
  }
  const defDepId = getSHA256Hash(DEFAULT_DEPARTMENT_ID);
  org.defaultDepartmentId = defDepId;
  try {
    const address = await contracts.createOrganization(org);
    await app_db_pool.query({
      text: 'INSERT INTO organizations(address, name) VALUES($1, $2);',
      values: [address, org.name],
    });
    await sqlCache.insertDepartmentDetails({ organizationAddress: address, id: defDepId, name: org.defaultDepartmentName || DEFAULT_DEPARTMENT_ID });
    log.info('Added organization name and address to postgres');
    return res.status(200).json({ address, name: org.name });
  } catch (err) {
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
});

const createOrganizationUserAssociation = asyncMiddleware(async (req, res) => {
  const authorized = await sqlCache.userIsOrganizationApprover(req.params.address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to add users');
  }
  await contracts.addUserToOrganization(req.params.userAddress, req.params.address, req.user.address);
  return res.status(200).send();
});

const deleteOrganizationUserAssociation = asyncMiddleware(async (req, res) => {
  const authorized = await sqlCache.userIsOrganizationApprover(req.params.address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
  }
  await contracts.removeUserFromOrganization(req.params.userAddress, req.params.address, req.user.address);
  return res.status(200).send();
});

const createDepartment = asyncMiddleware(async (req, res) => {
  const { name, users = [] } = req.body;
  const { address } = req.params;
  if (!name) {
    throw boom.badRequest('Name is required for department');
  } else if (name.length > 255) {
    throw boom.badRequest('Name length cannot exceed 255 characters');
  }
  const authorized = await sqlCache.userIsOrganizationApprover(address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
  }
  const id = getSHA256Hash(`${req.user.address}${name}${Date.now()}`).toUpperCase();
  await contracts.createDepartment(address, id, req.user.address);
  await sqlCache.insertDepartmentDetails({ organizationAddress: address, id, name });
  // Optionally also add users in the same request
  const addUserPromises = users.map(user => contracts.addDepartmentUser(address, id, user, req.user.address));
  await Promise.all(addUserPromises)
    .then(() => res.status(200).json({ id, name, users }))
    .catch((err) => {
      if (boom.isBoom(err)) throw err;
      throw boom.badImplementation(err);
    });
});

const removeDepartment = asyncMiddleware(async (req, res) => {
  const { address, id } = req.params;
  const authorized = await sqlCache.userIsOrganizationApprover(address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
  }
  await contracts.removeDepartment(address, id, req.user.address);
  await sqlCache.removeDepartmentDetails({ organizationAddress: address, id });
  res.status(200).send();
});

const addDepartmentUsers = asyncMiddleware(async (req, res) => {
  const { address, id } = req.params;
  const authorized = await sqlCache.userIsOrganizationApprover(address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
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
  const authorized = await sqlCache.userIsOrganizationApprover(address, req.user.address);
  if (!authorized) {
    throw boom.forbidden('User is not an approver of the organization and not authorized to remove users');
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
      prependHttps(process.env.API_URL),
      result.activationCode,
    );
  }
  return res.status(200).json({
    address: result.address,
    username: result.username,
  });
});

const activateUser = asyncMiddleware(async (req, res) => {
  const hash = crypto.createHash('sha256');
  log.info(`Activation request received with code: ${req.params.activationCode}`);
  hash.update(req.params.activationCode);
  const codeHex = hash.digest('hex');
  const rows = await sqlCache.getUserByActivationCode(codeHex);
  let redirectHost = process.env.WEBAPP_URL;
  if (!String(redirectHost).startsWith('http')) {
    redirectHost = process.env.MONAX_ENV === 'local' ? `http://${redirectHost}` : `https://${redirectHost}`;
  }
  if (!rows.length) {
    log.error(`Activation code ${req.params.activationCode} does not match any user account`);
    return res.redirect(`${redirectHost}/?tokenExpired=true`);
  }
  try {
    await sqlCache.updateUserActivation(rows[0].address, rows[0].userId, true, codeHex);
    log.info(`Successfully activated user at ${rows[0].address}`);
    return res.redirect(`${redirectHost}/?activated=true`);
  } catch (err) {
    log.error(`Failed to activate user account at ${rows[0].address}: ${err}`);
    return res.redirect(`${redirectHost}/help`);
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
    organization, organizationName, organizationKey, department, departmentName,
  }) => {
    if (organization && !organizations[organization]) {
      organizations[organization] = {
        address: organization, name: organizationName, organizationKey, departments: [],
      };
    }
    if (department) {
      const { id } = format('Department', { id: department });
      organizations[organization].departments.push({ id, name: departmentName });
    }
  });
  user.organizations = Object.values(organizations);
  delete user.organization;
  try {
    const { rows } = await app_db_pool.query({
      text: 'SELECT username AS id, email, created_at AS "createdAt", first_name AS "firstName", last_name AS "lastName", country, region, is_producer AS "isProducer", onboarding ' +
        'FROM users WHERE address = $1',
      values: [userAddress],
    });
    _.merge(user, rows[0]);
    return res.status(200).json(user);
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
      req.body.passwordDigest = hash;
    }
    delete req.body.currentPassword;
    delete req.body.newPassword;
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

const createOrFindAccountsWithEmails = async (params, typeKey) => {
  const newParams = {
    notAccountOrEmail: [],
    withEmail: [],
    forExistingUser: [],
    forNewUser: [],
  };
  params.forEach((param) => {
    if (param[typeKey] !== PARAM_TYPE.USER_ORGANIZATION && param[typeKey] !== PARAM_TYPE.SIGNING_PARTY) {
      // Ignore non-account parameters
      newParams.notAccountOrEmail.push({ ...param });
    } else if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i.test(param.value)) {
      // Select parameters with email values
      newParams.withEmail.push({ ...param });
    } else {
      // Ignore parameters with non-email values
      newParams.notAccountOrEmail.push({ ...param });
    }
  });
  const client = await app_db_pool.connect();
  try {
    let newUsers;
    if (newParams.withEmail.length) {
      const { rows } = await client.query({
        text: `SELECT LOWER(email) AS email, address FROM users WHERE LOWER(email) IN (${newParams.withEmail.map((param, i) => `LOWER($${i + 1})`)});`,
        values: newParams.withEmail.map(({ value }) => value),
      });
      newParams.forNewUser = {};
      newParams.withEmail.forEach((param) => {
        const emailAddr = param.value.toLowerCase();
        const existingUser = rows.find(({ email }) => emailAddr === email);
        if (existingUser) {
          // Use existing accounts info if email already registered
          newParams.forExistingUser.push({ ...param, value: existingUser.address });
        } else if (newParams.forNewUser[emailAddr]) {
          // Consolidate users that need to be registered into obj in case the same email was entered for multiple parameters
          // Also save the parameters that each email was used for
          newParams.forNewUser[emailAddr].push(param);
        } else {
          newParams.forNewUser[emailAddr] = [param];
        }
      });
      const createNewUserPromises = (Object.keys(newParams.forNewUser)).map(async (email) => {
        // Create user on chain
        const address = await contracts.createUser({ id: getSHA256Hash(email) });
        const password = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);
        // Create user in db
        const queryString = `INSERT INTO users(
          address, username, email, password_digest, is_producer, external_user
          ) VALUES(
            $1, $2, $3, $4, $5, $6
            );`;
        await client.query({ text: queryString, values: [address, email, email, hash, false, true] });
        return { email, address };
      });
      newUsers = await Promise.all(createNewUserPromises);
      newParams.forNewUser = Object.keys(newParams.forNewUser).reduce((acc, emailAddr) => {
        const { address } = newUsers.find(({ email }) => email === emailAddr);
        const newUserParams = newParams.forNewUser[emailAddr].map(param => ({ ...param, value: address }));
        return acc.concat(newUserParams);
      }, []);
    }
    // Release client
    client.release();
    // Return all parameters
    return {
      parameters: newParams.notAccountOrEmail.concat(newParams.forExistingUser).concat(newParams.forNewUser),
      newUsers,
    };
  } catch (err) {
    client.release();
    if (boom.isBoom(err)) throw err;
    throw boom.badImplementation(err);
  }
};

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
  createOrFindAccountsWithEmails,
};
