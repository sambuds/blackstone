pragma solidity ^0.5.12;

import "commons-base/ErrorsLib.sol";
import "commons-base/BaseErrors.sol";
import "bpm-runtime/Application.sol";
import "bpm-runtime/BpmService.sol";
import "bpm-runtime/ProcessInstance.sol";

contract DeadlineOracle is Application {

    // Be careful of naming conventions here due to how these are ran
    event LogDeadlineStarted(
        bytes32 indexed name,
        bytes32 indexed uuid,
        address oracle,
        address bpmService,
        address piAddress,
        address performer,
        uint currentTime,
        int deadline,
        bool completed
    );

    event LogDeadlineCompleted(
        bytes32 indexed name,
        bytes32 indexed uuid,
        address oracle,
        bool completed
    );

    bytes32 constant EVENT_ID_DEADLINE_ORACLE = "AN://oracles/monax/time/deadline";
    bytes32 constant MAPPING_ID_DEADLINE = "Deadline";
    BpmService bpmService;

    // stores ActivityInstance IDs (used as UUIDs) mapped to their ProcessInstances
    mapping(bytes32 => address) eventLog;

    /**
     * @dev Constructor to initialize the bpmService.
     * @param _service the address of the BpmService
     */
    constructor(address _service) public {
        bpmService = BpmService(_service);
    }

    /**
     * @dev Application function invoked from the BPM engine when this oracle contract is invoked for an ActivityInstance.
     * The activity instance ID and TX performer are registered the EventLog for an asynchronous completion at a later point.
     * This DeadlineOracle expects to have read access to a data mapping with the ID "Duration" containing a string that specifies
     * the time to wait. All information is then emitted via the LogDeadlineStarted event.
     * REVERTS if:
     * - the IN data mapping "Duration" cannot be accessed.
     * @param _piAddress the address of the ProcessInstance
     * @param _activityInstanceId the ID of an ActivityInstance
     * param _activityId the ID of the activity definition
     * @param _txPerformer the address which started the process transaction
     */
    function complete(address _piAddress, bytes32 _activityInstanceId, bytes32, address _txPerformer) public {
        int deadline = ProcessInstance(_piAddress).getActivityInDataAsInt(_activityInstanceId, MAPPING_ID_DEADLINE);
        eventLog[_activityInstanceId] = _piAddress;
        emit LogDeadlineStarted(EVENT_ID_DEADLINE_ORACLE, _activityInstanceId, address(this), address(bpmService), _piAddress, _txPerformer, block.timestamp, deadline, false);
    }

    /**
     * @dev Allows to complete the DeadlineOracle for a given UUID via an external call.
     * This triggers the completion of the ActivityInstance waiting for the external signal.
     * @param _uuid the ID of an ActivityInstance waiting for completion by this oracle contract.
     */
    function completeOracle(bytes32 _uuid) external {
        ErrorsLib.revertIf(eventLog[_uuid] == address(0),
            ErrorsLib.INVALID_INPUT(), "DeadlineOracle.completeOracle", "The provided ActivityInstance ID (UUID) is not registered");
        uint error = ProcessInstance(eventLog[_uuid]).completeActivity(_uuid, bpmService);
        if (error == BaseErrors.NO_ERROR()) {
            delete eventLog[_uuid];
            emit LogDeadlineCompleted(EVENT_ID_DEADLINE_ORACLE, _uuid, address(this), true);
        }
        else {
            emit LogDeadlineCompleted(EVENT_ID_DEADLINE_ORACLE, _uuid, address(this), false);
        }
    }

}
