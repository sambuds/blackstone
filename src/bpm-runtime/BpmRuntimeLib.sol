pragma solidity ^0.5;

import "commons-base/ErrorsLib.sol";
import "commons-base/BaseErrors.sol";
import "commons-utils/TypeUtilsLib.sol";
import "commons-standards/ERC165Utils.sol";
import "commons-collections/DataStorageUtils.sol";
import "commons-auth/Organization.sol";
import "bpm-model/BpmModel.sol";
import "bpm-model/ProcessModel.sol";
import "bpm-model/ProcessModelRepository.sol";
import "bpm-model/ProcessDefinition.sol";

import "bpm-runtime/BpmRuntime.sol";
import "bpm-runtime/ProcessInstance.sol";
import "bpm-runtime/ApplicationRegistry.sol";
import "bpm-runtime/TransitionConditionResolver.sol";

/**
 * @title BpmRuntimeLib Library
 * @dev Public API for the BpmRuntime data model.
 */
library BpmRuntimeLib {

    using TypeUtilsLib for bytes32;
    
    // NOTE: some of the following event definitions are duplicates of events defined in ProcessInstance.sol

	event LogProcessInstanceStateUpdate(
		bytes32 indexed eventURN,
		address processInstanceAddress,
		uint8 state
	);

    event LogActivityInstanceCreation(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        bytes32 activityId,
        address processInstanceAddress,
        uint created,
        address performer,
        uint completed,
        address completedBy,
        uint8 state
    );

    event LogTimerEventInstanceCreation(
        bytes32 indexed eventURN,
        bytes32 timerEventInstanceId,
        bytes32 timerEventId,
        address processInstanceAddress,
        BpmModel.EventType timerEventType,
        BpmModel.IntermediateEventBehavior timerEventBehavior,
        uint created,
        BpmRuntime.ActivityInstanceState state
    );

    event LogTimerEventInstanceStateUpdate(
        bytes32 indexed eventURN,
        bytes32 timerEventInstanceId,
        BpmRuntime.ActivityInstanceState state
    );

    event LogBoundaryEventInstanceCreation(
        bytes32 indexed eventURN,
        bytes32 eventInstanceId,
        bytes32 activityInstanceId,
        BpmModel.EventType eventType,
        BpmModel.BoundaryEventBehavior eventBehavior,
        BpmRuntime.BoundaryEventInstanceState state
    );

    event LogActivityInstanceStateUpdate(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        uint8 state
    );

    event LogActivityInstancePerformerUpdate(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        address performer
    );

    event LogActivityInstanceStateAndPerformerUpdate(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        address performer,
        uint8 state
    );

    event LogActivityInstanceStateAndTimestampUpdate(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        uint completed,
        uint8 state
    );

    event LogActivityInstanceCompletion(
        bytes32 indexed eventURN,
        bytes32 activityInstanceId,
        address completedBy,
        uint completed,
        address performer,
        uint8 state
    );

    event LogTimerEventTimerActivation(
		bytes32 indexed eventURN,
        bytes32 timerEventInstanceId,
        uint uintValue,
        string stringValue
    );

    event LogBoundaryEventTimerActivation(
		bytes32 indexed eventURN,
        bytes32 eventInstanceId,
        bytes32 activityInstanceId,
        uint uintValue,
        string stringValue
    );

    event LogBoundaryEventTimerDeactivation(
		bytes32 indexed eventURN,
        bytes32 eventInstanceId,
        bytes32 activityInstanceId
    );

    bytes32 public constant EVENT_ID_ACTIVITY_INSTANCES = "AN://activity-instances";
    // NOTE: EVENT_ID_PROCESS_INSTANCES is also defined in ProcessInstance.sol as similar events can generate from within the PI
	bytes32 public constant EVENT_ID_PROCESS_INSTANCES = "AN://process-instances";
	bytes32 public constant EVENT_ID_TIMER_EVENT_INSTANCES = "AN://timer-event-instances";
	bytes32 public constant EVENT_ID_TIMER_EVENT_WAIT_UNTIL = "AN://timer-event-wait-until";
    bytes32 public constant EVENT_ID_BOUNDARY_EVENTS = "AN://boundary-events";
    bytes32 public constant EVENT_ID_TIMER_EVENTS = "AN://timer-events";

    function getERC165IdOrganization() internal pure returns (bytes4) {
        return (bytes4(keccak256(abi.encodePacked("addUser(address)"))) ^ 
                bytes4(keccak256(abi.encodePacked("removeUser(address)"))) ^
                bytes4(keccak256(abi.encodePacked("authorizeUser(address,bytes32)"))));
    }

    /**
     * @dev Performs an "upsert" of a new ActivityInstance into the provided map.
     *
     * @param _map the map
     * @param _value the value
     * @return the number of tasks at the end of the operation
     */
    function insertOrUpdate(BpmRuntime.ActivityInstanceMap storage _map, BpmRuntime.ActivityInstance memory _value) internal returns (uint)
    {
        if (_map.rows[_value.id].exists) {
            _map.rows[_value.id].value = _value;
        } else {
            _map.rows[_value.id].keyIdx = (_map.keys.push(_value.id)-1);
            _map.rows[_value.id].value = _value;
            _map.rows[_value.id].exists = true;
        }
        return _map.keys.length;
    }

    /**
     * @dev Performs an "upsert" of a new IntermediateEventInstance into the provided map.
     *
     * @param _map the map
     * @param _value the value
     * @return the number of tasks at the end of the operation
     */
    function insertOrUpdate(BpmRuntime.IntermediateEventInstanceMap storage _map, BpmRuntime.IntermediateEventInstance memory _value) internal returns (uint)
    {
        if (_map.rows[_value.id].exists) {
            _map.rows[_value.id].value = _value;
        } else {
            _map.rows[_value.id].keyIdx = (_map.keys.push(_value.id)-1);
            _map.rows[_value.id].value = _value;
            _map.rows[_value.id].exists = true;
        }
        return _map.keys.length;
    }

    /**
     * @dev Performs an "upsert" of a new BoundaryEventInstance into the provided map.
     *
     * @param _map the map
     * @param _value the value
     * @return the number of tasks at the end of the operation
     */
    function insertOrUpdate(BpmRuntime.BoundaryEventInstanceMap storage _map, BpmRuntime.BoundaryEventInstance memory _value) internal returns (uint)
    {
        if (_map.rows[_value.id].exists) {
            _map.rows[_value.id].value = _value;
        } else {
            _map.rows[_value.id].keyIdx = (_map.keys.push(_value.id)-1);
            _map.rows[_value.id].value = _value;
            _map.rows[_value.id].exists = true;
        }
        return _map.keys.length;
    }

    /**
     * @dev Performs a "delete" of the given BoundaryEventInstance in the provided map.
     * @dev the _map.keys array may get re-ordered by this operation: unless the removed entry was
     * the last element in the map's keys, the last key will be moved into the void position created
     * by the removal.
     *
     * @param _map the map
     * @param _key the key
     */
    function remove(BpmRuntime.BoundaryEventInstanceMap storage _map, bytes32 _key) public {
        if (!_map.rows[_key].exists) { return; }
        bytes32 swapKey = Mappings.deleteInKeys(_map.keys, _map.rows[_key].keyIdx);
        if (!swapKey.isEmpty()) {
            _map.rows[swapKey].keyIdx = _map.rows[_key].keyIdx;
        }
        delete _map.rows[_key];
     }

    /**
     * @dev Internal function to emit a LogActivityInstanceCompletion event
     */
    function emitAICompletionEvent(bytes32 _aiId, address _completedBy, uint _completed, address _performer, BpmRuntime.ActivityInstanceState _state) internal {
        emit LogActivityInstanceCompletion(
            EVENT_ID_ACTIVITY_INSTANCES,
            _aiId,
            _completedBy,
            _completed,
            _performer,
            uint8(_state)
        );
    }

    /**
     * WORKFLOW SERVICE
     */

    /**
     * @dev Executes the given ActivityInstance based on the information in the provided ProcessDefinition.
     * Note that this function assumes there is a corresponding ActivityDefinition in the provided ProcessDefinition
     * that defines how this ActivityInstance needs to be processed. It's therefore the responsibility of the calling
     * code to make sure this prerequisite is met.
     * @param _activityInstance the ActivityInstance
     * @param _rootDataStorage a DataStorage that can be used to resolve process data (typically this is the ProcessInstance itself)
     * @param _processDefinition a ProcessDefinition containing information how to execute the activity
     * @param _service the BpmService to use for communicating
     * @return BaseErrors.INVALID_PARAM_STATE() if the ActivityInstance's state is not CREATED, SUSPENDED, or INTERRUPTED
     * @return BaseErrors.INVALID_ACTOR() if the ActivityInstance is of TaskType.USER, but neither the msg.sender nor the tx.origin is the assignee of the task.
     * @return BaseErrors.NO_ERROR() if successful
     */
    function executeActivity(BpmRuntime.ActivityInstance storage _activityInstance, DataStorage _rootDataStorage, ProcessDefinition _processDefinition, BpmService _service)
        public
        returns (uint error)
    {
        uint8 activityType;
        uint8 taskType;
        uint8 behavior;
        bytes32 application;
        bool multiInstance;
        // AI must be a new instance, regularly suspended, or one that was interrupted from previous errors and is being recovered
        if (_activityInstance.state != BpmRuntime.ActivityInstanceState.CREATED &&
            _activityInstance.state != BpmRuntime.ActivityInstanceState.SUSPENDED &&
            _activityInstance.state != BpmRuntime.ActivityInstanceState.INTERRUPTED) {
            return BaseErrors.INVALID_PARAM_STATE();
        }

        (activityType, taskType, behavior, , multiInstance, application, , ) = _processDefinition.getActivityData(_activityInstance.activityId);

        if (activityType == uint8(BpmModel.ActivityType.TASK)) {
            // ### NONE ###
            if (taskType == uint8(BpmModel.TaskType.NONE)) {
                // NONE gets SUSPENDED only when it's a new activity with asynchronous behavior
                if (_activityInstance.state == BpmRuntime.ActivityInstanceState.CREATED &&
                    (BpmModel.TaskBehavior(behavior) != BpmModel.TaskBehavior.SEND)) {
                        _activityInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
                        emit LogActivityInstanceStateUpdate(
                            EVENT_ID_ACTIVITY_INSTANCES,
                            _activityInstance.id,
                            uint8(_activityInstance.state)
                        );
                }
                // in all other cases it is completed
                else {
                    completeActivityInstance(_activityInstance, msg.sender);
                }
            }
            // ### USER ###
            else if (taskType == uint8(BpmModel.TaskType.USER)) {
                // A new CREATED user task is configured to be completed by a designated task perfomer and then SUSPENDED
                if (_activityInstance.state == BpmRuntime.ActivityInstanceState.CREATED) {
                    if (!setPerformer(_activityInstance, _processDefinition, _rootDataStorage)) {
                        return BaseErrors.INVALID_STATE();
                    }
                    // TODO require(_activityInstance.performer != address(0))
                    // USER tasks are always suspended to wait for external completion
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        uint8(_activityInstance.state)
                    );
                }
                // A SUSPENDED user task can be completed by the task performer resulting in the invocation of an application, if one was set for the activity
                else if (_activityInstance.state == BpmRuntime.ActivityInstanceState.SUSPENDED) {
                    address taskPerformer = authorizePerformer(_activityInstance.id, ProcessInstance(_activityInstance.processInstance));
                    // if the taskPerformer is empty, the authorization is regarded as failed
                    if (taskPerformer == address(0)) {
                        return BaseErrors.INVALID_ACTOR();
                    }

                    // execute the application if there is one
                    if (application != "") {
                        // grant performer rights to the application temporarily in order to access IN/OUT data mappings
                        ( , _activityInstance.performer, , , ) = _service.getApplicationRegistry().getApplicationData(application);
                        // USER tasks are allowed to have an application without code, i.e. no location address!
                        // In that case we have to skip the application invocation to avoid an error
                        if (_activityInstance.performer != address(0)) {
                            error = invokeApplication(_activityInstance, address(_rootDataStorage), application, taskPerformer, _processDefinition, _service.getApplicationRegistry());
                            if (error != BaseErrors.NO_ERROR()) {
                                // a USER task remains suspended if the completion function failed
                                _activityInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
                                // if the application prevented activity completion, return performing rights back to the user
                                _activityInstance.performer = taskPerformer;
                                emit LogActivityInstanceStateAndPerformerUpdate(
                                    EVENT_ID_ACTIVITY_INSTANCES,
                                    _activityInstance.id,
                                    _activityInstance.performer,
                                    uint8(BpmRuntime.ActivityInstanceState.SUSPENDED)
                                );
                                return (error);
                            }
                        }
                    }

                    // Task performer has been authenticated and the completion function (if there was one) returned no error
                    // all clear to mark task as complete.
                    // The AI performer is unset to avoid leaving any permissions open.
                    completeActivityInstance(_activityInstance, taskPerformer);
                }
            }
            // ### SERVICE ###
            else if (taskType == uint8(BpmModel.TaskType.SERVICE)) {
                // SERVICE tasks invoke code and end up either completed or interrupted
                // They are always synchronous and therefore the BpmModel.TaskBehavior is ignored
                // SERVICE tasks can only be invoked on a newly CREATED activity instance or on one that is being recovered from INTERRUPTED
                if (_activityInstance.state != BpmRuntime.ActivityInstanceState.CREATED &&
                    _activityInstance.state != BpmRuntime.ActivityInstanceState.INTERRUPTED) {
                    return BaseErrors.INVALID_PARAM_STATE();
                }
                // set the application as the performer to be able to get/set IN/OUT data or complete the activity (async only)
                ( , _activityInstance.performer, , , ) = _service.getApplicationRegistry().getApplicationData(application);
                // for synchronous service applications, the state is set to APPLICATION instead of SUSPENDED (for asynchronous behavior)
                _activityInstance.state = BpmRuntime.ActivityInstanceState.APPLICATION;
                error = invokeApplication(_activityInstance, address(_rootDataStorage), application, msg.sender, _processDefinition, _service.getApplicationRegistry());
                _activityInstance.performer = address(0);
                emit LogActivityInstanceStateAndPerformerUpdate(
                    EVENT_ID_ACTIVITY_INSTANCES,
                    _activityInstance.id,
                    _activityInstance.performer,
                    uint8(BpmRuntime.ActivityInstanceState.APPLICATION)
                );
                if (error != BaseErrors.NO_ERROR()) {
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.INTERRUPTED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        uint8(BpmRuntime.ActivityInstanceState.INTERRUPTED)
                    );
                    return (error);
                }
                
                completeActivityInstance(_activityInstance, _activityInstance.performer);
            }
            // ### EVENT ###
            else if (taskType == uint8(BpmModel.TaskType.EVENT)) {
                // EVENT tasks invoke code to send out an event and then complete or suspend depending on the task behavior:
                // A synchronous EVENT SEND task behaves exactly like a SERVICE task
                // A EVENT RECEIVE task behaves exactly like a NONE RECEIVE activity, except that the right to complete the activity is restricted to the event application

                // set the application as the performer to be able to get/set IN/OUT data or complete the activity (async only)
                ( , _activityInstance.performer, , , ) = _service.getApplicationRegistry().getApplicationData(application);

                // A newly created AI or one being recovered from INTERRUPTED paired with SEND or SENDRECEIVE
                // behavior triggers the invocation of the application
                if (_activityInstance.state == BpmRuntime.ActivityInstanceState.CREATED ||
                    _activityInstance.state == BpmRuntime.ActivityInstanceState.INTERRUPTED) {
                    if (BpmModel.TaskBehavior(behavior) == BpmModel.TaskBehavior.SEND ||
                        BpmModel.TaskBehavior(behavior) == BpmModel.TaskBehavior.SENDRECEIVE) {
                        // for the synchronous part of the event, the state is set to APPLICATION to allow IN mappings to be executed
                        _activityInstance.state = BpmRuntime.ActivityInstanceState.APPLICATION;
                        emit LogActivityInstanceStateUpdate(
                            EVENT_ID_ACTIVITY_INSTANCES,
                            _activityInstance.id,
                            uint8(BpmRuntime.ActivityInstanceState.APPLICATION)
                        );
                        error = invokeApplication(_activityInstance, address(_rootDataStorage), application, msg.sender, _processDefinition, _service.getApplicationRegistry());
                        if (error != BaseErrors.NO_ERROR()) {
                            _activityInstance.state = BpmRuntime.ActivityInstanceState.INTERRUPTED;
                            _activityInstance.performer = address(0);
                            emit LogActivityInstanceStateAndPerformerUpdate(
                                EVENT_ID_ACTIVITY_INSTANCES,
                                _activityInstance.id,
                                _activityInstance.performer,
                                uint8(BpmRuntime.ActivityInstanceState.INTERRUPTED)
                            );
                            return (error);
                        }
                    }

                    // Depending on the TaskBehavior, the AI is either suspended (async) or completed (fire-and-forget event)
                    if (BpmModel.TaskBehavior(behavior) != BpmModel.TaskBehavior.SEND) {
                        _activityInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
                        emit LogActivityInstanceStateUpdate(
                            EVENT_ID_ACTIVITY_INSTANCES,
                            _activityInstance.id,
                            uint8(_activityInstance.state)
                        );
                    }
                    else {
                        completeActivityInstance(_activityInstance, _activityInstance.performer);
                    }
                }
                // A SUSPENDED event task can only be completed by the performing application
                else if (_activityInstance.state == BpmRuntime.ActivityInstanceState.SUSPENDED) {
                    if (_activityInstance.performer != msg.sender) {
                        return BaseErrors.INVALID_ACTOR();
                    }
                    completeActivityInstance(_activityInstance, _activityInstance.performer);
                }
            }
            else {
                // Unknown task type. Should not happen!
                revert(ErrorsLib.format(ErrorsLib.INVALID_INPUT(), "BpmRuntimeLib.executeActivity(BpmRuntime.ActivityInstance,DataStorage,ProcessDefinition,BpmService)", "Unknown BpmModel.TaskType"));
            }
        }
        // ### SUBPROCESS ###
        else if (activityType == uint8(BpmModel.ActivityType.SUBPROCESS)) {
            if (_activityInstance.state == BpmRuntime.ActivityInstanceState.CREATED) {
                address subProcessDefinition = findProcessDefinitionForSubprocessActivity(_activityInstance, _processDefinition, _service.getProcessModelRepository());
                // TODO assert(subProcessDefinition != address(0))
                if (subProcessDefinition == address(0)) {
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.INTERRUPTED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        uint8(_activityInstance.state)
                    );
                    return BaseErrors.RESOURCE_NOT_FOUND();
                }
                // change the state of this AI *before* entering into the subprocess! If the subprocess completes within the same call, it will attempt to complete this activity.
                if (BpmModel.TaskBehavior(behavior) == BpmModel.TaskBehavior.SEND) {
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.COMPLETED;
                    _activityInstance.completed = block.timestamp;
                    emit LogActivityInstanceStateAndTimestampUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        _activityInstance.completed,
                        uint8(BpmRuntime.ActivityInstanceState.COMPLETED)
                    );
                }
                else {
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        uint8(_activityInstance.state)
                    );
                }
                // pass a reference to this activity instance to the subprocess
                ProcessInstance subProcess; // TODO stack too deep problems = _service.createSubProcess(subProcessDefinition, msg.sender, _activityInstance.id);
                //TODO datamapping to achieve same effect as: subProcess.setDataValueAsAddress("agreement", _rootDataStorage.getDataValueAsAddress("agreement"));
                error = _service.startProcessInstance(subProcess);
                if (error != BaseErrors.NO_ERROR()) {
                    _activityInstance.state = BpmRuntime.ActivityInstanceState.INTERRUPTED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        _activityInstance.id,
                        uint8(_activityInstance.state)
                    );
                    return (error);
                }
            }
            else if (_activityInstance.state == BpmRuntime.ActivityInstanceState.SUSPENDED) {
                // TODO we need a way to make sure the subprocess activity is legally completed, e.g. the subprocess must be completed
                // The call to complete this activity should be coming from the tail end of finishing off the subprocess in the continueTransaction() function, but how to make this assertion?
                // would be good to capture the subprocess address as the completedBy here!
                _activityInstance.state = BpmRuntime.ActivityInstanceState.COMPLETED;
                _activityInstance.completed = block.timestamp;
                emit LogActivityInstanceStateAndTimestampUpdate(
                    EVENT_ID_ACTIVITY_INSTANCES,
                    _activityInstance.id,
                    _activityInstance.completed,
                    uint8(BpmRuntime.ActivityInstanceState.COMPLETED)
                );
            }
        }
        else {
            // unknown activity type. Should not happen!
            revert(ErrorsLib.format(ErrorsLib.INVALID_INPUT(), "BpmRuntimeLib.executeActivity(BpmRuntime.ActivityInstance,DataStorage,ProcessDefinition,BpmService)", "Unknown BpmModel.ActivityType"));
        }
        
        return BaseErrors.NO_ERROR();
    }

    /**
     * @dev Executes the given ActivityInstance as intermediate event
     * Note that this function assumes there is a corresponding IntermediateEvent definition in the provided ProcessDefinition
     * that defines how this ActivityInstance needs to be processed. It's therefore the responsibility of the calling
     * code to make sure this prerequisite is met.
     */
    function executeIntermediateEvent(BpmRuntime.IntermediateEventInstance storage _eventInstance, DataStorage _rootDataStorage, ProcessDefinition _processDefinition)
        public
    {
        ErrorsLib.revertIf(_eventInstance.state != BpmRuntime.ActivityInstanceState.CREATED &&
            _eventInstance.state != BpmRuntime.ActivityInstanceState.SUSPENDED,
            ErrorsLib.INVALID_PARAMETER_STATE(), "BpmRuntimeLib.executeEvent", "The ActivityInstance for the intermediate event is not in the correct state");
        
        (BpmModel.EventType eventType, BpmModel.IntermediateEventBehavior eventBehavior, , ) = _processDefinition.getIntermediateEventGraphDetails(_eventInstance.eventId);

        (bytes32 dataPath, bytes32 dataStorageId, address dataStorage, uint timestampConstant, string memory durationConstant) = _processDefinition.getTimerEventDetails(_eventInstance.eventId); 

        address dataStorageAddress = DataStorageUtils.resolveDataStorageAddress(dataStorageId, dataStorage, _rootDataStorage);

        string memory timerDuration;
        uint timerTarget;

        if (eventType == BpmModel.EventType.TIMER_TIMESTAMP) {
            if (timestampConstant != 0) {
                timerTarget = timestampConstant;
            } else {
                timerTarget = DataStorage(dataStorageAddress).getDataValueAsUint(dataPath);
            }

            _eventInstance.timerTarget = timerTarget;

            emit LogTimerEventTimerActivation(
                EVENT_ID_TIMER_EVENT_WAIT_UNTIL,
                _eventInstance.id,
                timerTarget,
                timerDuration
            );
        }
        else if (eventType == BpmModel.EventType.TIMER_DURATION) {
            if (bytes(durationConstant).length > 0) {
                timerDuration = durationConstant;
            } else {
                timerDuration = DataStorage(dataStorageAddress).getDataValueAsString(dataPath);
            }

            emit LogTimerEventTimerActivation(
                EVENT_ID_TIMER_EVENT_WAIT_UNTIL,
                _eventInstance.id,
                timerTarget,
                timerDuration
            );
        }
        else {
            revert(ErrorsLib.format(ErrorsLib.INVALID_PARAMETER_STATE(), "BpmRuntimeLib.executeEvent", "The EventType for the intermediate event has an invalid value"));
        }

        if (eventBehavior == BpmModel.IntermediateEventBehavior.CATCHING) {
            _eventInstance.state = BpmRuntime.ActivityInstanceState.SUSPENDED;
        } else {
            _eventInstance.state = BpmRuntime.ActivityInstanceState.COMPLETED;
        }
        emit LogTimerEventInstanceStateUpdate (
            EVENT_ID_TIMER_EVENT_INSTANCES,
            _eventInstance.id,
            _eventInstance.state
        );
    }

    /**
     * @dev Completes the given ActivityInstance by changing its state to COMPLETED, setting the completedBy and current time as completion time.
     * Also, any boundary events are deactivated and removed from the ActivityInstance and the provided ProcessInstance
     * REVERTS if:
     * - the ActivityInstance's state is already final, COMPLETED or ABORTED
     * @param _activityInstance the BpmRuntime.ActivityInstance to be marked as completed
     * @param _completedBy the address to be set as having completed the ActivityInstance
     */
    function completeActivityInstance(BpmRuntime.ActivityInstance storage _activityInstance, address _completedBy) public {
        ErrorsLib.revertIf(_activityInstance.state == BpmRuntime.ActivityInstanceState.COMPLETED || _activityInstance.state == BpmRuntime.ActivityInstanceState.ABORTED,
            ErrorsLib.INVALID_PARAMETER_STATE(), "BpmRuntimeLib.completeActivityInstance", "The provided ActivityInstance is already in a final state, COMPLETED or ABORTED");
   
        _activityInstance.state = BpmRuntime.ActivityInstanceState.COMPLETED;
        _activityInstance.completedBy = _completedBy;
        _activityInstance.performer = address(0);
        _activityInstance.completed = block.timestamp;
        emitAICompletionEvent(
            _activityInstance.id,
            _activityInstance.completedBy,
            _activityInstance.completed,
            address(0),
            BpmRuntime.ActivityInstanceState.COMPLETED
        );
        // deactivate and remove any boundary events from the ActivityInstance
        if (_activityInstance.boundaryEvents.keys.length > 0) {
            for (uint i = 0; i < _activityInstance.boundaryEvents.keys.length; i++) {
                BpmRuntime.BoundaryEventInstance storage eventInstance = _activityInstance.boundaryEvents.rows[_activityInstance.boundaryEvents.keys[i]].value;
                // TODO this should only happen for timer-related events or we need to change the event name
                emit LogBoundaryEventTimerDeactivation(
                        EVENT_ID_TIMER_EVENTS,
                        eventInstance.id,
                        eventInstance.activityInstanceId
                );
            }
            delete _activityInstance.boundaryEvents;
        }
    }

    /**
     * @dev Activates the given BoundaryEventInstance by attempting to resolve any data-bindings.
     * The function supports different behaviors depending on the BpmModel.EventType of the boundary event.
     * Currently, only timer-related boundary events are supported for which a future date is either
     * calculated or injected via an external system.
     * This function immediately returns if the provided BoundaryEventInstance is already active.
     * Note that this function assumes there is a corresponding BoundarEvent definition in the provided ProcessDefinition
     * that defines how this BoundaryEventInstance needs to be processed. It's therefore the responsibility of the calling
     * code to make sure this prerequisite is met.
     * REVERTS if:
     * - the BoundaryEvent definition is of an unsupported type
     * @param _eventInstance a BpmRuntime.BoundaryEventInstance to be activated
     * @param _rootDataStorage a DataStorage contract to leverage for resolving data required to activate the event instance
     * @param _processDefinition a ProcessDefinition where the event's configuration can be found
     * @return the resulting BpmRuntime.BoundaryEventInstanceState to indicate whether the event instance was successfully activated
     */
    function activateBoundaryEvent(BpmRuntime.BoundaryEventInstance storage _eventInstance, DataStorage _rootDataStorage, ProcessDefinition _processDefinition)
        public
        returns (BpmRuntime.BoundaryEventInstanceState)
    {
        // simply return if the event instance is already active
        if (_eventInstance.state == BpmRuntime.BoundaryEventInstanceState.ACTIVE)
            return _eventInstance.state;

        // TODO it should not be possible to activate an event belonging to a finalized ActivityInstance.

        (BpmModel.EventType eventType, , ) = _processDefinition.getBoundaryEventGraphDetails(_eventInstance.boundaryId);

        address dataStorageAddress;

        if (eventType == BpmModel.EventType.TIMER_TIMESTAMP) {
            // only attempt data resolution if the targetTime is not yet set
            if (_eventInstance.timerTarget == 0) {
                (bytes32 dataPath, bytes32 dataStorageId, address dataStorage, uint timestampConstant, ) = _processDefinition.getTimerEventDetails(_eventInstance.boundaryId);
                dataStorageAddress = DataStorageUtils.resolveDataStorageAddress(dataStorageId, dataStorage, _rootDataStorage);
                uint timerTimestamp;
                if (timestampConstant > 0) {
                    timerTimestamp = timestampConstant;
                } else {
                    timerTimestamp = DataStorage(dataStorageAddress).getDataValueAsUint(dataPath);
                }

                if (timerTimestamp > 0) {
                    _eventInstance.timerTarget = timerTimestamp;
                    _eventInstance.state = BpmRuntime.BoundaryEventInstanceState.ACTIVE;
                    // TODO we need to distinguish between a boundary activation/deactivation event and the initial creation event. The creation event is what should be picked up vent to calculate and inject data.
                    emit LogBoundaryEventTimerActivation(
                        EVENT_ID_TIMER_EVENTS,
                        _eventInstance.id,
                        _eventInstance.activityInstanceId,
                        timerTimestamp,
                        ""
                    );
                }
            }
            // if for some reason the targetTime has been set already, but the event instance is not active, just activate it.
            else {
                _eventInstance.state = BpmRuntime.BoundaryEventInstanceState.ACTIVE;
                // TODO emit event, see above
            }
        }
        else if (eventType == BpmModel.EventType.TIMER_DURATION) {
            // only attempt data resolution if the targetTime is not yet set
            if (_eventInstance.timerTarget == 0) {
                (bytes32 dataPath, bytes32 dataStorageId, address dataStorage, , string memory durationConstant) = _processDefinition.getTimerEventDetails(_eventInstance.boundaryId);
                dataStorageAddress = DataStorageUtils.resolveDataStorageAddress(dataStorageId, dataStorage, _rootDataStorage);
                string memory timerDuration;
                if (bytes(durationConstant).length > 0) {
                    timerDuration = durationConstant;
                } else {
                    timerDuration = DataStorage(dataStorageAddress).getDataValueAsString(dataPath);
                }

                // TODO how do we find out if the event can be activated? Do clients call this function to inject the resolved uint??

                emit LogBoundaryEventTimerActivation(
                    EVENT_ID_TIMER_EVENTS,
                    _eventInstance.id,
                    _eventInstance.activityInstanceId,
                    0,
                    timerDuration
                );
            }
            // if for some reason the targetTime has been set already, but the event instance is not active, just activate it.
            else {
                _eventInstance.state = BpmRuntime.BoundaryEventInstanceState.ACTIVE;
                // TODO emit event, see above
            }
        }
        else {
            revert(ErrorsLib.format(ErrorsLib.INVALID_PARAMETER_STATE(), "BpmRuntimeLib.activateBoundaryEvent", "Unsupported EventType for the boundary event"));
        }

        return _eventInstance.state;
    }

    /**
     * @dev Executes the given ProcessInstance leveraging the given BpmService reference by looking for activities that are "ready" to be
     * executed. Execution continues along the process graph until no more activities can be executed. This function
     * implements a single transaction of all activities in a process flow until an asynchronous point in the flow is reached or the process has ended.
     * @param _processInstance the ProcessInstance to execute
     * @param _service the BpmService managing the ProcessInstance (used to register changes to the ProcessInstance and fire events)
     * @return BaseErrors.INVALID_STATE() if the ProcessInstance is not ACTIVE
     * @return BaseErrors.NO_ERROR() if successful
     */
    function execute(BpmRuntime.ProcessInstance storage _processInstance, BpmService _service) public returns (uint) {
        if (_processInstance.state != BpmRuntime.ProcessInstanceState.ACTIVE) {
            return BaseErrors.INVALID_STATE();
        }
        bytes32 activityId;
        uint8 taskType;
        bool multiInstance;
        bytes32 assignee;
        for (uint i=0; i<_processInstance.graph.activityKeys.length; i++) {
            activityId = _processInstance.graph.activityKeys[i];
            if (_processInstance.graph.activities[activityId].ready) {
                // remove the activation trigger and multi-instance information (in case this node in the graph has been run before)
                _processInstance.graph.activities[activityId].ready = false;
                if (_processInstance.graph.activities[activityId].instancesCompleted > 0)
                    _processInstance.graph.activities[activityId].instancesCompleted = 0;

                // some activities in the graph might not be represented by elements in the ProcessDefinition, e.g. to support
                // gateways in sequence. These activities simply move the activation markers.
                if (!_processInstance.processDefinition.modelElementExists(activityId)) {
                    _processInstance.graph.activities[activityId].done = true;
                    continue;
                }

                BpmModel.ModelElementType elementType = _processInstance.processDefinition.getElementType(activityId);
                // ACTIVITY 
                if (elementType == BpmModel.ModelElementType.ACTIVITY) {
                    ( , taskType, , assignee, multiInstance, , , ) = _processInstance.processDefinition.getActivityData(activityId);
                    if (multiInstance) {
                        address targetAddress;
                        bytes32 dataPath;
                        if (taskType == uint8(BpmModel.TaskType.USER)) {
                            // number of instances is determined by the conditional performer
                            (targetAddress, dataPath) = resolveParticipant(_processInstance.processDefinition.getModel(), DataStorage(_processInstance.addr), assignee);
                        }
                        else {
                            //TODO determine sizeOfArray based on data path of IN mapping
                            // _processInstance.graph.activities[activityId].instancesTotal = sizeOfArray;
                        }
                        //TODO assert targetAddress is a DataStorage and dataPath is not empty
                        _processInstance.graph.activities[activityId].instancesTotal = DataStorage(targetAddress).getArrayLength(dataPath);
                    }
                    else {
                        _processInstance.graph.activities[activityId].instancesTotal = 1;
                    }

                    ( , , bytes32[] memory boundaryEvents) = _processInstance.processDefinition.getActivityGraphDetails(activityId);

                    bytes32 aiId; // the unique AI ID
                    for (uint j = 0; j < _processInstance.graph.activities[activityId].instancesTotal; j++) {
                        aiId = createActivityInstance(_processInstance, activityId, j);
                        _service.getBpmServiceDb().addActivityInstance(aiId);
                        //TODO error from executeActivity() function is ignored as we want to continue creating activities. Even if one failed, it should be in INTERRUPTED state or otherwise recoverable
                        executeActivity(_processInstance.activities.rows[aiId].value, DataStorage(_processInstance.addr), _processInstance.processDefinition, _service);

                        if (_processInstance.activities.rows[aiId].value.state == BpmRuntime.ActivityInstanceState.COMPLETED) {
                            _processInstance.activities.rows[aiId].value.completed = block.timestamp;
                            _processInstance.graph.activities[activityId].instancesCompleted++;
                        }

                        // create boundary events
                        for (uint k = 0; k < boundaryEvents.length; k++) {
                            bytes32 boundaryId = boundaryEvents[k];
                            createBoundaryEventInstance(_processInstance, aiId, boundaryId, k);
                        }
                    }
                }
                // INTERMEDIATE EVENT
                else if (elementType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) {
                    bytes32 eiId; // the unique event instance ID
                    _processInstance.graph.activities[activityId].instancesTotal = 1;
                    eiId = createIntermediateEventInstance(_processInstance, activityId);
                    _service.getBpmServiceDb().addActivityInstance(eiId);
                    executeIntermediateEvent(_processInstance.intermediateEvents.rows[eiId].value, DataStorage(_processInstance.addr), _processInstance.processDefinition);
                    if (_processInstance.intermediateEvents.rows[eiId].value.state == BpmRuntime.ActivityInstanceState.COMPLETED) {
                        _processInstance.intermediateEvents.rows[eiId].value.completed = block.timestamp;
                        _processInstance.graph.activities[activityId].instancesCompleted = 1;
                    }
                }

                // check the completed vs total instances
                if (_processInstance.graph.activities[activityId].instancesCompleted == _processInstance.graph.activities[activityId].instancesTotal) {
                    _processInstance.graph.activities[activityId].done = true;
                }

                // TODO error gathering?
            }
        }

        return continueTransaction(_processInstance, _service);
    }

    /**
     * @dev Checks the given ProcessInstance for completeness and open activities.
     * If activatable activities are detected, recursive execution is entered via execute(ProcessInstance).
     * If the ProcessInstance is complete, its state is set to COMPLETED.
     * Otherwise the function returns BaseErrors.NO_ERROR().
     * @param _processInstance the BpmRuntime.ProcessInstance
     * @return BaseErrors.NO_ERROR() if no errors were encountered during processing or no processing happened
     * @return any error code from entering into a recursive execute(ProcessInstance) and continuing to execute the process
     */
    function continueTransaction(BpmRuntime.ProcessInstance storage _processInstance, BpmService _service) public returns (uint) {
        bool readyActivities;
        bool completed;
        (completed, readyActivities) = isCompleted(_processInstance.graph);
        // If there are any activatable activities enter into recursive execution
        if (readyActivities) {
            return execute(_processInstance, _service);
        }
        else if (completed) {
            _processInstance.state = BpmRuntime.ProcessInstanceState.COMPLETED;
            emit LogProcessInstanceStateUpdate(
                EVENT_ID_PROCESS_INSTANCES,
                _processInstance.addr,
                uint8(BpmRuntime.ProcessInstanceState.ABORTED)
            );
            ProcessInstance(_processInstance.addr).notifyProcessStateChange();
            // check if the process is the subprocess of another process
            if (_processInstance.subProcessActivityInstance != "") {
                address parentPI = _service.getBpmServiceDb().getProcessInstanceForActivity(_processInstance.subProcessActivityInstance);
                uint8 activityState;
                ( , , , , , activityState) = _service.getActivityInstanceData(parentPI, _processInstance.subProcessActivityInstance);
                // if the subprocess activity is SUSPENDED, it is waiting to be completed by this subprocess
                if (activityState == uint8(BpmRuntime.ActivityInstanceState.SUSPENDED)) {
                    return ProcessInstance(parentPI).completeActivity(_processInstance.subProcessActivityInstance, _service);
                }
            }
            clear(_processInstance.graph);
        }

        return BaseErrors.NO_ERROR();
    }

    /**
     * @dev Sets the performer on the given ActivityInstance based on the provided ProcessDefinition and DataStorage.
     * The ActivityInstance must belong to a USER task for the performer to be set.
     * @param _activityInstance the ActivityInstance on which to set the performer
     * @param _processDefinition the ProcessDefinition where the activity definition can be found
     * @param _rootDataStorage a DataStorage to use as the basis to resolve data paths
     * @return true if the performer was set, false otherwise
     */
    function setPerformer(BpmRuntime.ActivityInstance storage _activityInstance, ProcessDefinition _processDefinition, DataStorage _rootDataStorage)
        public
        returns (bool)
    {
        address targetAddress;
        bytes32 dataPath;
        uint8 taskType;
        bytes32 assignee;
        bool multiInstance;
        ( , taskType, , assignee, multiInstance, , , ) = _processDefinition.getActivityData(_activityInstance.activityId);
        if (taskType == uint8(BpmModel.TaskType.USER)) {
            (targetAddress, dataPath) = resolveParticipant(_processDefinition.getModel(), _rootDataStorage, assignee);
            if (multiInstance) {
                // assert targetAddress is a DataStore and dataPath is not empty
                _activityInstance.performer = DataStorage(targetAddress).getDataValueAsAddressArray(dataPath)[_activityInstance.multiInstanceIndex];
            }
            else {
                _activityInstance.performer = (dataPath == "") ? targetAddress : DataStorage(targetAddress).getDataValueAsAddress(dataPath);
            }
            emit LogActivityInstancePerformerUpdate(
                EVENT_ID_ACTIVITY_INSTANCES,
                _activityInstance.id,
                _activityInstance.performer
            );
        }
        return (_activityInstance.performer != address(0));
    }

    /**
     * @dev Attempts to determine if either the msg.sender or the tx.origin is an authorized performer for the specified activity instance ID in the given ProcessInstance.
     * The address of the one that cleared is returned with msg.sender always tried before tx.origin.
     * If there is no direct match, an attempt is made to determine if the set performer is an Organization which can authorize
     * one of the two addresses.
     * @param _activityInstanceId the ID of an activity instance
     * @param _processInstance the ProcessInstance that contains the specified activity instance
     * @return authorizedPerformer - the address (msg.sender or tx.origin) that was authorized, or 0x0 if no authorization is given
     */
    function authorizePerformer(bytes32 _activityInstanceId, ProcessInstance _processInstance)
        public
        returns (address authorizedPerformer)
    {
        (bytes32 activityId, , , address performer, , ) = _processInstance.getActivityInstanceData(_activityInstanceId);
        if (performer == address(0)) {
            return address(0);
        }
        if (performer == msg.sender) {
            authorizedPerformer = msg.sender;
        }
        else if (performer == tx.origin) {
            authorizedPerformer = tx.origin;
        }
        // if the performer cannot be determined directly (i.e. via msg.sender or tx.origin), check against a potential organization + scope (department/role)
        if (authorizedPerformer == address(0) && ERC165Utils.implementsInterface(performer, getERC165IdOrganization())) {
            // check if this organization performer and activity context require a restrictive scope (department)
            bytes32 scope = _processInstance.resolveAddressScope(performer, activityId, _processInstance);
            if (Organization(performer).authorizeUser(msg.sender, scope)) {
                authorizedPerformer = msg.sender;
            }
            else if (Organization(performer).authorizeUser(tx.origin, scope)) {
                authorizedPerformer = tx.origin;
            }
        }
    }

    /**
     * @dev Performs a call on the given application ID defined in the provided ApplicationRegistry.
     * The application's address should be registered as the ActivityInstance's performer prior to invoking this function.
     * Currently unused parameters were unnamed to avoid compiler warnings:
     * param _rootDataStorage a DataStorage that is used as the root or default for resolving data references
     * param _processDefinition the process definition
     * @param _activityInstance the ActivityInstance
     * @param _application the application ID
     * @param _txPerformer the account that initiated the current transaction (optional)
     * @param _applicationRegistry the registry where information about an application can be retrieved
     * @return BaseErrors.RUNTIME_ERROR if there was an exception in calling the defined appliation
     * @return BaseErrors.NO_ERROR() if successful
     */
    function invokeApplication(BpmRuntime.ActivityInstance storage _activityInstance, address /*_rootDataStorage*/, bytes32 _application, address _txPerformer, ProcessDefinition /*_processDefinition*/, ApplicationRegistry _applicationRegistry) public returns (uint) {
        bytes4 completionFunction;
        address appAddress;
        ( , appAddress, completionFunction, , ) = _applicationRegistry.getApplicationData(_application);
        // For some reason, making the .call below on an 0x0 address (or any address) does not return false, so we need to detect this situation beforehand
        // TODO check if the address is not 0x0 and has a code field
        if (appAddress == address(0)) {
            return BaseErrors.RESOURCE_NOT_FOUND();
        }
        if (completionFunction == "") {
            completionFunction = _applicationRegistry.DEFAULT_COMPLETION_FUNCTION();
        }

        //TODO support automatic resolution and injection of data mappings for completionFunction input params and return values. That's what the rootDataStorage parameter was meant for.

        //TODO support custom completion functions. Currently only the DEFAULT_COMPLETION_FUNCTION signature is supported

        bool success;
        (success, ) = appAddress.call(abi.encodeWithSelector(completionFunction, _activityInstance.processInstance, _activityInstance.id, _activityInstance.activityId, (_txPerformer == address(0) ? msg.sender : _txPerformer)));
        if (!success)
            return BaseErrors.RUNTIME_ERROR();
        return BaseErrors.NO_ERROR();
    }

    /**
     * @dev Returns the resolved location of the data specified by the data mapping for the specified ActivityInstance.
     * @param _processInstance provides the data context against which to resolve the data mapping
     * @param _activityInstanceId the ID of the activity instance
     * @param _dataMappingId the ID of a data mapping associated with the activity instance
     * @param _direction IN|OUT specifying the type of data mapping
     * @return dataStorage - the address of a DataStorage that contains the requested data. Default is the ProcessInstance itself, if none other specified
     * @return dataPath - the ID with which the data can be retrieved
     */
    function resolveDataMappingLocation(BpmRuntime.ProcessInstance storage _processInstance, bytes32 _activityInstanceId, bytes32 _dataMappingId, BpmModel.Direction _direction) public view returns (address dataStorage, bytes32 dataPath) {
        bytes32 dataStorageId;
        bytes32 activityId = _processInstance.activities.rows[_activityInstanceId].value.activityId;
        ( , , dataPath, dataStorageId, dataStorage) = _direction == BpmModel.Direction.IN ?
            _processInstance.processDefinition.getInDataMappingDetails(activityId, _dataMappingId) :
            _processInstance.processDefinition.getOutDataMappingDetails(activityId, _dataMappingId);
        if (dataStorage != address(0)) {
            return (dataStorage, dataPath);
        }
        else if (dataStorageId != "") {
            // retrieve the target by looking for the dataStorageId in the context of this ProcessInstance's dataStorage 
            dataStorage = DataStorage(_processInstance.addr).getDataValueAsAddress(dataStorageId);
        }
        else {
            dataStorage = _processInstance.addr;
        }
    }

    /**
     * @dev Returns the address of the ProcessDefinition which is configured as a subprocess for the given ActivityInstance.
     * @param _activityInstance the BpmRuntime.ActivityInstance that requires the subprocess information
     * @param _processDefinition the ProcessDefinition containing the subprocess activity definition
     * @param _repository a ProcessModelRepository in case the subprocess definition is in a different model than the provided ProcessDefinition
     * @return the address of a ProcessDefinition if successful, 0x0 otherwise
     */
    function findProcessDefinitionForSubprocessActivity(BpmRuntime.ActivityInstance memory _activityInstance, ProcessDefinition _processDefinition, ProcessModelRepository _repository) internal view returns (address subProcessDefinition) {
        bytes32 modelId;
        bytes32 processId;
        ( , , , , , , modelId, processId) = _processDefinition.getActivityData(_activityInstance.activityId);
        if (modelId == "") {
            // empty modelId assumes the subprocess is in the same model as the current process
            subProcessDefinition = _processDefinition.getModel().getProcessDefinition(processId);
        }
        else {
            subProcessDefinition = _repository.getProcessDefinition(modelId, processId);
        }
    }

    /**
     * @dev Provides runtime resolution capabilities to determine the account address or lookup location of an account for a participant in a given ProcessModel.
     * This function supports dealing with concrete participants as well as conditional performers.
     * Examples:
     * Return value (FE80A3F6CDFEF73D4FACA7DBA1DFCF215299279D, "") => The address is a concrete (user) account and can be used directly
     * Return value (AA194B34D18F710058C0B14CFDAD4FF0150856EA, "accountant") => The address is a DataStorage contract and the (user) account to use can be located using DataStorage(AA194B34D18F710058C0B14CFDAD4FF0150856EA).getDataValueAsAddress("accountant")
     * @param _processModel a ProcessModel
     * @param _dataStorage a concrete DataStorage instance supporting the lookup
     * @param _participant the ID of a participant in the given model
     * @return target - either the address of an account or the address of another DataStorage where the account can be found
     * @return dataPath - empty bytes32 in case the returned target is already an identified account or a key where to retrieve the account if the target is another DataStorage
     */
    function resolveParticipant(ProcessModel _processModel, DataStorage _dataStorage, bytes32 _participant) public view returns (address target, bytes32 dataPath) {
        bytes32 dataStorageId;
        address dataStorageAddress;
        address account;
        (account, dataPath, dataStorageId, dataStorageAddress) = _processModel.getParticipantData(_participant);
        if (account != address(0))
            target = account;
        else if (dataStorageAddress != address(0))
            target = dataStorageAddress;
        else if (dataStorageId != "")
            target = _dataStorage.getDataValueAsAddress(dataStorageId);
        else
            target = address(_dataStorage);
    }
    
    /**
     * @dev Creates a new BpmRuntime.ActivityInstance with the specified parameters and adds it to the given ProcessInstance
     * @param _processInstance the ProcessInstance to which the ActivityInstance is added
     * @param _activityId the ID of the activity as defined in the ProcessDefinition
     * @param _index indicates the position of the ActivityInstance when used in a multi-instance context
     * @return the unique global ID of the activity instance
     */
    function createActivityInstance(BpmRuntime.ProcessInstance storage _processInstance, bytes32 _activityId, uint _index) public returns (bytes32 aiId) {
        aiId = keccak256(abi.encodePacked(_processInstance.addr, _activityId, _processInstance.activities.keys.length));
        uint created = block.timestamp;
        bytes32[] memory keys;
        BpmRuntime.ActivityInstance memory ai = BpmRuntime.ActivityInstance({id: aiId,
                                                                             activityId: _activityId,
                                                                             processInstance: _processInstance.addr,
                                                                             multiInstanceIndex: _index,
                                                                             state: BpmRuntime.ActivityInstanceState.CREATED,
                                                                             created: created,
                                                                             performer: address(0),
                                                                             completed: uint8(0),
                                                                             completedBy: address(0),
                                                                             boundaryEvents: BpmRuntime.BoundaryEventInstanceMap({keys: keys})});
        insertOrUpdate(_processInstance.activities, ai);
        emit LogActivityInstanceCreation(
            EVENT_ID_ACTIVITY_INSTANCES,
            aiId,
            _activityId,
            _processInstance.addr,
            created,
            address(0),
            uint8(0),
            address(0),
            uint8(BpmRuntime.ActivityInstanceState.CREATED)
        );
    }

    /**
     * @dev Creates a new BpmRuntime.IntermediateEventInstance with the specified parameters and adds it to the given ProcessInstance
     * @param _processInstance the ProcessInstance to which the ActivityInstance is added
     * @param _eventId the ID of the event as defined in the ProcessDefinition
     * @return the unique global ID of the created IntermediateEventInstance
     */
    function createIntermediateEventInstance(BpmRuntime.ProcessInstance storage _processInstance, bytes32 _eventId) public returns (bytes32 eiId) {
        eiId = keccak256(abi.encodePacked(_processInstance.addr, _eventId));
        uint created = block.timestamp;
        
        BpmRuntime.IntermediateEventInstance memory iei = BpmRuntime.IntermediateEventInstance({id: eiId,
                                                                                               eventId: _eventId,
                                                                                               processInstance: _processInstance.addr,
                                                                                               created: created,
                                                                                               completed: 0,
                                                                                               state: BpmRuntime.ActivityInstanceState.CREATED,
                                                                                               timerTarget: 0});
        insertOrUpdate(_processInstance.intermediateEvents, iei);

        (BpmModel.EventType eventType, BpmModel.IntermediateEventBehavior eventBehavior, , ) = _processInstance.processDefinition.getIntermediateEventGraphDetails(_eventId);

        emit LogTimerEventInstanceCreation(
            EVENT_ID_TIMER_EVENT_INSTANCES,
            iei.id,
            iei.eventId,
            iei.processInstance,
            eventType,
            eventBehavior,
            created,
            iei.state
        );
    }

    /**
     * @dev Creates a new BpmRuntime.BoundaryEventInstance, based on the provided activity ID in the given ProcessInstance.
     * An attempt is made to activate the event, i.e. bind any configured runtime data needed to allow a triggering of the event.
     * If the event could not be activated automatically, it can still be done later via the #activateBoundaryEvent(...) function.
     * @param _processInstance A ProcessInstance struct providing the runtime and modeling context
     * @param _aiId The ID of an ActivityInstance to which the BoundaryEventInstance will be added
     * @param _boundaryId the ID of the boundary event definition to look up in the ProcessDefinition of the ProcessInstance
     * @param _index an additional index to affect the boundary event ID creation in case multiple event instances are being added to the same ActivityInstance
     * @return the unique ID of the created BoundaryEventInstance
     */
    function createBoundaryEventInstance(BpmRuntime.ProcessInstance storage _processInstance, bytes32 _aiId, bytes32 _boundaryId, uint _index)
        public
        returns (bytes32 biId)
    {
        ErrorsLib.revertIf(!_processInstance.activities.rows[_aiId].exists,
            ErrorsLib.RESOURCE_NOT_FOUND(), "BpmRuntimeLib.createBoundaryEventInstance", "The specified ActivityInstance could not be located in the provided ProcessInstance");

        BpmRuntime.ActivityInstance storage activityInstance = _processInstance.activities.rows[_aiId].value;
        biId = keccak256(abi.encodePacked(_aiId, _boundaryId, _index));

        BpmRuntime.BoundaryEventInstance memory bei = BpmRuntime.BoundaryEventInstance({id: biId,
                                                                                        boundaryId: _boundaryId,
                                                                                        activityInstanceId: activityInstance.id,
                                                                                        state: BpmRuntime.BoundaryEventInstanceState.INACTIVE,
                                                                                        timerTarget: 0 });
        insertOrUpdate(activityInstance.boundaryEvents, bei);

        (BpmModel.EventType eventType, BpmModel.BoundaryEventBehavior eventBehavior, ) = _processInstance.processDefinition.getBoundaryEventGraphDetails(_boundaryId);

        // try to activate the boundary event and transmit the result via the Log event
        // If the boundary event could not be activated, e.g. due to missing data, an external system can activate (bind the data) it later

        BpmRuntime.BoundaryEventInstanceState beiState = activateBoundaryEvent(activityInstance.boundaryEvents.rows[biId].value, DataStorage(_processInstance.addr), _processInstance.processDefinition);

        emit LogBoundaryEventInstanceCreation(
            EVENT_ID_BOUNDARY_EVENTS,
            biId,
            _aiId,
            eventType,
            eventBehavior,
            beiState
        );
    }

    /**
     * @dev Aborts the given ProcessInstance and all of its activities
     * @param _processInstance the process instance to abort
     */
    function abort(BpmRuntime.ProcessInstance storage _processInstance) public {
        // aborting is only possible for active processes
        if (_processInstance.state == BpmRuntime.ProcessInstanceState.ACTIVE ||
            _processInstance.state == BpmRuntime.ProcessInstanceState.CREATED) {

            bytes32 activityInstanceId;
            for (uint i=0; i<_processInstance.activities.keys.length; i++) {
                activityInstanceId = _processInstance.activities.keys[i];
                if (_processInstance.activities.rows[activityInstanceId].value.state != BpmRuntime.ActivityInstanceState.COMPLETED) {
                    _processInstance.activities.rows[activityInstanceId].value.state = BpmRuntime.ActivityInstanceState.ABORTED;
                    emit LogActivityInstanceStateUpdate(
                        EVENT_ID_ACTIVITY_INSTANCES,
                        activityInstanceId,
                        uint8(BpmRuntime.ActivityInstanceState.ABORTED)
                    );
                }
            }

            // TODO @SEAN need to abort all intermediate events as well

            clear(_processInstance.graph);
            _processInstance.state = BpmRuntime.ProcessInstanceState.ABORTED;
            emit LogProcessInstanceStateUpdate(
                EVENT_ID_PROCESS_INSTANCES,
                _processInstance.addr,
                uint8(BpmRuntime.ProcessInstanceState.ABORTED)
            );
        }
    }

    /**
     * NETWORK Graph Handling
     */

    /**
     * @dev Configures a ProcessGraph to be used for execution in the provided ProcessInstance.
     * The provided graph is cleared of any existing activity/transition information and then configured using the
     * ProcessDefinition of the process instance.
     * REVERTS if:
     * - the process instance's ProcessDefinition is not valid
     * @param _graph the BpmRuntime.ProcessGraph to configure
     */
    function configure(BpmRuntime.ProcessGraph storage _graph, ProcessInstance _processInstance) public {
        ProcessDefinition processDefinition = ProcessDefinition(_processInstance.getProcessDefinition());
        ErrorsLib.revertIf(!processDefinition.isValid(),
            ErrorsLib.INVALID_STATE(), "BpmRuntimeLib.configure(BpmRuntime.ProcessGraph,ProcessInstance)", "ProcessDefinition not valid");
        // start with a clean slate
        clear(_graph);
        _graph.processInstance = address(_processInstance);
        // traverse from start activity recursively along the graph.
        traverseRuntimeGraph(processDefinition, processDefinition.getStartActivity(), _graph);
    }

    /**
     * @dev Recursive function to walk a graph of model elements in the given ProcessDefinition starting at the specified element ID.
     * Due to the recursive nature of the function, it is not checked whether the ProcessDefinition is valid. This is the responsibility of the calling
     * function that initiates the recursion!
     * @param _processDefinition the ProcessDefinition on which the runtime graph should be based
     * @param _currentId the current element's ID which is being processed
     * @param _graph the process runtime graph being constructed
     */
    function traverseRuntimeGraph(ProcessDefinition _processDefinition, bytes32 _currentId, BpmRuntime.ProcessGraph storage _graph) public {
        bytes32 targetId;
        bytes32[] memory elementIds;
        uint256 i;
        BpmModel.ModelElementType currentType = _processDefinition.getElementType(_currentId);
        BpmModel.ModelElementType targetType;
        // ACTIVITY
        if (currentType == BpmModel.ModelElementType.ACTIVITY) {
            if (_graph.activities[_currentId].exists) {
                return; // if the element has already been added, end recursion
            }
            // create a place for the current activity
            addActivity(_graph, _currentId);
            ( , targetId, elementIds) = _processDefinition.getActivityGraphDetails(_currentId);
            // process the activity successor, if there is one
            if (targetId != "") {
                targetType = _processDefinition.getElementType(targetId);
                // continue recursion to the next element to ensure relevant nodes in the graph exist before adding the connections
                traverseRuntimeGraph(_processDefinition, targetId, _graph);
                connect(_graph, _currentId, currentType, targetId, targetType, "");
            }
            // process the activity's boundary events
            for (i=0; i<elementIds.length; i++) {
                // if there is an activity path connected to the boundary event, we follow it
                ( , , targetId) = _processDefinition.getBoundaryEventGraphDetails(elementIds[i]);
                if (targetId != "") {
                    targetType = _processDefinition.getElementType(targetId);
                    traverseRuntimeGraph(_processDefinition, targetId, _graph);
                    connect(_graph, _currentId, currentType, targetId, targetType, elementIds[i]); // use reserved colored slots for boundary event transitions
                }
            }
        }
        // INTERMEDIATE EVENT
        else if (currentType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) {
            if (_graph.activities[_currentId].exists) {
                return; // if the element has already been added, end recursion
            }
            // create a place for the current event
            addActivity(_graph, _currentId);
            ( , , , targetId) = _processDefinition.getIntermediateEventGraphDetails(_currentId);
            // process the successor, if there is one
            if (targetId != "") {
                targetType = _processDefinition.getElementType(targetId);
                // continue recursion to the next element to ensure relevant nodes in the graph exist before adding the connections
                traverseRuntimeGraph(_processDefinition, targetId, _graph);
                connect(_graph, _currentId, currentType, targetId, targetType, "");
            }
        }
        // GATEWAY
        else if (currentType == BpmModel.ModelElementType.GATEWAY) {
            if (_graph.transitions[_currentId].exists) {
                return; // if the element has already been added, end recursion
            }
            ( , bytes32[] memory outputs, BpmModel.GatewayType gatewayType, bytes32 defaultOutput) = _processDefinition.getGatewayGraphDetails(_currentId);
            BpmRuntime.TransitionType transitionType;
            if (gatewayType == BpmModel.GatewayType.XOR)
                transitionType = BpmRuntime.TransitionType.XOR;
            else if (gatewayType == BpmModel.GatewayType.OR)
                transitionType = BpmRuntime.TransitionType.OR;
            else if (gatewayType == BpmModel.GatewayType.AND)
                transitionType = BpmRuntime.TransitionType.AND;
            // create the current transition element
            addTransition(_graph, _currentId, transitionType);
            for (i=0; i<outputs.length; i++) {
                targetId = outputs[i];
                targetType = _processDefinition.getElementType(targetId);
                // continue recursion to the next element to ensure relevant nodes in the graph exist before adding the connections
                traverseRuntimeGraph(_processDefinition, targetId, _graph);
                bytes32 newElementId = connect(_graph, _currentId, currentType, targetId, targetType, "");
                // If the ProcessDefinition defines the target of the just made connection to be the default, it needs to be set in the graph
                // For the graph, however, the target can be the original target (=activity) or a newly inserted place (newElementId), if the PD's target is another gateway.
                if (defaultOutput == targetId) {
                    _graph.transitions[_currentId].defaultOutput = (newElementId != "") ? newElementId : targetId;
                }
            }
        }
    }

    /**
     * @dev Establishes a connection between two elements in the ProcessGraph identified by the given IDs and using the provided type declarations.
     * This function creates the "petry-net" graph structure and as such does not allow adding two places (or two transitions) directly. Therefore,
     * the following combinations require the generation of additional objects:
     * - activity -> activity: automatically generates a new NONE transition with two arcs to connect the activities
     * - gateway -> gateway: automatically generates a new artificial activity to connect the transitions
     * Note that regular and 'marked' transitions can be added to the outputs of an Activity in any order. It is not enforced how many transitions of any kind an Activity
     * can contain, but rather up to the algorithm creating the graph to build what is needed (see #traverseRuntimeGraph)
     * @param _graph a BpmRuntime.ProcessGraph
     * @param _sourceId the ID of the source object
     * @param _sourceType the BpmModel.ModelElementType of the source object
     * @param _targetId the ID of the target object
     * @param _targetType the BpmModel.ModelElementType of the target object
     * @param _sourceMarker an optional key which causes outputs of an activity to be marked (colored) and any involved transitions to only fire if the marker is activated
     */
    function connect(BpmRuntime.ProcessGraph storage _graph, bytes32 _sourceId, BpmModel.ModelElementType _sourceType, bytes32 _targetId, BpmModel.ModelElementType _targetType, bytes32 _sourceMarker)
        public
        returns (bytes32 newElementId)
    {
        if ((_sourceType == BpmModel.ModelElementType.ACTIVITY || _sourceType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) &&
            _targetType == BpmModel.ModelElementType.ACTIVITY || _targetType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) {
            // two places cannot be directly connected
            // so, a NONE transition is put between the two transitions
            newElementId = keccak256(abi.encodePacked(_sourceId, _targetId));
            addTransition(_graph, newElementId, BpmRuntime.TransitionType.NONE);
            // handle "colored" (marked) source activity outputs
            if (_sourceType == BpmModel.ModelElementType.ACTIVITY && !_sourceMarker.isEmpty()) {
                _graph.transitions[newElementId].marker = _sourceMarker;
            }
            connect(_graph.activities[_sourceId].node, _graph.transitions[newElementId].node); // input arc
            connect(_graph.transitions[newElementId].node, _graph.activities[_targetId].node); // output arc
        }
        // after the first if() above we know that one side of the connection is a transition, so next we handle the cases of connecting a transition with a non-transition (activity or event)
        else if (_sourceType == BpmModel.ModelElementType.ACTIVITY ||
                 _sourceType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) {
            // handle "colored" (marked) source activity outputs
            if (_sourceType == BpmModel.ModelElementType.ACTIVITY && !_sourceMarker.isEmpty()) {
                _graph.transitions[_targetId].marker = _sourceMarker;
            }
            connect(_graph.activities[_sourceId].node, _graph.transitions[_targetId].node);
        }
        else if (_targetType == BpmModel.ModelElementType.ACTIVITY ||
                 _targetType == BpmModel.ModelElementType.INTERMEDIATE_EVENT) {
            connect(_graph.transitions[_sourceId].node, _graph.activities[_targetId].node);
        }
        // at this point we know that both sides of the connection must be transitions
        else {
            // two transitions cannot be directly connected or the activation markers would not be passed on
            // so, an artificial activity (place) is put between the two transitions
            newElementId = keccak256(abi.encodePacked(_sourceId, _targetId));
            addActivity(_graph, newElementId);
            connect(_graph.transitions[_sourceId].node, _graph.activities[newElementId].node); // output arc
            connect(_graph.activities[newElementId].node, _graph.transitions[_targetId].node); // input arc
        }
    }

    /**
     * @dev Resets the provided runtime graph, i.e. removes any previously created activities and transitions.
     * @param _graph the process runtime graph to clean up
     */
    function clear(BpmRuntime.ProcessGraph storage _graph) public {
        uint i;
        for (i=0; i<_graph.activityKeys.length; i++) {
            delete _graph.activities[_graph.activityKeys[i]];
        }
        for (i=0; i<_graph.transitionKeys.length; i++) {
            delete _graph.transitions[_graph.transitionKeys[i]];
        }
        delete _graph.activityKeys;
        delete _graph.transitionKeys;
    }

    /**
     * @dev Adds an activity with the specified ID to the given process runtime graph.
     * @param _graph the process runtime graph
     * @param _id the activity ID to add
     */
    function addActivity(BpmRuntime.ProcessGraph storage _graph, bytes32 _id) public {
        if (!_graph.activities[_id].exists) {
            _graph.activityKeys.push(_id);
        }
        _graph.activities[_id].node.id = _id;
        _graph.activities[_id].exists = true;
    }

    /**
     * @dev Adds a transition with the specified ID to the given process runtime graph.
     * @param _graph the process runtime graph
     * @param _id the transition ID to add
     */
    function addTransition(BpmRuntime.ProcessGraph storage _graph, bytes32 _id, BpmRuntime.TransitionType _transitionType) public {
        if (!_graph.transitions[_id].exists) {
            _graph.transitionKeys.push(_id);
        }
        _graph.transitions[_id].node.id = _id;
        _graph.transitions[_id].transitionType = _transitionType;
        _graph.transitions[_id].exists = true;
    }

    /**
     * @dev Connects the two provided nodes by adding (b) to the outputs of (a) and (a) to the inputs of (b).
     * @param _a the source node
     * @param _b the target node
     */
    function connect(BpmRuntime.Node storage _a, BpmRuntime.Node storage _b) private {
        _a.outputs.push(_b.id);
        _b.inputs.push(_a.id);
    }

    /**
     * @dev Attempts to "fire" the given transition, i.e. if the required conditions are met, it consumes tokens from its input arcs
     * and produces tokens on its output arcs
     * @param _graph the process runtime graph providing the context for the transition
     * @param _transitionId the transition to fire
     * @return true if the transition was fired, false otherwise
     */
    function fireTransition(BpmRuntime.ProcessGraph storage _graph, bytes32 _transitionId)
        private
        returns (bool)
    {
        if (isTransitionEnabled(_graph, _transitionId)) {
            uint i;
            bytes32 marker = _graph.transitions[_transitionId].marker;
            bool coloredTransition = !marker.isEmpty();
            // NONE and AND transition types behave the same way: all tokens from incoming arcs are consumed and
            // all outgoing arcs are fired
            if (_graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.NONE ||
                _graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.AND) {

                // consume all "done" or colored tokens from input arcs
                for (i=0; i<_graph.transitions[_transitionId].node.inputs.length; i++) {
                    if (coloredTransition)
                        _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].markers[marker] = false;
                    else
                        _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].done = false;
                }
                // and produce "ready" tokens on all ouput arcs
                for (i=0; i<_graph.transitions[_transitionId].node.outputs.length; i++) {
                    _graph.activities[_graph.transitions[_transitionId].node.outputs[i]].ready = true;
                }
            }
            else if (_graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.XOR) {
                bool transitionFired;
                // consume a single "done" or colored token from input arcs
                for (i=0; i<_graph.transitions[_transitionId].node.inputs.length; i++) {
                    if (coloredTransition && _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].markers[marker]) {
                        _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].markers[marker] = false;
                        break;
                    }
                    else if (!coloredTransition && _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].done) {
                        _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].done = false;
                        break;
                    }
                }
                // and produce a single "ready" token on an ouput arc after evaluating the transition conditions
                for (i=0; i<_graph.transitions[_transitionId].node.outputs.length; i++) {
                    // the defaultOutput transition must be skipped when evaluating the conditions
                    if (_graph.transitions[_transitionId].defaultOutput == _graph.transitions[_transitionId].node.outputs[i]) {
                        continue;
                    }
                    if (ProcessInstance(_graph.processInstance).resolveTransitionCondition(_transitionId, _graph.transitions[_transitionId].node.outputs[i])) {
                        _graph.activities[_graph.transitions[_transitionId].node.outputs[i]].ready = true;
                        transitionFired = true;
                        break;
                    }
                }
                // if none of the outputs was activated, attempt to fire the default
                if (!transitionFired) {
                    if (_graph.transitions[_transitionId].defaultOutput != "") {
                        _graph.activities[_graph.transitions[_transitionId].defaultOutput].ready = true;
                    }
                    else {
                        revert(ErrorsLib.format(ErrorsLib.RUNTIME_ERROR(), "BpmRuntimeLib.fireTransition(BpmRuntime.ProcessGraph,bytes32)", "Firing XOR transition resulted in no traversable output and no default output configured.")); // no transition is true and no default output ... 
                    }
                }
            }

            // TODO need to review if anything above could lead to the transition as not having fired properly. For now always returning true.
            return true;
        }
        return false;
    }

    /**
     * @dev Executes a single iteration of the given ProcessGraph, i.e. it goes over all transitions and attempts to fire them based
     * on the current marker state of the network graph.
     * If after this iteration the new marker state would result in more transitions being fired, this function should be invoked again.
     * @param _graph the process runtime graph
     * @return the number of transitions that fired
     */
    function execute(BpmRuntime.ProcessGraph storage _graph) public returns (uint count) {
        for (uint i=0; i<_graph.transitionKeys.length; i++) {
            if (fireTransition(_graph, _graph.transitionKeys[i])) {
                count++;
            }
        }
    }

    /**
     * @dev Calls the execute() function on the given ProcessGraph, i.e. attempts to fire any possible transitions,
     * and reports back on completeness and open activities.
     * The following scenarios are possible:
     * (completed, !readyActivities): the process is done, there are no more activities to process
     * (!completed, readyActivities): the process is still active and there are activities ready for processing
     * (!completed, !readyActivities): the process is still active, but no activities are ready to be processed (which means there must be instances waiting for asynchronous events)
     * @param _graph the BpmRuntime.ProcessGraph
     * @return completed - if true, the graph cannot be executed any further
     * @return readyActivities - if true there are activities ready for processing, false otherwise
     */
    function isCompleted(BpmRuntime.ProcessGraph storage _graph) public returns (bool completed, bool readyActivities) {
        readyActivities = (execute(_graph) > 0) ? true : hasActivatableActivities(_graph);
        if (readyActivities)
            return (false, readyActivities);
        BpmRuntime.ActivityNode memory node;
        for (uint i=0; i<_graph.activityKeys.length; i++) {
            node = _graph.activities[_graph.activityKeys[i]];
            if (!node.done &&
                node.instancesTotal != node.instancesCompleted &&
                node.instancesTotal > 0) {
                completed = false;
                return (completed, readyActivities);
            }
        }
        completed = true;
    }

    /**
     * @dev Determines whether the given runtime instance has any activities that are waiting to be activated.
     * @param _graph the ProcessGraph
     * @return true if at least one activatable activity was found, false otherwise
     */
    function hasActivatableActivities(BpmRuntime.ProcessGraph storage _graph) public view returns (bool) {
        for (uint i=0; i<_graph.activityKeys.length; i++) {
            if (_graph.activities[_graph.activityKeys[i]].ready) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Determines whether the conditions are met to fire the provided transition.
     * If the transition is "colored" (has a specific marker), the marker's activation token on the transition's preceding activities are used to determine enabled status, otherwise the "done" token is used.
     * @param _graph the process runtime graph containing the transition
     * @param _transitionId the ID specifying the transition
     * @return true if the transitions can fire, false otherwise
     */
    function isTransitionEnabled(BpmRuntime.ProcessGraph storage _graph, bytes32 _transitionId) public view returns (bool enabled) {
        ErrorsLib.revertIf(!_graph.transitions[_transitionId].exists,
            ErrorsLib.RESOURCE_NOT_FOUND(), "BpmRuntimeLib.isTransitionEnabled", "A transition with the specified ID does not exist in the given graph");
        uint i;
        bytes32 marker = _graph.transitions[_transitionId].marker;
        bool coloredTransition = !marker.isEmpty();

        // AND and NONE transitions behave the same way: all incoming arcs must be activated to fire the transition
        if (_graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.NONE ||
            _graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.AND) {
            for (i=0; i<_graph.transitions[_transitionId].node.inputs.length; i++) {
                enabled = coloredTransition ?
                    _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].markers[marker] : _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].done;
                if (!enabled) {
                    return enabled;
                }
            }
            return true;
        }
        // XOR transitions require only a incoming arc to be activated in order to fire the transition
        else if (_graph.transitions[_transitionId].transitionType == BpmRuntime.TransitionType.XOR) {
            for (i=0; i<_graph.transitions[_transitionId].node.inputs.length; i++) {
                enabled = coloredTransition ?
                    _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].markers[marker] : _graph.activities[_graph.transitions[_transitionId].node.inputs[i]].done;
                if (enabled) {
                    return enabled;
                }
            }
        }
        return false;
    }

}