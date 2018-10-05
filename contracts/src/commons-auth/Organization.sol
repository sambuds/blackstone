pragma solidity ^0.4.23;

import "commons-standards/ERC165.sol";
import "commons-events/EventEmitter.sol";

/**
 * @title Organization Interface
 * @dev Describes functionality of a contract representing an organization in an ecosystem application.
 * Also provides access to constants required when dealing with organizations.
 */
contract Organization is EventEmitter, ERC165 {

	// The ERC165 ID only comprises the core Organization functions
	bytes4 public constant ERC165_ID_Organization = bytes4(keccak256(abi.encodePacked("addUser(address)"))) ^
													bytes4(keccak256(abi.encodePacked("removeUser(address)"))) ^
													bytes4(keccak256(abi.encodePacked("authorizeUser(address,bytes32)")));

	bytes32 public constant DEFAULT_DEPARTMENT_ID = "DEFAULT_DEPARTMENT";
	
	function addDepartment(bytes32 _id, string _name) public returns (uint error);

	function getNumberOfDepartments() external view returns (uint size);

	function getDepartmentAtIndex(uint _index) external view returns (bytes32 id);

	function getDepartmentData(bytes32 _id) external view returns (uint userCount, string name);

	function departmentExists(bytes32 _id) external view returns (bool);

	/**
	 * @dev Returns the number of registered approvers.
	 * @return the number of approvers
	 */
	function getNumberOfApprovers() external view returns (uint);
	
	/**
	 * @dev Returns the approver's address at the given index position.
	 * @param _pos the index position
	 * @return the address, if the position exists
	 */
	function getApproverAtIndex(uint _pos) external view returns (address);

	/**
	 * @dev returns the number of users associated with this organization
	 * @return the number of users
	 */
	function getNumberOfUsers() external view returns (uint);

	/**
	 * @dev Returns the user's address at the given index position.
	 * @param _pos the index position
	 * @return the address or 0x0 if the position does not exist
	 */
	function getUserAtIndex(uint _pos) external view returns (address);

	/**
	 * @dev Returns the number of users in a given department of the organization.
	 * @param _depId the id of the department
	 * @return size the number of users
	 */
	function getNumberOfDepartmentUsers(bytes32 _depId) external view returns (uint size);

	/**
	 * @dev Returns the user's address at the given index of the department.
	 * @param _depId the id of the department
	 * @param _index the index position
	 * @return userAccount the address of the user or 0x0 if the position does not exist
	 */
	function getDepartmentUserAtIndex(bytes32 _depId, uint _index) external view returns (address userAccount);

	/**
	 * @dev Adds the specified user to this organization as an active user. If the user already exists, the function ensures the account is active.
	 * @param _userAccount the user to add
	 * @return bool true if successful
	 */
	function addUser(address _userAccount) public returns (bool successful);

	/**
	 * @dev Adds the specified user to the organization if they aren't already registered, then adds the user to the department if they aren't already in it.
	 * @param _userAccount the user to add
	 * @param _department department id to which the user should be added
	 * @return bool true if successful
	 */
	function addUserToDepartment(address _userAccount, bytes32 _department) external returns (bool successful);

	/**
	 * @dev Removes the user in this organization.
	 * @param _userAccount the account to remove
	 * @return bool indicating success or failure
	 */
	function removeUser(address _userAccount) external returns (bool successful);

	/**
	 * @dev Removes the department in this organization.
	 * @param _depId the department to remove
	 * @return bool indicating success or failure
	 */
	function removeDepartment(bytes32 _depId) external returns (bool successful);

	/**
	 * @dev Removes the user from the department in this organization
	 * @param _userAccount the user to remove
	 * @param _depId the department to remove the user from
	 * @return bool indicating success or failure
	 */
	function removeUserFromDepartment(address _userAccount, bytes32 _depId) public returns (bool);

	/**
	 * @dev Returns whether the given user account is active in this organization and is authorized.
	 * The optional department/role identifier can be used to provide an additional authorization scope
	 * against which to authorize the user.
	 * @param _userAccount the user account
	 * @param _department an optional department/role context
	 * @return true if authorized, false otherwise
	 */
	function authorizeUser(address _userAccount, bytes32 _department) external view returns (bool);

  function getOrganizationDetails() external view returns (uint numberOfApprovers, bytes32 organizationKey);
}
