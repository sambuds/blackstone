pragma solidity ^0.4.23;

import "commons-base/BaseErrors.sol";
import "commons-base/ErrorsLib.sol";
import "commons-utils/ArrayUtilsAPI.sol";
import "commons-utils/TypeUtilsAPI.sol";
import "commons-utils/DataTypes.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "documents-commons/Documents.sol";

import "agreements/Archetype.sol";

/**
 * @title DefaultArchetype
 * @dev Default agreements network archetype
 */
contract DefaultArchetype is Archetype {

	using ArrayUtilsAPI for bytes32[];
	using TypeUtilsAPI for string;
	using MappingsLib for Mappings.Bytes32AddressMap;
	using MappingsLib for Mappings.Bytes32UintMap;

	struct Jurisdiction {
		bool exists;
		uint keyIdx;
		bytes2 country;
		bytes32 region;
	}

	string name;
	string description;
	uint32 price;
	address author;
	bool active;
	bool privateFlag;
	address successor;

	address formationProcessDefinition;
	address executionProcessDefinition;

	Mappings.Bytes32UintMap parameterTypes;
	bytes32[] parameters;

	mapping(bytes32 => Documents.HoardGrant) documents;
	bytes32[] documentsNames;

	mapping(bytes32 => Jurisdiction) jurisdictions;
	bytes32[] jurisdictionKeys;
	mapping(bytes2 => bytes32[]) jurisdictionHierarchy; // TODO this could be replaced with Mappings.Bytes2Bytes32Array later

	address[] governingArchetypes;

	/**
	 * @dev Constructor
	 * @param _name name
	 * @param _author author
	 * @param _description description
	 * @param _isPrivate determines if this archetype's documents are encrypted
	 * @param _active determines if this archetype is active
	 * @param _formationProcess the address of a ProcessDefinition that orchestrates the agreement formation
	 * @param _executionProcess the address of a ProcessDefinition that orchestrates the agreement execution
	 * @param _governingArchetypes array of governing archetype addresses (optional)
	 */
	constructor(uint32 _price, bool _isPrivate, bool _active, string _name, address _author, string _description, address _formationProcess, address _executionProcess, address[] _governingArchetypes) public {
		name = _name;
		author = _author;
		description = _description;
		price = _price;
		privateFlag = _isPrivate;
		active = _active;
		formationProcessDefinition = _formationProcess;
		executionProcessDefinition = _executionProcess;
		governingArchetypes = _governingArchetypes;
	}

	/**
	 * @dev Adds document
	 * @param _name name
	 * @param _hoardAddress hoard address
	 * @param _secretKey secret key
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.RESOURCE_ALREADY_EXISTS() if _name already exists in documentNames
	 */
	// TODO: validate for empty params once Solidity is updated
	// TODO: determine access (presumably only author should be able to call)
	function addDocument(bytes32 _name, bytes32 _hoardAddress, bytes32 _secretKey) external returns (uint error) {
		if (documentsNames.contains(_name))
			return BaseErrors.RESOURCE_ALREADY_EXISTS();

		documentsNames.push(_name);
		documents[_name] = Documents.HoardGrant(_hoardAddress, _secretKey);
		error = BaseErrors.NO_ERROR();
	}

	/**
	 * @dev Adds parameter
	 * @param _parameterType parameter type (enum)
	 * @param _parameterName parameter name
	 * @return 
	 *	 		 BaseErrors.NO_ERROR() and position of parameter, if successful,
	 *		   BaseErrors.NULL_PARAM_NOT_ALLOWED() if _parameter is empty,
	 *		   BaseErrors.RESOURCE_ALREADY_EXISTS() if _parameter already exists
	 */
	function addParameter(DataTypes.ParameterType _parameterType, bytes32 _parameterName) external returns (uint error, uint position) {
		if (_parameterName == "")
			return (BaseErrors.NULL_PARAM_NOT_ALLOWED(), 0);
		if (parameters.contains(_parameterName))
			return (BaseErrors.RESOURCE_ALREADY_EXISTS(), 0);

		parameters.push(_parameterName);
		parameterTypes.insert(_parameterName, uint8(_parameterType));
		return (BaseErrors.NO_ERROR(), parameterTypes.rows[_parameterName].keyIdx);
	}

	/**
	 * @dev Adds the given jurisdiction in the form of a country code and region identifier to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * If the region is empty, the jurisdiction will only reference the country and the regions will be emptied, i.e. any prior regions for that country will be removed.
	 * @param _country a ISO- code, e.g. 'US'
	 * @param _region a region identifier from a IsoCountries contract
	 * @return BaseErrors.NO_ERROR() if successful, and key of jurisdiction just added
	 * 	       BaseErrors.INVALID_PARAM_VALUE() if _country is not in the DataTypes enum,
	 */
	function addJurisdiction(bytes2 _country, bytes32 _region) external returns (uint error, bytes32 key) {
		if (_country == "")
			return (BaseErrors.NULL_PARAM_NOT_ALLOWED(), "");

		if (_region == "") {
			// for a jurisdiction represented by a country ONLY, we need to use an artificial bytes32 key
			key = keccak256(abi.encodePacked(_country));
			// remove all existing jurisdictions previously registered for this country
			deleteRegionsForCountry(_country);
		} else {
			key = _region;
			// establish hierarchical relationship, if it did not exist
			if (!jurisdictionHierarchy[_country].contains(_region)) {
				jurisdictionHierarchy[_country].push(_region);
			}
		}

		if (!jurisdictions[key].exists) {
			jurisdictions[key].exists = true;
			jurisdictions[key].keyIdx = jurisdictionKeys.push(key);
		}
		jurisdictions[key].country = _country;
		jurisdictions[key].region = _region;

		return (BaseErrors.NO_ERROR(), key);
	}

	/**
	 * @dev Private function to delete the regions of a country and also delete their "jurisdictionKeys" entries
	 * @param _country the country code 
	 */
	function deleteRegionsForCountry(bytes2 _country) private {
		uint lastPos;
		uint currentKeyIdx;
		for (uint i=0; i<jurisdictionHierarchy[_country].length; i++) {
			lastPos = jurisdictionKeys.length - 1;
			currentKeyIdx = jurisdictions[jurisdictionHierarchy[_country][i]].keyIdx;
			if (currentKeyIdx != lastPos) {
				// swap last element into position being deleted
				jurisdictionKeys[currentKeyIdx] = jurisdictionKeys[lastPos];
				// and update the swapped element's keyIdx
				jurisdictions[jurisdictionKeys[currentKeyIdx]].keyIdx = currentKeyIdx;
			}
			jurisdictionKeys.length--; // shortening the length also removes the last element, no need to specifically delete the entry (waste of gas)
			delete jurisdictions[jurisdictionHierarchy[_country][i]];
		}
		delete jurisdictionHierarchy[_country];
	}

	/**
	 * @dev Returns the archetype name
	 * @return the name
	 */
	function getName() public view returns (string) {
		return name;
	}

	/**
	 * @dev Gets description
	 * @return description
	 */
	function getDescription() external view returns (string) {
		return description;
	}

	/**
	 * @dev Gets price
	 * @return price
	 */
	function getPrice() external view returns (uint32) {
		return price;
	}

	/**
	 * @dev Sets price
	 * @param _price price of archetype
	 */
	function setPrice(uint32 _price) external {
		price = _price;
	}

	/**
	 * @dev Gets Author
	 * @return author author
	 */
	function getAuthor() external view returns (address) {
		return author;
	}

	/**
	 * @dev Gets document with given name
	 * @param _name document name
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.RESOURCE_NOT_FOUND() if documentsNames does not contain _name
	 * @return hoardAddress hoard address
	 * @return secretKey secret key
	 */
	function getDocument(bytes32 _name) external view returns (uint error, bytes32 hoardAddress, bytes32 secretKey) {
		error = BaseErrors.NO_ERROR();
		if (!documentsNames.contains(_name))
			error = BaseErrors.RESOURCE_NOT_FOUND();
		else {
			hoardAddress = documents[_name].hoardAddress;
			secretKey = documents[_name].secretKey;
		}
	}

	/**
	 * @dev Gets number of parameters
	 * @return size number of parameters
	 */
	function getNumberOfParameters() external view returns (uint size) {
		return parameters.length;
	}

	/**
	 * @dev Gets parameter at index
	 * @param _index index
	 * @return error error TBD
	 * @return parameter parameter
	 */
	function getParameterAtIndex(uint _index) external view returns (uint error, bytes32 parameter) {
		error = BaseErrors.NO_ERROR();
		if (_index >= parameters.length)
			error = BaseErrors.INDEX_OUT_OF_BOUNDS();
		else
			parameter = parameters[_index];
	}

	/**
	 * @dev Gets parameter data type
	 * @param _parameter parameter
	 * @return error error TBD
	 * @return position index of parameter
	 * @return parameterType parameter type
	 */
    function getParameterDetails(bytes32 _parameter) external view returns (uint position, DataTypes.ParameterType parameterType) {
        // the index of the parameterTypes Map correspond to the order of entry during creation and therefore can be used as an index for sorting
        position = parameterTypes.rows[_parameter].keyIdx;
        parameterType = DataTypes.ParameterType(parameterTypes.rows[_parameter].value);
    }

	/**
	 * @dev Gets number of documents
	 * @return size number of documents
	 */
	function getNumberOfDocuments() external view returns (uint size) {
		return documentsNames.length;
	}

	/**
	 * @dev Gets document name at index
	 * @param _index index
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.INDEX_OUT_OF_BOUNDS() if index is out of bounds
	 * @return name
	 */
	function getDocumentAtIndex(uint _index) external view returns (uint error, bytes32 documentName) {
		error = BaseErrors.NO_ERROR();
		if (_index >= documentsNames.length)
			error = BaseErrors.INDEX_OUT_OF_BOUNDS();
		else
			documentName = documentsNames[_index];
	}

	/**
	 * @dev Returns the address of the ProcessDefinition that orchestrates the agreement formation.
	 * @return the address of a ProcessDefinition
	 */
	function getFormationProcessDefinition() external view returns (address) {
		return formationProcessDefinition;
	}

	/**
	 * @dev Returns the number jurisdictions for this archetype
	 * @return the number of jurisdictions
	 */
	function getNumberOfJurisdictions() external view returns (uint size) {
		size = jurisdictionKeys.length;
	}

	/**
	 * @dev Retrieves the key for the jurisdiction at the specified index
	 * @param _index the index position
	 * @return error BaseErrors.NO_ERROR() or BaseErrors.INDEX_OUT_OF_BOUNDS() if index is out of bounds
	 * @return the key of the jurisdiction or an empty bytes32 if the index was out of bounds
	 */
	function getJurisdictionAtIndex(uint _index) external view returns (uint error, bytes32 key) {
		error = BaseErrors.NO_ERROR();
		if (_index >= jurisdictionKeys.length)
			error = BaseErrors.INDEX_OUT_OF_BOUNDS();
		else
			key = jurisdictionKeys[_index];
	}

	/**
	 * @dev Returns information about the jurisdiction with the specified key
	 * @param _key the key identifying the jurisdiction
	 * @return the country and region identifiers (see IsoCountries), if the jurisdiction exists
	 */
	function getJurisdictionData(bytes32 _key) external view returns (bytes2 country, bytes32 region) {
		country = jurisdictions[_key].country;
		region = jurisdictions[_key].region;
	}

	/**
	 * @dev Returns the number governing archetypes for this archetype
	 * @return the number of governing archetypes
	 */
	function getNumberOfGoverningArchetypes() external view returns (uint size) {
		return governingArchetypes.length;
	}

	/**
	 * @dev Retrieves the address for the governing archetype at the specified index
	 * @param _index the index position
	 * @return the address for the governing archetype
	 */
	function getGoverningArchetypeAtIndex(uint _index) external view returns (address archetypeAddress) {
		return governingArchetypes[_index];
	}

	/**
	 * @dev Returns information about the governing archetype with the specified address
	 * @param _archetype the governing archetype address
	 * @return the name of the governing archetype
	 */
	function getGoverningArchetypeData(address _archetype) external view returns (string archetypeName) {
		return Archetype(_archetype).getName();
	}

	/**
	 * @dev Returns all governing archetype address for this archetype
	 * @return the address array containing all governing archetypes
	 */
	function getGoverningArchetypes() external view returns (address[]) {
		return governingArchetypes;
	}

	/**
	 * @dev Returns the address of the ProcessDefinition that orchestrates the agreement execution.
	 * @return the address of a ProcessDefinition
	 */
	function getExecutionProcessDefinition() external view returns (address) {
		return executionProcessDefinition;
	}

	/**
	 * @dev Returns the active state
	 * @return true if active, false otherwise
	 */
	function isActive() external view returns (bool) {
		return active;
	}

	/**
	 * @dev Returns the private state
	 * @return true if private, false otherwise
	 */
	function isPrivate() external view returns (bool) {
		return privateFlag;
	}

	/**
	 * @dev Sets the successor this archetype. Setting a successor automatically deactivates this archetype.
	 * Fails if given successor is the same address as itself. 
	 * Fails if intended action will lead to two archetypes with their successors pointing to each other.
	 * @param _successor address of successor archetype
	 */
	function setSuccessor(address _successor) external {
		ErrorsLib.revertIf(_successor == address(this), ErrorsLib.INVALID_INPUT(), "DefaultArchetype.setSuccessor", "Archetype cannot be its own successor");
		ErrorsLib.revertIf(Archetype(_successor).getSuccessor() == address(this), ErrorsLib.INVALID_INPUT(), "DefaultArchetype.setSuccessor", "Successor circular dependency not allowed");
		active = false;
		successor = _successor;
	}

	/**
	 * @dev Returns the successor of this archetype
	 * @return address of successor archetype
	 */
	function getSuccessor() external view returns (address) {
		return successor;
	}

	/**
	 * @dev Activates this archetype
	 */
	function activate() external {
		ErrorsLib.revertIf(successor != 0x0, ErrorsLib.INVALID_STATE(), "DefaultArchetype.activate", "Archetype with a successor cannot be activated");
		active = true;
	}

	/**
	 * @dev Deactivates this archetype
	 */
	function deactivate() external {
		active = false;
	}
}
