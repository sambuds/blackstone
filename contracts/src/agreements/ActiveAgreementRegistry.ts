import { Readable } from "stream";
interface Provider<Tx> {
    deploy(msg: Tx, callback: (err: Error, addr: Uint8Array) => void): void;
    call(msg: Tx, callback: (err: Error, exec: Uint8Array) => void): void;
    listen(signature: string, address: string, callback: (err: Error, event: any) => void): Readable;
    payload(data: string, address?: string): Tx;
    encode(name: string, inputs: string[], ...args: any[]): string;
    decode(data: Uint8Array, outputs: string[]): any;
}
function Call<Tx, Output>(client: Provider<Tx>, addr: string, data: string, callback: (exec: Uint8Array) => Output): Promise<Output> {
    const payload = client.payload(data, addr);
    return new Promise((resolve, reject) => {
        client.call(payload, (err, exec) => { err ? reject(err) : resolve(callback(exec)); });
    });
}
function Replace(bytecode: string, name: string, address: string): string {
    address = address + Array(40 - address.length + 1).join("0");
    const truncated = name.slice(0, 36);
    const label = "__" + truncated + Array(37 - truncated.length).join("_") + "__";
    while (bytecode.indexOf(label) >= 0)
        bytecode = bytecode.replace(label, address);
    return bytecode;
}
export module ActiveAgreementRegistry {
    export class Contract<Tx> {
        private client: Provider<Tx>;
        public address: string;
        constructor(client: Provider<Tx>, address: string) {
            this.client = client;
            this.address = address;
        }
        LogAgreementCollectionCreation(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogAgreementCollectionCreation", this.address, callback); }
        LogAgreementExecutionProcessUpdate(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogAgreementExecutionProcessUpdate", this.address, callback); }
        LogAgreementFormationProcessUpdate(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogAgreementFormationProcessUpdate", this.address, callback); }
        LogAgreementToCollectionUpdate(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogAgreementToCollectionUpdate", this.address, callback); }
        DATA_ID_AGREEMENT() {
            const data = Encode(this.client).DATA_ID_AGREEMENT();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).DATA_ID_AGREEMENT();
            });
        }
        ERC165_ID_ObjectFactory() {
            const data = Encode(this.client).ERC165_ID_ObjectFactory();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).ERC165_ID_ObjectFactory();
            });
        }
        ERC165_ID_Upgradeable() {
            const data = Encode(this.client).ERC165_ID_Upgradeable();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).ERC165_ID_Upgradeable();
            });
        }
        ERC165_ID_VERSIONED_ARTIFACT() {
            const data = Encode(this.client).ERC165_ID_VERSIONED_ARTIFACT();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).ERC165_ID_VERSIONED_ARTIFACT();
            });
        }
        EVENT_ID_AGREEMENT_COLLECTIONS() {
            const data = Encode(this.client).EVENT_ID_AGREEMENT_COLLECTIONS();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).EVENT_ID_AGREEMENT_COLLECTIONS();
            });
        }
        EVENT_ID_AGREEMENT_COLLECTION_MAP() {
            const data = Encode(this.client).EVENT_ID_AGREEMENT_COLLECTION_MAP();
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).EVENT_ID_AGREEMENT_COLLECTION_MAP();
            });
        }
        OBJECT_CLASS_AGREEMENT() {
            const data = Encode(this.client).OBJECT_CLASS_AGREEMENT();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).OBJECT_CLASS_AGREEMENT();
            });
        }
        addAgreementToCollection(_collectionId: Buffer, _agreement: string) {
            const data = Encode(this.client).addAgreementToCollection(_collectionId, _agreement);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).addAgreementToCollection();
            });
        }
        compareArtifactVersion(_other: string, _version: [number, number, number]) {
            const data = Encode(this.client).compareArtifactVersion(_other, _version);
            return Call<Tx, {
                result: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).compareArtifactVersion();
            });
        }
        createAgreement(_archetype: string, _creator: string, _owner: string, _privateParametersFileReference: string, _isPrivate: boolean, _parties: string[], _collectionId: Buffer, _governingAgreements: string[]) {
            const data = Encode(this.client).createAgreement(_archetype, _creator, _owner, _privateParametersFileReference, _isPrivate, _parties, _collectionId, _governingAgreements);
            return Call<Tx, {
                activeAgreement: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).createAgreement();
            });
        }
        createAgreementCollection(_author: string, _collectionType: number, _packageId: Buffer) {
            const data = Encode(this.client).createAgreementCollection(_author, _collectionType, _packageId);
            return Call<Tx, {
                error: number;
                id: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).createAgreementCollection();
            });
        }
        getActiveAgreementAtIndex(_index: number) {
            const data = Encode(this.client).getActiveAgreementAtIndex(_index);
            return Call<Tx, {
                activeAgreement: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getActiveAgreementAtIndex();
            });
        }
        getActiveAgreementData(_activeAgreement: string) {
            const data = Encode(this.client).getActiveAgreementData(_activeAgreement);
            return Call<Tx, {
                archetype: string;
                creator: string;
                privateParametersFileReference: string;
                eventLogFileReference: string;
                maxNumberOfEvents: number;
                isPrivate: boolean;
                legalState: number;
                formationProcessInstance: string;
                executionProcessInstance: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getActiveAgreementData();
            });
        }
        getActiveAgreementsSize() {
            const data = Encode(this.client).getActiveAgreementsSize();
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getActiveAgreementsSize();
            });
        }
        getAgreementAtIndexInCollection(_id: Buffer, _index: number) {
            const data = Encode(this.client).getAgreementAtIndexInCollection(_id, _index);
            return Call<Tx, {
                agreement: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAgreementAtIndexInCollection();
            });
        }
        getAgreementCollectionAtIndex(_index: number) {
            const data = Encode(this.client).getAgreementCollectionAtIndex(_index);
            return Call<Tx, {
                id: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAgreementCollectionAtIndex();
            });
        }
        getAgreementCollectionData(_id: Buffer) {
            const data = Encode(this.client).getAgreementCollectionData(_id);
            return Call<Tx, {
                author: string;
                collectionType: number;
                packageId: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAgreementCollectionData();
            });
        }
        getAgreementParameterAtIndex(_address: string, _pos: number) {
            const data = Encode(this.client).getAgreementParameterAtIndex(_address, _pos);
            return Call<Tx, {
                dataId: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAgreementParameterAtIndex();
            });
        }
        getAgreementParameterDetails(_address: string, _dataId: Buffer) {
            const data = Encode(this.client).getAgreementParameterDetails(_address, _dataId);
            return Call<Tx, {
                process: string;
                id: Buffer;
                uintValue: number;
                intValue: number;
                bytes32Value: Buffer;
                addressValue: string;
                boolValue: boolean;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAgreementParameterDetails();
            });
        }
        getArchetypeRegistry() {
            const data = Encode(this.client).getArchetypeRegistry();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArchetypeRegistry();
            });
        }
        getArtifactVersion() {
            const data = Encode(this.client).getArtifactVersion();
            return Call<Tx, [[number, number, number]]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersion();
            });
        }
        getArtifactVersionMajor() {
            const data = Encode(this.client).getArtifactVersionMajor();
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionMajor();
            });
        }
        getArtifactVersionMinor() {
            const data = Encode(this.client).getArtifactVersionMinor();
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionMinor();
            });
        }
        getArtifactVersionPatch() {
            const data = Encode(this.client).getArtifactVersionPatch();
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionPatch();
            });
        }
        getBpmService() {
            const data = Encode(this.client).getBpmService();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getBpmService();
            });
        }
        getGoverningAgreementAtIndex(_agreement: string, _index: number) {
            const data = Encode(this.client).getGoverningAgreementAtIndex(_agreement, _index);
            return Call<Tx, {
                governingAgreement: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getGoverningAgreementAtIndex();
            });
        }
        getNumberOfAgreementCollections() {
            const data = Encode(this.client).getNumberOfAgreementCollections();
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfAgreementCollections();
            });
        }
        getNumberOfAgreementParameters(_address: string) {
            const data = Encode(this.client).getNumberOfAgreementParameters(_address);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfAgreementParameters();
            });
        }
        getNumberOfAgreementsInCollection(_id: Buffer) {
            const data = Encode(this.client).getNumberOfAgreementsInCollection(_id);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfAgreementsInCollection();
            });
        }
        getNumberOfGoverningAgreements(_agreement: string) {
            const data = Encode(this.client).getNumberOfGoverningAgreements(_agreement);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfGoverningAgreements();
            });
        }
        getPartiesByActiveAgreementSize(_activeAgreement: string) {
            const data = Encode(this.client).getPartiesByActiveAgreementSize(_activeAgreement);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getPartiesByActiveAgreementSize();
            });
        }
        getPartyByActiveAgreementAtIndex(_activeAgreement: string, _index: number) {
            const data = Encode(this.client).getPartyByActiveAgreementAtIndex(_activeAgreement, _index);
            return Call<Tx, {
                party: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getPartyByActiveAgreementAtIndex();
            });
        }
        getPartyByActiveAgreementData(_activeAgreement: string, _party: string) {
            const data = Encode(this.client).getPartyByActiveAgreementData(_activeAgreement, _party);
            return Call<Tx, {
                signedBy: string;
                signatureTimestamp: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getPartyByActiveAgreementData();
            });
        }
        processStateChanged(_pi: string) {
            const data = Encode(this.client).processStateChanged(_pi);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).processStateChanged();
            });
        }
        setEventLogReference(_activeAgreement: string, _eventLogFileReference: string) {
            const data = Encode(this.client).setEventLogReference(_activeAgreement, _eventLogFileReference);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).setEventLogReference();
            });
        }
        setMaxNumberOfEvents(_agreement: string, _maxNumberOfEvents: number) {
            const data = Encode(this.client).setMaxNumberOfEvents(_agreement, _maxNumberOfEvents);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).setMaxNumberOfEvents();
            });
        }
        setSignatureLogReference(_activeAgreement: string, _signatureLogFileReference: string) {
            const data = Encode(this.client).setSignatureLogReference(_activeAgreement, _signatureLogFileReference);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).setSignatureLogReference();
            });
        }
        startProcessLifecycle(_agreement: string) {
            const data = Encode(this.client).startProcessLifecycle(_agreement);
            return Call<Tx, {
                error: number;
                processInstance: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).startProcessLifecycle();
            });
        }
        transferAddressScopes(_processInstance: string) {
            const data = Encode(this.client).transferAddressScopes(_processInstance);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).transferAddressScopes();
            });
        }
        upgrade(_successor: string) {
            const data = Encode(this.client).upgrade(_successor);
            return Call<Tx, {
                success: boolean;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).upgrade();
            });
        }
    }
    export const Encode = <Tx>(client: Provider<Tx>) => { return {
        DATA_ID_AGREEMENT: () => { return client.encode("506DBA55", []); },
        ERC165_ID_ObjectFactory: () => { return client.encode("54AF67B7", []); },
        ERC165_ID_Upgradeable: () => { return client.encode("B21C815F", []); },
        ERC165_ID_VERSIONED_ARTIFACT: () => { return client.encode("E10533C6", []); },
        EVENT_ID_AGREEMENT_COLLECTIONS: () => { return client.encode("06319BD6", []); },
        EVENT_ID_AGREEMENT_COLLECTION_MAP: () => { return client.encode("92D0E81B", []); },
        OBJECT_CLASS_AGREEMENT: () => { return client.encode("C2E7F116", []); },
        addAgreementToCollection: (_collectionId: Buffer, _agreement: string) => { return client.encode("E09C7D5E", ["bytes32", "address"], _collectionId, _agreement); },
        compareArtifactVersion: (_other: string, _version: [number, number, number]) => {
            if (typeof _other === "string")
                return client.encode("5C030138", ["address"], _other);
            if (typeof _version === "string")
                return client.encode("78BC0B0D", ["uint8[3]"], _version);
        },
        createAgreement: (_archetype: string, _creator: string, _owner: string, _privateParametersFileReference: string, _isPrivate: boolean, _parties: string[], _collectionId: Buffer, _governingAgreements: string[]) => { return client.encode("6261AF40", ["address", "address", "address", "string", "bool", "address[]", "bytes32", "address[]"], _archetype, _creator, _owner, _privateParametersFileReference, _isPrivate, _parties, _collectionId, _governingAgreements); },
        createAgreementCollection: (_author: string, _collectionType: number, _packageId: Buffer) => { return client.encode("65561AAC", ["address", "uint8", "bytes32"], _author, _collectionType, _packageId); },
        getActiveAgreementAtIndex: (_index: number) => { return client.encode("2C86C866", ["uint256"], _index); },
        getActiveAgreementData: (_activeAgreement: string) => { return client.encode("27793035", ["address"], _activeAgreement); },
        getActiveAgreementsSize: () => { return client.encode("BF591D65", []); },
        getAgreementAtIndexInCollection: (_id: Buffer, _index: number) => { return client.encode("1B430596", ["bytes32", "uint256"], _id, _index); },
        getAgreementCollectionAtIndex: (_index: number) => { return client.encode("30E9472B", ["uint256"], _index); },
        getAgreementCollectionData: (_id: Buffer) => { return client.encode("FBD8CCD3", ["bytes32"], _id); },
        getAgreementParameterAtIndex: (_address: string, _pos: number) => { return client.encode("A3106A2D", ["address", "uint256"], _address, _pos); },
        getAgreementParameterDetails: (_address: string, _dataId: Buffer) => { return client.encode("92AFAAE8", ["address", "bytes32"], _address, _dataId); },
        getArchetypeRegistry: () => { return client.encode("01E08054", []); },
        getArtifactVersion: () => { return client.encode("756B2E6C", []); },
        getArtifactVersionMajor: () => { return client.encode("57E0EBCA", []); },
        getArtifactVersionMinor: () => { return client.encode("7589ADB7", []); },
        getArtifactVersionPatch: () => { return client.encode("F085F6DD", []); },
        getBpmService: () => { return client.encode("4846F303", []); },
        getGoverningAgreementAtIndex: (_agreement: string, _index: number) => { return client.encode("30AECA7A", ["address", "uint256"], _agreement, _index); },
        getNumberOfAgreementCollections: () => { return client.encode("766AC213", []); },
        getNumberOfAgreementParameters: (_address: string) => { return client.encode("69A5C2D0", ["address"], _address); },
        getNumberOfAgreementsInCollection: (_id: Buffer) => { return client.encode("9E6EB6B9", ["bytes32"], _id); },
        getNumberOfGoverningAgreements: (_agreement: string) => { return client.encode("220E8F8A", ["address"], _agreement); },
        getPartiesByActiveAgreementSize: (_activeAgreement: string) => { return client.encode("D5953D2B", ["address"], _activeAgreement); },
        getPartyByActiveAgreementAtIndex: (_activeAgreement: string, _index: number) => { return client.encode("E73BE278", ["address", "uint256"], _activeAgreement, _index); },
        getPartyByActiveAgreementData: (_activeAgreement: string, _party: string) => { return client.encode("21D45D0C", ["address", "address"], _activeAgreement, _party); },
        processStateChanged: (_pi: string) => { return client.encode("06B08F1C", ["address"], _pi); },
        setEventLogReference: (_activeAgreement: string, _eventLogFileReference: string) => { return client.encode("8EC25069", ["address", "string"], _activeAgreement, _eventLogFileReference); },
        setMaxNumberOfEvents: (_agreement: string, _maxNumberOfEvents: number) => { return client.encode("108055A6", ["address", "uint32"], _agreement, _maxNumberOfEvents); },
        setSignatureLogReference: (_activeAgreement: string, _signatureLogFileReference: string) => { return client.encode("E31F0582", ["address", "string"], _activeAgreement, _signatureLogFileReference); },
        startProcessLifecycle: (_agreement: string) => { return client.encode("714F8F71", ["address"], _agreement); },
        transferAddressScopes: (_processInstance: string) => { return client.encode("DEEE44B3", ["address"], _processInstance); },
        upgrade: (_successor: string) => { return client.encode("0900F010", ["address"], _successor); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        DATA_ID_AGREEMENT: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        ERC165_ID_ObjectFactory: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        ERC165_ID_Upgradeable: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        ERC165_ID_VERSIONED_ARTIFACT: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        EVENT_ID_AGREEMENT_COLLECTIONS: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        EVENT_ID_AGREEMENT_COLLECTION_MAP: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        OBJECT_CLASS_AGREEMENT: (): [string] => { return client.decode(data, ["string"]); },
        addAgreementToCollection: (): void => { return; },
        compareArtifactVersion: (): {
            result: number;
        } => {
            const [result] = client.decode(data, ["int256"]);
            return { result: result };
        },
        createAgreement: (): {
            activeAgreement: string;
        } => {
            const [activeAgreement] = client.decode(data, ["address"]);
            return { activeAgreement: activeAgreement };
        },
        createAgreementCollection: (): {
            error: number;
            id: Buffer;
        } => {
            const [error, id] = client.decode(data, ["uint256", "bytes32"]);
            return { error: error, id: id };
        },
        getActiveAgreementAtIndex: (): {
            activeAgreement: string;
        } => {
            const [activeAgreement] = client.decode(data, ["address"]);
            return { activeAgreement: activeAgreement };
        },
        getActiveAgreementData: (): {
            archetype: string;
            creator: string;
            privateParametersFileReference: string;
            eventLogFileReference: string;
            maxNumberOfEvents: number;
            isPrivate: boolean;
            legalState: number;
            formationProcessInstance: string;
            executionProcessInstance: string;
        } => {
            const [archetype, creator, privateParametersFileReference, eventLogFileReference, maxNumberOfEvents, isPrivate, legalState, formationProcessInstance, executionProcessInstance] = client.decode(data, ["address", "address", "string", "string", "uint256", "bool", "uint8", "address", "address"]);
            return { archetype: archetype, creator: creator, privateParametersFileReference: privateParametersFileReference, eventLogFileReference: eventLogFileReference, maxNumberOfEvents: maxNumberOfEvents, isPrivate: isPrivate, legalState: legalState, formationProcessInstance: formationProcessInstance, executionProcessInstance: executionProcessInstance };
        },
        getActiveAgreementsSize: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getAgreementAtIndexInCollection: (): {
            agreement: string;
        } => {
            const [agreement] = client.decode(data, ["address"]);
            return { agreement: agreement };
        },
        getAgreementCollectionAtIndex: (): {
            id: Buffer;
        } => {
            const [id] = client.decode(data, ["bytes32"]);
            return { id: id };
        },
        getAgreementCollectionData: (): {
            author: string;
            collectionType: number;
            packageId: Buffer;
        } => {
            const [author, collectionType, packageId] = client.decode(data, ["address", "uint8", "bytes32"]);
            return { author: author, collectionType: collectionType, packageId: packageId };
        },
        getAgreementParameterAtIndex: (): {
            dataId: Buffer;
        } => {
            const [dataId] = client.decode(data, ["bytes32"]);
            return { dataId: dataId };
        },
        getAgreementParameterDetails: (): {
            process: string;
            id: Buffer;
            uintValue: number;
            intValue: number;
            bytes32Value: Buffer;
            addressValue: string;
            boolValue: boolean;
        } => {
            const [process, id, uintValue, intValue, bytes32Value, addressValue, boolValue] = client.decode(data, ["address", "bytes32", "uint256", "int256", "bytes32", "address", "bool"]);
            return { process: process, id: id, uintValue: uintValue, intValue: intValue, bytes32Value: bytes32Value, addressValue: addressValue, boolValue: boolValue };
        },
        getArchetypeRegistry: (): [string] => { return client.decode(data, ["address"]); },
        getArtifactVersion: (): [[number, number, number]] => { return client.decode(data, ["uint8[3]"]); },
        getArtifactVersionMajor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionMinor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionPatch: (): [number] => { return client.decode(data, ["uint8"]); },
        getBpmService: (): [string] => { return client.decode(data, ["address"]); },
        getGoverningAgreementAtIndex: (): {
            governingAgreement: string;
        } => {
            const [governingAgreement] = client.decode(data, ["address"]);
            return { governingAgreement: governingAgreement };
        },
        getNumberOfAgreementCollections: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfAgreementParameters: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfAgreementsInCollection: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfGoverningAgreements: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getPartiesByActiveAgreementSize: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getPartyByActiveAgreementAtIndex: (): {
            party: string;
        } => {
            const [party] = client.decode(data, ["address"]);
            return { party: party };
        },
        getPartyByActiveAgreementData: (): {
            signedBy: string;
            signatureTimestamp: number;
        } => {
            const [signedBy, signatureTimestamp] = client.decode(data, ["address", "uint256"]);
            return { signedBy: signedBy, signatureTimestamp: signatureTimestamp };
        },
        processStateChanged: (): void => { return; },
        setEventLogReference: (): void => { return; },
        setMaxNumberOfEvents: (): void => { return; },
        setSignatureLogReference: (): void => { return; },
        startProcessLifecycle: (): {
            error: number;
            processInstance: string;
        } => {
            const [error, processInstance] = client.decode(data, ["uint256", "address"]);
            return { error: error, processInstance: processInstance };
        },
        transferAddressScopes: (): void => { return; },
        upgrade: (): {
            success: boolean;
        } => {
            const [success] = client.decode(data, ["bool"]);
            return { success: success };
        }
    }; };
}