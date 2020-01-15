pragma solidity ^0.5.12;

import "commons-auth/Permissioned.sol";

import "agreements/ActiveAgreement_v1_0_1.sol";

/**
 * @title ActiveAgreement Interface
 * @dev API for interaction with an ActiveAgreement. This contract represents the latest "version" of the interface by inheriting from past versions and guaranteeing
 * the existence of past event and function signatures.
 */
contract ActiveAgreement is ActiveAgreement_v1_0_1, Permissioned {

	// v1.1.0 LogAgreementCreation event with added field 'owner' and modified parameters ordering
	event LogAgreementCreation_v1_1_0(
		bytes32 indexed eventId,
		address	agreementAddress,
		address	archetypeAddress,
		address	creator,
		address	owner,
		string privateParametersFileReference,
		string eventLogFileReference,
		bool isPrivate,
		uint8 legalState,
		uint32 maxEventCount
	);

	// LogAgreementOwnerUpdate is used when retrofitting Agreement contracts < v1.1.0 with an owner value
	// see also #upgradeOwnerPermission(address)
	event LogAgreementOwnerUpdate(
		bytes32 indexed eventId,
		address agreementAddress,
		address owner
	);

    // Trigger a redaction of an agreement - this is intended to construct a queue of agreements to ultimately
    // expunge from the history on a re-written chain
    event LogAgreementRedaction(
        bytes32 indexed eventId,
        int __DELETE__,
        address agreementAddress
    );

 	bytes32 public constant ROLE_ID_OWNER = keccak256(abi.encodePacked("agreement.owner"));
 	bytes32 public constant ROLE_ID_LEGAL_STATE_CONTROLLER = keccak256(abi.encodePacked("agreement.legalStateController"));
    // This is a placeholder value for the marker field - it could be anything
    int constant DELETION = 0;

	/**
	 * @dev Initializes this ActiveAgreement with the provided parameters. This function replaces the
	 * contract constructor, so it can be used as the delegate target for an ObjectProxy.
	 * @param _archetype archetype address
	 * @param _creator the account that created this agreement
	 * @param _owner the account that owns this agreement
	 * @param _privateParametersFileReference the file reference to the private parameters
	 * @param _isPrivate if agreement is private
	 * @param _parties the signing parties to the agreement
	 * @param _governingAgreements array of agreement addresses which govern this agreement
	 */
	function initialize(
		address _archetype,
		address _creator,
		address _owner,
		string calldata _privateParametersFileReference,
		bool _isPrivate,
		address[] calldata _parties,
		address[] calldata _governingAgreements)
		external;

	/**
	 * @dev Returns the owner
	 * @return the owner address
	 */
	function getOwner() external view returns (address);

	/**
	 * @dev Performs a redaction on this agreement, i.e. marks the agreement as 'obscured' or 'redacted' to external systems and
	 * represents a request for removal of the agreement.
	 * @return the resulting Agreements.LegalState of the agreement
	 */
    function redact() external returns (Agreements.LegalState);

}
