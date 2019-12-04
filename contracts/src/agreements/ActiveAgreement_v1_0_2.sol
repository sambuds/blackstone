pragma solidity ^0.5.12;

import "commons-collections/DataStorage.sol";
import "commons-collections/AddressScopes.sol";
import "commons-events/EventEmitter.sol";
import "documents-commons/Signable.sol";
import "commons-management/VersionedArtifact.sol";

/**
 * @title ActiveAgreement Interface v1.0.2
 * @dev Legacy version of the ActiveAgreement interface that was separated out to secure backwards compatibility by versionizing a snapshot of the interface and allowing future versions to extend it.
 */
contract ActiveAgreement_v1_0_2 is VersionedArtifact, DataStorage, AddressScopes, Signable, EventEmitter {

    // This is a placeholder value for the marker field - it could be anything
    int constant DELETION = 0;

    // Trigger a redaction of an agreement - this is intended to construct a queue of agreements to ultimately
    // expunge from the history on a re-written chain
    event LogAgreementRedaction(
        bytes32 indexed eventId,
        int __DELETE__,
        address agreementAddress
);
}
