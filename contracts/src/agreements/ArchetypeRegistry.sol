pragma solidity ^0.4.23;

import "commons-management/Upgradeable.sol";

import "agreements/Archetype.sol";
import "agreements/Agreements.sol";

/**
 * @title ArchetypeRegistry Interface
 * @dev A contract interface to create and manage Archetype objects.
 */
contract ArchetypeRegistry is Upgradeable {

  event UpdateArchetypes(string name, address key);
  event UpdateArchetypeDocuments(string name, address key, bytes32 key2);
  event UpdateArchetypeParameters(string name, address key1, bytes32 key2);
	event UpdateArchetypeJurisdictions(string name, address key1, bytes32 key2);
	event UpdateArchetypePackages(string name, bytes32 key1);
	event UpdateArchetypePackageMap(string name, bytes32 key1, address key2);
	event UpdateGoverningArchetypes(string name, address key1, address key2);

	event LogArchetypeCreation(
		bytes32 indexed eventId,
		address archetype_address,
		string name,
		string description,
		uint32 price,
		address author,
		bool active,
		bool is_private,
		address successor,
		address formation_process_Definition,
		address execution_process_Definition
	);

	event LogArchetypeSuccessorUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		address successor
	);

	event LogArchetypePriceUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		uint32 price
	);

	event LogArchetypeActive(
		bytes32 indexed eventId,
		address archetype_address,
		bool active
	);

	event LogArchetypePackageCreation(
		bytes32 indexed eventId,
		bytes32 package_id,
		string name,
		string description,
		address author,
		bool is_private,
		bool active
	);

	event LogArchetypePackageActive(
		bytes32 indexed eventId,
		bytes32 package_id,
		bool active
	);

	event LogArchetypeToPackageUpdate(
		bytes32 indexed eventId,
		bytes32 package_id,
		address archetype_address,
		string archetype_name
	);

	event LogArchetypeParameterUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		bytes32 parameter_name,
		uint8 parameter_type,
		uint position		
	);

	event LogArchetypeDocumentUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		bytes32 document_key,
		bytes32 hoard_address,
		bytes32 secret_key
	);

	event LogArchetypeJurisdictionUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		bytes2 country,
		bytes32 region
	);

	event LogGoverningArchetypeUpdate(
		bytes32 indexed eventId,
		address archetype_address,
		address governing_archetype_address,
		string governing_archetype_name
	);

	bytes32 public constant EVENT_ID_ARCHETYPES = "AN://archetypes";
	bytes32 public constant EVENT_ID_ARCHETYPE_PACKAGES = "AN://archetype-packages";
	bytes32 public constant EVENT_ID_ARCHETYPE_PACKAGE_MAP = "AN://archetype-to-package";
	bytes32 public constant EVENT_ID_ARCHETYPE_PARAMETERS = "AN://archetype/parameters";
	bytes32 public constant EVENT_ID_ARCHETYPE_DOCUMENTS = "AN://archetype/documents";
	bytes32 public constant EVENT_ID_ARCHETYPE_JURISDICTIONS = "AN://archetype/jurisdictions";
	bytes32 public constant EVENT_ID_GOVERNING_ARCHETYPES = "AN://governing-archetypes";

	/**
	 * @dev Creates a new archetype
	 * @param _name name
	 * @param _author author
	 * @param _description description
	 * @param _price price
	 * @param _isPrivate determines if the archetype's documents are encrypted
	 * @param _active determines if this archetype is active
	 * @param _formationProcess the address of a ProcessDefinition that orchestrates the agreement formation
	 * @param _executionProcess the address of a ProcessDefinition that orchestrates the agreement execution
	 * @param _packageId id of package this archetype is part of (optional)
	 * @param _governingArchetypes array of archetype addresses which govern this archetype (optional)
	 * @return archetype - the new archetype's address, if successfully created
	 * Reverts if archetype address is already registered
	 */
	function createArchetype(
		uint32 _price, 
		bool _isPrivate, 
		bool _active, 
		string _name,
		address _author, 
		string _description,
		address _formationProcess, 
		address _executionProcess, 
		bytes32 _packageId, 
		address[] _governingArchetypes) 
		external returns (address archetype);

	/**
	 * @dev Adds archetype to package
	* @param _packageId the bytes32 package id
	 * @param _archetype the archetype address
	 * Reverts if package is not found
	 */
	function addArchetypeToPackage(bytes32 _packageId, address _archetype) public;

	/**
	 * @dev Adds the specified parameter to the archetype
	 * @param _parameterType parameter type (enum)
	 * @param _parameterName parameter name
	 * @return a return code indicating success or failure
	 */
	function addParameter(address _archetype, DataTypes.ParameterType _parameterType, bytes32 _parameterName) public returns (uint error);

	/**
	 * @dev Adds the specified parameters to the archetype
	 * @param _parameterTypes parameter type (enum) array
	 * @param _parameterNames parameter names array
	 * @return a return code indicating success or failure
	 */
	function addParameters(address _archetype, DataTypes.ParameterType[] _parameterTypes, bytes32[] _parameterNames) external returns (uint error);

	/**
	 * @dev Adds the given jurisdiction in the form of a country code and region identifier to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * @param _country a ISO- code, e.g. 'US'
	 * @param _region a region identifier from a IsoCountries contract
	 * @return a return code indicating success or failure
	 */
	function addJurisdiction(address _archetype, bytes2 _country, bytes32 _region) public returns (uint error);

	/**
	 * @dev Adds the given jurisdictions in the form of a country codes and region identifiers to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * @param _countries an array of a ISO- code, e.g. 'US'
	 * @param _regions an array of region identifiers from a IsoCountries contract
	 * @return a return code indicating success or failure
	 */
	function addJurisdictions(address _archetype, bytes2[] _countries, bytes32[] _regions) external returns (uint error);

	/**
	 * @dev Sets active to true for given archetype
	 * @param _archetype address of archetype
	 * @param _author address of author (must match the author of the archetype in order to activate)
	 */
	function activate(address _archetype, address _author) external;

	/**
	 * @dev Sets active to false for given archetype
	 * @param _archetype address of archetype
	 * @param _author address of author (must match the author of the archetype in order to deactivate)
	 */
	function deactivate(address _archetype, address _author) external;

	/**
	 * @dev Sets archetype successor
	 * @param _archetype address of archetype
	 * @param _successor address of successor
	 * @param _author address of author (must match the author of the archetype in order to set successor)
	 */
	function setArchetypeSuccessor(address _archetype, address _successor, address _author) external;

	/**
	 * @dev Returns archetype successor
	 * @param _archetype address of archetype
	 * @return address address of successor
	 */
	function getArchetypeSuccessor(address _archetype) external view returns (address);

	/**
		* @dev Gets number of archetypes
		* @return size size
		*/
	function getArchetypesSize() external view returns (uint size);

	/**
		* @dev Gets archetype address at given index
		* @param _index index
		* @return the archetype address
		*/
	function getArchetypeAtIndex(uint _index) external view returns (address archetype);

	/**
    * @dev Returns data about an archetype
		* @param _archetype the archetype address
		* @return name name
		* @return description description
		* @return price price
		* @return author author address
		* @return active bool
		* @return isPrivate bool
		* @return successor address
		* @return formationProcessDefinition
		* @return executionProcessDefinition
		*/
	function getArchetypeData(address _archetype) external view returns (
		string name,
		string description,
		uint32 price,
		address author,
		bool active,
		bool isPrivate,
		address successor,
		address formationProcessDefinition,
		address executionProcessDefinition
	);

	/**
	 * @dev Adds Hoard document to the given Archetype
	 * @param _archetype archetype
	 * @param _name name
	 * @param _hoardAddress hoard address
	 * @param _secretKey secret key
	 * @return error BaseErrors.NO_ERROR(), BaseErrors.RESOURCE_NOT_FOUND() _archetype does not exist, or see DefaultArchetype
	 */
	// TODO: validate for empty params once Solidity is updated
	// TODO: determine access (presumably only author should be able to call)
	function addDocument(address _archetype, bytes32 _name, bytes32 _hoardAddress, bytes32 _secretKey) external returns (uint error);

	/**
	 * @dev Sets price of given archetype
	 * @param _archetype archetype
	 * @param _price price
	 */
	function setArchetypePrice(address _archetype, uint32 _price) external;

	/**
	 * @dev Adds a new archetype package
	 * @param _name name
	 * @param _description description
	 * @param _author address of author (user account of organization)
	 * @param _isPrivate makes it a private package visible to only the author
	 * @param _active makes it a inactive package
	 * @return error BaseErrors.NO_ERROR(), BaseErrors.NULL_PARAM_NOT_ALLOWED(), BaseErrors.RESOURCE_ALREADY_EXISTS()
	 * @return id bytes32 id of package
	 */
	function createArchetypePackage(string _name, string _description, address _author, bool _isPrivate, bool _active) external returns (uint error, bytes32 id);

	/**
	 * @dev Sets active to true for given archetype package
	 * @param _id bytes32 id of archetype package
	 * @param _author address of author (must match the author of the archetype package in order to activate)
	 */
	function activatePackage(bytes32 _id, address _author) external;

	/**
	 * @dev Sets active to false for given archetype package
	 * @param _id bytes32 id of archetype package
	 * @param _author address of author (must match the author of the archetype package in order to deactivate)
	 */
	function deactivatePackage(bytes32 _id, address _author) external;

	/**
	 * @dev Gets number of archetype packages
	 * @return size size
	 */
	function getNumberOfArchetypePackages() external view returns (uint size);

	/**
	 * @dev Gets package id at index
	 * @param _index uint index
	 * @return id bytes32 id
	 */
	function getArchetypePackageAtIndex(uint _index) external view returns (bytes32 id);

	/**
	 * @dev Gets package data by id
	 * @param _id bytes32 package id
	 * @return name string
	 * @return description string
	 * @return author address
	 * @return isPrivate bool
	 * @return active bool
	 */
	function getArchetypePackageData(bytes32 _id) external view returns (string name, string description, address author, bool isPrivate, bool active);

	/**
	 * @dev Gets number of archetypes in given package
	 * @param _id id of the package
	 * @return size archetype count
	 */
	function getNumberOfArchetypesInPackage(bytes32 _id) external view returns (uint size);

	/**
	 * @dev Gets archetype address at index in package
	 * @param _id id of the package
	 * @param _index uint index
	 * @return archetype address of archetype
	 */
	function getArchetypeAtIndexInPackage(bytes32 _id, uint _index) external view returns (address archetype);

	/**
	 * @dev Get archetype data by package id and archetype address
	 * @param _id id of the package
	 * @param _archetype address of archetype
	 * @return archetypeName name of archetype
	 */
	function getArchetypeDataInPackage(bytes32 _id, address _archetype) external view returns (string archetypeName);

	/**
	 * @dev Determines whether given archetype address is in the package identified by the packageId
	 * @param _packageId id of the package
	 * @param _archetype address of archetype
	 * @return hasArchetype bool representing if archetype is in package
	 */
	function packageHasArchetype(bytes32 _packageId, address _archetype) external view returns (bool hasArchetype);

	/**
		* @dev Gets documents size for given Archetype
		* @param _archetype archetype
		* @return size size
		*/
	function getDocumentsByArchetypeSize(address _archetype) external view returns (uint size);

	/**
		* @dev Gets document name by Archetype At index
		* @param _archetype archetype
		* @param _index index
		* @return name name
		*/
	function getDocumentByArchetypeAtIndex(address _archetype, uint _index) external view returns (bytes32 name);

	/**
		* @dev Returns data about the document given the specified name
		* @param _archetype archetype
		* @param _name name
		* @return hoardAddress hoard address
		* @return secretKey secret key
		*/
	function getDocumentByArchetypeData(address _archetype, bytes32 _name) external view returns (bytes32 hoardAddress, bytes32 secretKey);

	/**
		* @dev Gets parameters size for given Archetype
		* @param _archetype archetype
		* @return size size
		*/
	function getParametersByArchetypeSize(address _archetype) external view returns (uint size);

	/**
		* @dev Gets parameter name by Archetype At index
		* @param _archetype archetype
		* @param _index index
		* @return name name
		*/
	function getParameterByArchetypeAtIndex(address _archetype, uint _index) external view returns (bytes32 name);

	/**
		* @dev Returns data about the parameter at with the specified name
		* @param _archetype archetype
		* @param _name name
		* @return position index of parameter
		* @return parameterType parameter type
		*/
	function getParameterByArchetypeData(address _archetype, bytes32 _name) external view returns (uint position, DataTypes.ParameterType parameterType);

	/**
		* @dev Returns the number of jurisdictions for the given Archetype
		* @param _archetype archetype address
		* @return the number of jurisdictions
		*/
	function getNumberOfJurisdictionsForArchetype(address _archetype) external view returns (uint size);

	/**
		* @dev Returns the jurisdiction key at the specified index for the given archetype
		* @param _archetype archetype address
		* @param _index the index of the jurisdiction
		* @return the jurisdiction primary key
		*/
	function getJurisdictionAtIndexForArchetype(address _archetype, uint _index) external view returns (bytes32 key);

	/**
		* @dev Returns data about the jurisdiction with the specified key in the given archetype
		* @param _archetype archetype address
		* @param _key the jurisdiction key
		* @return country the jurisdiction's country
		* @return region the jurisdiction's region
		*/
	function getJurisdictionDataForArchetype(address _archetype, bytes32 _key) external view returns (bytes2 country, bytes32 region);

	/**
	 * @dev Returns the number governing archetypes for the given archetype
	 * @param _archetype address of the archetype
	 * @return the number of governing archetypes
	 */
	function getNumberOfGoverningArchetypes(address _archetype) external view returns (uint size);
	
	/**
	 * @dev Retrieves the address of governing archetype at the specified index
	 * @param _archetype the address of the archetype
	 * @param _index the index position of its governing archetype
	 * @return the address for the governing archetype
	 */
	function getGoverningArchetypeAtIndex(address _archetype, uint _index) external view returns (address archetype);
	
	/**
	 * @dev Returns information about the governing archetype with the specified address
	 * @param _archetype the archetype address
	 * @param _governingArchetype the governing archetype address
	 * @return the name of the governing archetype
	 */
	function getGoverningArchetypeData(address _archetype, address _governingArchetype) external view returns (string name);
}
