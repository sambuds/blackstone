const {
  getActivityInstances,
  getActivityInstance,
  getDataMappings,
  setDataMappings,
  getTasksForUser,
  getModels,
  getModelDiagram,
  getApplications,
  getDefinitions,
  getDefinition,
  createModelFromBpmn,
  completeActivity,
  signAndCompleteActivity,
} = require(`${global.__controllers}/bpm-controller`);

const {
  ensureAuth,
} = require(`${global.__common}/middleware`);

// APIs defined according to specification found here -> http://apidocjs.com
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

module.exports = (app, customMiddleware) => {
  // Use custom middleware if passed, otherwise use plain old ensureAuth
  let middleware = [];
  middleware = middleware.concat(customMiddleware.length ? customMiddleware : [ensureAuth]);

  /* **************
   * BPM Model
   ************** */

  /**
   * @api {get} /bpm/process-models Read Process Models
   * @apiName ReadProcessModels
   * @apiGroup BPMModel
   *
   * @apiExample {curl} Simple:
   *     curl -iX GET /bpm/process-models
   *
   * @apiSuccess {String} modelAddress
   * @apiSuccess {String} id
   * @apiSuccess {String} name
   * @apiSuccess {Number} versionMajor
   * @apiSuccess {Number} versionMinor
   * @apiSuccess {Number} versionPatch
   * @apiSuccess {Boolean} active
   * @apiSuccessExample {json} Success Object Array
    [{
      "modelAddress": "912A82D4C72847EF1EC76426544EAA992993EE20",
      "id": "0000000000000000000000000000000000000000000000000000000000000000",
      "name": "0000000000000000000000000000000000000000000000000000000000000000",
      "versionMajor": 0,
      "versionMinor": 0,
      "versionPatch": 0,
      "active": true
    }]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  */
  app.get('/bpm/process-models', middleware, getModels);

  /**
   * @api {get} /bpm/process-models/:address/diagram Read Diagram of Process Model
   * @apiName ReadProcessModelDiagram
   * @apiGroup BPMModel
   * @apiDescription Reads the diagram of the specified process model in the requested MIME type.
   * The 'Accept' header in the request should be set to either 'application/xml' or 'application/json'.
   *
   * @apiParam {String} address The address of the process model
   *
   * @apiExample {curl} Simple:
   *     curl -i -H "Accept: application/json" /bpm/process-models/912A82D4C72847EF1EC76426544EAA992993EE20/diagram
   *
   * @apiSuccess {Object} Object with details of the model and processes belonging to it
   * @apiSuccessExample {json} Success Object
   *
      {
        "model": {
          "name": "Collaboration_1bqszqk",
          "id": "1534895680958_ommi",
          "version": [
            1,
            0,
            0
          ],
          "private": false,
          "dataStores": [{
              "dataStorage": "PROCESS_INSTANCE",
              "dataPath": "agreement",
              "parameterType": 7
            },
            {
              "dataStorage": "agreement",
              "dataPath": "Assignee",
              "parameterType": 8
            }
          ],
        },
        "processes": [{
          "id": "Process_1rywjij",
          "name": "Process Name",
          "interface": "Agreement Formation",
          "participants": [{
            "id": "Lane_1mjalez",
            "name": "Assignee",
            "tasks": [
              "Task Name"
            ],
            "conditionalPerformer": true,
            "dataStorageId": "agreement",
            "dataPath": "Assignee"
          }],
          "tasks": [],
          "userTasks": [{
            "id": "Task Name",
            "name": "Task Name",
            "assignee": "Lane_1mjalez",
            "activityType": 0,
            "taskType": 1,
            "behavior": 1,
            "multiInstance": false,
            "application": "",
            "subProcessModelId": "",
            "subProcessDefinitionId": ""
          }],
          "sendTasks": [],
          "receiveTasks": [],
          "serviceTasks": [],
          "subProcesses": [],
          "transitions": []
        }]
      }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/process-models/:address/diagram', middleware, getModelDiagram);

  /**
   * @api {post} /bpm/process-models Parse BPMN XML and from it create a process model and definition
   * @apiName CreateBpmModel
   * @apiGroup BPMModel
   *
   * @apiDescription BPMN XML needs to be passed in the request body as plain text or application/xml
   *
   * @apiExample {curl} Simple:
   *     curl -i /bpm/process-models
   *     curl -i /bpm/process-models?format=bpmn
   *
   * @apiParam {String} [format] Optional parameter to denote format of process model.
   * Defaults to `bpmn` which is also the only format that is supported at this time.
   *
   * @apiSuccess {Object} Model details, process details, and parsed diagram (JSON)
   * @apiSuccessExample {json} Success Object
   {
     "model": {
       "id": "1535053136633_ommi",
       "address": "CDEBECF4D78F2DCF94DFAB12215D018CF1F3F11F"
     },
     "processes": [{
       "address": "43548D6C7894C0E5A7DA1ED08143E1AF4E9DD67E",
       "processDefinitionId": "Process_104nkeu",
       "interfaceId": "Agreement Formation",
       "processName": "Process Name",
       "modelAddress": "CDEBECF4D78F2DCF94DFAB12215D018CF1F3F11F",
       "private": false,
       "author": "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1"
     }],
     "parsedDiagram": {
       "model": {
         "dataStores": [{
             "id": "PROCESS_INSTANCE",
             "name": "Process Instance",
             "parameters": [{
               "name": "agreement",
               "parameterType": 7
             }]
           },
           {
             "id": "agreement",
             "name": "Agreement",
             "parameters": [{
               "name": "Assignee",
               "parameterType": 8
             }]
           }
         ],
         "name": "Collaboration_1bqszqk",
         "id": "1535053136633_ommi",
         "version": [1, 0, 0],
         "private": false,
         "author": "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1"
       },
       "processes": [{
         "id": "Process_104nkeu",
         "name": "Process Name",
         "interface": "Agreement Formation",
         "participants": [{
             "id": "Lane_18i4kvj",
             "name": "Agreement Parties (Signatories)",
             "tasks": ["Task_0ky8n9d"],
             "conditionalPerformer": true,
             "dataStorageId": "agreement",
             "dataPath": "AGREEMENT_PARTIES"
           },
           {
             "id": "Lane_1qvrgtf",
             "name": "Assignee",
             "tasks": ["Task_1jrtitw"],
             "conditionalPerformer": true,
             "dataStorageId": "agreement",
             "dataPath": "Assignee"
           }
         ],
         "tasks": [],
         "userTasks": [{
             "id": "Task_0ky8n9d",
             "name": "Signing Task",
             "assignee": "Lane_18i4kvj",
             "activityType": 0,
             "taskType": 1,
             "behavior": 1,
             "multiInstance": true,
             "dataMappings": [{
               "id": "agreement",
               "direction": 0,
               "dataPath": "agreement",
               "dataStorageId": ""
             }],
             "application": "AgreementSignatureCheck",
             "subProcessModelId": "",
             "subProcessDefinitionId": ""
           },
           {
             "id": "Task_1jrtitw",
             "name": "User Task",
             "assignee": "Lane_1qvrgtf",
             "activityType": 0,
             "taskType": 1,
             "behavior": 1,
             "multiInstance": false,
             "application": "",
             "subProcessModelId": "",
             "subProcessDefinitionId": ""
           }
         ],
         "sendTasks": [],
         "serviceTasks": [],
         "subProcesses": [],
         "transitions": [{
           "id": "SequenceFlow_0twrlls",
           "source": "Task_0ky8n9d",
           "target": "Task_1jrtitw"
         }],
         "activityMap": {
           "Task_0ky8n9d": "Signing Task",
           "Task_1jrtitw": "User Task"
         }
       }]
     }
   }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.post('/bpm/process-models', middleware, createModelFromBpmn);


  /**
   * @api {get} /bpm/applications Read Applications
   * @apiName ReadApplications
   * @apiGroup BPMModel
   *
   * @apiExample {curl} Simple:
   *     curl -iX GET /bpm/applications
   *
   * @apiSuccessExample {Object[]} Success Object Array
      [{
          "id": "AgreementSignatureCheck",
          "applicationType": 2,
          "location": "FFA3BB89E3B0DC63C0CE9BF0E2278B56CE5991F4",
          "webForm": "SigningWebFormWithSignatureCheck",
          "accessPoints": [{
            "accessPointId": "agreement",
            "direction": 0,
            "dataType": 59
          }]
        },
        {
          "id": "WebAppApprovalForm",
          "applicationType": 2,
          "location": "0000000000000000000000000000000000000000",
          "webForm": "TaskApprovalForm",
          "accessPoints": []
        }
      ]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/applications', middleware, getApplications);

  /**
   * @api {get} /bpm/process-definitions Read All Process Definitions
   * @apiName ReadAllProcessDefinitions
   * @apiGroup BPMModel
   *
   * @apiParam {String} [interfaceId] Optional query parameter `interfaceId` can be used to filter by interface
   * @apiParam {String} [processDefinitionId] Optional query parameter `processDefinitionId` can be used to filter by processDefinitionId
   * @apiParam {String} [modelId] Optional query parameter `modelId` can be used to filter by modelId
   *
   * @apiExample {curl} Simple:
   *     curl -i /bpm/process-definitions
   *     curl -i /bpm/process-definitions?interfaceId=Agreement%20Execution
   *
   * @apiSuccess {Object[]} object Process Definition object
   * @apiSuccessExample {json} Success Objects Array
    [{
      "processDefinitionId": "Process_00pj23z",
      "address": "65BF0FB03BA5C140B1584A290B157F8907B8FEBE",
      "modelAddress": "6025AF7E4FBB2FCCCFBB855E68025CF20038E142",
      "interfaceId": "Agreement Execution",
      "modelFileReference": "eyJTcG...iVmVyc2lvbiI6MH0=",
      "isPrivate": false,
      "author": "DAE988ADED111E6AE82DBFD9AE4FFFE97ADBC23D",
      "modelId": "INC_EXEC_2018",
      "processName": "Inc Exec Process"
    }]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/process-definitions', middleware, getDefinitions);

  /**
   * @api {get} /bpm/process-definitions/:address Read Single Process Definition
   * @apiName ReadProcessDefinition
   * @apiGroup BPMModel
   *
   * @apiParam {String} address The address of the process definition
   *
   * @apiExample {curl} Simple:
   *     curl -i /bpm/process-definitions/81A817870C6C6A209150FA26BC52D835CA6E17D2
   *
   * @apiSuccess {String} processDefinitionId Id of the process definition
   * @apiSuccess {String} address Address of the process definition
   * @apiSuccess {String} modelAddress Address of the model the process definition was created under
   * @apiSuccess {String} interfaceId 'Agreement Formation' or 'Agreement Execution'
   * @apiSuccess {String} modelFileReference Hoard grant for the xml file representing the process
   * @apiSuccess {String} isPrivate Whether model is private
   * @apiSuccess {String} author Address of the model author
   * @apiSuccess {String} modelId Id of the process model
   * @apiSuccess {String} processName Human-readable name of the process definition
   * @apiSuccessExample {json} Success Object
    {
      "processDefinitionId": "Process_00pj23z",
      "address": "65BF0FB03BA5C140B1584A290B157F8907B8FEBE",
      "modelAddress": "6025AF7E4FBB2FCCCFBB855E68025CF20038E142",
      "interfaceId": "Agreement Execution",
      "modelFileReference": "eyJTcG...iVmVyc2lvbiI6MH0=",
      "isPrivate": false,
      "author": "DAE988ADED111E6AE82DBFD9AE4FFFE97ADBC23D",
      "modelId": "INC_EXEC_2018",
      "processName": "Inc Exec Process"
    }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/process-definitions/:address', middleware, getDefinition);

  /**
   * @api {get} /activity-instances Read Activities of a process instance
   * @apiName ReadProcessInstanceActivities
   * @apiGroup BPMRuntime
   *
   * @apiDescription Read all activities of a process instance
   * @apiParam {String} [processInstance] Optional Address of process instance to filter by
   * @apiParam {String} [agreementAddress] Optional Address of process instance to filter by
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances?processInstance=150D431B160790B2462D8CC683C87FEA2F1C3C61
   *
   * @apiSuccessExample {json} Success Objects Array
    [{
      "processAddress": "A65B3111789E4355EA03E0F109FBDD0042133307",
      "activityInstanceId": "A2A9736AEEC9B1DCAA274DEBF76248EA57ABA0727BDE343C2CDE663FC48E2BF4",
      "activityId": "Task_0X7REW5",
      "created": 1533736147000,
      "completed": 0,
      "performer": "5860AF129980B0E932F3509432A0C43DEAB77B0B",
      "completedBy": "0000000000000000000000000000000000000000",
      "state": 4,
      "agreementAddress": "391F69095A291E21079A78F0F67EE167D7628AE2",
      "agreementName": "Agreement Name"
      "processDefinitionAddress": "0506903B34830785168D840BB70D7D48D31A5C1F",
      "processName": "Ship"
    }]
  *
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/activity-instances', middleware, getActivityInstances);

  /**
   * @api {get} /activity-instances/:id Read activity instance
   * @apiName ReadActivityInstance
   * @apiGroup BPMRuntime
   *
   * @apiDescription Retrieve details of the specified activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances/41ED431B140790B2462D8CC683C87FEA2F1DE321
   *
   * @apiSuccess {Object} object Activity instance object
   * @apiSuccessExample {json} Success Object
    {
      "state": 4,
      "processAddress": "A65B3111789E4355EA03E0F109FBDD0042133307",
      "activityInstanceId": "A2A9736AEEC9B1DCAA274DEBF76248EA57ABA0727BDE343C2CDE663FC48E2BF4",
      "activityId": "Sign_Signing Task",
      "created": 1533678582000,
      "performer": "5860AF129980B0E932F3509432A0C43DEAB77B0B",
      "completed": 0,
      "taskType": 1,
      "application": "AgreementSignatureCheck",
      "applicationType": 2,
      "webForm": "DefaultSignAndCompleteForm",
      "processName": "Lease Formation",
      "processDefinitionAddress": "833E7452A7D1B02655889AC52F745FD1D5C50AAC",
      "agreementAddress": "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1",
      "modelAuthor": "5860AF129980B0E932F3509432A0C43DEAB77B0B",
      "private": 0,
      "agreementName": "Drone Lease Agreement",
      "data": [
        {
          "dataMappingId": "readName",
          "dataPath": "name"
          "dataStorageId": ""
          "value": "John Doe",
          "dataType": 2,
          "parameterType": 1,
          "direction": 0
        },
        {
          "dataMappingId": "readApproved",
          "dataPath": "approved"
          "value": true,
          "dataType": 1,
          "parameterType": 0,
          "direction": 0
        },
        {
          "dataMappingId": "writeName",
          "dataPath": "name"
          "dataStorageId": ""
          "dataType": 2,
          "parameterType": 1,
          "direction": 1
        },
        {
          "dataMappingId": "writeApproved",
          "dataPath": "approved"
          "dataStorageId": ""
          "dataType": 1,
          "parameterType": 0,
          "direction": 1
        }
      ]
    }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/activity-instances/:id', middleware, getActivityInstance);

  /**
   * @api {get} /activity-instances/:activityInstanceId/data-mappings Read data mappings of activity instance
   * @apiName ReadActivityInstanceDataMappings
   * @apiGroup BPMRuntime
   *
   * @apiDescription Retrieve details of the data mappings for the specified activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances/41ED431B140790B2462D8CC683C87FEA2F1DE321/data-mappings
   *
   * @apiSuccess {Object[]} object Array of data mapping objects
   * @apiSuccessExample {json} Success Object
    [{
      "dataMappingId": "readApproved",
      "dataPath": "approved"
      "value": true,
      "dataType": 1,
      "parameterType": 0,
      "direction": 0
    }]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/activity-instances/:activityInstanceId/data-mappings', middleware, getDataMappings);

  /**
   * @api {get} /activity-instances/:activityInstanceId/data-mappings/:dataMappingId Read single data mapping of an activity instance
   * @apiName ReadActivityInstanceDataMapping
   * @apiGroup BPMRuntime
   *
   * @apiDescription Retrieve details of the data mapping with the given ID for the specified activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances/150E9377C388CF1B76E508642646F6DFACA67D53B82A0C3F479C12610FA29BCB/data-mappings/readApproved
   *
   * @apiSuccess {Object} object Data mapping objects
   * @apiSuccessExample {json} Success Object
    {
      "dataMappingId": "readApproved",
      "dataPath": "approved"
      "value": true,
      "dataType": 1,
      "parameterType": 0,
      "direction": 0
    }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/bpm/activity-instances/:activityInstanceId/data-mappings/:dataMappingId', middleware, getDataMappings);

  /**
   * @api {get} /activity-instances/:activityInstanceId/data-mappings Write data mappings of activity instance
   * @apiName WriteActivityInstanceDataMappings
   * @apiGroup BPMRuntime
   *
   * @apiDescription Write to data mappings for the specified activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances/150E9377C388CF1B76E508642646F6DFACA67D53B82A0C3F479C12610FA29BCB/data-mappings
   *
   * @apiParamExample {json} Sample request body with data mapping id/value pairs in an array
    [{
        "id": "writeApproved",
        "value": true,
        "dataType": 1
      },
      {
        "id": "writeName",
        "value": "John Doe",
        "dataType": 2
      }
    ]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.put('/bpm/activity-instances/:activityInstanceId/data-mappings', middleware, setDataMappings);

  /**
   * @api {get} /activity-instances/:activityInstanceId/data-mappings/:dataMappingId Write single data mapping of an activity instance
   * @apiName WriteActivityInstanceDataMapping
   * @apiGroup BPMRuntime
   *
   * @apiDescription Write to the data mapping with the given ID for the specified activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /activity-instances/150E9377C388CF1B76E508642646F6DFACA67D53B82A0C3F479C12610FA29BCB/data-mappings/writeApproved
   *
   * @apiParamExample {json} Sample request body with data mapping value
    {
      "value": true,
      "dataType": 1
    }
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.put('/bpm/activity-instances/:activityInstanceId/data-mappings/:dataMappingId', middleware, setDataMappings);

  /**
   * @api {get} /tasks Read Tasks
   * @apiName ReadTasks
   * @apiGroup BPMRuntime
   *
   * @apiDescription Retrieves an array of tasks assigned to the logged in user
   *
   * @apiExample {curl} Simple:
   *     curl -i /tasks
   *
   * @apiSuccess {Object[]} object Array of task objects
   * @apiSuccessExample {json} Success Objects Array
    [{
      "state": 4,
      "processAddress": "A65B3111789E4355EA03E0F109FBDD0042133307",
      "activityInstanceId": "A2A9736AEEC9B1DCAA274DEBF76248EA57ABA0727BDE343C2CDE663FC48E2BF4",
      "activityId": "Task_5ERV12I",
      "created": 1533736147000,
      "performer": "5860AF129980B0E932F3509432A0C43DEAB77B0B",
      "processName": "Process Name",
      "processDefinitionAddress": "833E7452A7D1B02655889AC52F745FD1D5C50AAC",
      "agreementAddress": "AB3399395E9CAB5434022D1992D31BB3ACC2E3F1",
      "agreementName": "Drone Purchase Agreement"
    }]
  *
  * @apiUse NotLoggedIn
  * @apiUse AuthTokenRequired
  *
  */
  app.get('/tasks', middleware, getTasksForUser);

  /**
   * @api {put} /tasks/:activityInstanceId/complete Complete task identified by the activityInstanceId
   * @apiName CompleteTask
   * @apiGroup BPMRuntime
   *
   * @apiDescription Completes the activity identified by the activityInstanceId. Optionally accepts 'data' array to write.
   *
   * @apiParam {String} activityInstanceId The system generated id of the activity instance
   *
   * @apiExample {curl} Simple:
   *     curl -i /task/:activityInstanceId/complete
   *
   * @apiParam {json} Optional request body with out data
    {
      data: [{
        "id": "writeApproved",
        "value": true,
        "dataType": 1,
      }]
    }
  *
  */
  app.put('/tasks/:activityInstanceId/complete', middleware, completeActivity);

  /**
   * @api {put} /tasks/:activityInstanceId/complete/:agreementAddress/sign Sign the agreement and complete the activity
   * @apiName CompleteTask
   * @apiGroup Runtime
   *
   * @apiDescription Signs the agreement at the given address and then completes the activity
   * identified by the activityInstanceId.
   *
   * @apiParam {String} activityInstanceId The system generated id of the activity instance
   * @apiParam {String} agreementAddress The address of the agreement
   *
   * @apiExample {curl} Simple:
   *     curl -i /tasks/:activityInstanceId/complete/:agreementAddress/sign
   *
   */
  app.put('/tasks/:activityInstanceId/complete/:agreementAddress/sign', middleware, signAndCompleteActivity);
};
