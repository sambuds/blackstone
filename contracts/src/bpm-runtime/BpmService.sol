pragma solidity ^0.4.23;

import "bpm-model/ProcessModelRepository.sol";
import "commons-management/Upgradeable.sol";

import "bpm-runtime/ApplicationRegistry.sol";
import "bpm-runtime/ProcessInstance.sol";
import "bpm-runtime/BpmServiceDb.sol";

/**
 * @title BpmService Interface
 * @dev Manages manual tasks, processes, and their data.
 */
contract BpmService is Upgradeable {

	// Events
	event UpdateActivities(string name, address key1, bytes32 key2);
	event UpdateProcesses(string name, address key1);
	event UpdateProcessData(string name, address key1, bytes32 key2);

    /**
     * @dev Gets the ProcessModelRepository address for this BpmService
     * @return the address of the repository
     */
    function getProcessModelRepository() external view returns (ProcessModelRepository);

	/**
	 * @dev Returns a reference to the ApplicationRegistry currently used by this BpmService
	 * @return the ApplicationRegistry
	 */
    function getApplicationRegistry() external view returns (ApplicationRegistry);

	/**
	 * @dev Creates a new ProcessInstance based on the specified ProcessDefinition and starts its execution
	 * @param _processDefinition the address of a ProcessDefinition
	 * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
	 * @return error code indicating success or failure
	 * @return instance the address of a ProcessInstance, if successful
	 */
	function startProcess(address _processDefinition, bytes32 _activityInstanceId) public returns (uint error, address);

	/**
	 * @dev Creates a new ProcessInstance based on the specified IDs of a ProcessModel and ProcessDefinition and starts its execution
	 * @param _modelId the model that qualifies the process ID, if multiple models are deployed, otherwise optional
	 * @param _processDefinitionId the ID of the process definition
	 * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
	 * @return error code indicating success or failure
	 * @return instance the address of a ProcessInstance, if successful
	 */
	function startProcessFromRepository(bytes32 _modelId, bytes32 _processDefinitionId, bytes32 _activityInstanceId) public returns (uint error, address);

	/**
	 * @dev Initializes, registers, and executes a given ProcessInstance
	 * @param _pi the ProcessInstance
	 * @return BaseErrors.NO_ERROR() if successful or an error code from initializing or executing the ProcessInstance
	 */
	function startProcessInstance(ProcessInstance _pi) public returns (uint error);

	/**
	 * @dev Creates a new ProcessInstance initiated with the provided parameters. This ProcessInstance can be further customized and then
	 * submitted to the #startProcessInstance(ProcessInstance) function for execution.
	 * @param _processDefinition the address of a ProcessDefinition
	 * @param _startedBy the address of an account that regarded as the starting user
     * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
	 */
	function createDefaultProcessInstance(address _processDefinition, address _startedBy, bytes32 _activityInstanceId) public returns (ProcessInstance);

	/**
	 * @dev Returns the bool value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the bool value resulting from resolving the data mapping
	 */
	function getActivityInDataAsBool(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (bool);

	/**
	 * @dev Returns the string value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the string value resulting from resolving the data mapping
	 */
	function getActivityInDataAsString(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (string);

	/**
	 * @dev Returns the bytes32 value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the bytes32 value resulting from resolving the data mapping
	 */
	function getActivityInDataAsBytes32(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (bytes32);

	/**
	 * @dev Returns the uint value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the uint value resulting from resolving the data mapping
	 */
	function getActivityInDataAsUint(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (uint);

	/**
	 * @dev Returns the int value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the int value resulting from resolving the data mapping
	 */
	function getActivityInDataAsInt(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (int);

	/**
	 * @dev Returns the address value of the specified IN data mapping in the context of the given activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the address value resulting from resolving the data mapping
	 */
	function getActivityInDataAsAddress(bytes32 _activityInstanceId, bytes32 _dataMappingId) external view returns (address);

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsBool(bytes32 _activityInstanceId, bytes32 _dataMappingId, bool _value) external;

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsString(bytes32 _activityInstanceId, bytes32 _dataMappingId, string _value) external;

	/**
	 * @dev Applies the given bytes32 value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsBytes32(bytes32 _activityInstanceId, bytes32 _dataMappingId, bytes32 _value) external;

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsUint(bytes32 _activityInstanceId, bytes32 _dataMappingId, uint _value) external;

	/**
	 * @dev Applies the given int value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsInt(bytes32 _activityInstanceId, bytes32 _dataMappingId, int _value) external;

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsAddress(bytes32 _activityInstanceId, bytes32 _dataMappingId, address _value) external;

	/**
	 * @dev Returns the number of Process Instances.
	 * @return the process instance count as size
	 */
	function getNumberOfProcessInstances() external view returns (uint size);

	/**
	 * @dev Returns the process instance address at the specified index
	 * @param _pos the index
	 * @return the process instance address or or BaseErrors.INDEX_OUT_OF_BOUNDS(), 0x0
	 */
	function getProcessInstanceAtIndex(uint _pos) external view returns (address processInstanceAddress);

	/**
	 * @dev Returns information about the process intance with the specified address
	 * @param _address the process instance address
	 * @return processDefinition the address of the ProcessDefinition
	 * @return state the BpmRuntime.ProcessInstanceState as uint8
	 * @return startedBy the address of the account who started the process
	 */
	function getProcessInstanceData(address _address) external view returns (address processDefinition, uint8 state, address startedBy);

	/**
	 * @dev Returns the number of activity instances.
	 * @return the activity instance count as size
	 */
	function getNumberOfActivityInstances(address _address) external view returns (uint size);

	/**
	 * @dev Returns the ActivityInstance ID at the specified index
	 * @param _address the process instance address
	 * @param _pos the activity instance index
	 * @return the ActivityInstance ID
	 */
	function getActivityInstanceAtIndex(address _address, uint _pos) external view returns (bytes32 activityId);

 	/**
 	 * @dev Returns ActivityInstance data for the given ActivityInstance ID
	 * @param _processInstance the process instance address to which the ActivityInstance belongs
	 * @param _id the global ID of the activity instance
	 * @return activityId - the ID of the activity as defined by the process definition
	 * @return created - the creation timestamp
	 * @return completed - the completion timestamp
	 * @return performer - the account who is performing the activity (for interactive activities only)
	 * @return completedBy - the account who completed the activity (for interactive activities only) 
	 * @return state - the uint8 representation of the BpmRuntime.ActivityInstanceState of this activity instance
	 */
	function getActivityInstanceData(address _processInstance, bytes32 _id) external view returns (
        bytes32 activityId, 
        uint created,
        uint completed,
        address performer,
        address completedBy,
        uint8 state);

	/**
	 * @dev Returns the number of process data entries.
	 * @return the process data size
	 */
	function getNumberOfProcessData(address _address) external view returns (uint size);

	/**
	 * @dev Returns the process data ID at the specified index
	 * @param _pos the index
	 * @return the data ID
	 */
	function getProcessDataAtIndex(address _address, uint _pos) external view returns (bytes32 dataId);

	/**
	 * @dev Returns information about the process data entry for the specified process and data ID
	 * @param _address the process instance
	 * @param _dataId the data ID
	 * @return (process,id,uintValue,bytes32Value,addressValue,boolValue)
	 */
	function getProcessDataDetails(address _address, bytes32 _dataId)
		external view
		returns (uint uintValue,
				 int intValue,
				 bytes32 bytes32Value,
				 address addressValue,
				 bool boolValue);

	/**
	 * @dev Returns the number of address scopes for the given ProcessInstance.
	 * @param _processInstance the address of a ProcessInstance
	 * @return the number of scopes
	 */
	function getNumberOfAddressScopes(address _processInstance) external view returns (uint size);

	/**
	 * @dev Returns the address scope key at the given index position of the specified ProcessInstance.
	 * @param _processInstance the address of a ProcessInstance
	 * @param _index the index position
	 * @return the bytes32 scope key
	 */
	function getAddressScopeKeyAtIndex(address _processInstance, uint _index) external view returns (bytes32);

	/**
	 * @dev Returns detailed information about the address scope with the given key in the specified ProcessInstance
	 * @param _processInstance the address of a ProcessInstance
	 * @param _key a scope key
	 * @return keyAddress - the address encoded in the key
	 * @return keyContext - the context encoded in the key
	 * @return fixedScope - a bytes32 representing a fixed scope
	 * @return dataPath - the dataPath of a ConditionalData defining the scope
	 * @return dataStorageId - the dataStorageId of a ConditionalData defining the scope
	 * @return dataStorage - the dataStorgage address of a ConditionalData defining the scope
	 */
	function getAddressScopeDetails(address _processInstance, bytes32 _key)
		external view
		returns (address keyAddress,
				 bytes32 keyContext,
				 bytes32 fixedScope,
				 bytes32 dataPath,
				 bytes32 dataStorageId,
				 address dataStorage);

	/**
	 * @dev Returns the address of the ProcessInstance of the specified ActivityInstance ID
	 * @param _aiId the ID of an ActivityInstance
	 * @return the ProcessInstance address or 0x0 if it cannot be found
	 */
	function getProcessInstanceForActivity(bytes32 _aiId) external view returns (address);

	/**
	 * @dev Returns a reference to the BpmServiceDb currently used by this BpmService
	 * @return the BpmServiceDb
	 */
	function getBpmServiceDb() external view returns (BpmServiceDb);

	/**
	 * @dev Fires the UpdateActivities event to update sqlsol with given activity
	 * @param _piAddress - the address of the process instance to which the activity belongs
	 * @param _activityId - the bytes32 Id of the activity
	 */
	function fireActivityUpdateEvent(address _piAddress, bytes32 _activityId) external;

	/**
	 * @dev Fires the UpdateProcessData event to update sqlsol with given information
	 * @param _piAddress - the address of the process instance to which the activity belongs
	 * @param _dataId - the ID of the data entry
	 */
	function fireProcessDataUpdateEvent(address _piAddress, bytes32 _dataId) external;

}