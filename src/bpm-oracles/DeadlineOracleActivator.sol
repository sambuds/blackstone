pragma solidity ^0.5.12;

import "bpm-runtime/ProcessInstance.sol";
import "bpm-runtime/BpmRuntime.sol";

import "active-agreements/DeadlineOracle.sol";

contract DeadlineOracleActivator {

    DeadlineOracle deadlineOracle;

    constructor(address _oracle) public {
        deadlineOracle = DeadlineOracle(_oracle);
    }

    function triggerOracleInProcessInstance(address _piAddress) external returns (string memory) {

        ProcessInstance pi = ProcessInstance(_piAddress);
        // the last AI should always be the waiting (suspended) oracle
        bytes32 lastAiId = pi.getActivityInstanceAtIndex(pi.getNumberOfActivityInstances()-1);
        ( , , , , , uint8 state) = pi.getActivityInstanceData(lastAiId);
        if (state != uint8(BpmRuntime.ActivityInstanceState.SUSPENDED))
            return "The latest AI of the given process is not suspended!";

        deadlineOracle.completeOracle(lastAiId);

        return "Oracle triggered";
    }
}
