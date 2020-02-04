pragma solidity ^0.5.12;

import "bpm-runtime/Application.sol";
import "bpm-runtime/ProcessInstance.sol";

contract Decrement is Application {

    /**
     * @dev Reads the IN-data mapping ID "Number" from the BpmService, increments it by 1, and stores it back via an OUT-data mapping.
     * @param _piAddress the address of the ProcessInstance
     * @param _activityInstanceId the ID of an ActivityInstance
     * param _activityId the ID of the activity definition
     * param _txPerformer the address which started the process transaction
     */
    function complete(address _piAddress, bytes32 _activityInstanceId, bytes32, address) public {
        uint current = ProcessInstance(_piAddress).getActivityInDataAsUint(_activityInstanceId, "numberIn");
        ProcessInstance(_piAddress).setActivityOutDataAsUint(_activityInstanceId, "numberOut", current > 0 ? current-1 : 0); // TODO needs SafeMath lib
    }

}
