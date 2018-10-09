pragma solidity ^0.4.23;

import "commons-base/Named.sol";

import "agreements/Agreements.sol";

/**
 * @title Archetype Interface
 * @dev API for interaction with an agreement archetype
 */
contract Archetype is Named {

	/**
	 * @dev Adds the document specified by the given parameters to the archetype
	 * @param _name name
	 * @param _hoardAddress hoard address
	 * @param _secretKey secret key
	 * @return error code indicating success or failure
	 */
	function addDocument(bytes32 _name, bytes32 _hoardAddress, bytes32 _secretKey) external returns (uint error);

	/**
	 * @dev Adds parameter
	 * @param _parameterType parameter type (enum)
	 * @param _parameterName parameter name
	 * @return 
	 *	 		 BaseErrors.NO_ERROR() and position of parameter, if successful,
	 *		   BaseErrors.NULL_PARAM_NOT_ALLOWED() if _parameter is empty,
	 *		   BaseErrors.RESOURCE_ALREADY_EXISTS() if _parameter already exists
	 */
	function addParameter(Agreements.ParameterType _parameterType, bytes32 _parameterName) external returns (uint error, uint position);

	/**
	 * @dev Adds the given jurisdiction in the form of a country code and region identifier to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * @param _country a ISO- code, e.g. 'US'
	 * @param _region a region identifier from a IsoCountries contract
	 * @return error code indicating success or failure
	 * 				 key of the jurisdiction just added
	 */
	function addJurisdiction(bytes2 _country, bytes32 _region) external returns (uint error, bytes32 key);

	/**
	 * @dev Gets description
	 * @return description
	 */
	function getDescription() external view returns (string description);

	/**
	 * @dev Gets price
	 * @return price
	 */
	function getPrice() external view returns (uint32);

	/**
	 * @dev Sets price
	 * @param _price price of archetype
	 */
	function setPrice(uint32 _price) external;

	/**
	 * @dev Gets Author
	 * @return author author
	 */
	function getAuthor() external view returns (address author);

	/**
	 * @dev Gets document with given name
	 * @param _name document name
	 * @return externalContent external content
	 */
	function getDocument(bytes32 _name) external view returns (uint error, bytes32 hoardAddress, bytes32 secretKey);

	/**
	 * @dev Gets number of parameters
	 * @return size number of parameters
	 */
	function getNumberOfParameters() external view returns (uint size);

	/**
	 * @dev Gets parameter at index
	 * @param _index index
	 * @return error error TBD
	 * @return customField parameter
	 */
	function getParameterAtIndex(uint _index) external view returns (uint error, bytes32 parameter);

	/**
	 * @dev Gets parameter data type
	 * @param _parameter parameter
	 * @return error error TBD
	 * @return position index of parameter
	 * @return parameterType parameter type
	 */
	function getParameterDetails(bytes32 _parameter) external view returns (uint position, Agreements.ParameterType parameterType);

	/**
	 * @dev Gets number of documents
	 * @return size number of documents
	 */
	function getNumberOfDocuments() external view returns (uint size);

	/**
	 * @dev Gets document name at index
	 * @param _index index
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.INDEX_OUT_OF_BOUNDS() if index is out of bounds
	 * @return name
	 */
	function getDocumentAtIndex(uint _index) external view returns (uint error, bytes32 name);

	/**
	 * @dev Returns the number jurisdictions for this archetype
	 * @return the number of jurisdictions
	 */
	function getNumberOfJurisdictions() external view returns (uint size);

	/**
	 * @dev Retrieves the key for the jurisdiction at the specified index
	 * @param _index the index position
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.INDEX_OUT_OF_BOUNDS() if index is out of bounds
	 * @return the key of the jurisdiction or an empty bytes32 if the index was out of bounds
	 */
	function getJurisdictionAtIndex(uint _index) external view returns (uint error, bytes32 key);

	/**
	 * @dev Returns information about the jurisdiction with the specified key
	 * @param _key the key identifying the jurisdiction
	 * @return the country and region identifiers (see IsoCountries), if the jurisdiction exists
	 */
	function getJurisdictionData(bytes32 _key) external view returns (bytes2 country, bytes32 region);

	/**
	 * @dev Returns the number governing archetypes for this archetype
	 * @return the number of governing archetypes
	 */
	function getNumberOfGoverningArchetypes() external view returns (uint size);

	/**
	 * @dev Retrieves the address for the governing archetype at the specified index
	 * @param _index the index position
	 * @return the address for the governing archetype
	 */
	function getGoverningArchetypeAtIndex(uint _index) external view returns (address archetypeAddress);

	/**
	 * @dev Returns information about the governing archetype with the specified address
	 * @param _archetype the governing archetype address
	 * @return the name of the governing archetype
	 */
	function getGoverningArchetypeData(address _archetype) external view returns (string archetypeName);

	/**
	 * @dev Returns all governing archetype address for this archetype
	 * @return the address array containing all governing archetypes
	 */
	function getGoverningArchetypes() external view returns (address[]);

	/**
	 * @dev Returns the address of the ProcessDefinition that orchestrates the agreement formation.
	 * @return the address of a ProcessDefinition
	 */
	function getFormationProcessDefinition() external view returns (address);

	/**
	 * @dev Returns the address of the ProcessDefinition that orchestrates the agreement execution.
	 * @return the address of a ProcessDefinition
	 */
	function getExecutionProcessDefinition() external view returns (address);

	/**
	 * @dev Returns the active state
	 * @return true if active, false otherwise
	 */
	function isActive() external view returns (bool);

	/**
	 * @dev Returns the private state
	 * @return true if private, false otherwise
	 */
	function isPrivate() external view returns (bool);

	/**
	 * @dev Sets the successor this archetype. Setting a successor automatically deactivates this archetype.
	 * Fails if given successor is the same address as itself. 
	 * Fails if intended action will lead to two archetypes with their successors pointing to each other.
	 * @param _successor address of successor archetype
	 */
	function setSuccessor(address _successor) external;
	
	/**
	 * @dev Returns the successor of this archetype
	 * @return address of successor archetype
	 */
	function getSuccessor() external view returns (address);

	/**
	 * @dev Activates this archetype
	 */
	function activate() external;

	/**
	 * @dev Deactivates this archetype
	 */
	function deactivate() external;
}
