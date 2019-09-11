pragma solidity ^0.4.25;

import "commons-auth/Ecosystem.sol";

/**
 * @title Ecosystem Interface
 * @dev The interface describing interaction with an Ecosystem
 */
contract Ecosystem_v1_0_1 is Ecosystem {

    function migrateUserAccount(address _userAccount, bytes32 _migrateFromId, bytes32 _migrateToId) external;
}