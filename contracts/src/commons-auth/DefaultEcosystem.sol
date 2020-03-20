pragma solidity ^0.5;

import "commons-base/ErrorsLib.sol";
import "commons-auth/Ecosystem.sol";
import "commons-auth/Ecosystem_v1_0_1.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-management/AbstractVersionedArtifact.sol";
import "commons-management/AbstractDelegateTarget.sol";

/**
 * @title DefaultEcosystem
 * @dev The default Ecosystem implementation
 */
contract DefaultEcosystem is AbstractVersionedArtifact(1,0,1), AbstractDelegateTarget, Ecosystem_v1_0_1 {

    using MappingsLib for Mappings.Bytes32AddressMap;
    
    mapping (address => bool) publicKeys;
    Mappings.Bytes32AddressMap userAccounts;

	/**
	 * @dev Initializes this DefaultOrganization with the provided parameters. This function replaces the
	 * contract constructor, so it can be used as the delegate target for an ObjectProxy.
     * Sets the msg.sender as the owner of the Ecosystem
     */
    function initialize()
        external
        pre_post_initialize
    {
        owner = msg.sender;
    }

    function addExternalAddress(address _address)
        external
        pre_onlyByOwner
    {
        publicKeys[_address] = true;
    }

    function removeExternalAddress(address _address)
        external
        pre_onlyByOwner
    {
        delete publicKeys[_address];
    }

    function isKnownExternalAddress(address _address)
        external view
        returns (bool)
    {
        return publicKeys[_address];
    }

    // TODO protect function with modifier for owner or public key only

    function addUserAccount(bytes32 _id, address _userAccount) 
        external
    {
        ErrorsLib.revertIf(
            (_id == ""), 
            ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(),
            "DefaultEcosystem.addUserAccount",
            "User ID cannot be empty"
        );
        ErrorsLib.revertIf(
            (_userAccount == address(0)), 
            ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(),
            "DefaultEcosystem.addUserAccount",
            "User account address cannot be empty"
        );
        ErrorsLib.revertIf(
            userAccounts.exists(_id), 
            ErrorsLib.RESOURCE_ALREADY_EXISTS(),
            "DefaultEcosystem.addUserAccount",
            "User with same ID already exists in given ecosystem"
        );
        uint error = userAccounts.insert(_id, _userAccount);
        ErrorsLib.revertIf(
            error != BaseErrors.NO_ERROR(), 
            ErrorsLib.RUNTIME_ERROR(),
            "DefaultEcosystem.addUserAccount",
            "User with same ID already exists in given ecosystem"
        );
    }

    function getUserAccount(bytes32 _id)
        external
        view
        returns (address userAccount) 
    {
        userAccount = userAccounts.get(_id);
        ErrorsLib.revertIf(
            userAccount == address(0),
            ErrorsLib.RESOURCE_NOT_FOUND(),
            "DefaultEcosystem.getUserAccount",
            "User account with given Id does not exist"
        );
    }

    /**
     * @dev Temporary function allowing the owner of the Ecosystem to perform a migration of user IDs.
     * REVERTS if:
     * - the _migrateFromId does not match the current user ID of the account
     * - the _migrateToId is already being used in the Ecosystem
     * @param _userAccount the account being migrated
     * @param _migrateFromId the user ID currently associated with the account
     * @param _migrateToId the new user ID for the account
     */
    function migrateUserAccount(address _userAccount, bytes32 _migrateFromId, bytes32 _migrateToId) 
        external
        pre_onlyByOwner
    {
        address mappedAddress = userAccounts.get(_migrateFromId);
        ErrorsLib.revertIf(
            mappedAddress != _userAccount,
            ErrorsLib.INVALID_INPUT(),
            "DefaultEcosystem.migrateUserAccount",
            "Given user account address does not match the address found with given _migrateFromId"
        );
        uint error = userAccounts.insert(_migrateToId, mappedAddress);
        ErrorsLib.revertIf(
            error != BaseErrors.NO_ERROR(),
            ErrorsLib.RUNTIME_ERROR(),
            "DefaultEcosystem.migrateUserAccount",
            "User with same _migrateToId already exists in given ecosystem"
        );
        error = userAccounts.remove(_migrateFromId);
        ErrorsLib.revertIf(
            error != BaseErrors.NO_ERROR(),
            ErrorsLib.RUNTIME_ERROR(),
            "DefaultEcosystem.migrateUserAccount",
            "Failed to remove key _migrateFromId from userAccounts map"
        );
    }
}