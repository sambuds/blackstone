pragma solidity ^0.5.12;

import "commons-management/AbstractVersionedArtifact.sol";

import "agreements/Archetype.sol";
import "agreements/AbstractArchetype_v1_2_1.sol";

/**
 * @title DefaultArchetype
 * @dev Default implementation of the Archetype interface. This contract represents the latest "version" of the artifact by inheriting from past versions to guarantee the order
 * of storage variable declarations. It also inherits and instantiates AbstractVersionedArtifact.
 */
contract DefaultArchetype is AbstractVersionedArtifact(1,3,0), AbstractArchetype_v1_2_1, Archetype {

	/**
	 * @dev Removes all documents stored in the contract.
	 */
	function clearDocuments() external {
		for (uint i = 0; i < documents.keys.length; i++) {
			( , bytes32 key) = documents.keyAtIndex(i);
			emit LogArchetypeDocumentRemoval(
				EVENT_ID_ARCHETYPE_DOCUMENTS,
				0,
				address(this),
				key
			);
		}
		documents.clear();
	}

}
