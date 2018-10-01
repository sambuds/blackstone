pragma solidity ^0.4.23;

import "commons-utils/TypeUtilsAPI.sol";

import "commons-auth/Ecosystem.sol";
import "commons-auth/DefaultEcosystem.sol";
import "commons-auth/ParticipantsManager.sol";
import "commons-auth/ParticipantsManagerDb.sol";
import "commons-auth/DefaultParticipantsManager.sol";
import "commons-auth/UserAccount.sol";
import "commons-auth/DefaultUserAccount.sol";
import "commons-auth/DefaultOrganization.sol";

contract ParticipantsManagerTest {

    string constant SUCCESS = "success";

    uint error;
    address addr;
    bytes32 id;
    
    ParticipantsManager participantsManager;

    bytes32 EMPTY = "";
    string constant EMPTY_STRING = "";

    // TODO: Remove below func, create Accounts Manager in test contract instead of injecting
    function setParticipantsManager(address _accountsManager) external {
		participantsManager = ParticipantsManager(_accountsManager);
	}

    /**
     * @dev Tests UserAccount/Owner/Ecosystem relationships and authorizing transactions.
     */
    function testUserAccountSecurity() external returns (string) {

        ExternalCaller ownerCaller = new ExternalCaller();
        ExternalCaller ecosystemCaller = new ExternalCaller();

        Ecosystem myEcosystem = new DefaultEcosystem();
        myEcosystem.addExternalAddress(address(ecosystemCaller));

        TestUserAccount user1 = new TestUserAccount("user1", address(ownerCaller), address(myEcosystem));

        // first test failure
        if (address(user1).call(bytes4(keccak256(abi.encodePacked("authorizedCall()")))))
            return "It should not be possible to call a protected function on a UserAccount from an unautorized address";
        // test success
        if (!ownerCaller.performExternalCall(user1))
            return "Calling the UserAccount from a valid owner should be allowed";
        if (!ecosystemCaller.performExternalCall(user1))
            return "Calling the UserAccount from a valid ecosystem address should be allowed";

        return SUCCESS;
    }

    function testParticipantsManager() external returns (string) {
        // generate unique names for this test
        bytes32 acc1Id = TypeUtilsAPI.toBytes32(block.number+34);
        bytes32 acc2Id = "dummyId";
        bytes32 acc3Id = "dummyId2";
        bytes32 dep1Id = "dep1Id";
        string memory dep1Name = "dep1Name";
        bytes32 dep2Id = "dep2Id";
        string memory dep2Name = "dep1Name";

        // create the required organizations
        address[10] memory approvers;
        DefaultOrganization org1 = new DefaultOrganization(approvers, EMPTY_STRING);
        DefaultOrganization org2 = new DefaultOrganization(approvers, EMPTY_STRING);

        UserAccount account1 = new DefaultUserAccount(acc1Id, participantsManager, 0x0);
        UserAccount account2 = new DefaultUserAccount(acc2Id, participantsManager, 0x0);
        address account3;
        uint oldSize = participantsManager.getUserAccountsSize();
        uint departmentUserSize;

        if (BaseErrors.NO_ERROR() != participantsManager.addUserAccount(account1)) return "Error adding account1.";
        if (BaseErrors.NO_ERROR() != participantsManager.addUserAccount(account2)) return "Error adding account2.";
        if (BaseErrors.RESOURCE_ALREADY_EXISTS() != participantsManager.addUserAccount(account2)) return "Expected error for existing account2.";

        // test adding users
        if (participantsManager.getUserAccountsSize() != oldSize + 2) return "Expected accounts size to be +2";

        // test creating user
        oldSize = participantsManager.getUserAccountsSize();

        // test creating user accounts via ParticipantsManager
        account3 = participantsManager.createUserAccount(acc3Id, this, 0x0);

        if (UserAccount(account3).getId() != keccak256(abi.encodePacked(acc3Id))) return "UserAccount account3 id mismatch";
        (error, addr) = participantsManager.getUserAccount(acc3Id);
        if (addr != account3) return "account3 address mismatch";
        if (error != BaseErrors.NO_ERROR()) return "Exp. NO_ERROR";
        if (addr == 0x0) return "Exp. non-0x0 address";
        if (UserAccount(addr).getId() != keccak256(abi.encodePacked(acc3Id))) return "UserAccount addr id mismatch";
        if (UserAccount(addr).getOwner() != address(this)) return "Exp. this";
        if (participantsManager.getUserAccountsSize() != oldSize + 1) return "Expected accounts size to be +1";
        (error, addr, id) = participantsManager.getUserAccountDataById(acc3Id);
        if (error != BaseErrors.NO_ERROR()) return "Exp. NO_ERROR retrieving account data by id";
        if (addr == 0x0) return "Exp. non-0x0 address retrieving account data by id";
        if (id != keccak256(abi.encodePacked(acc3Id))) return "UserAccount account3 id mismatch retrieving account data by id";

        // test adding user accounts to organizations via Organization
        oldSize = org1.getNumberOfUsers();
        if (!org1.addUser(account2)) return "Adding account2 to org1 failed";
        if (oldSize+1 != org1.getNumberOfUsers()) return "Expected number of user in org1 to have increased after account2 added.";
        if (org1.getUserAtIndex(0) != address(account2)) return "Expected second user of org1 to be account2";
        if (!org1.authorizeUser(account2, keccak256(abi.encodePacked(address(org1))))) return "account2 expected to be active in org1";
        if (!org1.removeUser(account2)) return "Removing account2 from org1 failed.";
        if (org1.authorizeUser(account2, keccak256(abi.encodePacked(address(org1))))) return "account2 expected to be inactive in org1";
        if (!org1.addUser(account2)) return "Failed adding account2 back into org1";
        if (!org1.authorizeUser(account2, keccak256(abi.encodePacked(address(org1))))) return "account2 expected to be active again in org1";

        // user can be added to multiple organizations
        oldSize = org2.getNumberOfUsers();
        if (!org2.addUser(account2)) return "Adding account2 to org2 failed";
        if (oldSize+1 != org2.getNumberOfUsers()) return "Expected number of user in org2 to have increased after account2 added.";
        if (org2.getUserAtIndex(0) != address(account2)) return "Expected second user of org2 to be account2";
        if (!org2.authorizeUser(account2, keccak256(abi.encodePacked(address(org2))))) return "account2 expected to be active in org2";
        if (!org2.removeUser(account2)) return "Removing account2 from org2 failed.";
        if (org2.authorizeUser(account2, keccak256(abi.encodePacked(address(org2))))) return "account2 expected to be inactive in org2";

        // users can be added to departments in organization
        if (org1.addDepartment(dep1Id, dep1Name) != BaseErrors.NO_ERROR()) return "Failed adding dep1 to org1";
        if (org1.addDepartment(dep2Id, dep2Name) != BaseErrors.NO_ERROR()) return "Failed adding dep2 to org1";
        if (!org1.addUserToDepartment(account1, dep1Id)) return "Failed to add account1 to dep1";
        if (!org1.addUserToDepartment(account1, dep2Id)) return "Failed to add account1 to dep2";
        if (!org1.addUserToDepartment(account2, dep1Id)) return "Failed to add account2 to dep1";
        (departmentUserSize, ) = org1.getDepartmentData(dep1Id);
        if (departmentUserSize != 2) return "Expected dep1 in org1 to have two users after adding accounts 1 and 2";
        (departmentUserSize, ) = org1.getDepartmentData(dep2Id);
        if (departmentUserSize != 1) return "Expected dep2 in org1 to have one user after adding account1";
        if (org1.authorizeUser(account1, "fakeDepId")) return "Account1 should not be authorized for fake department in org1";
        if (!org1.authorizeUser(account1, dep1Id)) return "Account1 should be authorized for department1 in org1";
        if (!org1.authorizeUser(account2, dep1Id)) return "Account2 should be authorized for department1 in org1";
        if (org1.authorizeUser(account2, dep2Id)) return "Account2 should not be authorized for department2 in org1";

        // user can be removed from department in organization
        if (!org1.removeUserFromDepartment(account2, dep1Id)) return "Failed to remove account2 from dep1";
        (departmentUserSize, ) = org1.getDepartmentData(dep1Id);
        if (departmentUserSize != 1) return "Expected dep1 in org1 to have 1 user after removing account2";

        // removing user from organization removes user from department
        if (!org1.removeUser(account1)) return "Failed to remove account2 from org1";
        (departmentUserSize, ) = org1.getDepartmentData(dep1Id);
        if (departmentUserSize != 0) return "Expected dep1 in org1 to have no users after removing account1 from org1";
        (departmentUserSize, ) = org1.getDepartmentData(dep2Id);
        if (departmentUserSize != 0) return "Expected dep2 in org1 to have no users after removing account1 from org1";

        return SUCCESS;
    }

    function testOrganizationsManagement() external returns (string) {
		
		// reusable variables in this test
		address[10] memory knownAdmins;
		address[10] memory emptyAdmins;
        bytes32 acc1Id = TypeUtilsAPI.toBytes32(block.number+34);
        bytes32 acc2Id = "dummyId";
        bytes32 dep1Id = "dep1Id";
        string memory dep1Name = "Department 1 Name";
		
		// externally created organizations
		Organization org1 = new DefaultOrganization(emptyAdmins, "Unassigned");

        UserAccount user1 = new DefaultUserAccount(acc1Id, participantsManager, 0x0);
        UserAccount user2 = new DefaultUserAccount(acc2Id, participantsManager, 0x0);
		
        // Test special handling of the default department in the organization
        if (!org1.departmentExists(org1.DEFAULT_DEPARTMENT_ID()))
            return "The default department should have been created when creating the organization";
        if (keccak256(abi.encodePacked(DefaultOrganization(org1).defaultDepartmentName())) != keccak256(abi.encodePacked("Unassigned")))
            return "The default department name should have been overwritten";
        if (org1.removeDepartment(org1.DEFAULT_DEPARTMENT_ID()))
            return "It should not be possible to remove the default department";

		// 1. Test adding existing organization contract

		error = participantsManager.addOrganization(org1);
		if (error != BaseErrors.NO_ERROR()) return "Unexpected error adding org1.";
		if (participantsManager.getNumberOfOrganizations() != 1) return "Number of Orgs in participantsManager should be 1";
		if (org1.getNumberOfApprovers() != 1) return "Number of approvers in org1 not correct";
		if (org1.getApproverAtIndex(0) != address(this)) return "Approver in org1 should be 'this'";
		if (!participantsManager.getOrganization(address(org1))) return "Failed retrieving org1 by its ID";

		// double-adding org1 should return error
		error = participantsManager.addOrganization(org1);
		if (error != BaseErrors.RESOURCE_ALREADY_EXISTS()) return "Expected error for adding already registered org1.";
		if (participantsManager.getNumberOfOrganizations() != 1) return "Number of Orgs in participantsManager should be 1";

        // departments
        if (org1.addDepartment(dep1Id, dep1Name) != BaseErrors.NO_ERROR()) return "Failed adding department to org1";
        // reminder: number of deps is +1 due to the default department
        if (org1.getNumberOfDepartments() != 2) return "Failed to get number of departments in org1";
        if (org1.getDepartmentAtIndex(1) != dep1Id) return "Failed to get department id at pos 0 in org1";
        if (!org1.departmentExists(dep1Id)) return "Failed to find existance of dep1 in org1";
        (uint retUserCount, string memory retDepName) = org1.getDepartmentData(dep1Id);
        if (retUserCount != 0) return "Failed to get department data (user count) for dep1 in org1";
        if (keccak256(abi.encodePacked(retDepName)) != keccak256(abi.encodePacked(dep1Name))) return "Failed to get department data (name) for dep1 in org1";
		address orgAddr = participantsManager.getOrganizationAtIndex(0);
		if (orgAddr != address(org1)) return "Expected org1 address";
		if (participantsManager.getOrganizationData(orgAddr) != 1) return "Expected number of approvers for orgAddr to be 1";

        // department users
        if (!org1.addUserToDepartment(user1, dep1Id)) return "Failed to add user1 to dep1";
        if (!org1.addUserToDepartment(user2, dep1Id)) return "Failed to add user2 to dep1";
        if (org1.getNumberOfDepartmentUsers(dep1Id) != 2) return "Expected 2 department users in dep1";
        if (org1.getDepartmentUserAtIndex(dep1Id, 0) != address(user1)) return "Expected department user at idx 0 to be user1";
        if (org1.getDepartmentUserAtIndex(dep1Id, 1) != address(user2)) return "Expected department user at idx 1 to be user2";
        if (!org1.removeUserFromDepartment(user1, dep1Id)) return "Failed removing user1 from dep1";
        if (org1.getDepartmentUserAtIndex(dep1Id, 0) != address(user2)) return "Expected department user at idx 0 to be user2 after removing user1";        
        if (org1.getNumberOfDepartmentUsers(dep1Id) != 1) return "Expected 1 department user in dep1 after removing user1";
        if (org1.addUserToDepartment(user2, dep1Id) != false) return "Expected attempt to re-add user2 to dep1 to return false";
        if (org1.getNumberOfDepartmentUsers(dep1Id) != 1) return "Expected re-adding user2 to dep1 to not change number of department users";

		// 0x0 address for non-existent index
		if (participantsManager.getOrganizationAtIndex(1) != 0x0) return "Expected 0x0";

		// 2. Test factory function

		// create with known admins
		knownAdmins[0] = tx.origin;
		knownAdmins[1] = org1;
		
		address orgAddress2;
        (error, orgAddress2) = participantsManager.createOrganization(knownAdmins, EMPTY_STRING);
        if (BaseErrors.NO_ERROR() != error) return "Unexpected error creating organization 2 (known admins)";
		if (Organization(orgAddress2).getNumberOfApprovers() != 2) return "Number of approvers in organization 2 not correct";
		if (Organization(orgAddress2).getApproverAtIndex(0) != tx.origin) return "Approver 1 in organization 2 should be tx.origin";
		if (Organization(orgAddress2).getApproverAtIndex(1) != address(org1)) return "Approver 2 in organization 2 should be org1";
		if (participantsManager.getOrganization(orgAddress2) != true) return "Failed retrieving organization 2 by its address";
		// create with emptyAdmins again, so that msg.sender is automatically used for approver
		address orgAddress3;
        (error, orgAddress3) = participantsManager.createOrganization(emptyAdmins, EMPTY_STRING);
        if (BaseErrors.NO_ERROR() != error) return "Unexpected error creating organization 3 (empty admins)";
		if (Organization(orgAddress3).getNumberOfApprovers() != 1) return "Number of approvers in organization 3 not correct";
		if (Organization(orgAddress3).getApproverAtIndex(0) != address(participantsManager)) return "Approver in organization 3 should be the ecoparticipantsManager as the creator.";
		if (participantsManager.getOrganization(orgAddress3) != true) return "Failed retrieving organization 3 by its address";

		if (participantsManager.getNumberOfOrganizations() != 3) return "Number of Orgs in participantsManager should be 3 at this point.";

		orgAddr = participantsManager.getOrganizationAtIndex(2);
		if (orgAddr != orgAddress3) return "Expected orgAddress3";
		if (participantsManager.getOrganizationData(orgAddress3) != 1) return "Expected number of approvers for orgAddress3 to be 1";

		return SUCCESS;
	}

    /**
     * @dev Tests the variations of the organization's authorizeUser function
     */
    function testOrganizationAuthorization() external returns (string) {

		address[10] memory emptyAdmins;

        Organization org = new DefaultOrganization(emptyAdmins, EMPTY_STRING);
        bytes32 user1Id = "user1";
        bytes32 user2Id = "user2";
        bytes32 user3Id = "user3";
        bytes32 dep1Id = "department";

        UserAccount user1 = new DefaultUserAccount(user1Id, participantsManager, 0x0);
        UserAccount user2 = new DefaultUserAccount(user2Id, participantsManager, 0x0);
        UserAccount user3 = new DefaultUserAccount(user3Id, participantsManager, 0x0);

        // User1 -> default department
        // User2 -> Department 1
        // User3 -> Organization only 
        if (org.addDepartment(dep1Id, "Department 1") != BaseErrors.NO_ERROR()) return "Failed adding department to org1";
        if (!org.addUserToDepartment(user1, EMPTY)) return "Failed to add user1 to default department";
        if (!org.addUserToDepartment(user2, dep1Id)) return "Failed to add user2 to department1";
        if (!org.addUser(user3)) return "Failed to add user3 to organization";

        if (org.getNumberOfDepartmentUsers(dep1Id) != 1) return "There should be 1 user in department 1";
        // auth failure
        if (org.authorizeUser(address(user1), dep1Id)) return "User1 should not be authorized for department1";
        if (org.authorizeUser(address(user3), EMPTY)) return "User3 should not be authorized for empty department (default)";
        if (org.authorizeUser(address(this), keccak256(abi.encodePacked(address(org))))) return "Test address should not be authorized for the organization";
        // auth success
        if (!org.authorizeUser(address(user1), EMPTY)) return "User1 should be authorized for empty department (default)";
        if (!org.authorizeUser(address(user1), "fakeDepartmentXYZ")) return "User1 should be authorized for non-existent department (default)";
        if (!org.authorizeUser(address(user2), dep1Id)) return "User2 should be authorized for department1";
        if (!org.authorizeUser(address(user3), keccak256(abi.encodePacked(address(org))))) return "User3 should be authorized for the organization";
        if (!org.authorizeUser(address(user1), keccak256(abi.encodePacked(address(org))))) return "User1 should be authorized for the organization";

        return SUCCESS;
    }

}

contract TestUserAccount is DefaultUserAccount {

    constructor(bytes32 _id, address _owner, address _ecosystem) public
        DefaultUserAccount(_id, _owner, _ecosystem) {
        
    }

    function authorizedCall()
        external view
        pre_onlyAuthorizedCallers
        returns (bool)
    {
        return true;
    }
}

contract ExternalCaller {

    function performExternalCall(TestUserAccount _user) external view returns (bool) {
        return _user.authorizedCall();
    }

}