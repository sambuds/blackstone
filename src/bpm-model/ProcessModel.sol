pragma solidity ^0.5;

import "bpm-model/BpmModel.sol";
import "bpm-model/ProcessModel_v1_0_0.sol";

/**
 * @title ProcessModel Interface
 * @dev Versionized container providing a namespace for a set of business process definitions and their artifacts. 
 */
contract ProcessModel is ProcessModel_v1_0_0 {

	event LogProcessModelFileReferenceUpdate(
		bytes32 indexed eventId,
		address modelAddress,
		string modelFileReference
	);

	/**
	 * @dev Sets the file reference for the model
	 */
	function setModelFileReference(string calldata _modelFileReference) external;

}