pragma solidity ^0.4.25;

import "commons-base/Owned.sol";
import "commons-management/VersionedArtifact.sol";

/**
 * @title Ecosystem Interface
 * @dev The interface describing interaction with an Ecosystem
 */
contract Ecosystem_v1_0_1 is VersionedArtifact, Owned {

	/**
	 * @dev Initializes this DefaultOrganization with the provided parameters. This function replaces the
	 * contract constructor, so it can be used as the delegate target for an ObjectProxy.
     * Sets the msg.sender as the owner of the Ecosystem
     */
    function initialize() external;

    function addExternalAddress(address _address) external;

    function removeExternalAddress(address _address) external;

    function isKnownExternalAddress(address _address) external view returns (bool);
    
    function addUserAccount(bytes32 _id, address _userAccount) external;

    function getUserAccount(bytes32 _id) external view returns (address _account);

    function migrateUserAccount(address _userAccount, bytes32 _migrateFromId, bytes32 _migrateToId) external pre_onlyByOwner;
}