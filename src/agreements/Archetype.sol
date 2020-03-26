pragma solidity ^0.5.12;

import "agreements/Archetype_v1_2_1.sol";

/**
 * @title Archetype Interface
 * @dev API for interaction with an Archetype. This contract represents the latest "version" of the interface by inheriting from past versions and guaranteeing
 * the existence of past event and function signatures.
 */
contract Archetype is Archetype_v1_2_1 {

	event LogArchetypeDocumentRemoval(
        bytes32 indexed eventId,
        int __DELETE__,
		address archetypeAddress,
		bytes32 documentKey
	);

	/**
	 * @dev Removes all documents stored in contract.
	 */
	function clearDocuments() external;
}
