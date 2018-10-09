pragma solidity ^0.4.23;

import "commons-events/EventListener.sol";
import "commons-management/Upgradeable.sol";
import "bpm-runtime/ProcessStateChangeListener.sol";

import "agreements/ActiveAgreement.sol";

/**
 * @title ActiveAgreementRegistry Interface
 * @dev A contract interface to create and manage Active Agreements.
 */
contract ActiveAgreementRegistry is EventListener, ProcessStateChangeListener, Upgradeable {

	event UpdateActiveAgreements(string name, address key);
	event UpdateActiveAgreementToParty(string name, address key1, address key2);
	event UpdateActiveAgreementCollections(string name, bytes32 key1);
	event UpdateActiveAgreementCollectionMap(string name, bytes32 key1, address key2);
	event UpdateGoverningAgreements(string name, address key1, address key2);

	// Vent specific events
	event LogAgreementCreation(
		bytes32 indexed eventId, 
		address agreementAddress, 
		address archetype, 
		string name, 
		address creator,
		bool isPrivate, 
		uint8 legalState,
		bytes32 hoardAddress,
		bytes32 hoardSecret
	);

	event LogAgreementFormationProcessUpdate(
		bytes32 indexed eventId, 
		address agreementAddress,
		address formationProcessInstance
	);

	event LogAgreementExecutionProcessUpdate(
		bytes32 indexed eventId, 
		address agreementAddress,
		address executionProcessInstance
	);

	event LogAgreementMaxEventCountUpdate(
		bytes32 indexed eventId,
		address agreementAddress, 
		uint32 maxNumberOfEvents
	);

	event LogAgreementEventLogReference(
		bytes32 indexed eventId,
		address agreementAddress, 
		bytes32 eventLogHoardAddress,
		bytes32 eventLogHoardSecret
	);

	event LogAgreementCollectionCreation(
		bytes32 indexed eventId,
		bytes32 id,
		string name,
		address author,
		uint8 collectionType,
		bytes32 packageId
	);

	event LogAgreementToCollectionMapUpdate(
		bytes32 indexed eventId,
		bytes32 collectionId,
		address agreementAddress,
		string agreementName,
		address archetypeAddress
	);

	event LogActiveAgreementToPartyMapUpdate(
		bytes32 indexed eventId,
		address agreementAddress,
		address party
	);

	event LogGoverningAgreementUpdate(
		bytes32 indexed eventId,
		address agreementAddress,
		address governingAgreementAddress,
		string governingAgreementName
	);

	event LogAgreementLegalStateUpdate(
		bytes32 indexed eventId,
		address agreementAddress,
		uint8 legalState
	);

	bytes32 public constant DATA_ID_AGREEMENT = "agreement";

	bytes32 public constant AGREEMENT_EVENT_ID = "AN://agreement";
	bytes32 public constant AGREEMENT_COLLECTION_EVENT_ID = "AN://agreement/collection";
	bytes32 public constant AGREEMENT_COLLECTION_MAP_EVENT_ID = "AN://agreement-to-collection";
	bytes32 public constant AGREEMENT_PARTY_MAP_EVENT_ID = "AN://agreement-to-party";
	bytes32 public constant GOVERNING_AGREEMENT_EVENT_ID = "AN://governing-agreement";

	/**
	 * @dev Creates an Active Agreement with the given parameters
	 * @param _archetype archetype
	 * @param _name name
	 * @param _creator address
	 * @param _hoardAddress Address of agreement params in hoard
	 * @param _hoardSecret Secret for hoard retrieval
	 * @param _isPrivate agreement is private
	 * @param _parties parties array
	 * @param _collectionId id of agreement collection (optional)
	 * @param _governingAgreements array of agreement addresses which govern this agreement (optional)
	 * @return activeAgreement - the new ActiveAgreement's address, if successfully created, 0x0 otherwise
	 * Reverts if:
	 * 	Agreement name or archetype address is empty
	 * 	Duplicate governing agreements are passed
	 * 	Agreement address is already registered
	 * 	Given collectionId does not exist
	 */
	function createAgreement(
		address _archetype,
		string _name, 
		address _creator, 
		bytes32 _hoardAddress, 
		bytes32 _hoardSecret,
		bool _isPrivate,
		address[] _parties, 
		bytes32 _collectionId, 
		address[] _governingAgreements) 
		external returns (address activeAgreement);

	/**
	 * @dev Sets the max number of events for this agreement
	 */
	function setMaxNumberOfEvents(address _agreement, uint32 _maxNumberOfEvents) external;

	/**
	 * @dev Adds an agreement to given collection
	 * @param _collectionId the bytes32 collection id
	 * @param _agreement agreement address
	 * Reverts if collection is not found
	 */
	function addAgreementToCollection(bytes32 _collectionId, address _agreement) public;

	/**
	 * @dev Creates a starts a ProcessInstance to handle the formation workflow as defined by the given agreement's archetype.
	 * @param _agreement an ActiveAgreement
	 * @return error - an error code indicating success or failure
	 * @return the address of the ProcessInstance, if successful
	 */
	function startFormation(ActiveAgreement _agreement) external returns (uint error, address processInstance);

	/**
	 * @dev Sets address scopes on the given ProcessInstance based on the scopes defined in the ActiveAgreement referenced in the ProcessInstance.
	 * Address scopes relying on a ConditionalData configuration are translated, so they work from the POV of the ProcessInstance.
	 * This function ensures that any scopes (roles) set for user/organization addresses on the agreement are adhered to in the process.
	 * @param _processInstance the ProcessInstance being configured
	 */
	function transferAddressScopes(ProcessInstance _processInstance) public;

	/**
	 * @dev Returns the BpmService address
	 * @return address the BpmService
	 */
	function getBpmService() external returns (address);

	/**
	 * @dev Returns the ArchetypeRegistry address
	 * @return address the ArchetypeRegistry
	 */
	function getArchetypeRegistry() external returns (address);

  /**
   * @dev Gets number of activeAgreements
   * @return size size
   */
  function getActiveAgreementsSize() external view returns (uint size);

  /**
   * @dev Gets activeAgreement address at given index
   * @param _index index
   * @return the Active Agreement address
   */
  function getActiveAgreementAtIndex(uint _index) external view returns (address activeAgreement);

  /**
   * @dev Gets parties size for given Active Agreement
   * @param _activeAgreement Active Agreement
   * @return size size
   */
	function getPartiesByActiveAgreementSize(address _activeAgreement) external view returns (uint size);

  /**
   * @dev Gets getPartyByActiveAgreementAtIndex
   * @param _activeAgreement Active Agreement
   * @param _index index
   * @return party party
   */
	function getPartyByActiveAgreementAtIndex(address _activeAgreement, uint _index) public view returns (address party);

    /**
     * @dev Returns data about the ActiveAgreement at the specified address
	 * @param _activeAgreement Active Agreement
	 * @return archetype - the agreement's archetype adress
	 * @return name - the name of the agreement
	 * @return creator - the creator of the agreement
	 * @return hoardAddress - address of the agreement parameters in hoard (only used when agreement is private)
	 * @return hoardSecret - secret for retrieval of hoard parameters
	 * @return eventLogHoardAddress - address of the agreement's event log in hoard
	 * @return eventLogHoardSecret - secret for retrieval of the hoard event log file
	 * @return maxNumberOfEvents - the maximum number of events allowed to be stored for this agreement
	 * @return isPrivate - whether the agreement's parameters are private, i.e. stored off-chain in hoard
	 * @return legalState - the agreement's Agreement.LegalState as uint8
	 * @return formationProcessInstance - the address of the process instance representing the formation of this agreement
	 * @return executionProcessInstance - the address of the process instance representing the execution of this agreement
	 */
	function getActiveAgreementData(address _activeAgreement) external view returns (address archetype, string name, address creator, bytes32 hoardAddress, bytes32 hoardSecret, bytes32 eventLogHoardAddress, bytes32 eventLogHoardSecret, uint maxNumberOfEvents, bool isPrivate, uint8 legalState, address formationProcessInstance, address executionProcessInstance);

    /**
	 * @dev Returns the number of agreement parameter entries.
	 * @return the number of parameters
	 */
	function getNumberOfAgreementParameters(address _address) external view returns (uint size);

    /**
	 * @dev Returns the process data ID at the specified index
	 * @param _pos the index
	 * @return the data ID
	 */
	function getAgreementParameterAtIndex(address _address, uint _pos) external view returns (bytes32 dataId);

    /**
	 * @dev Returns information about the process data entry for the specified process and data ID
	 * @param _address the active agreement
	 * @param _dataId the data ID
	 * @return (process,id,uintValue,bytes32Value,addressValue,boolValue)
	 */
	function getAgreementParameterDetails(address _address, bytes32 _dataId) external view returns (
			address process,
			bytes32 id,
			uint uintValue,
			int intValue,
			bytes32 bytes32Value,
			address addressValue,
			bool boolValue);

    /**
     * @dev Returns data about the given party's signature on the specified agreement.
	 * @param _activeAgreement the ActiveAgreement
	 * @param _party the signing party
	 * @return signedBy the actual signature authorized by the party
	 * @return signatureTimestamp the timestamp when the party has signed, or 0 if not signed yet
	 */
	function getPartyByActiveAgreementData(address _activeAgreement, address _party) external view returns (address signedBy, uint signatureTimestamp);

	/**
	 * @dev Updates the hoard address and secret for the event log of the specified agreement
	 * @param _activeAgreement Address of active agreement
	 * @param _eventLogHoardAddress New hoard address of event log for agreement
	 * @param _eventLogHoardSecret New hoard secret key of event log for agreement
	 */
	 function setEventLogReference(address _activeAgreement, bytes32 _eventLogHoardAddress, bytes32 _eventLogHoardSecret) external;

	 /**
 	 * @dev Creates a AgreementPartyAccount with the specified parameters and adds it to the ParticipantsManager
 	 * @param _accountsManager the ParticipantsManager address
	 * @param _id an identifier for the user
	 * @param _owner the owner of the user account
	 * @param _ecosystem the address of an Ecosystem to which the user account is connected
	 * @return an error code indicating success or failure
	 * @return userAccount user account address, or 0x0 if not successful
	 */
	function createUserAccount(address _accountsManager, bytes32 _id, address _owner, address _ecosystem) external returns (uint error, address userAccount);

	/**
	 * @dev Creates a new agreement collection
	 * @param _name name
	 * @param _author address of author
	 * @return an error code indicating success or failure
	 * @return id bytes32 id of package
	 */
	function createAgreementCollection(string _name, address _author, uint8 _collectionType, bytes32 _packageId) external returns (uint error, bytes32 id);

	/**
	 * @dev Gets number of agreement collections
	 * @return size size
	 */
	function getNumberOfAgreementCollections() external view returns (uint size);

	/**
	 * @dev Gets collection id at index
	 * @param _index uint index
	 * @return id bytes32 id
	 */
	function getAgreementCollectionAtIndex(uint _index) external view returns (bytes32 id);
	
	/**
	 * @dev Gets collection data by id
	 * @param _id bytes32 collection id
	 * @return name string
	 * @return author address
	 * @return collectionType type of collection
	 * @return packageId id of the archetype package
	 */
	function getAgreementCollectionData(bytes32 _id) external view returns (string name, address author, uint8 collectionType, bytes32 packageId);

	/**
	 * @dev Gets number of agreements in given collection
	 * @param _id id of the collection
	 * @return size agreement count
	 */
	function getNumberOfAgreementsInCollection(bytes32 _id) external view returns (uint size);

	/**
	 * @dev Gets agreement address at index in colelction
	 * @param _id id of the collection
	 * @param _index uint index
	 * @return agreement address of archetype
	 */
	function getAgreementAtIndexInCollection(bytes32 _id, uint _index) external view returns (address agreement);

	/**
	 * @dev Get agreement data by collection id and agreement address
	 * @param _id id of the collection
	 * @param _agreement address of agreement
	 * @return agreementName name of agreement
	 * @return archetype address of archetype
	 */
	function getAgreementDataInCollection(bytes32 _id, address _agreement) external view returns (string agreementName, address archetype);	

	/**
	 * @dev Returns the number governing agreements for given agreement
	 * @return the number of governing agreements
	 */
	function getNumberOfGoverningAgreements(address _agreement) external view returns (uint size);

	/**
	 * @dev Retrieves the address for the governing agreement at the specified index
	 * @param _agreement the address of the agreement
	 * @param _index the index position
	 * @return the address for the governing agreement
	 */
	function getGoverningAgreementAtIndex(address _agreement, uint _index) external view returns (address governingAgreement);

	/**
	 * @dev Returns information about the governing agreement with the specified address
	 * @param _agreement the agreement address
	 * @param _governingAgreement the governing agreement address
	 * @return the name of the governing agreement
	 */
	function getGoverningAgreementData(address _agreement, address _governingAgreement) external view returns (string name);
}
