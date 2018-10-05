pragma solidity ^0.4.23;

import "commons-base/SystemOwned.sol";
import "commons-utils/TypeUtilsAPI.sol";
import "commons-standards/IsoCountries100.sol";
import "commons-management/AbstractDbUpgradeable.sol";

import "agreements/Agreements.sol";
import "agreements/DefaultArchetype.sol";
import "agreements/ArchetypeRegistry.sol";
import "agreements/ArchetypeRegistryDb.sol";
import "agreements/DefaultArchetypeRegistry.sol";

contract ArchetypeRegistryTest {

	string constant SUCCESS = "success";
	bytes32 EMPTY = "";
	IsoCountries100 isoCountries;

	ArchetypeRegistry public registry = new DefaultArchetypeRegistry(); // public for testing getArchetypeData 
	ArchetypeRegistryDb registryDb = new ArchetypeRegistryDb();
	address falseAddress = 0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa;

	string name = "archetype name";
	string description = "this string description is more than thirty-two characters";
	bytes32 documentName = "documentName";
	bytes32 hoardAddress = "hoardAddress";
	bytes32 secretKey = "secretKey";
	bytes32 parameter = "parameter";
	Agreements.ParameterType parameterType = Agreements.ParameterType.BOOLEAN;

	address droneArchetype = 0x0;
	address droneArchetype2 = 0x0;
	bytes32 fakePackageId = "ABC123";
	bytes32 dronePackageId = "";
	string dronePackageName = "drone rental package";
	string dronePackageDesc = "a package of archetypes for renting drones in new york";
	bytes32 buildingPackageId = "";
	string buildingPackageName = "building package";
	string buildingPackageDesc = "a package of archetypes for constructing buildings in new york";
	address packageAuthor = 0xaBAbAbaABAbAbAaBabbbBbBbbAAAaaaaaaaAaAaA;

	address employmentArchetype;
	address ndaArchetype;

	address[] addrArrayWithDupes;
	address[] addrArrayWithoutDupes;
	address[] ndaGovArchetypes;
	address[] emptyArray;

	// TODO: Reinstate the constructor when the issue below is resolved.
	// ISSUE: EPM does not pass params via a constructor when it deploys a contract from binary.
	// So had to add a getter/setter below instead of using constructor. See AN-307
	// constructor(address _isoCountries) {
	// 	isoCountries = IsoCountries100(_isoCountries);
	// }

	function setIsoCountries(address _isoCountries) external {
		isoCountries = IsoCountries100(_isoCountries);
	}

	function getIsoCountries() external view returns (address) {
		return address(isoCountries);
	}

	/**
	 * @dev Covers the creation and setup of an archetype
	 */
	function testArchetypeCreation() external returns (string) {

		SystemOwned(registryDb).transferSystemOwnership(registry);
		AbstractDbUpgradeable(registry).acceptDatabase(registryDb);

		uint error;
		address archetype;

		if (address(registry).call(bytes4(keccak256(abi.encodePacked(
			"createArchetype(bytes32,address,string,bool,bool,address,address,bytes32,address[])"))),
			EMPTY, falseAddress, description, false, true, 0x0, 0x0, EMPTY, addrArrayWithDupes)) 
		{
			return "Exp. NULL_PARAM_NOT_ALLOWED";
		}

		if (address(registry).call(bytes4(keccak256(abi.encodePacked(
			"createArchetype(bytes32,address,string,bool,bool,address,address,bytes32,address[])"))),
			name, 0x0, description, false, true, 0x0, 0x0, EMPTY, addrArrayWithDupes)) 
		{
			return "Creating archetype with empty author expected to fail with NULL_PARAM_NOT_ALLOWED";
		}

		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, addrArrayWithDupes);
		if (archetype == 0x0) return "Archetype address is empty after creation";

		if (registry.getArchetypesSize() != 1) return "Exp. 1";
		if (registry.getArchetypeAtIndex(0) != archetype) return "Exp. archetype";

		registry.activate(archetype, falseAddress);
		if (!Archetype(archetype).isActive()) return "Archetype should be active";

		registry.deactivate(archetype, falseAddress);
		if (Archetype(archetype).isActive()) return "Archetype should be deactivated";

		// Parameter

		if (registry.addParameter(falseAddress, parameterType, parameter) != BaseErrors.RESOURCE_NOT_FOUND()) return "Adding parameter on non-existent archetype expected to fail with RESOURCE_NOT_FOUND";
		if (registry.addParameter(archetype, parameterType, EMPTY) != BaseErrors.NULL_PARAM_NOT_ALLOWED()) return "Adding parameter with empty name expected to fail with NULL_PARAM_NOT_ALLOWED";
		if (registry.addParameter(archetype, parameterType, parameter) != BaseErrors.NO_ERROR()) return "Adding parameter to archetype failed unexpectedly";
		if (registry.getParametersByArchetypeSize(archetype) != 1) return "Parameters on archetype expected to be 1";
		if (registry.getParameterByArchetypeAtIndex(archetype, 0) != parameter) return "parameter at index 0 does not match";
		(, Agreements.ParameterType retParameterType) = registry.getParameterByArchetypeData(archetype, parameter);
		if (retParameterType != parameterType) return "parameterType of parameter does not match";

		// Document Attachments

		error = registry.addDocument(falseAddress, documentName, hoardAddress, secretKey);
		if (error != BaseErrors.RESOURCE_NOT_FOUND()) return "Adding document to non-existent archetype should have failed with RESOURCE_NOT_FOUND";
		error = registry.addDocument(archetype, documentName, hoardAddress, secretKey);
		if (error != BaseErrors.NO_ERROR()) return "Adding document to archetype failed unexpectedly";
		if (registry.getDocumentsByArchetypeSize(archetype) != 1) return "Documents on archetype exptected to be 1";
		if (registry.getDocumentByArchetypeAtIndex(archetype, 0) != documentName) return "documentName at index 0 not returned correctly";

		bytes32 retHoardAddress;
		bytes32 retSecretKey;
		(retHoardAddress, retSecretKey) = registry.getDocumentByArchetypeData(archetype, documentName);
		if (retHoardAddress != hoardAddress) return "hoardAddress does not match";
		if (retSecretKey != secretKey) return "secretKey does not match";

		// Jurisdictions
		bytes32 region = keccak256(abi.encodePacked("CA", "QC"));
		error = registry.addJurisdiction(falseAddress, "CA", region);
		if (error != BaseErrors.RESOURCE_NOT_FOUND()) return "Adding jurisdiction to non-existent archetype should have failed with RESOURCE_NOT_FOUND";
		// test a country/region combination
		error = registry.addJurisdiction(archetype, "CA", region);
		if (error != BaseErrors.NO_ERROR()) return "Adding CAN_QC jurisdiction to archetype failed unexpectedly";
		if (registry.getNumberOfJurisdictionsForArchetype(archetype) != 1) return "Jurisdictions on archetype exptected to be 1";
		if (registry.getJurisdictionAtIndexForArchetype(archetype, 0) != region) return "jurisdiction key at index 0 not returned correctly";
		bytes2 country;
		bytes32 retRegion;
		(country, retRegion) = registry.getJurisdictionDataForArchetype(archetype, region);
		if (country != "CA") return "jurisdiction country not returned correctly for CAN_QC";
		if (retRegion != region) return "jurisdiction region not returned correctly for CAN_QC";
		// test a country-ONLY jurisdiction
		error = registry.addJurisdiction(archetype, "US", EMPTY);
		if (error != BaseErrors.NO_ERROR()) return "Adding USA jurisdiction to archetype failed unexpectedly";
		if (registry.getNumberOfJurisdictionsForArchetype(archetype) != 2) return "Jurisdictions on archetype exptected to be 2";
		if (registry.getJurisdictionAtIndexForArchetype(archetype, 1) != keccak256(abi.encodePacked("US"))) return "jurisdiction key at index 1 not returned correctly";
		(country, retRegion) = registry.getJurisdictionDataForArchetype(archetype, keccak256(abi.encodePacked("US")));
		if (country != "US") return "jurisdiction country not returned correctly for USA";
		if (retRegion != "") return "jurisdiction region not returned correctly for USA";
		// test adding another region for existing country
		region = keccak256(abi.encodePacked("CA", "ON"));
		error = registry.addJurisdiction(archetype, "CA", region);
		if (error != BaseErrors.NO_ERROR()) return "Adding CAN_ON jurisdiction to archetype failed unexpectedly";
		if (registry.getNumberOfJurisdictionsForArchetype(archetype) != 3) return "Jurisdictions on archetype exptected to be 3";
		if (registry.getJurisdictionAtIndexForArchetype(archetype, 2) != region) return "jurisdiction key at index 2 not returned correctly";		
		// test overwriting (cleaning) a country/region with country-ONLY jurisdiction
		error = registry.addJurisdiction(archetype, "CA", EMPTY);
		if (error != BaseErrors.NO_ERROR()) return "Adding CAN jurisdiction country overwrite to archetype failed unexpectedly";

		if (registry.getNumberOfJurisdictionsForArchetype(archetype) != 2) return "Jurisdictions on archetype exptected to be 2 after country overwrite";
		if (registry.getJurisdictionAtIndexForArchetype(archetype, 2) != "") return "jurisdiction key at index 2 should return empty after country overwrite";		
		if (registry.getJurisdictionAtIndexForArchetype(archetype, 1) != keccak256(abi.encodePacked("CA"))) return "jurisdiction key at index 1 should return country hash after country overwrite";		

		return SUCCESS;
	}

	function testArchetypeSuccessor() external returns (string) {

		address successor;

		droneArchetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, addrArrayWithDupes);
		if (droneArchetype == 0x0) return "droneArchetype address empty after creation";

		droneArchetype2 = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, addrArrayWithDupes);
		if (droneArchetype2 == 0x0) return "droneArchetype2 address empty after creation";

		registry.setArchetypeSuccessor(droneArchetype, droneArchetype2, falseAddress);

		successor = registry.getArchetypeSuccessor(droneArchetype);
		if (successor != droneArchetype2) return "Successor of droneArchetype is not set to droneArchetype2";
		if (Archetype(droneArchetype).isActive()) return "droneArchetype is still active even with successor set";
		
		return SUCCESS;
	}

	function testArchetypePackages() external returns (string) {
		uint error;
		bool active;
	
		droneArchetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, addrArrayWithDupes);
		if (droneArchetype == 0x0) return "droneArchetype address empty after creation";

		if (address(registry).call(bytes4(keccak256(abi.encodePacked("addArchetypeToPackage(bytes32,address)"))), fakePackageId, droneArchetype)) {
			return "Expected RESOURCE_NOT_FOUND for non-existent package id";
		}

		(error, dronePackageId) = registry.createArchetypePackage(dronePackageName, dronePackageDesc, 0x0, true, true);
		if (error != BaseErrors.NULL_PARAM_NOT_ALLOWED()) return "Expected failure due to no author address";

		(error, dronePackageId) = registry.createArchetypePackage(dronePackageName, dronePackageDesc, packageAuthor, true, true);
		if (error != BaseErrors.NO_ERROR()) return "It should create a new package";
		if (dronePackageId == "") return "Package id should not be empty";

		registry.deactivatePackage(dronePackageId, packageAuthor);
		( , , , , active) = registry.getArchetypePackageData(dronePackageId);
		if (active) return "dronePackage should be inactive";

		registry.activatePackage(dronePackageId, packageAuthor);
		( , , , , active) = registry.getArchetypePackageData(dronePackageId);
		if (!active) return "dronePackage should be active";

		(error, dronePackageId) = registry.createArchetypePackage(dronePackageName, dronePackageDesc, packageAuthor, true, true);
		if (error != BaseErrors.RESOURCE_ALREADY_EXISTS()) return "Expected failure when creating package with duplicate name/author";
		
		(error, buildingPackageId) = registry.createArchetypePackage(buildingPackageName, buildingPackageDesc, packageAuthor, false, true);
		if (error != BaseErrors.NO_ERROR()) return "It should create a new package";
		if (buildingPackageId == "") return "Package id should not be empty";

		if (registry.getNumberOfArchetypePackages() != 2) return "Registry should have 2 packages";

		registry.addArchetypeToPackage(dronePackageId, droneArchetype);

		if (registry.getNumberOfArchetypesInPackage(dronePackageId) != 1) return "Drone package should have 1 archetype";
		if (registry.getArchetypeAtIndexInPackage(dronePackageId, 0) != droneArchetype) return "Archetype at index 0 should match droneArchetype";

		droneArchetype2 = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, dronePackageId, addrArrayWithDupes);

		if (registry.getNumberOfArchetypesInPackage(dronePackageId) != 2) return "Drone package should have 2 archetypes";
		if (registry.getArchetypeAtIndexInPackage(dronePackageId, 1) != droneArchetype2) return "Archetype at index 1 should match droneArchetype2";

		return SUCCESS;
	}

	function testGoverningArchetypes() external returns (string) {
		address archetype;
		string memory employmentArchName = "Employment Archetype";

		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithDupes.push(archetype);
		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithDupes.push(archetype);
		addrArrayWithDupes.push(archetype); // duplicate
		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithDupes.push(archetype);
		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithDupes.push(archetype);
		
		if (address(registry).call(bytes4(keccak256(abi.encodePacked(
			"createArchetype(bytes32,address,string,bool,bool,address,address,bytes32,address[])"))), 
			name, falseAddress, description, false, true, falseAddress, falseAddress, EMPTY, addrArrayWithDupes)) {
				return "Creating archetype with duplicate governing archetypes should fail";
		}

		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithoutDupes.push(archetype);
		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, emptyArray);
		addrArrayWithoutDupes.push(archetype);
		archetype = registry.createArchetype(10, false, true, name, falseAddress, description, falseAddress, falseAddress, EMPTY, addrArrayWithoutDupes);
		if (archetype == 0x0) return "Archetype with no duplicate gov archetypes has no address";

		// Create employment archetype
		employmentArchetype = registry.createArchetype(10, false, true, employmentArchName, falseAddress, description, falseAddress, falseAddress, EMPTY, ndaGovArchetypes);
		if (archetype == 0x0) return "Employment archetype created with no errors, but empty address returned";

		ndaGovArchetypes.push(employmentArchetype);

		// Create NDA Archetype with employment archetype as its governing archetype
		ndaArchetype = registry.createArchetype(10, false, true, "NDA Archetype", falseAddress, description, falseAddress, falseAddress, EMPTY, ndaGovArchetypes);
		if (archetype == 0x0) return "NDA archetype creation returned empty address";

		if (registry.getNumberOfGoverningArchetypes(ndaArchetype) != 1) return "ndaArchetype should have 1 governing archetype";
		if (registry.getGoverningArchetypeAtIndex(ndaArchetype, 0) != employmentArchetype) return "ndaArchetype's governing archetype should be set to employmentArchetype";
		if (bytes(registry.getGoverningArchetypeData(ndaArchetype, employmentArchetype)).length != bytes(employmentArchName).length) return "ndaArchetype's governing archetype name should be correct";
		
		return SUCCESS;
	}
}
