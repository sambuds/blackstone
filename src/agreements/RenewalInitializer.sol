pragma solidity ^0.5;

import "commons-base/ErrorsLib.sol";
import "commons-base/BaseErrors.sol";
import "bpm-runtime/Application.sol";
import "bpm-runtime/ProcessInstance.sol";
import "agreements/ActiveAgreement.sol";
import "agreements/Renewable.sol";

contract RenewalInitializer is Application {

    bytes32 public constant DATA_ID_RENEWAL_LOOP_BACK = "renewalLoopBack";
    
    /**
     * @dev Resets the franchisee renewal votes for the current iteration of the process 
     * @param _piAddress the address of the ProcessInstance in which context the application is invoked
     * @param _activityInstanceId the globally unique ID of the ActivityInstance invoking this contract
     * param bytes32 activityId the ID of the activity definition
     * param _txPerformer the address performing the transaction
     */
    function complete(address _piAddress, bytes32 _activityInstanceId, bytes32 /* activityId */, address /* _txPerformer */) public {
        address agreement = ProcessInstance(_piAddress).getActivityInDataAsAddress(_activityInstanceId, "agreement");
        
        ErrorsLib.revertIf(agreement == address(0),
            ErrorsLib.INVALID_STATE(), "RenewalInitializer.complete", "Empty agreement address found on given ProcessInstance");
        
        Renewable(agreement).resetRenewalVotes();
        ProcessInstance(_piAddress).setActivityOutDataAsBool(_activityInstanceId, DATA_ID_RENEWAL_LOOP_BACK, false);
    }
}