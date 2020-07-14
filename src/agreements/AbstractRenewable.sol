pragma solidity ^0.5;

import "agreements/Renewable.sol";
import "agreements/AgreementsAPI.sol";
import "commons-base/ErrorsLib.sol";
import "commons-collections/Mappings.sol";
import "commons-collections/MappingsLib.sol";
import "commons-collections/DataStorage.sol";

contract AbstractRenewable is Renewable {

  int currentExpirationDate;
  int nextExpirationDate;
  string opensAtOffset;
  string closesAtOffset;
  string extensionOffset;
	uint threshold;
	
	bool renewalWindowOpen;
	bool renew;
  
  // A franchisee is a party that has the right to vote to renew the 
	// the agreement. Not all parties are franchisees.
	address[] franchisees;

	mapping(address => Vote) votes;

	bytes32 constant DATA_ID_AGREEMENT_EXPIRATION_DATE = "Agreement Expiration Date";
	bytes32 constant DATA_ID_AGREEMENT_RENEWAL_OPENS_AT = "Renewal Opens At";
	bytes32 constant DATA_ID_AGREEMENT_RENEWAL_CLOSES_AT = "Renewal Closes At";
	bytes32 constant DATA_ID_AGREEMENT_EXTEND_EXPIRATION_BY = "Extend Expiration By";

  bytes32 constant EVENT_ID_AGREEMENT_FRANCHISEE_MAP = "AN://agreement-to-franchisee";
  bytes32 constant EVENT_ID_AGREEMENT_RENEWALS = "AN://agreement-renewals";
	
	/**
	 * @dev Gets number of franchisees
	 * @return size number of franchisees
	 */
	function getNumberOfRenewalFranchisees() external view returns (uint size) {
		return franchisees.length;
	}

	/**
	 * @dev Returns the frachisee at the given index
	 * @param _index the index position
	 * @return the frachisee's address or 0x0 if the index is out of bounds
	 */
	function getRenewalFranchiseeAtIndex(uint _index) external view returns (address franchisee) {
		if (_index < franchisees.length)
			return franchisees[_index];
	}

	/**
	 * @dev Returns the terms of renewal
	 */
	function getRenewalTerms() external view returns (
		uint renewalThreshold,
		int agreementExpirationDate,
		string memory renewalOpensAtOffset,
		string memory renewalClosesAtOffset,
		string memory renewalExtensionOffset
	) {
		renewalThreshold = threshold;
		agreementExpirationDate = currentExpirationDate;
		renewalOpensAtOffset = opensAtOffset;
		renewalClosesAtOffset = closesAtOffset;
		renewalExtensionOffset = extensionOffset;
	}

	/**
	 * @dev Sets the expiration date
	 * @param _expirationDate int expiration date timestamp
	 */
	function setCurrentExpirationDate(int _expirationDate) external {
		currentExpirationDate = _expirationDate;
		DataStorage(address(this)).setDataValueAsInt(DATA_ID_AGREEMENT_EXPIRATION_DATE, _expirationDate);
		emit LogAgreementRenewalExpirationDateUpdate(
			EVENT_ID_AGREEMENT_RENEWALS,
			address(this),
			currentExpirationDate
		);
	}

	/**
	 * @dev Sets the next expiration date if a renewal occurs
	 * @param _expirationDate int expiration date timestamp
	 */
	function setNextExpirationDate(int _expirationDate) external {
		nextExpirationDate = _expirationDate;
	}

	/**
	 * @dev Returns the voter, the renew vote cast and timestamp of the vote of the given franchisee.
	 * @param _franchisee the franchisee
	 * @return the address of the voter (if the franchisee authorized a voter other than itself)
	 * @return the renew vote of the voter
	 * @return the time of voting or 0 if the address is not a frachisee for renewal of this agreement or has not voted yet
	 */
	function getRenewalVoteDetails(address _franchisee) external view returns (address renewalVoter, bool renewVote, uint voteTimestamp) {
		renewalVoter = votes[_franchisee].voter;
		renewVote = votes[_franchisee].renew;
		voteTimestamp = votes[_franchisee].timestamp;
	}

	/**
	 * @dev Opens the renewal window to accept votes for renewal
	 */
	function openRenewalWindow() external {
		if (!renewalWindowOpen) {
			renewalWindowOpen = true;
			emit LogAgreementRenewalWindowOpened(
				EVENT_ID_AGREEMENT_RENEWALS,
				address(this),
				renewalWindowOpen,
				block.timestamp
			);
		}
	}

	/**
	 * @dev Closes the renewal window to stop accepting votes for renewal
	 */
	function closeRenewalWindow() external {
		if (renewalWindowOpen) {
			renewalWindowOpen = false;
			emit LogAgreementRenewalWindowClosed(
				EVENT_ID_AGREEMENT_RENEWALS,
				address(this),
				renewalWindowOpen,
				block.timestamp
			);
			if (renew) {
				ErrorsLib.revertIf(nextExpirationDate == 0,
					ErrorsLib.INVALID_STATE(), "AbstractRenewable.closeRenewalWindow",
						"Agreement is set to renew, but no updated expiration date set");
				currentExpirationDate = nextExpirationDate;
				nextExpirationDate = 0;
				DataStorage(address(this)).setDataValueAsInt(DATA_ID_AGREEMENT_EXPIRATION_DATE, currentExpirationDate);
				emit LogAgreementRenewalExpirationDateUpdate(
					EVENT_ID_AGREEMENT_RENEWALS,
					address(this),
					currentExpirationDate
				);
			}
		}
	}

	/**
	 * @dev Returns the current renewal window state
	 */
	function isRenewalWindowOpen() external view returns (bool) {
		return renewalWindowOpen;
	}

	/**
	 * @dev Returns the current renewal state indicating whether agreement will renew
	 */
	function getRenewalState() external view returns (bool) {
		return renew;
	}

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
	) external {
		ErrorsLib.revertIf(_franchisees.length == 0,
			ErrorsLib.INVALID_INPUT(), "AbstractRenewable.defineTerms",
				"At least one franchisee required to define renewal terms");
		ErrorsLib.revertIf(_threshold > _franchisees.length,
			ErrorsLib.INVALID_INPUT(), "AbstractRenewable.defineTerms",
				"Threshold may not be greater than total number of franchisees able to renew");
		currentExpirationDate = _expirationDate;
		franchisees = _franchisees;
		threshold = _threshold;
		opensAtOffset = _opensAtOffset;
		closesAtOffset = _closesAtOffset;
		extensionOffset = _extensionOffset;

		resetRenewalVotes();

		DataStorage(address(this)).setDataValueAsInt(DATA_ID_AGREEMENT_EXPIRATION_DATE, currentExpirationDate);
		DataStorage(address(this)).setDataValueAsString(DATA_ID_AGREEMENT_RENEWAL_OPENS_AT, opensAtOffset);
		DataStorage(address(this)).setDataValueAsString(DATA_ID_AGREEMENT_RENEWAL_CLOSES_AT, closesAtOffset);
		DataStorage(address(this)).setDataValueAsString(DATA_ID_AGREEMENT_EXTEND_EXPIRATION_BY, extensionOffset);

		emit LogAgreementRenewalTermsDefined(
			EVENT_ID_AGREEMENT_RENEWALS,
			address(this),
			currentExpirationDate,
			threshold,
			opensAtOffset,
			closesAtOffset,
			extensionOffset
		);
	}

	/**
	 * @dev Validates if the msg.sender is an authorized party in order to be able to vote.
	 * It then registers the vote received via the renew param as the vote cast by the caller
	 * @param _renew bool param denoting the vote to renew agreement
	 */
	function castRenewalVote(bool _renew) external {

		ErrorsLib.revertIf(!renewalWindowOpen,
			ErrorsLib.INVALID_PARAMETER_STATE(), "AbstractRenewable.castVote()", "The renewal voting window is closed");

		address voter;
		address franchisee;

		(voter, franchisee) = AgreementsAPI.authorizePartyActor(address(this));

		// if the voter is empty at this point, the authorization is regarded as failed
		ErrorsLib.revertIf(voter == address(0),
			ErrorsLib.UNAUTHORIZED(), "AbstractRenewable.castVote()", "The caller is not authorized to vote for renewal");

		ErrorsLib.revertIf(!votes[franchisee].exists,
			ErrorsLib.UNAUTHORIZED(), "AbstractRenewable.castVote()", "The franchisee derieved from this caller is not authorized to vote");

		votes[franchisee].voter = voter;
		votes[franchisee].renew = _renew;
		votes[franchisee].timestamp = block.timestamp;

		emit LogAgreementRenewalVoteCast(
			EVENT_ID_AGREEMENT_FRANCHISEE_MAP,
			address(this),
			franchisee,
			votes[franchisee].voter,
			votes[franchisee].renew,
			votes[franchisee].timestamp
		);
		evaluateRenewalState();
	}

	/**
	 * @dev Internal function that resets all franchisee renewal votes to false
	 */
	function resetRenewalVotes() public {
		ErrorsLib.revertIf(renewalWindowOpen,
			ErrorsLib.INVALID_PARAMETER_STATE(), "AbstractRenewable.resetVotes()", "Cannot reset votes while renewal window is open");

		for (uint i = 0; i < franchisees.length; i++) {
			address _franchisee = franchisees[i];
			votes[_franchisee].voter = address(0);
			votes[_franchisee].renew = false;
			votes[_franchisee].timestamp = 0;
			votes[_franchisee].exists = true;
			emit LogAgreementRenewalFranchiseeUpdate(
				EVENT_ID_AGREEMENT_FRANCHISEE_MAP,
				address(this),
				_franchisee,
				votes[_franchisee].voter,
				votes[_franchisee].renew,
				votes[_franchisee].timestamp
			);
		}
		evaluateRenewalState();
	}

	/**
	 * @dev Evaluates the renewal path by counting renewal botes and comparing against
	 * renewal threshold
	 */
	function evaluateRenewalState() internal {
		uint counter = 0;
		for (uint i = 0; i < franchisees.length; i++) {
			if (votes[franchisees[i]].renew) {
				counter++;
			}
		}
		renew = counter >= threshold;
		emit LogAgreementRenewalResultUpdate(
      EVENT_ID_AGREEMENT_RENEWALS,
      address(this),
      renew
  	);
	}
}