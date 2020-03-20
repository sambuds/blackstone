pragma solidity ^0.5.12;

import "bpm-runtime/ProcessInstance.sol";
import "bpm-runtime/BpmRuntime.sol";

import "active-agreements/WaitOracle.sol";

contract WaitOracleActivator {

    WaitOracle waitOracle;

    constructor(address _oracle) public {
        waitOracle = WaitOracle(_oracle);
    }

    function triggerOracleInProcessInstance(address _piAddress) external returns (string memory) {

        ProcessInstance pi = ProcessInstance(_piAddress);
        // the last AI should always be the waiting (suspended) oracle
        bytes32 lastAiId = pi.getActivityInstanceAtIndex(pi.getNumberOfActivityInstances()-1);
        ( , , , , , uint8 state) = pi.getActivityInstanceData(lastAiId);
        if (state != uint8(BpmRuntime.ActivityInstanceState.SUSPENDED))
            return "The latest AI of the given process is not suspended!";

        waitOracle.completeOracle(lastAiId);

        return "Oracle triggered";
    }
}
