pragma solidity ^0.4.23;

import "commons-events/EventListener.sol";
import "commons-management/Upgradeable.sol";

/**
 * @title ParticipantsManager Interface
 * @dev Manages organizational structures.
 */

contract ParticipantsManager is EventListener, Upgradeable {
  // SQLsol Events
    event UpdateUserAccount(string name, address key1);
    event UpdateOrganization(string name, address key1);
    event UpdateOrganizationUser(string name, address key1, address key2);
    event RemoveOrganizationUser(string name, address key1, address key2);
    event UpdateOrganizationApprover(string name, address key1, address key2);
    event UpdateOrganizationDepartment(string name, address key1, bytes32 key2);
    event RemoveOrganizationDepartment(string name, address key1, bytes32 key2);
    event UpdateDepartmentUser(string name, address key1, bytes32 key2, address key3);
    event RemoveDepartmentUser(string name, address key1, bytes32 key2, address key3);

    /**
    * @dev Creates and adds a user account
    * @param _id id (required)
    * @param _owner owner (optional)
    * @param _ecosystem owner (optional)
    * @return error code indicating success or failure
    * @return userAccount user account
    */
    function createUserAccount(bytes32 _id, address _owner, address _ecosystem) external returns (address userAccount);

    /**
     * @dev Adds the specified UserAccount
     * @return an error code
     */
    function addUserAccount(address _account) public returns (uint);

	/**
	 * @dev Adds the organization at the specified address
	 * @param _address the Organization contract's address
	 * @return error code
	 */
    function addOrganization(address _address) external returns (uint);

	/**
	 * @dev Creates and adds a new Organization with the specified parameters
	 * @param _initialApprovers the initial owners/admins of the Organization.
	 * @param _defaultDepartmentName an optional custom name/label for the default department of this organization.
	 * @return error code and the address of the newly created organization, if successful
	 */
    function createOrganization(address[] _initialApprovers, string _defaultDepartmentName) external returns (uint, address);

	/**
		* @dev Indicates whether the specified organization exists for the given organization id
		* @param _address organization address
		* @return bool exists
		*/
    function organizationExists(address _address) external view returns (bool);

	/**
	 * @dev Returns the address of the organization with the specified ID, if it exists
	 * @param _address the organization's address
	 * @return the organization's address, if it exists
	 */
    function getOrganization(address _address) external view returns (bool);
	
	/**
	 * @dev Returns the number of registered organizations.
	 * @return the number of organizations
	 */
    function getNumberOfOrganizations() external view returns (uint size);

	/**
	 * @dev Returns the organization at the specified index.
	 * @param _pos the index position
	 * @return the address of the organization
	 */
    function getOrganizationAtIndex(uint _pos) external view returns (address organization);
	
	/**
	 * @dev Returns the public data of the organization at the specified address
	 * @param _organization the address of an organization
	 * @return the organization's ID and name
	 */
    function getOrganizationData(address _organization) external view returns (uint numApprovers);

    function departmentExists(address _organization, bytes32 _departmentId) external view returns (bool);

    function getNumberOfDepartments(address _organization) external view returns (uint size);

    function getDepartmentAtIndex(address _organization, uint _index) external view returns (bytes32 id);

    function getDepartmentData(address _organization, bytes32 _id) external view returns (uint userCount, string name);

    function getNumberOfDepartmentUsers(address _organization, bytes32 _depId) external view returns (uint size);

    function getDepartmentUserAtIndex(address _organization, bytes32 _depId, uint _index) external view returns (address departmentMember);

    function getDepartmentUserData(address _organization, bytes32 _depId, address _userAccount) external view returns (address departmentMember);

    /**
	 * @dev Returns the number of registered approvers in the specified organization.
	 * @param _organization the organization's address
	 * @return the number of approvers
	 */
    function getNumberOfApprovers(address _organization) external view returns (uint size);
	
	/**
	 * @dev Returns the approver's address at the given index position of the specified organization.
	 * @param _organization the organization's address
	 * @param _pos the index position
	 * @return the approver's address, if the position exists
	 */
    function getApproverAtIndex(address _organization, uint _pos) external view returns (address);

	/**
	 * @dev Function supports SQLsol, but only returns the approver address parameter.
	 * @param _organization the organization's address
	 * @param _approver the approver's address
	 */
    function getApproverData(address _organization, address _approver) external view returns (address approverAddress);

	/**
	 * @dev returns the number of users associated with the specified organization
	 * @param _organization the organization's address
	 * @return the number of users
	 */
    function getNumberOfUsers(address _organization) external view returns (uint size);

	/**
	 * @dev Returns the user's address at the given index position in the specified organization.
	 * @param _organization the organization's address
	 * @param _pos the index position
	 * @return the address or 0x0 if the position does not exist
	 */
    function getUserAtIndex(address _organization, uint _pos) external view returns (address);

	/**
	 * @dev Returns information about the specified user in the context of the given organization (only address is stored)
	 * @param _organization the organization's address
	 * @param _user the user's address
	 * @return userAddress - address of the user
	 */
    function getUserData(address _organization, address _user) external view returns (address userAddress);

    /**
     * @dev Indicates whether the specified user account exists for the given userAccount ID
     * @param _id userAccount ID
     * @return bool exists
     */
    function userAccountExists(bytes32 _id) external view returns (bool);

    /**
     * @dev Returns the user account address for the specified user account ID.
     */
    function getUserAccount(bytes32 _id) external view returns (uint, address);

    /**
     * SQLSOL support functions
     */

    function getUserAccountsSize() external view returns (uint size);

    function getUserAccountData(address _userAccount) external view returns (bytes32 id, address owner);

    /**
     * @dev Gets hashed user account ID and user account address for the specified user account ID.
     * @param _id the user account ID
     * @return error RESOURCE_NOT_FOUND or NO_ERROR
     * @return addr user account address
     * @return hashedId hashed user account ID
     */
    function getUserAccountDataById(bytes32 _id) external view returns (uint error, address addr, bytes32 hashedId);

    function getUserAccountAtIndex(uint _pos) external view returns (address userAccount);
}