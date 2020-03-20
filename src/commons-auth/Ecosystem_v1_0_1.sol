pragma solidity ^0.5.12;

import "commons-auth/Ecosystem.sol";

/**
 * @title Ecosystem v1.0.1 Interface
 * @dev Temporary Ecosystem interface that adds an upgrade function which allows the migration of user IDs in the ecosystem for upgrade purposes.
 */
contract Ecosystem_v1_0_1 is Ecosystem {

    /**
     * @dev Temporary function allowing to perform a migration of user IDs.
     */
    function migrateUserAccount(address _userAccount, bytes32 _migrateFromId, bytes32 _migrateToId) external;
}