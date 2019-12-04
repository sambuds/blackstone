pragma solidity ^0.5.12;

import "commons-collections/AbstractDataStorage.sol";
import "commons-collections/AbstractAddressScopes.sol";
import "commons-events/DefaultEventEmitter.sol";
import "commons-management/AbstractDelegateTarget.sol";

import "agreements/ActiveAgreement_v1_0_2.sol";
import "agreements/AbstractActiveAgreement_v1_0_1.sol";
import "agreements/Agreements.sol";

/**
 * @title Abstract ActiveAgreement v1.0.2
 */
contract AbstractActiveAgreement_v1_0_2 is AbstractActiveAgreement_v1_0_1, ActiveAgreement_v1_0_2 {

    function getOwner() external view returns (address);

    /**
     * @dev Registers the msg.sender as having canceled the agreement.
     * An agreement with no parties can be unilaterally cancelled by its owner
     * During formation (legal states DRAFT and FORMULATED), the agreement can canceled unilaterally by one of the parties to the agreement.
     * During execution (legal state EXECUTED), the agreement can only be canceled if all parties agree to do so by invoking this function.
     * REVERTS if:
     * - the caller could not be authorized (see AgreementsAPI.authorizePartyActor())
     */
    function cancel() external {
        (address actor, address party) = AgreementsAPI.authorizePartyActor(address(this));

        doCancel(msg.sender, actor, party);
    }

    function redact() external returns (Agreements.LegalState) {
        ErrorsLib.revertIf(this.getOwner() != msg.sender, ErrorsLib.UNAUTHORIZED(),
            "DefaultActiveAgreement.redact()", "Only the agreement owner may request redaction");

        (address actor, address party) = AgreementsAPI.authorizePartyActor(address(this));

        // Attempt to cancel -
        doCancel(msg.sender, actor, party);

        if (legalState == Agreements.LegalState.CANCELED) {
            legalState = Agreements.LegalState.REDACTED;
            emit LogAgreementLegalStateUpdate(EVENT_ID_AGREEMENTS, address(this), uint8(legalState));
            emitEvent(EVENT_ID_STATE_CHANGED, address(this));
            // Trigger deletion from vent
            emit LogAgreementRedaction(EVENT_ID_AGREEMENTS, DELETION, address(this));
        }

        return legalState;
    }

    function doCancel(address sender, address actor, address party) private {
        // Allow owner to unilaterally cancel agreement with no parties
        // (e.g. a pen-and-paper signed legacy agreement)
        if (parties.length == 0 && this.getOwner() == sender) {
            setStateToCanceled();
            return;
        }

        // if the actor is empty at this point, the authorization is regarded as failed
        ErrorsLib.revertIf(actor == address(0), ErrorsLib.UNAUTHORIZED(),
            "DefaultActiveAgreement.doCancel()", "The caller is not authorized to cancel");


        if (legalState == Agreements.LegalState.DRAFT ||
        legalState == Agreements.LegalState.FORMULATED) {
            // unilateral cancellation is allowed before execution phase
            setStateToCanceled();
            // for cancellations we need to inform the registry
            emit LogActiveAgreementToPartyCancelationsUpdate(EVENT_ID_AGREEMENT_PARTY_MAP, address(this), party, actor, block.timestamp);
        }
        else if (legalState == Agreements.LegalState.EXECUTED) {
            // multilateral cancellation (timestamp == 0 => party has cancelled)
            if (cancellations[party].timestamp == 0) {
                cancellations[party].signee = actor;
                cancellations[party].timestamp = block.timestamp;
                emit LogActiveAgreementToPartyCancelationsUpdate(EVENT_ID_AGREEMENT_PARTY_MAP, address(this), party, actor, block.timestamp);
                for (uint i = 0; i < parties.length; i++) {
                    if (cancellations[parties[i]].timestamp == 0) {
                        break;
                    }
                    if (i == parties.length - 1) {
                        // All parties have registered their desire to cancel
                        setStateToCanceled();
                    }
                }
            }
        }
    }

    function setStateToCanceled() private {
        legalState = Agreements.LegalState.CANCELED;
        emit LogAgreementLegalStateUpdate(EVENT_ID_AGREEMENTS, address(this), uint8(legalState));
        emitEvent(EVENT_ID_STATE_CHANGED, address(this));
    }

}
