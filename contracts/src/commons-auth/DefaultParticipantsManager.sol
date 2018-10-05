pragma solidity ^0.4.23;

import "commons-base/ErrorsLib.sol";
import "commons-base/BaseErrors.sol";
import "commons-events/AbstractEventListener.sol";
import "commons-management/AbstractDbUpgradeable.sol";

import "commons-auth/ParticipantsManager.sol";
import "commons-auth/ParticipantsManagerDb.sol";
import "commons-auth/UserAccount.sol";
import "commons-auth/DefaultUserAccount.sol";
import "commons-auth/Organization.sol";
import "commons-auth/DefaultOrganization.sol";

/**
 * @title DefaultParticipantsManager
 * @dev Default implementation of the ParticipantsManager interface.
 */
contract DefaultParticipantsManager is Versioned(1,0,0), AbstractEventListener, ParticipantsManager, AbstractDbUpgradeable {

    // event names
    bytes32 constant EVENT_UPDATE_ORGANIZATION_USER = "UpdateOrganizationUser";
    bytes32 constant EVENT_REMOVE_ORGANIZATION_USER = "RemoveOrganizationUser";
    bytes32 constant EVENT_UPDATE_ORGANIZATION_DEPARTMENT = "UpdateOrganizationDepartment";
    bytes32 constant EVENT_REMOVE_ORGANIZATION_DEPARTMENT = "RemoveOrganizationDepartment";
    bytes32 constant EVENT_UPDATE_DEPARTMENT_USER = "UpdateDepartmentUser";
    bytes32 constant EVENT_REMOVE_DEPARTMENT_USER = "RemoveDepartmentUser";

    // SQLSOL metadata
    string constant TABLE_USERS = "USERS";
    string constant TABLE_ORGANIZATIONS = "ORGANIZATIONS";
    string constant TABLE_ORGANIZATION_USERS = "ORGANIZATION_USERS";
    string constant TABLE_ORGANIZATION_APPROVERS = "ORGANIZATION_APPROVERS";
    string constant TABLE_ORGANIZATION_DEPARTMENTS = "ORGANIZATION_DEPARTMENTS";
    string constant TABLE_DEPARTMENT_USERS = "DEPARTMENT_USERS";

    /**
     * @dev Creates and adds a user account
     * @param _id id (required)
     * @param _owner owner (optional)
     * @param _ecosystem owner (optional)
     * @return userAccount user account
     */
    function createUserAccount(bytes32 _id, address _owner, address _ecosystem) external returns (address userAccount) {
        ErrorsLib.revertIf(_id == "",
            ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultParticipantsManager.createUserAccount", "User ID must not be empty");
        bytes32 hashedId = keccak256(abi.encodePacked(_id)); //TODO the ID should be hashed client-side and not here
        ErrorsLib.revertIf(ParticipantsManagerDb(database).userAccountExists(hashedId),
            ErrorsLib.OVERWRITE_NOT_ALLOWED(), "DefaultParticipantsManager.createUserAccount", "User with same ID already exists");
        userAccount = new DefaultUserAccount(_id, _owner, _ecosystem); // passing user-readable id since DefaultUserAccount hashes it before storing
        require(addUserAccount(userAccount) == BaseErrors.NO_ERROR(),
            ErrorsLib.format(ErrorsLib.INVALID_STATE(), "DefaultParticipantsManager.createUserAccount", "Unable to add new UserAccount to DB"));
    }

    /**
     * @dev Adds the specified UserAccount.
     * @return NO_ERROR, RESOURCE_ALREADY_EXISTS if the user account ID is already registered
     */
    function addUserAccount(address _account) public returns (uint error) {
        error = ParticipantsManagerDb(database).addUserAccount(UserAccount(_account).getId(), _account);
        if (error == BaseErrors.NO_ERROR()) {
            emit UpdateUserAccount(TABLE_USERS, _account);
        }
    }

    /**
     * @dev Indicates whether the specified user account exists for the given userAccount ID
     * @param _id userAccount ID
     * @return bool exists
     */
    function userAccountExists(bytes32 _id) external view returns (bool) {
        return ParticipantsManagerDb(database).userAccountExists(keccak256(abi.encodePacked(_id)));
    }

	/**
	 * @dev Returns the user account address for the specified user account ID.
	 */
    function getUserAccount(bytes32 _id) external view returns (uint, address) {
        bytes32 hashedId = keccak256(abi.encodePacked(_id)); // hashing the user-readable id before lookup
        return ParticipantsManagerDb(database).getUserAccount(hashedId);
    }

    /**
	 * @dev Adds the organization at the specified address
	 * @param _address the Organization contract's address
	 * @return BaseErrors.INVALID_PARAM_VALUE() if address is empty, BaseErrors.RESOURCE_ALREADY_EXISTS() if the organization's ID is already registered, BaseErrors.NO_ERROR() if successful
	 */
    function addOrganization(address _address) external returns (uint error) {
        if (_address == 0x0) return BaseErrors.INVALID_PARAM_VALUE();
        error = ParticipantsManagerDb(database).addOrganization(_address);
        if (error == BaseErrors.NO_ERROR()) {
            Organization(_address).addEventListener(EVENT_UPDATE_ORGANIZATION_USER);
            Organization(_address).addEventListener(EVENT_REMOVE_ORGANIZATION_USER);
            Organization(_address).addEventListener(EVENT_UPDATE_ORGANIZATION_DEPARTMENT);
            Organization(_address).addEventListener(EVENT_REMOVE_ORGANIZATION_DEPARTMENT);
            Organization(_address).addEventListener(EVENT_UPDATE_DEPARTMENT_USER);
            Organization(_address).addEventListener(EVENT_REMOVE_DEPARTMENT_USER);
            emit UpdateOrganization(TABLE_ORGANIZATIONS, _address);
            fireOrganizationApproverEvents(_address);
            fireDepartmentEvents(_address);
        }
    }

	/**
	 * @dev Creates and adds a new Organization with the specified parameters
	 * @param _initialApprovers the initial owners/admins of the Organization. If left empty, the msg.sender will be set as an approver.
	 * @param _defaultDepartmentName an optional custom name/label for the default department of this organization.
	 * @return BaseErrors.NO_ERROR() if successful
	 * @return the address of the newly created Organization, or 0x0 if not successful
	 */
    function createOrganization(address[] _initialApprovers, string _defaultDepartmentName) external returns (uint error, address organization) {
        address[] memory approvers;
        if (_initialApprovers.length == 0) {
            approvers = new address[](1);
            approvers[0] = msg.sender;
        }
        else {
            approvers = _initialApprovers;
        }
        organization = new DefaultOrganization(approvers, _defaultDepartmentName);
        error = ParticipantsManagerDb(database).addOrganization(organization);
        if (error == BaseErrors.NO_ERROR()) {
            Organization(organization).addEventListener(EVENT_UPDATE_ORGANIZATION_USER);
            Organization(organization).addEventListener(EVENT_REMOVE_ORGANIZATION_USER);
            Organization(organization).addEventListener(EVENT_UPDATE_ORGANIZATION_DEPARTMENT);
            Organization(organization).addEventListener(EVENT_REMOVE_ORGANIZATION_DEPARTMENT);
            Organization(organization).addEventListener(EVENT_UPDATE_DEPARTMENT_USER);
            Organization(organization).addEventListener(EVENT_REMOVE_DEPARTMENT_USER);
            emit UpdateOrganization(TABLE_ORGANIZATIONS, organization);
            fireOrganizationApproverEvents(organization);
            fireDepartmentEvents(organization);
		}
    }

 	/**
    * @dev Indicates whether the specified organization exists for the given organization id
    * @param _address organization address
    * @return bool exists
    */
    function organizationExists(address _address) external view returns (bool) {
        return ParticipantsManagerDb(database).organizationExists(_address);
    }

    /**
	 * @dev Returns the address of the organization if it exists
	 * @param _address the organization's address
	 * @return bool exists
	 */
    function getOrganization(address _address) external view returns (bool) {
        return ParticipantsManagerDb(database).getOrganization(_address);
    }

	/**
	 * @dev Returns the number of registered organizations.
	 * @return the number of organizations
	 */
    function getNumberOfOrganizations() external view returns (uint size) {
        return ParticipantsManagerDb(database).getNumberOfOrganizations();
    }
    	
	/**
	 * @dev Returns the address of the Organization at the given index.
	 * @param _pos the index position
	 * @return the address of the Organization or 0x0 if the index position does not exist
	 */
    function getOrganizationAtIndex(uint _pos) external view returns (address organization) {
        return ParticipantsManagerDb(database).getOrganizationAtIndex(_pos);
    }

    /**
	 * @dev Returns the public data of the organization at the specified address
	 * @param _organization the address of an organization
	 * @return the organization's ID and name
	 */
    function getOrganizationData(address _organization) external view returns (uint numApprovers, bytes32 organizationKey) {
        Organization org = Organization(_organization);
        (numApprovers, organizationKey) = org.getOrganizationDetails();
    }

    function departmentExists(address _organization, bytes32 _departmentId) external view returns (bool) {
        return Organization(_organization).departmentExists(_departmentId);
    }
    
    function getNumberOfDepartments(address _organization) external view returns (uint size) {
        return Organization(_organization).getNumberOfDepartments();
    }

    function getDepartmentAtIndex(address _organization, uint _index) external view returns (bytes32 id) {
        return Organization(_organization).getDepartmentAtIndex(_index);
    }

    function getDepartmentData(address _organization, bytes32 _id) external view returns (uint userCount, string name) {
        return Organization(_organization).getDepartmentData(_id);
    }

    function getNumberOfDepartmentUsers(address _organization, bytes32 _depId) external view returns (uint size) {
        return Organization(_organization).getNumberOfDepartmentUsers(_depId);
    }

    function getDepartmentUserAtIndex(address _organization, bytes32 _depId, uint _index) external view returns (address departmentMember) {
        return Organization(_organization).getDepartmentUserAtIndex(_depId, _index);
    }

    function getDepartmentUserData(address /*_organization*/, bytes32 /*_depId*/, address _userAccount) external view returns (address departmentMember) {
        return _userAccount;
    }
	
	/**
	 * @dev Returns the number of registered approvers in the specified organization.
	 * @param _organization the organization's address
	 * @return the number of approvers
	 */
    function getNumberOfApprovers(address _organization) external view returns (uint size) {
        return Organization(_organization).getNumberOfApprovers();
    }
	
	/**
	 * @dev Returns the approver's address at the given index position of the specified organization.
	 * @param _organization the organization's address
	 * @param _pos the index position
	 * @return the approver's address, if the position exists
	 */
    function getApproverAtIndex(address _organization, uint _pos) external view returns (address) {
        return Organization(_organization).getApproverAtIndex(_pos);
    }

	/**
	 * @dev Function supports SQLsol, but only returns the approver address parameter.
	 * Unused parameter `address` refers to the Organization and is required by SQLsol
	 * @param _approver the approver's address
	 * @return the approver address
	 */
    function getApproverData(address /*_organization*/, address _approver) external view returns (address approverAddress) {
        approverAddress = _approver;
    }

	/**
	 * @dev returns the number of users associated with the specified organization
	 * @param _organization the organization's address
	 * @return the number of users
	 */
    function getNumberOfUsers(address _organization) external view returns (uint size) {
        return Organization(_organization).getNumberOfUsers();
    }

	/**
	 * @dev Returns the user's address at the given index position in the specified organization.
	 * @param _organization the organization's address
	 * @param _pos the index position
	 * @return the address or 0x0 if the position does not exist
	 */
    function getUserAtIndex(address _organization, uint _pos) external view returns (address) {
        return Organization(_organization).getUserAtIndex(_pos);
    }

	/**
	 * @dev Returns information about the specified user in the context of the given organization (only address is stored)
	 * Unused parameter `address` refers to the Organization and is required by SQLsol
	 * @param _user the user's address
	 * @return userAddress - the user's address
	 */
    function getUserData(address /*_organization*/, address _user) external view returns (address userAddress) {
        return _user;
    }

    /**
     * SQLSOL support functions
     */

    /**
     * @dev Gets user accounts size.
     * @return size size
     */
    function getUserAccountsSize() external view returns (uint size) {
        size = ParticipantsManagerDb(database).getNumberOfUserAccounts();
    }

    /**
     * @dev Gets data for the specified user account.
     * @param _userAccount the user account address
     * @return id user account ID
     * @return owner user account owner
     */
    function getUserAccountData(address _userAccount) external view returns (bytes32 id, address owner) {
        UserAccount acc = UserAccount(_userAccount);
        id = acc.getId();
        owner = acc.getOwner();
    }

    /**
     * @dev Gets hashed user account ID and user account address for the specified user account ID.
     * @param _id the user account ID
     * @return error RESOURCE_NOT_FOUND or NO_ERROR
     * @return addr user account address
     * @return hashedId hashed user account ID
     */
    function getUserAccountDataById(bytes32 _id) external view returns (uint error, address addr, bytes32 hashedId) {
        hashedId = keccak256(abi.encodePacked(_id)); // hashing the user-readable id before lookup
        (error, addr) = ParticipantsManagerDb(database).getUserAccount(hashedId);
        if (error != BaseErrors.NO_ERROR()) return (error, 0x0, "");
        error = BaseErrors.NO_ERROR();
    }

    /**
     * @dev Gets user account at the given position.
     * @param _pos position
     * @return userAccount user account address
     */
    function getUserAccountAtIndex(uint _pos) external view returns (address) {
        return ParticipantsManagerDb(database).getUserAccountAtIndex(_pos);
    }

	/**
	 * @dev Implementation of the EventListener interface. Can be called by a registered organization to trigger an UpdateOrganization event.
	 * @param _event the event that was fired. Currently supports custom event EVENT_UPDATE_ORGANIZATION_USER
	 * @param _source Expected to be a registered Organization
	 */
    function eventFired(bytes32 _event, address _source, address _data) external {
        if (_event == EVENT_UPDATE_ORGANIZATION_USER &&
             ParticipantsManagerDb(database).organizationExists(_source)) {
            emit UpdateOrganizationUser(TABLE_ORGANIZATION_USERS, _source, _data);
        } else if (_event == EVENT_REMOVE_ORGANIZATION_USER &&
             ParticipantsManagerDb(database).organizationExists(_source)) {
            emit RemoveOrganizationUser(TABLE_ORGANIZATION_USERS, _source, _data);
        }
    }

	/**
	 * @dev Implementation of the EventListener interface. Can be called by a registered organization to trigger an UpdateOrganizationDepartment event.
	 * @param _event the event that was fired. Currently supports custom event EVENT_UPDATE_ORGANIZATION_DEPARTMENT and EVENT_REMOVE_ORGANIZATION_DEPARTMENT
	 * @param _source Expected to be a registered Organization
	 * @param _id ID of department added
	 */
    function eventFired(bytes32 _event, address _source, bytes32 _id) external {
        if (_event == EVENT_UPDATE_ORGANIZATION_DEPARTMENT &&
            ParticipantsManagerDb(database).organizationExists(_source)) {
            emit UpdateOrganizationDepartment(TABLE_ORGANIZATION_DEPARTMENTS, _source, _id);            
        } else if (_event == EVENT_REMOVE_ORGANIZATION_DEPARTMENT &&
            ParticipantsManagerDb(database).organizationExists(_source)) {
            emit RemoveOrganizationDepartment(TABLE_ORGANIZATION_DEPARTMENTS, _source, _id);            
        }
    }

	/**
	 * @dev Implementation of the EventListener interface. Can be called by a registered organization to trigger an UpdateDepartmentUser event.
	 * @param _event the event that was fired. Currently supports custom event EVENT_UPDATE_DEPARTMENT_USER and EVENT_REMOVE_DEPARTMENT_USER
	 * @param _source Expected to be a registered Organization
	 * @param _id ID of department
	 * @param _userAccount address of user added
	 */
    function eventFired(bytes32 _event, address _source, bytes32 _id, address _userAccount) external {
        if (_event == EVENT_UPDATE_DEPARTMENT_USER &&
            ParticipantsManagerDb(database).organizationExists(_source)) {
            emit UpdateDepartmentUser(TABLE_DEPARTMENT_USERS, _source, _id, _userAccount);
        } else if (_event == EVENT_REMOVE_DEPARTMENT_USER &&
            ParticipantsManagerDb(database).organizationExists(_source)) {
            emit RemoveDepartmentUser(TABLE_DEPARTMENT_USERS, _source, _id, _userAccount);
        }
    }

	/**
	 * @dev Internal convenience function to emit a UpdateOrganizationApprover event for each of the current approvers of the given organization.
	 * @param _address the organization address
	 */
    function fireOrganizationApproverEvents(address _address) internal {
        for (uint i=0; i<Organization(_address).getNumberOfApprovers(); i++) {
            emit UpdateOrganizationApprover(TABLE_ORGANIZATION_APPROVERS, _address, Organization(_address).getApproverAtIndex(i));
        }
    }

	/**
	 * @dev Internal convenience function to emit a UpdateDepartment event for each of the current departments of the given organization.
	 * @param _address the organization address
	 */
    function fireDepartmentEvents(address _address) internal {
        for (uint i=0; i<Organization(_address).getNumberOfDepartments(); i++) {
            emit UpdateOrganizationDepartment(TABLE_ORGANIZATION_DEPARTMENTS, _address, Organization(_address).getDepartmentAtIndex(i));
        }
    }

}
