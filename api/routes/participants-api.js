const {
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
  activateUser,
} = require(`${global.__controllers}/participants-controller`);

const {
  login,
  logout,
  validateToken,
  createRecoveryCode,
  validateRecoveryCode,
  resetPassword,
} = require(`${global.__controllers}/participants-auth-controller`);

const {
  ensureAuth,
} = require(`${global.__common}/middleware`);

// APIs defined according to specification found here -> http://apidocjs.com
module.exports = (app, customMiddleware) => {
  // Use custom middleware if passed, otherwise use plain old ensureAuth
  let middleware = [];
  middleware = middleware.concat(customMiddleware.length ? customMiddleware : [ensureAuth]);

  /** *************
   * Organizations
   ************** */

  /**
   * @apiDefine NotLoggedIn
   *
   * @apiError NotLoggedIn The user making the request does not have a proper authentication token.
   */
  /**
   * @apiDefine AuthTokenRequired
   *
   * @apiParam {String{20}} Cookie `access_token` containing the JsonWebToken is required, cookie is set upon successful login
   */

  /**
   * @api {get} /organizations Read Organizations
   * @apiName ReadOrganizations
   * @apiGroup Organizations
   *
   * @apiQueryParameter approver If the optional query parameter is given
   * causes a JOIN query to retrieve only organizations where the specified user is an approver.
   * Value of 'true' will do the above for the authenticated user.
   *
   * @apiExample {curl} Simple:
   *     curl -i /organizations
   *
   * @apiSuccess {String} address Organization's Controller Contract
   * @apiSuccess {String} id  Organization's machine readable ID
   * @apiSuccess {String} name  Organization's human readable name
   * @apiSuccessExample {json} Success Objects Array
    [{
      "address": "DAE988ADED111E6AE82DBFD9AE4FFFE97ADBC23D",
      "approvers": [
        "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1",
        "F5C84B3CC6317023F1E9914BDC86FC0E339E8110",
        "F9EAB43B627645C48F6FDB424F9AD3D760907C25"
      ],
      "name": "orgone"
    }]
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/organizations', middleware, getOrganizations);

  /**
   * @api {get} /organizations/:address Read a Single Organization
   * @apiName ReadSingleOrganization
   * @apiGroup Organizations
   *
   * @apiExample {curl} Simple:
   *     curl -i /organizations/9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E
   *
   * @apiSuccess {String} address Organization's Controller Contract
   * @apiSuccess {String} organizationKey Hashed address (keccak256)
   * @apiSuccess {String} id  Organization's machine readable ID
   * @apiSuccess {String} name  Organization's human readable name
   * @apiSuccessExample {json} Success Object
    {
      "address": "DAE988ADED111E6AE82DBFD9AE4FFFE97ADBC23D",
      "organizationKey": "55D40E05C91F484E0F4104774F528D131DFC0990A7A18124DA5666E1F5EA2EAA",
      "name": "orgone",
      "approvers": [{
          "address": "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1",
          "id": "joesmith"
        },
        {
          "address": "F5C84B3CC6317023F1E9914BDC86FC0E339E8110",
          "id": "sarasmith"
        },
        {
          "address": "F9EAB43B627645C48F6FDB424F9AD3D760907C25",
          "id": "ogsmith"
        }
      ],
      "users": [{
          "address": "889A3EEBAC57E0F14D5BAB7AA87A4E69C432ECCD",
          "id": "patmorgan"
          "departments": [
            "acct"
          ],
        },
        {
          "address": "F5C84B3CC6317023F1E9914BDC86FC0E339E8110",
          "id": "sarasmith"
          "departments": [
            "acct"
          ],
        },
        {
          "address": "F9EAB43B627645C48F6FDB424F9AD3D760907C25",
          "id": "ogsmith"
          "departments": [
            "acct"
          ],
        }
      ],
      "departments": [{
        "id": "acct",
        "name": "Accounting",
        "users": [
          "889A3EEBAC57E0F14D5BAB7AA87A4E69C432ECCD",
          "F5C84B3CC6317023F1E9914BDC86FC0E339E8110",
          "F9EAB43B627645C48F6FDB424F9AD3D760907C25"
        ]
      }]
    }
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/organizations/:address', middleware, getOrganization);

  /**
  * @api {post} /organizations Create a New Organization
  * @apiName CreateOrganizations
  * @apiGroup Organizations
  *
  * @apiDescription
  * Creating a new organization also established the primary administrators for that organization
  * If no approvers are provided for the organization,
  * then the currently logged-in user will be registered as an approver.
  *
  * @apiBodyParameter {String} id Organization's machine readable ID
  * @apiBodyParameter {String} name Organization's human readable name
  * @apiBodyParameter {String[]} approvers Organization's approvers are the adminsistrators of that organization
  *    and may approve the addition of new users into the organization, set the roles of users within the
  *    organization, as well as remove users from the organization. This array is optional.
  *    If no approvers are passed, the currently logged-in user's address is used as the single
  *    approver of for the new organization.
  * @apiBodyParameterExample {json} Param Object
    {
      "name": "ACME Corp",
      "approvers": ["9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E", "9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E"]
    }
  * @apiExample {curl} Simple:
  *     curl -iX POST /organizations
  *
  * @apiSuccess {json} The address of the created Organization
  * @apiSuccessExample {json} Success-Response:
  {
  "address": "6EDC6101F0B64156ED867BAE925F6CD240635656",
  "name": "ACME Corp"
  }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.post('/organizations', middleware, createOrganization);

  /**
   * @api {put} /organizations/:orgId/users/:userAddress Adds user to Organization
   * @apiName UpdateOrganizations
   * @apiGroup Organizations
   *
   * @apiExample {curl} Simple:
   *     curl -iX PUT /organizations/9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E/users/10DA7307DA7E74BC54D1E829764E2DE7AD0D8DBB4
   *
   * @apiSuccess (200) Success
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.put(
    '/organizations/:address/users/:userAddress', middleware,
    createOrganizationUserAssociation,
  );

  /**
   * @api {delete} /organizations/:orgId/users/:userAddress Removes a user from Organization
   * @apiName RemoveUser
   * @apiGroup Organizations
   *
   * @apiExample {curl} Simple:
   *     curl -iX DELETE /organizations/9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E/users/10DA7307DA7E74BC54D1E829764E2DE7AD0D8DBB4
   *
   * @apiSuccess (200) Success
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.delete(
    '/organizations/:address/users/:userAddress', middleware,
    deleteOrganizationUserAssociation,
  );

  /**
   * @api {put} /organizations/:address/departments Create a New Department in an Organization
   * @apiName CreateDepartment
   * @apiGroup Organizations
   *
   * @apiDescription
   * Creating a new department within an organization and add members to it
   *
   * @apiBodyParameter {String} id Departments's ID (must be unique within organization)
   * @apiBodyParameter {String} name Department's human readable name
   * @apiBodyParameter {String[] Optional} users Addresses of the members to add to the Department
   * If not given, department will be created with no members and members can be added later
   * @apiBodyParameterExample {json} Param Object
    {
      "id": "accounting",
      "name": "Accounting",
      "users": ["9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E"]
    }
   * @apiExample {curl} Simple:
   *     curl -iX PUT /organizations/6EDC6101F0B64156ED867BAE925F6CD240635656/departments
   *
   * @apiSuccess {json} The address of the Organization, the id and name of the department, and the users belonging to the department
   * @apiSuccessExample {json} Success-Response:
    {
      "id": "accounting",
      "name": "Accounting",
      "users": ["9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E"]
    }
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.put('/organizations/:address/departments', middleware, createDepartment);

  /**
   * @api {delete} /organizations/:address/departments/:id Remove a Department
   * @apiName RemoveDepartment
   * @apiGroup Organizations
   *
   * @apiDescription
   * Removing a department within an organization
   *
   * @apiExample {curl} Simple:
   *     curl -iX DELETE /organizations/6EDC6101F0B64156ED867BAE925F6CD240635656/departments/accounting
   *
   * @apiSuccess (200) Success
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.delete('/organizations/:address/departments/:id', middleware, removeDepartment);

  /**
   * @api {put} /organizations/:address/departments/:departmentId/users Add Users to a Department
   * @apiName AddDepartmentUsers
   * @apiGroup Organizations
   *
   * @apiDescription
   * Add users to a department
   *
   * @apiBodyParameter {String[]} users Addresses of the members to add to the Department.
   * @apiBodyParameterExample {json} Param Object
      {
        "users": ["9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E"]
      }
   * @apiExample {curl} Simple:
   *     curl -iX PUT /organizations/6EDC6101F0B64156ED867BAE925F6CD240635656/departments/accounting/users
   *
   * @apiSuccess (200) Success
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.put('/organizations/:address/departments/:id/users', middleware, addDepartmentUsers);

  /**
   * @api {delete} /organizations/:address/departments/:departmentId/users/:userAddress Remove User from a Department
   * @apiName RemoveDepartmentUser
   * @apiGroup Organizations
   *
   * @apiDescription
   * Remove a user from a department
   *
   * @apiExample {curl} Simple:
   *     curl -iX PUT /organizations/6EDC6101F0B64156ED867BAE925F6CD240635656/departments/accounting/users/9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E
   *
   * @apiSuccess (200) Success
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.delete('/organizations/:address/departments/:id/users/:userAddress', middleware, removeDepartmentUser);

  /** *************
   * Users
   ************** */

  /**
   * @api {get} /users Read Users
   * @apiName ReadUsers
   * @apiGroup Users
   *
   * @apiDescription Retrieves user information. The `organization` query
   * parameter is optional. It can be used to filter users belonging to a
   * specific organization or retrieving users not belonging to an
   * organization, yet (via `?organization=null`).
   *
   * Note: The organization address is returned as
   * "0000000000000000000000000000000000000000" for user that do not
   * belong to an organization.
   *
   * @apiQueryParameter organization If the optional parameter is given
   * filters users accordingly. May give the API the following options
   * `<orgAddress>|null|notnull`
   *
   * @apiExample {curl} Simple:
   *     curl -i /users
   *
   * @apiSuccess {String} address Users's Controller Contract
   * @apiSuccess {String} id  Users's machine readable ID
   * @apiSuccess {String} organization Organization's Controller Contract
   * @apiSuccess {String} organizationId Organization's machine readable ID
   * @apiSuccess {String} organizationName Organization's human readable name
   * @apiSuccessExample {json} Success Objects Array
   [{
     "address": "9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E",
     "id": "j.smith",
     "organization": "707791D3BBD4FDDE615D0EC4BB0EB3D909F66890",
     "organizationId": "acmecorp92",
     "organizationName": "ACME Corp"
   }]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  */
  app.get('/users', middleware, getUsers);

  /**
   * @api {get} /users/profile Read User Profile of currently logged in user
   * @apiName ReadUserProfile
   * @apiGroup Users
   *
   * @apiDescription Retrieves a single users profile identified by the access token.
   *
   * @apiExample {curl} Simple:
   *     curl -i /users/profile
   *
   * @apiSuccess {String} address Users's Controller Contract
   * @apiSuccess {String} id  Users's human readable ID
   * @apiSuccess {String} email  Users's email address
   * @apiSuccess {String} organization Organization's Controller Contract
   * @apiSuccess {String} organizationId Organization's machine readable ID
   * @apiSuccess {String} organizationName Organization's human readable name
   * @apiSuccess {String} firstName User's first name
   * @apiSuccess {String} lastName User's last name
   * @apiSuccess {String} country User's country code
   * @apiSuccess {String} region Contract address of user's region
   * @apiSuccess {Boolean} isProducer Boolean representing whether user account is producer type (as opposed to consumer type)
   * @apiSuccess {Boolean} onboarding Boolean representing whether user prefers to see onboarding screens
   * @apiSuccess {String} createdAt Timestamp of user account creation
   * @apiSuccessExample {json} Success Object
   {
     "address": "9F24307DA7E74BC54D1E829764E2DE7AD0D8DF6E",
     "id": "j.smith",
     "email": "jsmith@monax.io",
     "organization": "707791D3BBD4FDDE615D0EC4BB0EB3D909F66890",
     "organizationId": "acmecorp92",
     "organizationName": "ACME Corp",
     "firstName": "Joe",
     "lastName": "Smith",
     "country": "CA",
     "region": "1232SDFF3EC680332BEFDDC3CA12CBBD",
     "isProducer": false,
     "onboarding": true,
     "createdAt": ""
   }
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   */
  app.get('/users/profile', middleware, getProfile);

  /**
   * @api {put} /users/profile Update User Profile of currently logged in user
   * @apiName EditUserProfile
   * @apiGroup Users
   *
   * @apiDescription Updates a single users profile identified by the access token.
   * @apiBodyParameter {String} firstName User's first name (optional)
   * @apiBodyParameter {String} lastName User's last name (optional)
   * @apiBodyParameter {String} country User's country code (optional)
   * @apiBodyParameter {String} region Address of user's region (optional)
   * @apiBodyParameter {String} currentPassword User's current password (optional if new password not being set)
   * @apiBodyParameter {String} newPassword (optional)
   * @apiBodyParameter {Boolean} isProducer Set account type to producer or consumer(optional)
   * @apiBodyParameter {Boolean} onboarding Set user preference for viewing onboarding screens (optional)
   * @apiBodyParameterExample {json} Param Object
    {
      "firstName": "Joe",
      "lastName": "Smith",
      "country": "CA",
      "region": "1232SDFF3EC680332BEFDDC3CA12CBBD",
      "currentPassword": "badpassword",
      "newPassword": "beTTERpa$$W0Rd932",
      "isProducer": true,
      "onboarding": false
    }
   * @apiExample {curl} Simple:
   *     curl -iX PUT /users/profile
   *
   * @apiSuccess {String} address Users's Controller Contract
   * @apiSuccessExample {json} Success Object
    {
      "address": "605401BB8B9E597CC40C35D1F0185DE94DBCE533",
    }
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   */
  app.put('/users/profile', middleware, editProfile);

  /**
   * @api {post} /users Create a New User
   * @apiName RegisterUser
   * @apiGroup Users
   *
   * @apiDescription Creating a new user
   *
   * @apiBodyParameter {String} user The user's userName
   * @apiBodyParameter {String} email The user's email address
   * @apiBodyParameter {String} password The user's password
   * @apiBodyParameter {Boolean} isProducer Set to true to create a producer account instead of a consumer account (optional)
   * @apiBodyParameter {json} Param Object
     {
       "username": "username_id-123",
       "email": "myemail@mycompany.com",
       "password": "superhardtoguess",
       "isProducer": false
     }
   *
   * @apiExample {curl} Simple:
   *     curl -iX POST /users
   *
   * @apiSuccess {Object} userData The "address" and "id" of the User
   * @apiSuccessExample {json} Success Object
     {
       "address": "605401BB8B9E597CC40C35D1F0185DE94DBCE533",
       "id": "johnsmith"
     }
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.post('/users', registrationHandler);

  /**
   * @api {post} /users/login Log in as a User
   * @apiName UserLogin
   * @apiGroup Users
   *
   * @apiBodyParameter {String} user The user's userName
   * @apiBodyParameter {String} password The user's password
   * @apiBodyParameter {json} Param Object
    {
      "username": "username/id",
      "password": "superhardtoguess"
    }
   *
   * @apiExample {curl} Simple:
   *     curl -iX PUT /users/login
   *
   * @apiSuccess {String} address The address of the user
   * @apiSuccess {String} id The id (username) of the user
   * @apiSuccess {String} A timestamp of the account creation
   * @apiSuccessExample {json} Success Object
    {
      "address": "41D6BC9143DF87A07F65FCAF642FB89E16D26548",
      "id": "jsmith",
      "createdAt": "2018-06-25T13:44:26.925Z"
    }
   *
   */
  app.put('/users/login', login);

  /**
   * @api {post} /users/logout Log out a User
   * @apiName Logout
   * @apiGroup Users
   *
   * @apiExample {curl} Simple:
   *     curl -iX PUT /users/logout
   *
   */
  app.put('/users/logout', logout);

  /**
   * @api {get} /users/token/validate Validate user token
   * @apiName ValidateToken
   * @apiGroup Users
   *
   * @apiDescription This route validates the JWT `access_token`
   * which should be set as cookie in the request
   *
   * @apiExample {curl} Simple:
   *     curl -iX GET /users/token/validate
   *
   * @apiSuccessExample {json} Success Object
    {
      "address": "41D6BC9143DF87A07F65FCAF642FB89E16D26548",
      "id": "jsmith",
    }
   *
   * @apiUse NotLoggedIn
   * @apiUse AuthTokenRequired
   *
   */
  app.get('/users/token/validate', middleware, validateToken);

  /**
   * @api {post} /users/password-recovery Request password reset for a user account
   * @apiName PasswordRecovery
   * @apiGroup Users
   *
   * @apiDescription
   * Sends an email with a password recovery code to the given email address
   *
   * @apiBodyParameter {String} email The user's email address
   * @apiBodyParameter {json} Param Object
    {
      "email": "hello@monax.io",
    }
   *
   * @apiExample {curl} Simple:
   *     curl -iX POST /users/password-recovery
   */
  app.post('/users/password-recovery', createRecoveryCode);

  /**
   * @api {get} /users/password-recovery/:recoveryCode Validates the given password recovery code
   * @apiName ValidatePasswordRecoveryCode
   * @apiGroup Users
   *
   * @apiDescription
   * Checks if the given password recovery code is valid
   *
   * @apiExample {curl} Simple:
   *     curl -iX GET /users/password-recovery/vdk7bd2esdf3234...
   */
  app.get('/users/password-recovery/:recoveryCode', validateRecoveryCode);

  /**
   * @api {put} /users/password-recovery/:recoveryCode Reset password for user account
   * @apiName ResetPassword
   * @apiGroup Users
   *
   * @apiDescription
   * Resets the user's password with the given password, if the recovery code is valid
   *
   * @apiURLParameter recoveryCode The password recovery code
   * @apiBodyParameter {json} Param Object
    {
      "password": "newpassword",
    }
   *
   * @apiExample {curl} Simple:
   *     curl -iX PUT /users/password-recovery/vdk7bd2esdf3234...
   */
  app.put('/users/password-recovery/:recoveryCode', resetPassword);

  /**
   * @api {get} /users/activate/:activationCode Activate user account
   * @apiName ActivateUser
   * @apiGroup Users
   *
   * @apiDescription
   * Activates the user account
   *
   * @apiURLParameter activationCode The activation code
   *
   * @apiExample {curl} Simple:
   *     curl -iX GET /users/activate/vdk7bd2esdf3234...
   */
  app.get('/users/activate/:activationCode', activateUser);
};
