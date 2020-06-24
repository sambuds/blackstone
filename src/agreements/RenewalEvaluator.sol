pragma solidity ^0.5;

import "commons-collections/DataStorage.sol";
import "bpm-runtime/Application.sol";
import "bpm-runtime/ProcessInstance.sol";
import "agreements/ActiveAgreement.sol";
import "agreements/Renewable.sol";

contract RenewalEvaluator is Application {

    event LogRenewalResultNotificationTrigger(
        bytes32 indexed eventURN,
        address agreementAddress,
        address party,
        bool agreement_will_renew
    );

    bytes32 constant MAPPING_ID_RENEWAL_LOOP_BACK = "renewalLoopBack";
    
    bytes32 constant EVENT_ID_RENEWAL_EVALUATOR = "AN://agreement-renewal-evaluator";
    
    /**
     * @dev Accesses datetime and datetimeOffset parameters from the process instance via data mappings in order to
     * emit those value for an extermal system to consume and process.
     * @param _piAddress the address of the ProcessInstance in which context the application is invoked
     * @param _activityInstanceId the globally unique ID of the ActivityInstance invoking this contract
     * param _activityId the ID of the activity definition
     * param _txPerformer the address performing the transaction
     */
    function complete(address _piAddress, bytes32 _activityInstanceId, bytes32 /* _activityId */, address /* _txPerformer */) public {
        address dataStorage;
        bytes32 dataPath;
        
        address agreement = ProcessInstance(_piAddress).getActivityInDataAsAddress(_activityInstanceId, "agreement");

        // get renewal state boolean which drives renewalLoopBack for the process
        bool willRenew = Renewable(agreement).getRenewalState();

        // emit event for renewal result notification
        for (uint i = 0; i < ActiveAgreement(agreement).getNumberOfParties(); i++) {
            emit LogRenewalResultNotificationTrigger(
                EVENT_ID_RENEWAL_EVALUATOR,
                agreement,
                ActiveAgreement(agreement).getPartyAtIndex(i),
                willRenew
            );
        }

        // set the result on the process in order for gateway to evaluate the correct transition condition
        (dataStorage, dataPath) = ProcessInstance(_piAddress).resolveOutDataLocation(_activityInstanceId, MAPPING_ID_RENEWAL_LOOP_BACK);
        DataStorage(dataStorage).setDataValueAsBool(dataPath, willRenew);
    }
}