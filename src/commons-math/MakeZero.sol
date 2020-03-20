pragma solidity ^0.5.12;

import "bpm-runtime/Application.sol";
import "bpm-runtime/ProcessInstance.sol";

contract MakeZero is Application {

    /**
     * @dev Sets the OUT-data mapping ID "numberOut" to 0.
     * @param _piAddress the address of the ProcessInstance
     * @param _activityInstanceId the ID of an ActivityInstance
     * param _activityId the ID of the activity definition
     * param _txPerformer the address which started the process transaction
     */
    function complete(address _piAddress, bytes32 _activityInstanceId, bytes32, address) public {
        ProcessInstance(_piAddress).setActivityOutDataAsUint(_activityInstanceId, "numberOut", 0);
    }

}
