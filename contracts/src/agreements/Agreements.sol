pragma solidity ^0.4.23;

/**
 * @title Agreements
 * @dev Library to define data structures used across agreements.
 */
library Agreements {

  enum LegalState {DRAFT, FORMULATED, EXECUTED, FULFILLED, DEFAULT, CANCELED}

  enum CollectionType {CASE, DEAL, DOSSIER, FOLDER, MATTER, PACKAGE, PROJECT}

  struct Signature {
    address signee;
    uint timestamp;
  }

  struct ArchetypePackage {
    bytes32 id;
    string name;
    string description;
    address author;
    bool isPrivate;
    bool active;
    address[] archetypes;
  }

  struct ArchetypePackageMap {
    mapping(bytes32 => ArchetypePackageElement) rows;
    bytes32[] keys;
  }

  struct ArchetypePackageElement {
    uint keyIdx;
    ArchetypePackage value;
    bool exists;
  }

  struct AgreementCollection {
    bytes32 id;
    string name;
    address author;
    uint8 collectionType;
    bytes32 packageId;
    address[] agreements;
  }

  struct AgreementCollectionMap {
    mapping(bytes32 => AgreementCollectionElement) rows;
    bytes32[] keys;
  }

  struct AgreementCollectionElement {
    uint keyIdx;
    AgreementCollection value;
    bool exists;
  }

}