pragma solidity ^0.4.23;

import "commons-base/ErrorsLib.sol";
import "commons-auth/ParticipantsManager.sol";
import "commons-auth/Ecosystem.sol";
import "commons-base/BaseErrors.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-management/AbstractDbUpgradeable.sol";
import "commons-management/ContractLocatorEnabled.sol";
import "bpm-model/ProcessModelRepository.sol";
import "bpm-model/ProcessDefinition.sol";
import "bpm-model/ProcessModel.sol";

import "bpm-runtime/BpmRuntime.sol";
import "bpm-runtime/BpmRuntimeLib.sol";
import "bpm-runtime/BpmService.sol";
import "bpm-runtime/BpmServiceDb.sol";
import "bpm-runtime/ProcessInstance.sol";
import "bpm-runtime/DefaultProcessInstance.sol";
import "bpm-runtime/WorkflowUserAccount.sol";

/**
 * @title DefaultBpmService
 * @dev Default implementation of the BpmService interface.
 */
contract DefaultBpmService is Versioned(1,0,0), AbstractDbUpgradeable, ContractLocatorEnabled, BpmService {

    using BpmRuntimeLib for ProcessInstance;

    string constant TABLE_PROCESS_INSTANCES = "PROCESS_INSTANCES";
    string constant TABLE_ACTIVITY_INSTANCES = "ACTIVITY_INSTANCES";
    string constant TABLE_PROCESS_DATA = "PROCESS_DATA";

    //TODO these string should not be hardcoded. Inject via constructor after AN-307 fixed
    string constant serviceIdProcessModelRepository = "ProcessModelRepository";
    string constant serviceIdApplicationRegistry = "ApplicationRegistry";

    ProcessModelRepository modelRepository;
    ApplicationRegistry applicationRegistry;

    /**
     * @dev REVERTS if
     * - the activity instance is not found in the database
     * - the activity is of task type USER, but not in SUSPENDED state
     * - the activity is of task type SERVICE or EVENT, but not in APPLICATION state
     * - the msg.sender or tx.origin cannot be authorized as the performer of the activity instance for all activity types except BpmModel.TaskType.NONE.
     */
    modifier pre_inDataPermissionCheck(bytes32 _activityInstanceId) {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        ErrorsLib.revertIf(piAddress == 0x0,
            ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultBpmService.pre_inDataPermissionCheck", "ProcessInstance for provided ActivityInstance ID not found");
        (bytes32 activityId, , , , , uint8 state) = ProcessInstance(piAddress).getActivityInstanceData(_activityInstanceId);
        ( , uint8 taskType, , , , , , ) = ProcessDefinition(ProcessInstance(piAddress).getProcessDefinition()).getActivityData(activityId);
        if (taskType == uint8(BpmModel.TaskType.USER)) {
            ErrorsLib.revertIf(state != uint(BpmRuntime.ActivityInstanceState.SUSPENDED),
                ErrorsLib.INVALID_STATE(), "DefaultBpmService.pre_inDataPermissionCheck", "USER task state must be SUSPENDED for IN mappings");
        }
        else if (taskType == uint8(BpmModel.TaskType.SERVICE) || taskType == uint8(BpmModel.TaskType.EVENT)) {
            ErrorsLib.revertIf(state != uint(BpmRuntime.ActivityInstanceState.APPLICATION),
                ErrorsLib.INVALID_STATE(), "DefaultBpmService.pre_inDataPermissionCheck", "SERVICE or EVENT task state must be APPLICATION for IN mappings");
        }
        if (taskType != uint8(BpmModel.TaskType.NONE)) {
            ErrorsLib.revertIf(BpmRuntimeLib.authorizePerformer(_activityInstanceId, ProcessInstance(piAddress)) == address(0),
                ErrorsLib.UNAUTHORIZED(), "DefaultBpmService.pre_inDataPermissionCheck", "Unable to authorize msg.sender/tx.origin as performer of a USER/SERVICE/EVENT task for IN mappings");
        }
        _;
    }

    /**
     * @dev REVERTS if
     * - the activity instance is not found in the database
     * - the activity is of task type USER or EVENT, but not in SUSPENDED state
     * - the activity is of task type SERVICE, but not in APPLICATION state
     * - the msg.sender is not set as the performer of the activity instance for all activity types except BpmModel.TaskType.NONE.
     */
    modifier pre_outDataPermissionCheck(bytes32 _activityInstanceId) {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        ErrorsLib.revertIf(piAddress == 0x0,
            ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultBpmService.pre_outDataPermissionCheck", "ProcessInstance for provided ActivityInstance ID not found");
        (bytes32 activityId, , , , , uint8 state) = ProcessInstance(piAddress).getActivityInstanceData(_activityInstanceId);
        ( , uint8 taskType, , , , , , ) = ProcessDefinition(ProcessInstance(piAddress).getProcessDefinition()).getActivityData(activityId);
        if (taskType == uint8(BpmModel.TaskType.USER) || taskType == uint8(BpmModel.TaskType.EVENT)) {
            ErrorsLib.revertIf(state != uint(BpmRuntime.ActivityInstanceState.SUSPENDED),
                ErrorsLib.INVALID_STATE(), "DefaultBpmService.pre_outDataPermissionCheck", "USER or EVENT task state must be SUSPENDED for OUT mappings");
        }
        else if (taskType == uint8(BpmModel.TaskType.SERVICE)) {
            ErrorsLib.revertIf(state != uint(BpmRuntime.ActivityInstanceState.APPLICATION),
                ErrorsLib.INVALID_STATE(), "DefaultBpmService.pre_outDataPermissionCheck", "SERVICE task state must be APPLICATION for OUT mappings");
        }
        if (taskType != uint8(BpmModel.TaskType.NONE)) {
            ErrorsLib.revertIf(BpmRuntimeLib.authorizePerformer(_activityInstanceId, ProcessInstance(piAddress)) == address(0),
                ErrorsLib.UNAUTHORIZED(), "DefaultBpmService.pre_outDataPermissionCheck", "Unable to authorize msg.sender/tx.origin as performer of a USER/SERVICE/EVENT task for OUT mappings");
        }
        _;
    }

	/**
	 * @dev Creates a new ProcessInstance based on the specified ProcessDefinition and starts its execution
	 * @param _processDefinition the address of a ProcessDefinition
     * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
     * @return any error resulting from ProcessInstance.execute() or BaseErrors.NO_ERROR(), if successful
     * @return the address of a ProcessInstance, if successful
	 */
    function startProcess(address _processDefinition, bytes32 _activityInstanceId)
        public
        returns (uint error, address)
    {
        ProcessInstance pi = createDefaultProcessInstance(_processDefinition, msg.sender, _activityInstanceId);
        error = startProcessInstance(pi);
        return (error, pi);
    }

    /**
	 * @dev Creates a new ProcessInstance based on the specified IDs of a ProcessModel and ProcessDefinition and starts its execution
     * @param _modelId the model that qualifies the process ID, if multiple models are deployed, otherwise optional
     * @param _processDefinitionId the ID of the process definition
     * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
     * REVERTS if:
     * - a ProcessDefinition cannot be located in the ProcessModelRepository
     * @return any error resulting from ProcessInstance.execute() or ProcessBaseErrors.NO_ERROR(), if successful
     * @return the address of a ProcessInstance, if successful
     * //TODO this function should be called startProcess(bytes32, bytes32), but our JS libs have a problem with polymorphism: AN-301
     */
    function startProcessFromRepository(bytes32 _modelId, bytes32 _processDefinitionId, bytes32 _activityInstanceId)
        public
        returns (uint error, address)
    {
        address pd = modelRepository.getProcessDefinition(_modelId, _processDefinitionId);
        ErrorsLib.revertIf(pd == 0x0,
            ErrorsLib.RESOURCE_NOT_FOUND(), "DefaultBpmService.startProcessFromRepository", "Unable to find a ProcessDefinition for the given ID");
        return startProcess(pd, _activityInstanceId);
    }

    /**
     * @dev Initializes, registers, and executes a given ProcessInstance
     * @param _pi the ProcessInstance
     * @return BaseErrors.NO_ERROR() if successful or an error code from executing the ProcessInstance
     */
    function startProcessInstance(ProcessInstance _pi)
        public
        returns (uint error)
    {
        _pi.initRuntime();
        BpmServiceDb(database).addProcessInstance(_pi);
        bytes32 dataId;
        for (uint i=0; i<_pi.getSize(); i++) {
            ( ,dataId) = _pi.getDataIdAtIndex(i);
            emit UpdateProcessData(TABLE_PROCESS_DATA, _pi, dataId);
        }
        error = _pi.execute(this);
        emit UpdateProcesses(TABLE_PROCESS_INSTANCES, _pi);
    }

	/**
	 * @dev Creates a new ProcessInstance initiated with the provided parameters. This ProcessInstance can be further customized and then
	 * submitted to the #startProcessInstance(ProcessInstance) function for execution. The ownership of the created ProcessInstance
     * is transfered to the msg.sender, i.e. the caller of this function will be the owner of the ProcessInstance.
     * REVERTS if:
     * - the provided ProcessDefinition is NULL
	 * @param _processDefinition the address of a ProcessDefinition
	 * @param _startedBy the address of an account that regarded as the starting user. If empty, the msg.sender is used.
     * @param _activityInstanceId the ID of a subprocess activity instance that initiated this ProcessInstance (optional)
	 */
    function createDefaultProcessInstance(address _processDefinition, address _startedBy, bytes32 _activityInstanceId)
        public
        returns (ProcessInstance processInstance)
    {
        ErrorsLib.revertIf(_processDefinition == 0x0,
            ErrorsLib.NULL_PARAMETER_NOT_ALLOWED(), "DefaultBpmService.createDefaultProcessInstance", "ProcessDefinition is NULL");
        processInstance = new DefaultProcessInstance(ProcessDefinition(_processDefinition), (_startedBy == 0x0) ? msg.sender : _startedBy, _activityInstanceId);
        processInstance.transferOwnership(msg.sender);
    }

	/**
	 * @dev Returns the bool value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the bool value resulting from resolving the data mapping
	 */
	function getActivityInDataAsBool(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (bool)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsBool(dataPath);
    }

	/**
	 * @dev Returns the string value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the string value resulting from resolving the data mapping
	 */
	function getActivityInDataAsString(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (string)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsString(dataPath);
    }

	/**
	 * @dev Returns the bytes32 value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the bytes32 value resulting from resolving the data mapping
	 */
	function getActivityInDataAsBytes32(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (bytes32)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsBytes32(dataPath);
    }

	/**
	 * @dev Returns the uint value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the uint value resulting from resolving the data mapping
	 */
	function getActivityInDataAsUint(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (uint)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsUint(dataPath);
    }

	/**
	 * @dev Returns the int value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the int value resulting from resolving the data mapping
	 */
	function getActivityInDataAsInt(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (int)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsInt(dataPath);
    }

	/**
	 * @dev Returns the address value of the specified IN data mapping in the context of the given activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_inDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an IN data mapping defined for the activity
	 * @return the address value resulting from resolving the data mapping
	 */
	function getActivityInDataAsAddress(bytes32 _activityInstanceId, bytes32 _dataMappingId)
        external view
        pre_inDataPermissionCheck(_activityInstanceId)
        returns (address)
    {
        (address storageAddress, bytes32 dataPath) = ProcessInstance(BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId)).resolveInDataLocation(_activityInstanceId, _dataMappingId);
        return DataStorage(storageAddress).getDataValueAsAddress(dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsBool(bytes32 _activityInstanceId, bytes32 _dataMappingId, bool _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsBool(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsString(bytes32 _activityInstanceId, bytes32 _dataMappingId, string _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsString(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsBytes32(bytes32 _activityInstanceId, bytes32 _dataMappingId, bytes32 _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsBytes32(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsUint(bytes32 _activityInstanceId, bytes32 _dataMappingId, uint _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsUint(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsInt(bytes32 _activityInstanceId, bytes32 _dataMappingId, int _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsInt(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

	/**
	 * @dev Applies the given value to the OUT data mapping with the specified ID on the specified activity instance.
     * Note: This function triggers a REVERT under conditions set in the pre_outDataPermissionCheck(bytes32) modifier!
	 * @param _activityInstanceId the ID of an activity instance managed by this BpmService
	 * @param _dataMappingId the ID of an OUT data mapping defined for the activity
	 * @param _value the value to set
	 */
	function setActivityOutDataAsAddress(bytes32 _activityInstanceId, bytes32 _dataMappingId, address _value)
        external
        pre_outDataPermissionCheck(_activityInstanceId)
    {
        address piAddress = BpmServiceDb(database).getProcessInstanceForActivity(_activityInstanceId);
        (address storageAddress, bytes32 dataPath) = ProcessInstance(piAddress).resolveOutDataLocation(_activityInstanceId, _dataMappingId);
        DataStorage(storageAddress).setDataValueAsAddress(dataPath, _value);
        if (storageAddress == piAddress)
            emit UpdateProcessData(TABLE_PROCESS_DATA, piAddress, dataPath);
    }

    /**
     * @dev Overrides ContractLocatorEnabled.setContractLocator(address).
     * Performs a lookup of dependencies for a ProcessModelRepository and an ApplicationRegistry.
     * REVERTS if:
     * - if any of the dependencies cannot be satisfied.
     * @param _locator the ContractLocator to use
     */
    function setContractLocator(address _locator)
        public
    {
        super.setContractLocator(_locator);
        modelRepository = ProcessModelRepository(ContractLocator(_locator).getContract(serviceIdProcessModelRepository));
        applicationRegistry = ApplicationRegistry(ContractLocator(_locator).getContract(serviceIdApplicationRegistry));
        ErrorsLib.revertIf(address(modelRepository) == 0x0,
			ErrorsLib.DEPENDENCY_NOT_FOUND(), "DefaultBpmService.setContractLocator", "ModelRepository not found");
        ErrorsLib.revertIf(address(applicationRegistry) == 0x0,
			ErrorsLib.DEPENDENCY_NOT_FOUND(), "DefaultBpmService.setContractLocator", "ApplicationRegistry not found");
        ContractLocator(_locator).addContractChangeListener(serviceIdProcessModelRepository);
        ContractLocator(_locator).addContractChangeListener(serviceIdApplicationRegistry);
    }

    /**
     * @dev Implements ContractChangeListener.contractChanged(string,address) to update this contract's dependencies.
     */
    function contractChanged(string _name, address, address _newAddress)
        external
        pre_onlyByLocator
    {
        if (keccak256(abi.encodePacked(_name)) == keccak256(abi.encodePacked(serviceIdProcessModelRepository))){
            modelRepository = ProcessModelRepository(_newAddress);
        }
        else if (keccak256(abi.encodePacked(_name)) == keccak256(abi.encodePacked(serviceIdApplicationRegistry))){
            applicationRegistry = ApplicationRegistry(_newAddress);
        }
    }

	/**
	 * @dev Returns the number of process instances.
	 * @return the process instance count as size
	 */
    function getNumberOfProcessInstances() external view returns (uint size) {
        return BpmServiceDb(database).getNumberOfProcessInstances();
    }

    /**
	 * @dev Returns the process instance address at the specified index
	 * @param _pos the index
	 * @return the process instance address or BaseErrors.INDEX_OUT_OF_BOUNDS(), 0x0
	 */
    function getProcessInstanceAtIndex(uint _pos) external view returns (address processInstanceAddress) {
        return BpmServiceDb(database).getProcessInstanceAtIndex(_pos);
    }

	/**
	 * @dev Returns information about the process intance with the specified address
	 * @param _address the process instance address
	 * @return processDefinition the address of the ProcessDefinition
	 * @return state the BpmRuntime.ProcessInstanceState as uint8
	 * @return startedBy the address of the account who started the process
	 */
    function getProcessInstanceData(address _address) external view returns (address processDefinition, uint8 state, address startedBy) {
        ProcessInstance pi = ProcessInstance(_address);
        processDefinition = pi.getProcessDefinition();
        state = pi.getState();
        startedBy = pi.getStartedBy();
    }

    /**
     * @dev Returns the number of activity instances.
     * @return the activity instance count as size
     */
    function getNumberOfActivityInstances(address _address) external view returns (uint size) {
        return ProcessInstance(_address).getNumberOfActivityInstances();
    }

    /**
	 * @dev Returns the ActivityInstance ID at the specified index
	 * @param _address the process instance address
	 * @param _pos the activity instance index
	 * @return the ActivityInstance ID
	 */
    function getActivityInstanceAtIndex(address _address, uint _pos) external view returns (bytes32 activityId) {
        activityId = ProcessInstance(_address).getActivityInstanceAtIndex(_pos);
    }

    /**
	 * @dev Returns ActivityInstance data for given the ActivityInstance ID
     * @param _processInstance the process instance address to which the ActivityInstance belongs
	 * @param _id the global ID of the activity instance
	 * @return activityId - the ID of the activity as defined by the process definition
	 * @return created - the creation timestamp
	 * @return completed - the completion timestamp
	 * @return performer - the account who is performing the activity (for interactive activities only)
	 * @return completedBy - the account who completed the activity (for interactive activities only) 
	 * @return state - the uint8 representation of the BpmRuntime.ActivityInstanceState of this activity instance
	 */
    function getActivityInstanceData(address _processInstance, bytes32 _id)
        external view
        returns (
            bytes32 activityId, 
            uint created,
            uint completed,
            address performer,
            address completedBy,
            uint8 state)
    {        
        (activityId, created, completed, performer, completedBy, state) = ProcessInstance(_processInstance).getActivityInstanceData(_id);
    }

    /**
	 * @dev Returns the number of process data entries.
	 * @return the process data size
	 */
    function getNumberOfProcessData(address _address) external view returns (uint size) {
        size = ProcessInstance(_address).getSize();
    }

    /**
	 * @dev Returns the process data ID at the specified index
	 * @param _pos the index
	 * @return the data ID
	 */
    function getProcessDataAtIndex(address _address, uint _pos) external view returns (bytes32 dataId) {
        uint error;
        (error, dataId) = ProcessInstance(_address).getDataIdAtIndex(_pos);
    }

    /**
	 * @dev Returns information about the process data entry for the specified process and data ID
	 * @param _address the process instance
	 * @param _dataId the data ID
	 * @return (process,id,uintValue,bytes32Value,addressValue,boolValue)
	 */
    function getProcessDataDetails(address _address, bytes32 _dataId)
        external view
        returns (
            uint uintValue,
            int intValue,
            bytes32 bytes32Value,
            address addressValue,
            bool boolValue)
    {
        uintValue = ProcessInstance(_address).getDataValueAsUint(_dataId);
        intValue = ProcessInstance(_address).getDataValueAsInt(_dataId);
        bytes32Value = ProcessInstance(_address).getDataValueAsBytes32(_dataId);
        addressValue = ProcessInstance(_address).getDataValueAsAddress(_dataId);
        boolValue = ProcessInstance(_address).getDataValueAsBool(_dataId);
    }

	/**
	 * @dev Returns the number of address scopes for the given ProcessInstance.
	 * @param _processInstance the address of a ProcessInstance
	 * @return the number of scopes
	 */
	function getNumberOfAddressDataScopes(address _processInstance) external view returns (uint size) {
        size = ProcessInstance(_processInstance).getAddressScopeKeys().length;
    }

	/**
	 * @dev Returns the address scope key at the given index position of the specified ProcessInstance.
	 * @param _processInstance the address of a ProcessInstance
	 * @param _index the index position
	 * @return the bytes32 scope key
	 */
	function getAddressScopeKeyAtIndex(address _processInstance, uint _index) external view returns (bytes32) {
        return ProcessInstance(_processInstance).getAddressScopeKeys()[_index];
    }

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
				 address dataStorage)
    {
        return ProcessInstance(_processInstance).getAddressScopeDetailsForKey(_key);
    }

    /**
     * @dev Returns the address of the ProcessInstance of the specified ActivityInstance ID
     * @param _aiId the ID of an ActivityInstance
     * @return the ProcessInstance address or 0x0 if it cannot be found
     */
    function getProcessInstanceForActivity(bytes32 _aiId) external view returns (address) {
        return BpmServiceDb(database).getProcessInstanceForActivity(_aiId);
    }

	/**
	 * @dev Returns a reference to the BpmServiceDb currently used by this BpmService
	 * @return the BpmServiceDb
	 */
    function getBpmServiceDb() external view returns (BpmServiceDb) {
        return BpmServiceDb(database);
    }

    /**
     * @dev Gets the ProcessModelRepository address for this BpmService
     * @return the ProcessModelRepository
     */
    function getProcessModelRepository() external view returns (ProcessModelRepository) {
        return modelRepository;
    }

	/**
	 * @dev Returns a reference to the ApplicationRegistry currently used by this BpmService
	 * @return the ApplicationRegistry
	 */
    function getApplicationRegistry() external view returns (ApplicationRegistry) {
        return applicationRegistry;
    }

    /**
     * @dev Fires the UpdateActivities event to update sqlsol with given activity
     * @param _piAddress - the address of the process instance to which the activity belongs
     * @param _activityId - the bytes32 Id of the activity
     */
    function fireActivityUpdateEvent (address _piAddress, bytes32 _activityId) external {
        emit UpdateActivities(TABLE_ACTIVITY_INSTANCES, _piAddress, _activityId);
    }

	/**
     * @dev Fires the UpdateProcessData event to update sqlsol with given information
     * @param _piAddress - the address of the process instance to which the activity belongs
     * @param _dataId - the ID of the data entry
     */
    function fireProcessDataUpdateEvent(address _piAddress, bytes32 _dataId) external {
        emit UpdateProcessData(TABLE_PROCESS_DATA, _piAddress, _dataId);
    }

}