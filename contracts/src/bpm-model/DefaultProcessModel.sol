pragma solidity ^0.4.23;

import "commons-base/BaseErrors.sol";
import "commons-base/ErrorsLib.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-events/DefaultEventEmitter.sol";

import "bpm-model/BpmModel.sol";
import "bpm-model/DefaultProcessDefinition.sol";

/**
 * @title DefaultProcessModel
 * @dev Default implementation of the ProcessModel interface 
 */
contract DefaultProcessModel is ProcessModel, DefaultEventEmitter {

	using MappingsLib for Mappings.Bytes32AddressMap;
	using MappingsLib for Mappings.Bytes32UintMap;

	Mappings.Bytes32UintMap dataDefinitions;
	Mappings.Bytes32AddressMap processDefinitions;
	BpmModel.ParticipantMap participants;
	mapping(bytes32 => bool) processInterfaces;
	bytes32[] processInterfaceKeys;
	bytes32 hoardAddress;
	bytes32 hoardSecret;
	address author;
	bool privateFlag;

	/**
	 * @dev Creates a new DefaultProcessModel with the given parameters
	 * @param _id the model ID
	 * @param _name the model name
	 * @param _version the model version
	 * @param _author the model author
	 * @param _isPrivate indicates if model is visible only to creator
	 * @param _hoardAddress the HOARD address of the model file
	 * @param _hoardSecret the HOARD secret of the model file
	 */
	constructor(bytes32 _id, string _name, uint8[3] _version, address _author, bool _isPrivate, bytes32 _hoardAddress, bytes32 _hoardSecret)
		Versioned(_version[0], _version[1], _version[2])
		AbstractNamedElement(_id, _name)
		public
	{
		hoardAddress = _hoardAddress;
		hoardSecret = _hoardSecret;
		author = _author;
		privateFlag = _isPrivate;
	}
	
	/**
	 * @dev Creates a new process definition with the given parameters in this ProcessModel
	 * @param _id the process ID
	 * @return error - BaseErrors.RESOURCE_ALREADY_EXISTS(), if a process definition with the same ID already exists, BaseErrors.NO_ERROR() otherwise
	 * @return newAddress - the address of the new ProcessDefinition when successful
	 */
	function createProcessDefinition(bytes32 _id) external returns (uint error, address newAddress) {
		if (processDefinitions.exists(_id)) return (BaseErrors.RESOURCE_ALREADY_EXISTS(), 0x0);
		newAddress = new DefaultProcessDefinition(_id, this);
		error = processDefinitions.insert(_id, newAddress);
		emitEvent("UPDATE_PROCESS_DEFINITION", newAddress);
		emit LogProcessDefinitionCreation(
			EVENT_ID_PROCESS_DEFINITIONS,
			newAddress,
			_id,
			bytes32(""),
			ProcessModel(this).getId(),
			address(this)
		);
	}
	
	/**
	 * @dev Returns the address of the ProcessDefinition with the specified ID
	 * @param _id the process ID
	 * @return the address of the process definition, if it exists
	 */
	function getProcessDefinition(bytes32 _id) external view returns (address) {
		return processDefinitions.rows[_id].value;
	}

	/**
	 * @dev Returns the HOARD file information of the model's diagram
	 * @return location - the HOARD address
	 * @return secret - the HOARD secret
	 */
	function getDiagram() external view returns (bytes32 location,  bytes32 secret) {
		location = hoardAddress;
		secret = hoardSecret;
	}

	/**
	 * @dev Returns model author address
	 * @return address - model author
	 */
	function getAuthor() external view returns (address) {
		return author;
	}

	/**
	 * @dev Returns whether the model is private
	 * @return bool - if model is private
	 */
	function isPrivate() external view returns (bool) {
		return privateFlag;
	}

	/**
	 * @dev Adds a process interface declaration to this ProcessModel that process definitions can refer to
	 * @param _interfaceId the ID of the interface
	 * @return BaseErrors.RESOURCE_ALREADY_EXISTS() if an interface with the given ID already exists, BaseErrors.NO_ERROR() otherwise
	 */
	function addProcessInterface(bytes32 _interfaceId) external returns (uint) {
		if (processInterfaces[_interfaceId]) return BaseErrors.RESOURCE_ALREADY_EXISTS();
		processInterfaces[_interfaceId] = true;
		processInterfaceKeys.push(_interfaceId);
		return BaseErrors.NO_ERROR();
	}

	/**
	 * @dev Adds a participant with the specified ID and attributes to this ProcessModel
	 * @param _id the participant ID
	 * @param _account the address of a participant account
	 * @param _dataStorage the address of a DataStorage contract to find a conditional participant
	 * @param _dataStorageId a field key in a known DataStorage containing an address of another DataStorage contract
	 * @param _dataPath the field key under which to locate the conditional participant
	 * @return BaseErrors.INVALID_PARAM_VALUE() if both participant and conditional participant are being attempted to be set or if the config for a conditional participant is missing the _dataPath
	 * @return BaseErrors.NO_ERROR() if successful
	 */
	function addParticipant(bytes32 _id, address _account, bytes32 _dataPath, bytes32 _dataStorageId, address _dataStorage) external returns (uint error) {
		if (participants.rows[_id].exists) {
			return BaseErrors.RESOURCE_ALREADY_EXISTS();
		}
		// 1. single participant and conditional participant configs are mutually exclusive
		// 2. conditional participant must have a dataPath set
		if ((_account != 0x0 && (_dataStorage != 0x0 || _dataStorageId != "")) ||
			(_account == 0x0 && _dataPath == "")) {
			return BaseErrors.INVALID_PARAM_VALUE();
		}

		participants.rows[_id].keyIdx = participants.keys.push(_id);
		participants.rows[_id].value.id = _id;
		if (_account != 0x0) {
			participants.rows[_id].value.account = _account;
		} else {
			participants.rows[_id].value.conditionalPerformer = DataStorageUtils.ConditionalData({dataStorage: _dataStorage, dataStorageId: _dataStorageId, dataPath: _dataPath, exists: true});
		}
		participants.rows[_id].exists = true;

		emitEvent("UPDATE_PROCESS_MODEL", this);
		return BaseErrors.NO_ERROR();
	}

	/**
	 * @dev Returns the participant ID in this model that matches the given ConditionalData parameters.
	 * @param _dataPath a data path
	 * @param _dataStorageId the path to a DataStorage
	 * @param _dataStorage the address of a DataStorage
	 * @return the ID of a participant or an empty bytes32, if no matching participant exists
	 */
	function getConditionalParticipant(bytes32 _dataPath, bytes32 _dataStorageId, address _dataStorage) external view returns (bytes32) {
		for (uint i=0; i<participants.keys.length; i++) {
			if (participants.rows[participants.keys[i]].value.conditionalPerformer.exists &&
				participants.rows[participants.keys[i]].value.conditionalPerformer.dataPath == _dataPath &&
			    ((participants.rows[participants.keys[i]].value.conditionalPerformer.dataStorageId != "" &&
			      participants.rows[participants.keys[i]].value.conditionalPerformer.dataStorageId == _dataStorageId) ||
			     (participants.rows[participants.keys[i]].value.conditionalPerformer.dataStorage != 0x0 &&
			      participants.rows[participants.keys[i]].value.conditionalPerformer.dataStorage == _dataStorage))) {
					  
					return participants.rows[participants.keys[i]].value.id;
				}
		}
	}

	/**
	 * @dev Returns the number of process interfaces declared in this ProcessModel
	 * @return the number of process interfaces
	 */
	function getNumberOfProcessInterfaces() external view returns (uint) {
		return processInterfaceKeys.length;
	}

	/**
	 * @dev Returns whether a process interface with the specified ID exists in this ProcessModel
	 * @param _interfaceId the interface ID
	 * @return true if it exists, false otherwise
	 */
	function hasProcessInterface(bytes32 _interfaceId) external view returns (bool) {
		return processInterfaces[_interfaceId];
	}

	/**
	 * @dev Returns the number of process definitions in this ProcessModel
	 * @return the number of process definitions
	 */
	function getNumberOfProcessDefinitions() external view returns (uint) {
		return processDefinitions.keys.length;
	}

	/**
	 * @dev Returns the address for the ProcessDefinition at the given index
	 * @param _idx the index position
	 * @return the address of the ProcessDefinition, if it exists
	 */
	function getProcessDefinitionAtIndex(uint _idx) external view returns (address) {
		return processDefinitions.get(processDefinitions.keys[_idx]);
	}

	/**
	 * @dev Returns information about the ProcessDefinition at the given address
	 * @param _processDefinition the address
	 * @return id the process ID
	 * @return interfaceId the first process interface the process definition supports
	 * @return modelId the id of the model to which this process definition belongs
	 */
	function getProcessDefinitionData(address _processDefinition) external view returns (bytes32 id, bytes32 interfaceId, bytes32 modelId) {
		ProcessDefinition pd = ProcessDefinition(_processDefinition);
		id = pd.getId();
		modelId = pd.getModelId();
		if (pd.getNumberOfImplementedProcessInterfaces() > 0) {
			address model;
			(model, interfaceId) = pd.getImplementedProcessInterfaceAtIndex(0);
		} 
	}

	/**
	 * @dev Returns the number of participants defined in this ProcessModel
	 * @return the number of participants
	 */
	function getNumberOfParticipants() external view returns (uint) {
		return participants.keys.length;
	}

	/**
	 * @dev Returns the ID of the participant at the given index
	 * @param _idx the index position
	 * @return the participant ID, if it exists
	 */
	function getParticipantAtIndex(uint _idx) external view returns (bytes32) {
		return participants.keys[_idx];
	}

	/**
	 * @dev Returns information about the participant with the given ID
	 * @param _id the participant ID
	 * @return location the applications contract address, only available for a service participant
	 * @return method the function signature of the participant, only available for a service participant
	 * @return webForm the form identifier (formHash) of the web participant, only available for a web participant
	 */
	function getParticipantData(bytes32 _id) external view returns (address account, bytes32 dataPath, bytes32 dataStorageId, address dataStorage) {
		account = participants.rows[_id].value.account;
		dataPath = participants.rows[_id].value.conditionalPerformer.dataPath;
		dataStorageId = participants.rows[_id].value.conditionalPerformer.dataStorageId;
		dataStorage = participants.rows[_id].value.conditionalPerformer.dataStorage;
	}

	/**
	 * @dev Returns whether a participant with the specified ID exists in this ProcessModel
	 * @param _id the participant ID
	 * @return true if it exists, false otherwise
	 */
	function hasParticipant(bytes32 _id) external view returns (bool) {
		return participants.rows[_id].exists;
	}

	/**
	 * @dev Adds a data definition to this ProcessModel
	 * @param _id the ID of the data object
	 * @param _parameterType the DataTypes.ParameterType of the data object
	 */
	function addDataDefinition(bytes32 _id, DataTypes.ParameterType _parameterType) external {
		dataDefinitions.insertOrUpdate(_id, uint(_parameterType));
		emit LogProcessModelDataCreation(EVENT_ID_PROCESS_MODEL_DATA, _id, address(this), uint(_parameterType));
	}

	/**
	 * @dev Returns the number of data definitions in the ProcessModel
	 * @return the number of data definitions
	 */
	function getNumberOfDataDefinitions() external view returns (uint) {
		return dataDefinitions.keys.length;
	}

	/**
	 * @dev Returns details about the data definition at the given index position
	 * REVERTS if:
	 * - the index is out of bounds
	 * @param _index the index position
	 * @return id - the ID of the data definition
	 * @return parameterType - the uint representation of the DataTypes.ParameterType
	 */
	function getDataDefinitionDetailsAtIndex(uint _index) external view returns (bytes32 id, uint parameterType) {
		ErrorsLib.revertIf(_index >= dataDefinitions.keys.length,
			ErrorsLib.INVALID_INPUT(), "DefaultProcessModel.getDataDefinitionDetailsAtIndex", "The given index value is out-of-bounds of the data definitions collection");
		id = dataDefinitions.keys[_index];
		parameterType = dataDefinitions.get(id);
	}

	/**
	 * @dev To be called by a registered process definition to signal an update.
	 * Causes the ProcessModel to emit an update event on behalf of the msg.sender
	 */
	function fireProcessDefinitionUpdateEvent() external {
		ProcessDefinition pd = ProcessDefinition(msg.sender);
		// check if the sender is a registered process definition
		if (processDefinitions.get(pd.getId()) == msg.sender) {
			emitEvent("UPDATE_PROCESS_DEFINITION", pd);
		}
	}

	/**
	 * @dev To be called by a registered process definition to signal an update.
	 * Causes the ProcessModel to emit an update event on behalf of the msg.sender
	 */
	function fireActivityDefinitionUpdateEvent(bytes32 _activityId) external {
		ProcessDefinition pd = ProcessDefinition(msg.sender);
		// check if the sender is a registered process definition
		if (processDefinitions.get(pd.getId()) == msg.sender) {
			emitEvent("UPDATE_ACTIVITY_DEFINITION", pd, _activityId);
		}
	}
}