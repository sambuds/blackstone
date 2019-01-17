pragma solidity ^0.4.23;

import "commons-base/BaseErrors.sol";
import "commons-base/ErrorsLib.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-management/AbstractDbUpgradeable.sol";
import "bpm-model/ProcessDefinition.sol";

import "agreements/ArchetypeRegistry.sol";
import "agreements/ArchetypeRegistryDb.sol";
import "agreements/DefaultArchetype.sol";
import "agreements/Agreements.sol";

/**
 * @title DefaultArchetypeRegistry
 * @dev Creates and tracks archetypes
 */
contract DefaultArchetypeRegistry is Versioned(1,0,0), ArchetypeRegistry, AbstractDbUpgradeable {
	
	// SQLSOL metadata
	string constant TABLE_ARCHETYPES = "ARCHETYPES";
	string constant TABLE_ARCHETYPE_DOCUMENTS = "ARCHETYPE_DOCUMENTS";
	string constant TABLE_ARCHETYPE_PARAMETERS = "ARCHETYPE_PARAMETERS";
	string constant TABLE_ARCHETYPE_JURISDICTIONS = "ARCHETYPE_JURISDICTIONS";
	string constant TABLE_ARCHETYPE_PACKAGES = "ARCHETYPE_PACKAGES";
	string constant TABLE_ARCHETYPE_TO_PACKAGE = "ARCHETYPE_TO_PACKAGE";
	string constant TABLE_GOVERNING_ARCHETYPES = "GOVERNING_ARCHETYPES";

	// Temporary mapping to detect duplicates in governing archetypes
	mapping(address => uint) duplicateMap;

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
		external returns (address archetype)
	{
		ErrorsLib.revertIf(bytes(_name).length == 0 || _author == 0x0,
			ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultArchetypeRegistry.createArchetype", "Archetype name and author address must not be empty");
		verifyNoDuplicates(_governingArchetypes);
		archetype = new DefaultArchetype(_price, _isPrivate, _active, _name, _author, _description,  _formationProcess, _executionProcess, _governingArchetypes);
		registerArchetype(archetype, _name);
		for (uint i = 0; i < _governingArchetypes.length; i++) {
			emit UpdateGoverningArchetypes(TABLE_GOVERNING_ARCHETYPES, archetype, _governingArchetypes[i]);
			emit LogGoverningArchetypeUpdate(
				EVENT_ID_GOVERNING_ARCHETYPES, 
				archetype, 
				_governingArchetypes[i],
				Archetype(_governingArchetypes[i]).getName()
			);
		}
		if (_packageId != "") addArchetypeToPackage(_packageId, archetype);
	}

	function registerArchetype(address _archetype, string _name) internal {
		uint error = ArchetypeRegistryDb(database).addArchetype(_archetype, _name);
		ErrorsLib.revertIf(error != BaseErrors.NO_ERROR(), 
			ErrorsLib.RESOURCE_ALREADY_EXISTS(), "DefaultArchetypeRegistry.createArchetype", "Archetype already exists");
		emit LogArchetypeCreation(
			EVENT_ID_ARCHETYPES,
			_archetype,
			Archetype(_archetype).getName(),
			Archetype(_archetype).getDescription(),
			Archetype(_archetype).getPrice(),
			Archetype(_archetype).getAuthor(),
			Archetype(_archetype).isActive(),
			Archetype(_archetype).isPrivate(),
			Archetype(_archetype).getSuccessor(),
			Archetype(_archetype).getFormationProcessDefinition(),
			Archetype(_archetype).getExecutionProcessDefinition()
		);
		emit UpdateArchetypes(TABLE_ARCHETYPES, _archetype);
	}

	/**
	 * @dev Detects if governing archetypes array has duplicates and reverts accordingly
	 * TODO - Consider moving this util function to MappingsLib and creating a AddressUintMap data structure for checking dupes
	 * @param _archetypes the address[] array of governing archetypes
	 */
	function verifyNoDuplicates(address[] _archetypes) internal {
		for (uint i = 0; i < _archetypes.length; i++) {
			if (duplicateMap[_archetypes[i]] != 0) {
				duplicateMap[_archetypes[i]]++;
			} else {
				duplicateMap[_archetypes[i]] = 1;
			}
			if (duplicateMap[_archetypes[i]] > 1) {
				clearDuplicateMap(_archetypes);
				revert(ErrorsLib.format(ErrorsLib.INVALID_INPUT(), 
					"DefaultArchetypeRegistry.verifyNoDuplicates", 
					"Governing archetypes has duplicates"));
			}
		}
		clearDuplicateMap(_archetypes);
	}

	/**
	 * @dev Clears the temporary mapping that is used to check for duplicate governing archetypes
	 * @param _archetypes the address[] array of governing archetypes
	 */
	function clearDuplicateMap (address[] _archetypes) internal {
		for (uint i = 0; i < _archetypes.length; i++) {
			delete duplicateMap[_archetypes[i]];
		}
	}

	/**
	 * @dev Adds archetype to package
	 * @param _packageId the bytes32 package id
	 * @param _archetype the archetype address
	 * Reverts if package is not found
	 */
	function addArchetypeToPackage(bytes32 _packageId, address _archetype) public {
		uint error = ArchetypeRegistryDb(database).addArchetypeToPackage(_packageId, _archetype);
		ErrorsLib.revertIf(error != BaseErrors.NO_ERROR(), ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultArchetypeRegistry.addArchetypeToPackage", "Package not found");
		emit UpdateArchetypePackageMap(TABLE_ARCHETYPE_TO_PACKAGE, _packageId, _archetype);
		emit LogArchetypeToPackageUpdate(
			EVENT_ID_ARCHETYPE_PACKAGE_MAP,
			_packageId,
			_archetype,
			Archetype(_archetype).getName()
		);
	}

	/**
	 * @dev Adds parameter to archetype
	 * @param _archetype the archetype address
	 * @param _parameterType data type (enum)
	 * @param _parameterName the parameter name
	 * @return BaseErrors.NO_ERROR() if successful
	 * @return BaseErrors.RESOURCE_NOT_FOUND() if archetype is not found
	 * @return any error returned from the Archetype.addParameter() function
	 */
	function addParameter(address _archetype, DataTypes.ParameterType _parameterType, bytes32 _parameterName) public returns (uint error) {
		uint position;
		if (!ArchetypeRegistryDb(database).archetypeExists(_archetype))
			return BaseErrors.RESOURCE_NOT_FOUND();
		(error, position) = Archetype(_archetype).addParameter(_parameterType, _parameterName);
		if (error == BaseErrors.NO_ERROR()) {
			emit UpdateArchetypeParameters(TABLE_ARCHETYPE_PARAMETERS, _archetype, _parameterName);
			emit LogArchetypeParameterUpdate(
				EVENT_ID_ARCHETYPE_PARAMETERS,
				_archetype,
				_parameterName,
				uint8(_parameterType),
				position
			);
		}
	}

	/**
	 * @dev Adds the specified parameters to the archetype. If one of the parameters cannot be added, the operation aborts and returns that error code.
	 * @param _archetype the archetype address
	 * @param _parameterTypes the parameter types
	 * @param _parameterNames the parameter names
	 * @return BaseErrors.NO_ERROR() if succesful
	 * @return BaseErrors.RESOURCE_NOT_FOUND() if archetype is not found
	 * @return BaseErrors.INVALID_PARAM_STATE() if the lengths of the two arrays don't match
	 */
	function addParameters(address _archetype, DataTypes.ParameterType[] _parameterTypes, bytes32[] _parameterNames) external returns (uint error) {
		if (_parameterTypes.length != _parameterNames.length)
			return BaseErrors.INVALID_PARAM_STATE();
		for (uint i=0; i<_parameterTypes.length; i++) {
			error = addParameter(_archetype, _parameterTypes[i], _parameterNames[i]);
			if (error != BaseErrors.NO_ERROR())
				return;
		}
		return BaseErrors.NO_ERROR();
	}

	/**
	 * @dev Adds the given jurisdiction in the form of a country code and region identifier to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * @param _country a ISO-3166-1 code, e.g. 'US'
	 * @param _region a region identifier from a IsoCountries contract
	 * @return BaseErrors.NO_ERROR() if succesful
	 * @return BaseErrors.RESOURCE_NOT_FOUND() if archetype is not found
	 * @return any error returned from the Archetype.addJurisdiction() function
	 */
	function addJurisdiction(address _archetype, bytes2 _country, bytes32 _region) public returns (uint error) {
		if (!ArchetypeRegistryDb(database).archetypeExists(_archetype))
			return BaseErrors.RESOURCE_NOT_FOUND();
		bytes32 key;
		(error, key) = Archetype(_archetype).addJurisdiction(_country, _region);
		if (error == BaseErrors.NO_ERROR()) {
			emit UpdateArchetypeJurisdictions(TABLE_ARCHETYPE_JURISDICTIONS, _archetype, key);
			emit LogArchetypeJurisdictionUpdate(
				EVENT_ID_ARCHETYPE_JURISDICTIONS,
				_archetype,
				_country,
				_region
			);
		}
	}

	/**
	 * @dev Adds the given jurisdictions in the form of a country codes and region identifiers to this archetype.
	 * References codes defined via IsoCountries interface implementations.
	 * @param _countries an array of a ISO-3166-1 code, e.g. 'US'
	 * @param _regions an array of region identifiers from a IsoCountries contract
	 * @return BaseErrors.NO_ERROR() if succesful
	 * @return BaseErrors.RESOURCE_NOT_FOUND() if archetype is not found
	 * @return BaseErrors.INVALID_PARAM_STATE() if the lengths of the two arrays don't match
	 */
	function addJurisdictions(address _archetype, bytes2[] _countries, bytes32[] _regions) external returns (uint error) {
		if (_countries.length != _regions.length)
			return BaseErrors.INVALID_PARAM_STATE();
		for (uint i=0; i<_countries.length; i++) {
			error = addJurisdiction(_archetype, _countries[i], _regions[i]);
			if (error != BaseErrors.NO_ERROR())
				return;
		}
		return BaseErrors.NO_ERROR();
	}

	/**
	 * @dev Sets active to true for given archetype
	 * @param _archetype address of archetype
	 * @param _author address of author (must match the author of the archetype in order to activate)
	 */
	function activate(address _archetype, address _author) external {
		ErrorsLib.revertIf(_archetype == 0x0, ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultArchetypeRegistry.activate", "Arcehtype address must be supplied");
		ErrorsLib.revertIf(_author != Archetype(_archetype).getAuthor(), ErrorsLib.UNAUTHORIZED(), "DefaultArchetypeRegistry.activate", "Given author address is not authorized to activate archetype");
		Archetype(_archetype).activate();
		emit UpdateArchetypes(TABLE_ARCHETYPES, _archetype);
		emit LogArchetypeActive(EVENT_ID_ARCHETYPES, _archetype, true);
	}

	/**
	 * @dev Sets active to false for given archetype
	 * @param _archetype address of archetype
	 * @param _author address of author (must match the author of the archetype in order to deactivate)
	 */
	function deactivate(address _archetype, address _author) external {
		ErrorsLib.revertIf(_author != Archetype(_archetype).getAuthor(), ErrorsLib.UNAUTHORIZED(), "DefaultArchetypeRegistry.activate", "Given address is not authorized to deactivate archetype");
		Archetype(_archetype).deactivate();
		emit UpdateArchetypes(TABLE_ARCHETYPES, _archetype);
		emit LogArchetypeActive(EVENT_ID_ARCHETYPES, _archetype, false);
	}

	/**
	 * @dev Sets archetype successor
	 * @param _archetype address of archetype
	 * @param _successor address of successor
	 * @param _author address of author (must match the author of the archetype in order to set successor)
	 */
	function setArchetypeSuccessor(address _archetype, address _successor, address _author) external {
		ErrorsLib.revertIf(_archetype == 0x0, ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultArchetypeRegistry.setArchetypeSuccessor", "Archetype address must be supplied");
		ErrorsLib.revertIf(_author != Archetype(_archetype).getAuthor(), ErrorsLib.UNAUTHORIZED(), "DefaultArchetypeRegistry.setArchetypeSuccessor", "Given author address is not authorized to set successor");
		ErrorsLib.revertIf(_successor != 0x0 && !ArchetypeRegistryDb(database).archetypeExists(_successor), ErrorsLib.INVALID_INPUT(), "DefaultArchetypeRegistry.setArchetypeSuccessor", "Successor must be a valid archetype");
		Archetype(_archetype).setSuccessor(_successor);
		emit UpdateArchetypes(TABLE_ARCHETYPES, _archetype);
		emit LogArchetypeSuccessorUpdate(EVENT_ID_ARCHETYPES, _archetype, _successor);
	}

	/**
	 * @dev Returns archetype successor
	 * @param _archetype address of archetype
	 * @return address address of successor
	 */
	function getArchetypeSuccessor(address _archetype) external view returns (address) {
		ErrorsLib.revertIf(_archetype == 0x0, ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultArchetypeRegistry.getArchetypeSuccessor", "Archetype address must be supplied");
		return Archetype(_archetype).getSuccessor();
	}

	/**
		* @dev Gets number of archetypes
		* @return size size
		*/
	function getArchetypesSize() external view returns (uint size) {
			return ArchetypeRegistryDb(database).getNumberOfArchetypes();
	}

	/**
		* @dev Gets archetype address at given index
		* @param _index index
		* @return archetype archetype
		*/
	function getArchetypeAtIndex(uint _index) external view returns (address archetype) {
		uint error;
		(error, archetype) = ArchetypeRegistryDb(database).getArchetypeAtIndex(_index);
	}

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
	) {
		name = ArchetypeRegistryDb(database).getArchetypeName(_archetype);
		if (bytes(name).length != 0) {
			description = Archetype(_archetype).getDescription();
			price = Archetype(_archetype).getPrice();
			author = Archetype(_archetype).getAuthor();
			active = Archetype(_archetype).isActive();
			isPrivate = Archetype(_archetype).isPrivate();
			successor = Archetype(_archetype).getSuccessor();
			formationProcessDefinition = Archetype(_archetype).getFormationProcessDefinition();
			executionProcessDefinition = Archetype(_archetype).getExecutionProcessDefinition();
		}
	}

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
	function addDocument(address _archetype, bytes32 _name, bytes32 _hoardAddress, bytes32 _secretKey) external returns (uint error) {
		if (!ArchetypeRegistryDb(database).archetypeExists(_archetype))
			return BaseErrors.RESOURCE_NOT_FOUND();
		error = Archetype(_archetype).addDocument(_name, _hoardAddress, _secretKey);
		if (error == BaseErrors.NO_ERROR()) {
			emit UpdateArchetypeDocuments(TABLE_ARCHETYPE_DOCUMENTS, _archetype, _name);
			emit LogArchetypeDocumentUpdate(
				EVENT_ID_ARCHETYPE_DOCUMENTS,
				_archetype,
				_name,
				_hoardAddress,
				_secretKey
			);
		}
	}

	/**
	 * @dev Sets price of given archetype
	 * @param _archetype archetype
	 * @param _price price
	 */
	function setArchetypePrice(address _archetype, uint32 _price) external {
		Archetype(_archetype).setPrice(_price);
		emit UpdateArchetypes(TABLE_ARCHETYPES, _archetype);
		emit LogArchetypePriceUpdate(
			EVENT_ID_ARCHETYPES,
			_archetype,
			_price
		);
	}

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
	function createArchetypePackage(string _name, string _description, address _author, bool _isPrivate, bool _active) external returns (uint error, bytes32 id) {
		if (_author == 0x0) return (BaseErrors.NULL_PARAM_NOT_ALLOWED(), "");
		id = keccak256(abi.encodePacked(_name, _author, block.timestamp));
		error = ArchetypeRegistryDb(database).createPackage(id, _name, _description, _author, _isPrivate, _active);
		if (error == BaseErrors.NO_ERROR()) {
			emit UpdateArchetypePackages(TABLE_ARCHETYPE_PACKAGES, id);
			emit LogArchetypePackageCreation(EVENT_ID_ARCHETYPE_PACKAGES, id, _name, _description, _author, _isPrivate, _active);
		}
	}

	/**
	 * @dev Sets active to true for given archetype package
	 * @param _id bytes32 id of archetype package
	 * @param _author address of author (must match the author of the archetype package in order to activate)
	 */
	function activatePackage(bytes32 _id, address _author) external {
		ErrorsLib.revertIf(!ArchetypeRegistryDb(database).packageExists(_id), ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultArchetypeRegistry.activatePackage", "Package with given id not found");
		address packageAuthor;
		( , , packageAuthor, , ) = ArchetypeRegistryDb(database).getPackageData(_id);
		ErrorsLib.revertIf(_author != packageAuthor, ErrorsLib.UNAUTHORIZED(), "DefaultArchetypeRegistry.activatePackage", "Given address is not authorized to activate archetype package");
		ArchetypeRegistryDb(database).activatePackage(_id);
		emit UpdateArchetypePackages(TABLE_ARCHETYPE_PACKAGES, _id);
		emit LogArchetypePackageActive(EVENT_ID_ARCHETYPE_PACKAGES, _id, true);
	}

	/**
	 * @dev Sets active to false for given archetype package
	 * @param _id bytes32 id of archetype package
	 * @param _author address of author (must match the author of the archetype package in order to deactivate)
	 */
	function deactivatePackage(bytes32 _id, address _author) external {
		ErrorsLib.revertIf(!ArchetypeRegistryDb(database).packageExists(_id), ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultArchetypeRegistry.activatePackage", "Package with given id not found");
		address packageAuthor;
		( , , packageAuthor, , ) = ArchetypeRegistryDb(database).getPackageData(_id);
		ErrorsLib.revertIf(_author != packageAuthor, ErrorsLib.UNAUTHORIZED(), "DefaultArchetypeRegistry.activatePackage", "Given address is not authorized to deactivate archetype package");
		ArchetypeRegistryDb(database).deactivatePackage(_id);
		emit UpdateArchetypePackages(TABLE_ARCHETYPE_PACKAGES, _id);
		emit LogArchetypePackageActive(EVENT_ID_ARCHETYPE_PACKAGES, _id, false);
	}

	/**
	 * @dev Gets number of archetype packages
	 * @return size size
	 */
	function getNumberOfArchetypePackages() external view returns (uint size) {
		return ArchetypeRegistryDb(database).getNumberOfPackages();
	}

	/**
	 * @dev Gets package id at index
	 * @param _index uint index
	 * @return id bytes32 id
	 */
	function getArchetypePackageAtIndex(uint _index) external view returns (bytes32 id) {
		return ArchetypeRegistryDb(database).getPackageAtIndex(_index);
	}

	/**
	 * @dev Gets package data by id
	 * @param _id bytes32 package id
	 * @return name string
	 * @return description string
	 * @return author address
	 * @return isPrivate bool
	 * @return active bool
	 */
	function getArchetypePackageData(bytes32 _id) external view returns (string name, string description, address author, bool isPrivate, bool active) {
		(name, description, author, isPrivate, active) = ArchetypeRegistryDb(database).getPackageData(_id);
	}

	/**
	 * @dev Gets number of archetypes in given package
	 * @param _id id of the package
	 * @return size archetype count
	 */
	function getNumberOfArchetypesInPackage(bytes32 _id) external view returns (uint size) {
		return ArchetypeRegistryDb(database).getNumberOfArchetypesInPackage(_id);
	}

	/**
	 * @dev Gets archetype address at index in package
	 * @param _id id of the package
	 * @param _index uint index
	 * @return archetype address of archetype
	 */
	function getArchetypeAtIndexInPackage(bytes32 _id, uint _index) external view returns (address archetype) {
		return ArchetypeRegistryDb(database).getArchetypeAtIndexInPackage(_id, _index);
	}

	/**
	 * @dev Get archetype data by package id and archetype address
	 * Currently unused parameters were unnamed to avoid compiler warnings:
	 * param _id id of the package
	 * @param _archetype address of archetype
	 * @return archetypeName name of archetype
	 */
	function getArchetypeDataInPackage(bytes32 /*_id*/, address _archetype) external view returns (string archetypeName) {
		return DefaultArchetype(_archetype).getName();
	}
	
	/**
	 * @dev Determines whether given archetype address is in the package identified by the packageId
	 * @param _packageId id of the package
	 * @param _archetype address of archetype
	 * @return hasArchetype bool representing if archetype is in package
	 */
	function packageHasArchetype(bytes32 _packageId, address _archetype) external view returns (bool hasArchetype) {
		hasArchetype = false;
		uint count = ArchetypeRegistryDb(database).getNumberOfArchetypesInPackage(_packageId);
		for (uint i=0; i<count; i++) {
			if (ArchetypeRegistryDb(database).getArchetypeAtIndexInPackage(_packageId, i) == _archetype) {
				hasArchetype = true;
				break;
			}
		}
	}

	/**
	 * @dev Gets documents size for given Archetype
	 * @param _archetype archetype
	 * @return size size
	 */
	function getDocumentsByArchetypeSize(address _archetype) external view returns (uint size) {
		return Archetype(_archetype).getNumberOfDocuments();
	}

    /**
     * @dev Gets document name by Archetype At index
     * @param _archetype archetype
     * @param _index index
     * @return name name
     */
	function getDocumentByArchetypeAtIndex(address _archetype, uint _index) external view returns (bytes32 name) {
		uint error;
		(error, name) = Archetype(_archetype).getDocumentAtIndex(_index);
	}

    /**
     * @dev Returns data about the document at the specified address
	 * @param _archetype archetype
	 * @param _name name
	 * @return _hoardAddress hoard address
	 * @return _secretKey secret key
	 */
	function getDocumentByArchetypeData(address _archetype, bytes32 _name) external view returns (bytes32 hoardAddress, bytes32 secretKey) {
		uint error;
		(error, hoardAddress, secretKey) = Archetype(_archetype).getDocument(_name);
	}

    /**
     * @dev Gets parameter count for given Archetype
     * @param _archetype archetype
     * @return size size
     */
	function getParametersByArchetypeSize(address _archetype) external view returns (uint size) {
		return Archetype(_archetype).getNumberOfParameters();
	}

    /**
     * @dev Gets parameter name by Archetype At index
     * @param _archetype archetype
     * @param _index index
     * @return name name
     */
	function getParameterByArchetypeAtIndex(address _archetype, uint _index) external view returns (bytes32 name) {
		uint error;
		(error, name) = Archetype(_archetype).getParameterAtIndex(_index);
	}

    /**
     * @dev Returns data about the parameter at with the specified name
	 * @param _archetype archetype
	 * @param _name name
	 * @return position index of parameter
	 * @return parameterType parameter type
	 */
    function getParameterByArchetypeData(address _archetype, bytes32 _name) external view returns (uint position, DataTypes.ParameterType parameterType) {
        return Archetype(_archetype).getParameterDetails(_name);
    }

    /**
     * @dev Returns the number of jurisdictions for the given Archetype
     * @param _archetype archetype address
     * @return the number of jurisdictions
     */
	function getNumberOfJurisdictionsForArchetype(address _archetype) external view returns (uint size) {
		return Archetype(_archetype).getNumberOfJurisdictions();
	}

    /**
     * @dev Returns the jurisdiction key at the specified index for the given archetype
     * @param _archetype archetype address
     * @param _index the index of the jurisdiction
     * @return the jurisdiction primary key
     */
	function getJurisdictionAtIndexForArchetype(address _archetype, uint _index) external view returns (bytes32 key) {
		uint error;
		(error, key) = Archetype(_archetype).getJurisdictionAtIndex(_index);
	}

    /**
     * @dev Returns data about the jurisdiction with the specified key in the given archetype
	 * @param _archetype archetype address
	 * @param _key the jurisdiction key
	 * @return country the jurisdiction's country
	 * @return region the jurisdiction's region
	 */
	function getJurisdictionDataForArchetype(address _archetype, bytes32 _key) external view returns (bytes2 country, bytes32 region) {
		return Archetype(_archetype).getJurisdictionData(_key);
	}

	/**
	 * @dev Returns the number governing archetypes for the given archetype
	 * @param _archetype address of the archetype
	 * @return the number of governing archetypes
	 */
	function getNumberOfGoverningArchetypes(address _archetype) external view returns (uint size) {
		return Archetype(_archetype).getNumberOfGoverningArchetypes();
	}

	/**
	 * @dev Retrieves the address of governing archetype at the specified index
	 * @param _archetype the address of the archetype
	 * @param _index the index position of its governing archetype
	 * @return the address for the governing archetype
	 */
	function getGoverningArchetypeAtIndex(address _archetype, uint _index) external view returns (address governingArchetype) {
		return Archetype(_archetype).getGoverningArchetypeAtIndex(_index);
	}

	/**
	 * @dev Returns information about the governing archetype with the specified address
	 * @param _archetype the archetype address
	 * @param _governingArchetype the governing archetype address
	 * @return the name of the governing archetype
	 */
	function getGoverningArchetypeData(address _archetype, address _governingArchetype) external view returns (string name) {
		return Archetype(_archetype).getGoverningArchetypeData(_governingArchetype);
	}

}
