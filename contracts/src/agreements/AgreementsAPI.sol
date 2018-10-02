pragma solidity ^0.4.23;

import "commons-standards/ERC165Utils.sol";
import "commons-auth/Governance.sol";
import "commons-auth/Organization.sol";

import "agreements/ActiveAgreement.sol";

/**
 * @title AgreementsAPI
 * @dev Library with functions around agreements
 */
library AgreementsAPI {

    /**
     * @dev Checks whether the given agreement is fully executed.
     * @param _agreement an ActiveAgreement
     * @return true if all parties have signed, false otherwise
     */
	function isFullyExecuted(ActiveAgreement _agreement) public view returns (bool) {
        uint timestamp;
		for (uint i=0; i<_agreement.getNumberOfParties(); i++) {
            ( , timestamp) = _agreement.getSignatureDetails(_agreement.getPartyAtIndex(i));
            if (timestamp == 0) {
                return false;
            }
        }
        return true;
	}

    /**
     * @dev Evaluates the msg.sender and tx.origin against the given agreement to determine if there is an authorized party/actor relationship.
     * @param _agreement an ActiveAgreement
     * @return actor - the address of either msg.sender or tx.origin depending on which one was authorized; 0x0 if authorization failed
     * @return party - the agreement party associated with the identified actor. This is typically the same as the actor, but can also contain
     * an Organization address if an Organization was registered as a party. 0x0 if authorization failed
     */
    function authorizePartyActor(ActiveAgreement _agreement) public view returns (address actor, address party) {

        address current;
        uint i;
        uint size = _agreement.getNumberOfParties();

        // try establish a direct party actor
		for (i=0; i<size; i++) {
            current = _agreement.getPartyAtIndex(i);
            if (current == msg.sender || current == tx.origin) {
    			actor = current;
                party = current; // for a direct match, the actor is the party
                return;
    		}
        }

        for (i=0; i<size; i++) {
            current = _agreement.getPartyAtIndex(i);
            if (ERC165Utils.implementsInterface(current, Governance.ERC165_ID_Organization())) {
                // The agreement might have a scope set for the agreement parties reserved field that represents the signatories
                // that needs to be used to authorize against the organization
                bytes32 scope = _agreement.resolveAddressScope(current, _agreement.DATA_FIELD_AGREEMENT_PARTIES(), _agreement);
                if (Organization(current).authorizeUser(msg.sender, scope)) {
                    actor = msg.sender;
                    party = current;
                    return;
                }
                else if (Organization(current).authorizeUser(tx.origin, scope)) {
                    actor = tx.origin;
                    party = current;
                    return;
                }
            }
        }
    }

}