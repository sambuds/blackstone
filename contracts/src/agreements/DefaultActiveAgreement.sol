pragma solidity ^0.4.23;

import "commons-base/ErrorsLib.sol";
import "commons-utils/ArrayUtilsAPI.sol";
import "commons-utils/TypeUtilsAPI.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-collections/AbstractDataStorage.sol";
import "commons-collections/AbstractAddressScopes.sol";
import "commons-events/DefaultEventEmitter.sol";

import "agreements/Agreements.sol";
import "agreements/AgreementsAPI.sol";
import "agreements/Archetype.sol";
import "agreements/ActiveAgreement.sol";

contract DefaultActiveAgreement is ActiveAgreement, AbstractDataStorage, AbstractAddressScopes, DefaultEventEmitter {
	
	using ArrayUtilsAPI for address[];
	using TypeUtilsAPI for bytes32;
	using AgreementsAPI for ActiveAgreement;
	using MappingsLib for Mappings.Bytes32Bytes32Map;

	address archetype;
	string name;
	address creator;
	bool privateFlag;
	bytes32 hoardAddress;
	bytes32 hoardSecret;
	bytes32 eventLogHoardAddress;
	bytes32 eventLogHoardSecret;
	uint32 maxNumberOfEvents;
	address[] parties;
	Agreements.LegalState legalState = Agreements.LegalState.FORMULATED; //TODO we currently don't support a negotiation phase in the AN, so the agreement's prose contract is already formulated when the agreement is created.
	mapping(address => Agreements.Signature) signatures;
	mapping(address => Agreements.Signature) cancellations;
	address[] governingAgreements;

	/**
	 * @dev Constructor
	 * @param _archetype archetype address
	 * @param _name name
	 * @param _creator the account that created this agreement
	 * @param _hoardAddress the address of the prose document in Hoard
	 * @param _hoardSecret the secret to accessing the prose document in Hoard
	 * @param _isPrivate if agreement is private
	 * @param _parties the signing parties to the agreement
	 * @param _governingAgreements array of agreement addresses which govern this agreement (optional)
	 */
	constructor(
		address _archetype, 
		string _name, 
		address _creator, 
		bytes32 _hoardAddress, 
		bytes32 _hoardSecret,
		bool _isPrivate, 
		address[] _parties, 
		address[] _governingAgreements) public 
	{
		archetype = _archetype;
		name = _name;
		creator = _creator;
		hoardAddress = _hoardAddress;
		hoardSecret = _hoardSecret;
		privateFlag = _isPrivate;
		parties = _parties;
		governingAgreements = _governingAgreements;
	}

	/**
	 * @dev Returns the number governing agreements for this agreement
	 * @return the number of governing agreements
	 */
	function getNumberOfGoverningAgreements() external view returns (uint size) {
		return governingAgreements.length;
	}

	/**
	 * @dev Retrieves the address for the governing agreement at the specified index
	 * @param _index the index position
	 * @return the address for the governing agreement
	 */
	function getGoverningAgreementAtIndex(uint _index) external view returns (address agreementAddress) {
		return governingAgreements[_index];
	}

	/**
	 * @dev Returns information about the governing agreement with the specified address
	 * @param _agreement the governing agreement address
	 * @return the name of the governing agreement
	 */
	function getGoverningAgreementData(address _agreement) external view returns (string agreementName) {
		return ActiveAgreement(_agreement).getName();
	}

	/**
	 * @dev Gets name
	 * @return name name
	 */
	function getName() public view returns (string) {
		return name;
	}

	/**
	 * @dev Gets number of parties
	 * @return size number of parties
	 */
	function getNumberOfParties() external view returns (uint size) {
		return parties.length;
	}

	/**
	 * @dev Returns the party at the given index
	 * @param _index the index position
	 * @return the party's address or 0x0 if the index is out of bounds
	 */
	function getPartyAtIndex(uint _index) external view returns (address party) {
		if (_index < parties.length)
			return parties[_index];
	}

	/**
	 * @dev Returns the archetype
	 * @return the archetype address 
	 */
	function getArchetype() external view returns (address) {
		return archetype;
	}


	/**
	 * @dev Returns the Hoard Address
	 * @return the Hoard Address	 
	 */
	function getHoardAddress() external view returns (bytes32){
		return hoardAddress;
	}


	/**
	 * @dev Returns the Hoard Secret
	 * @return the Hoard Secret
	 */
	function getHoardSecret() external view returns (bytes32){
		return hoardSecret;
	}

	/**
	 * @dev Sets the max number of events for this agreement
	 */
	function setMaxNumberOfEvents(uint32 _maxNumberOfEvents) external {
		maxNumberOfEvents = _maxNumberOfEvents;
	}

	/**
	 * @dev Sets the Hoard Address and Hoard Secret for the Event Log
	 */
	function setEventLogReference(bytes32 _eventLogHoardAddress, bytes32 _eventLogHoardSecret) external {
		eventLogHoardAddress = _eventLogHoardAddress;
		eventLogHoardSecret = _eventLogHoardSecret;
		emitEvent(EVENT_ID_EVENT_LOG_UPDATED, this);
	}

	/**
	 * @dev Returns the Hoard Address and Hoard Secret for the Event Log
	 * @return the Hoard Address and Hoard Secret for the Event Log
	 */
	function getEventLogReference() external view returns (bytes32 retEventLogHoardAddress, bytes32 retEventLogHoardSecret) {
		retEventLogHoardAddress = eventLogHoardAddress;
		retEventLogHoardSecret = eventLogHoardSecret;
	}

	/**
	 * @dev Returns the max number of events for the event log
	 * @return the max number of events for the event log
	 */
	function getMaxNumberOfEvents() external view returns (uint) {
		return maxNumberOfEvents;
	}

	/**
	 * @dev Returns the creator
	 * @return the creator address
	 */
	function getCreator() external view returns (address){
		return creator;
	}

	/**
	 * @dev Returns the private flag
	 * @return the private flag 
	 */
	function isPrivate() external view returns (bool){
		return privateFlag;
	}

	/**
	 * @dev Applies the msg.sender or tx.origin as a signature to this agreement, if it can be authorized as a valid signee.
	 * The timestamp of an already existing signature is not overwritten in case the agreement is signed again!
	 * REVERTS if:
	 * - the caller could not be authorized (see AgreementsAPI.authorizePartyActor())
	 */
	function sign() external {

		address signee;
		address party;

		(signee, party) = ActiveAgreement(this).authorizePartyActor();

		// if the signee is empty at this point, the authorization is regarded as failed
		ErrorsLib.revertIf(signee == 0x0, ErrorsLib.UNAUTHORIZED(), "DefaultActiveAgreement.sign()", "The caller is not authorized to sign");

		// the signature is only applied, if no previous signature for the party exists
		if (signatures[party].timestamp == 0) {
			signatures[party].signee = signee;
			signatures[party].timestamp = block.timestamp;
			emitEvent(EVENT_ID_SIGNATURE_ADDED, this, party);
			if (ActiveAgreement(this).isFullyExecuted()) {
				legalState = Agreements.LegalState.EXECUTED;
				emitEvent(EVENT_ID_STATE_CHANGED, this);
			}
		}
	}

	/**
	 * @dev Returns the signee and timestamp of the signature of the given party.
	 * @param _party the signing party
	 * @return the address of the signee (if the party authorized a signee other than itself)
	 * @return the time of signing or 0 if the address is not a party to this agreement or has not signed yet
	 */
	function getSignatureDetails(address _party) external view returns (address signee, uint signatureTimestamp) {
		signee = signatures[_party].signee;
		signatureTimestamp = signatures[_party].timestamp;
	}

	/**
	 * @dev Returns whether the given account's signature is on the agreement.
	 * @param _signee The account to check
	 * @return true if the provided address is a recorded signature on the agreement, false otherwise
	 */
	function isSignedBy(address _signee) external view returns (bool) {
		// check the signedBy of all parties
		for (uint i=0; i<parties.length; i++) {
			if (signatures[parties[i]].signee == _signee)
				return true;
		}
		return false;
	}

	/**
	 * @dev Overriden method of DataStorage to return the agreement parties for special ID DATA_FIELD_AGREEMENT_PARTIES.
	 * @param _id the bytes32 ID of an address array
	 * @return the address array
	 */
	function getDataValueAsAddressArray(bytes32 _id) external view returns (address[]) {
		if (_id == DATA_FIELD_AGREEMENT_PARTIES) {
			return parties;
		}
		else {
			return dataStorageMap.get(_id).addressArrayValue;
		}
	}

	/**
	 * @dev Overrides DataStorage.getArrayLength(bytes32).
	 * Returns the number of parties for special ID DATA_FIELD_AGREEMENT_PARTIES. Otherwise behaves identical to DataStorage.getArrayLength(bytes32).
	 * @param _id the ID of the data field
	 * @return the size of the specified array
	 */
	function getArrayLength(bytes32 _id) public view returns (uint) {
		if (_id == DATA_FIELD_AGREEMENT_PARTIES) {
			return parties.length;
		}
		return super.getArrayLength(_id);
	}

	/**
	 * @dev Returns the legal state of this agreement
	 * @return the Agreements.LegalState as a uint
	 */
	function getLegalState() external view returns (uint8) {
		return uint8(legalState);
	}

	/**
	 * @dev Sets the legal state of this agreement to Agreements.LegalState.FULFILLED.
	 * Note: All other legal states are set by internal logic.
	 */
	function setFulfilled() external {
		// TODO this must only be allowed by an authorized account, e.g. SystemOwner which could be the registry
		legalState = Agreements.LegalState.FULFILLED;
		emitEvent(EVENT_ID_STATE_CHANGED, this);
	}

	/**
	 * @dev Registers the msg.sender as having canceled the agreement.
	 * During formation (legal states DRAFT and FORMULATED), the agreement can canceled unilaterally by one of the parties to the agreement.
	 * During execution (legal state EXECUTED), the agreement can only be canceled if all parties agree to do so by invoking this function.
	 * REVERTS if:
	 * - the caller could not be authorized (see AgreementsAPI.authorizePartyActor())
	 */ 
	function cancel() external {

		address actor;
		address party;

		(actor, party) = ActiveAgreement(this).authorizePartyActor();

		// if the actor is empty at this point, the authorization is regarded as failed
		ErrorsLib.revertIf(actor == 0x0, ErrorsLib.UNAUTHORIZED(), "DefaultActiveAgreement.sign()", "The caller is not authorized to cancel");

		if (legalState == Agreements.LegalState.DRAFT ||
			legalState == Agreements.LegalState.FORMULATED) {
			// unilateral cancellation is allowed before execution phase
			legalState = Agreements.LegalState.CANCELED;
			emitEvent(EVENT_ID_STATE_CHANGED, this);
		}
		else if (legalState == Agreements.LegalState.EXECUTED) {
			// multilateral cancellation
			if (cancellations[party].timestamp == 0) {
				cancellations[party].signee = actor;
				cancellations[party].timestamp = block.timestamp;
				for (uint i=0; i<parties.length; i++) {
					if (cancellations[parties[i]].timestamp == 0) {
						break;
					}
					if (i == parties.length-1) {
						legalState = Agreements.LegalState.CANCELED;
						emitEvent(EVENT_ID_STATE_CHANGED, this);
					}
				}
			}
		}
	}

}
