pragma solidity ^0.5;

contract Renewable {

  event LogAgreementRenewalTermsDefined(
		bytes32 indexed eventURN,
		address agreementAddress,
    int expirationDate,
    uint threshold,
    string opensAtOffset,
    string closesAtOffset,
    string extensionOffset
	);

	event LogAgreementRenewalVoteCast(
		bytes32 indexed eventURN,
		address agreementAddress,
		address franchisee,
		address voter,
		bool renew,
		uint timestamp
	);

	event LogAgreementRenewalFranchiseeUpdate(
		bytes32 indexed eventId,
		address agreementAddress,
		address franchisee,
		address voter,
		bool renew,
		uint timestamp
	);

  event LogAgreementRenewalWindowStateUpdate(
    bytes32 indexed eventURN,
    address agreementAddress,
    bool renewalWindowOpen
  );

  event LogAgreementRenewalResultUpdate(
    bytes32 indexed eventURN,
    address agreementAddress,
    bool renew
  );

  event LogAgreementRenewalExpirationDateUpdate(
    bytes32 indexed eventURN,
    address agreementAddress,
    int expirationDate
  );

  struct Vote {
    address voter;
    bool renew;
    uint timestamp;
    bool exists;
  }

  /**
	 * @dev Gets number of franchisees
	 * @return size number of franchisees
	 */
	function getNumberOfRenewalFranchisees() external view returns (uint size);

	/**
	 * @dev Returns the frachisee at the given index
	 * @param _index the index position
	 * @return the frachisee's address or 0x0 if the index is out of bounds
	 */
	function getRenewalFranchiseeAtIndex(uint _index) external view returns (address franchisee);

  /**
	 * @dev Returns the terms of renewal
	 */
	function getRenewalTerms() external view returns (
		uint renewalThreshold,
		int agreementExpirationDate,
		string memory renewalOpensAtOffset,
		string memory renewalClosesAtOffset,
		string memory renewalExtensionOffset
	);

  /**
	 * @dev Sets the expiration date
	 * @param _expirationDate int expiration date timestamp
	 */
	function setCurrentExpirationDate(int _expirationDate) external;

	/**
	 * @dev Sets the next expiration date if a renewal occurs
	 * @param _expirationDate int expiration date timestamp
	 */
	function setNextExpirationDate(int _expirationDate) external;

  /**
	 * @dev Returns the voter, the renew vote cast and timestamp of the vote of the given franchisee.
	 * @param _franchisee the franchisee
	 * @return the address of the voter (if the franchisee authorized a voter other than itself)
	 * @return the renew vote of the voter
	 * @return the time of voting or 0 if the address is not a frachisee for renewal of this agreement or has not voted yet
	 */
	function getRenewalVoteDetails(address _franchisee) external view returns (address renewalVoter, bool renewVote, uint voteTimestamp);

  /**
	 * @dev Opens the renewal window to accept votes for renewal
	 */
	function openRenewalWindow() external;

  /**
	 * @dev Closes the renewal window to stop accepting votes for renewal
	 */
	function closeRenewalWindow() external;

	/**
	 * @dev Returns the current renewal window state
	 */
	function isRenewalWindowOpen() external view returns (bool);

  /**
	 * @dev Returns the current renewal state indicating whether agreement will renew
	 */
	function getRenewalState() external view returns (bool);

  /**
	 * @dev Defines the renewal obligation by setting the required parameters on the agreement. This function
	 * also resets any dangling votes from the previous iterations essentially wiping the 
	 * slate clean for current iteration of voting
	 * @param _franchisees an array of addresses representing the franchisees who have privilege to renew
	 * @param _threshold the number of votes needed to to renew
	 * @param _expirationDate expiration date of agreement
	 * @param _opensAtOffset ISO 8601 offset from the expiration date when the renewal window opens
	 * @param _closesAtOffset ISO 8601 offset from the expiration date when the renewal window closes
	 * @param _extensionOffset ISO 8601 offset defining the duration of extention of the expiration date
	 */
	function defineRenewalTerms(
		address[] calldata _franchisees, 
		uint _threshold,
		int _expirationDate,
		string calldata _opensAtOffset,
		string calldata _closesAtOffset,
		string calldata _extensionOffset
	) external;

  /**
	 * @dev Validates if the msg.sender is an authorized party in order to be able to vote.
	 * It then registers the vote received via the renew param as the vote cast by the caller
	 * @param _renew bool param denoting the vote to renew agreement
	 */
	function castRenewalVote(bool _renew) external;

  /**
	 * @dev Internal function that resets all franchisee renewal votes to false
	 */
	function resetRenewalVotes() external;

  /**
	 * @dev Evaluates the renewal path by counting renewal botes and comparing against
	 * renewal threshold
	 */
	function evaluateRenewalState() internal;

}