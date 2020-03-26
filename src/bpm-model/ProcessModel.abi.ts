//Code generated by solts. DO NOT EDIT.
import { Readable } from "stream";
interface Provider<Tx> {
    deploy(msg: Tx, callback: (err: Error, addr: Uint8Array) => void): void;
    call(msg: Tx, callback: (err: Error, exec: Uint8Array) => void): void;
    callSim(msg: Tx, callback: (err: Error, exec: Uint8Array) => void): void;
    listen(signature: string, address: string, callback: (err: Error, event: any) => void): Readable;
    payload(data: string, address?: string): Tx;
    encode(name: string, inputs: string[], ...args: any[]): string;
    decode(data: Uint8Array, outputs: string[]): any;
}
function Call<Tx, Output>(client: Provider<Tx>, addr: string, data: string, isSim: boolean, callback: (exec: Uint8Array) => Output): Promise<Output> {
    const payload = client.payload(data, addr);
    if (isSim)
        return new Promise((resolve, reject) => { client.callSim(payload, (err, exec) => { err ? reject(err) : resolve(callback(exec)); }); });
    else
        return new Promise((resolve, reject) => { client.call(payload, (err, exec) => { err ? reject(err) : resolve(callback(exec)); }); });
}
function Replace(bytecode: string, name: string, address: string): string {
    address = address + Array(40 - address.length + 1).join("0");
    const truncated = name.slice(0, 36);
    const label = "__" + truncated + Array(37 - truncated.length).join("_") + "__";
    while (bytecode.indexOf(label) >= 0)
        bytecode = bytecode.replace(label, address);
    return bytecode;
}
export module ProcessModel {
    export class Contract<Tx> {
        private client: Provider<Tx>;
        public address: string;
        constructor(client: Provider<Tx>, address: string) {
            this.client = client;
            this.address = address;
        }
        LogProcessModelCreation(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogProcessModelCreation", this.address, callback); }
        LogProcessModelDataCreation(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogProcessModelDataCreation", this.address, callback); }
        LogProcessModelFileReferenceUpdate(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogProcessModelFileReferenceUpdate", this.address, callback); }
        ERC165_ID_VERSIONED_ARTIFACT() {
            const data = Encode(this.client).ERC165_ID_VERSIONED_ARTIFACT();
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).ERC165_ID_VERSIONED_ARTIFACT();
            });
        }
        EVENT_ID_PROCESS_DEFINITIONS() {
            const data = Encode(this.client).EVENT_ID_PROCESS_DEFINITIONS();
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).EVENT_ID_PROCESS_DEFINITIONS();
            });
        }
        EVENT_ID_PROCESS_MODELS() {
            const data = Encode(this.client).EVENT_ID_PROCESS_MODELS();
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).EVENT_ID_PROCESS_MODELS();
            });
        }
        EVENT_ID_PROCESS_MODEL_DATA() {
            const data = Encode(this.client).EVENT_ID_PROCESS_MODEL_DATA();
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).EVENT_ID_PROCESS_MODEL_DATA();
            });
        }
        OBJECT_CLASS_PROCESS_DEFINITION() {
            const data = Encode(this.client).OBJECT_CLASS_PROCESS_DEFINITION();
            return Call<Tx, [string]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).OBJECT_CLASS_PROCESS_DEFINITION();
            });
        }
        addDataDefinition(_dataId: Buffer, _dataPath: Buffer, _parameterType: number) {
            const data = Encode(this.client).addDataDefinition(_dataId, _dataPath, _parameterType);
            return Call<Tx, void>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).addDataDefinition();
            });
        }
        addParticipant(_id: Buffer, _account: string, _dataPath: Buffer, _dataStorageId: Buffer, _dataStorage: string) {
            const data = Encode(this.client).addParticipant(_id, _account, _dataPath, _dataStorageId, _dataStorage);
            return Call<Tx, {
                error: number;
            }>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).addParticipant();
            });
        }
        addProcessInterface(_interfaceId: Buffer) {
            const data = Encode(this.client).addProcessInterface(_interfaceId);
            return Call<Tx, {
                error: number;
            }>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).addProcessInterface();
            });
        }
        compareArtifactVersion(_other: string, _version: [number, number, number]) {
            const data = Encode(this.client).compareArtifactVersion(_other, _version);
            return Call<Tx, {
                result: number;
            }>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).compareArtifactVersion();
            });
        }
        compareVersion(_other: string, _version: [number, number, number]) {
            const data = Encode(this.client).compareVersion(_other, _version);
            return Call<Tx, {
                result: number;
            }>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).compareVersion();
            });
        }
        createProcessDefinition(_id: Buffer, _artifactsFinder: string) {
            const data = Encode(this.client).createProcessDefinition(_id, _artifactsFinder);
            return Call<Tx, {
                newAddress: string;
            }>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).createProcessDefinition();
            });
        }
        getArtifactVersion() {
            const data = Encode(this.client).getArtifactVersion();
            return Call<Tx, [[number, number, number]]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersion();
            });
        }
        getArtifactVersionMajor() {
            const data = Encode(this.client).getArtifactVersionMajor();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionMajor();
            });
        }
        getArtifactVersionMinor() {
            const data = Encode(this.client).getArtifactVersionMinor();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionMinor();
            });
        }
        getArtifactVersionPatch() {
            const data = Encode(this.client).getArtifactVersionPatch();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArtifactVersionPatch();
            });
        }
        getAuthor() {
            const data = Encode(this.client).getAuthor();
            return Call<Tx, [string]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getAuthor();
            });
        }
        getConditionalParticipant(_dataPath: Buffer, _dataStorageId: Buffer, _dataStorage: string) {
            const data = Encode(this.client).getConditionalParticipant(_dataPath, _dataStorageId, _dataStorage);
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getConditionalParticipant();
            });
        }
        getDataDefinitionDetailsAtIndex(_index: number) {
            const data = Encode(this.client).getDataDefinitionDetailsAtIndex(_index);
            return Call<Tx, {
                key: Buffer;
                parameterType: number;
            }>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getDataDefinitionDetailsAtIndex();
            });
        }
        getId() {
            const data = Encode(this.client).getId();
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getId();
            });
        }
        getModelFileReference() {
            const data = Encode(this.client).getModelFileReference();
            return Call<Tx, [string]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getModelFileReference();
            });
        }
        getNumberOfDataDefinitions() {
            const data = Encode(this.client).getNumberOfDataDefinitions();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfDataDefinitions();
            });
        }
        getNumberOfParticipants() {
            const data = Encode(this.client).getNumberOfParticipants();
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfParticipants();
            });
        }
        getNumberOfProcessDefinitions() {
            const data = Encode(this.client).getNumberOfProcessDefinitions();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfProcessDefinitions();
            });
        }
        getNumberOfProcessInterfaces() {
            const data = Encode(this.client).getNumberOfProcessInterfaces();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfProcessInterfaces();
            });
        }
        getParticipantAtIndex(_idx: number) {
            const data = Encode(this.client).getParticipantAtIndex(_idx);
            return Call<Tx, [Buffer]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getParticipantAtIndex();
            });
        }
        getParticipantData(_id: Buffer) {
            const data = Encode(this.client).getParticipantData(_id);
            return Call<Tx, {
                account: string;
                dataPath: Buffer;
                dataStorageId: Buffer;
                dataStorage: string;
            }>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getParticipantData();
            });
        }
        getProcessDefinition(_id: Buffer) {
            const data = Encode(this.client).getProcessDefinition(_id);
            return Call<Tx, [string]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getProcessDefinition();
            });
        }
        getProcessDefinitionAtIndex(_idx: number) {
            const data = Encode(this.client).getProcessDefinitionAtIndex(_idx);
            return Call<Tx, [string]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getProcessDefinitionAtIndex();
            });
        }
        getVersion() {
            const data = Encode(this.client).getVersion();
            return Call<Tx, [[number, number, number]]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getVersion();
            });
        }
        getVersionMajor() {
            const data = Encode(this.client).getVersionMajor();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getVersionMajor();
            });
        }
        getVersionMinor() {
            const data = Encode(this.client).getVersionMinor();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getVersionMinor();
            });
        }
        getVersionPatch() {
            const data = Encode(this.client).getVersionPatch();
            return Call<Tx, [number]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).getVersionPatch();
            });
        }
        hasParticipant(_id: Buffer) {
            const data = Encode(this.client).hasParticipant(_id);
            return Call<Tx, [boolean]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).hasParticipant();
            });
        }
        hasProcessInterface(_interfaceId: Buffer) {
            const data = Encode(this.client).hasProcessInterface(_interfaceId);
            return Call<Tx, [boolean]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).hasProcessInterface();
            });
        }
        initialize(_id: Buffer, _version: [number, number, number], _author: string, _isPrivate: boolean, _modelFileReference: string) {
            const data = Encode(this.client).initialize(_id, _version, _author, _isPrivate, _modelFileReference);
            return Call<Tx, void>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).initialize();
            });
        }
        isPrivate() {
            const data = Encode(this.client).isPrivate();
            return Call<Tx, [boolean]>(this.client, this.address, data, true, (exec: Uint8Array) => {
                return Decode(this.client, exec).isPrivate();
            });
        }
        setModelFileReference(_modelFileReference: string) {
            const data = Encode(this.client).setModelFileReference(_modelFileReference);
            return Call<Tx, void>(this.client, this.address, data, false, (exec: Uint8Array) => {
                return Decode(this.client, exec).setModelFileReference();
            });
        }
    }
    export const Encode = <Tx>(client: Provider<Tx>) => { return {
        ERC165_ID_VERSIONED_ARTIFACT: () => { return client.encode("E10533C6", []); },
        EVENT_ID_PROCESS_DEFINITIONS: () => { return client.encode("BA840F64", []); },
        EVENT_ID_PROCESS_MODELS: () => { return client.encode("429814CD", []); },
        EVENT_ID_PROCESS_MODEL_DATA: () => { return client.encode("15FCB649", []); },
        OBJECT_CLASS_PROCESS_DEFINITION: () => { return client.encode("2B50AA2B", []); },
        addDataDefinition: (_dataId: Buffer, _dataPath: Buffer, _parameterType: number) => { return client.encode("6377C4E2", ["bytes32", "bytes32", "uint8"], _dataId, _dataPath, _parameterType); },
        addParticipant: (_id: Buffer, _account: string, _dataPath: Buffer, _dataStorageId: Buffer, _dataStorage: string) => { return client.encode("E5637B2F", ["bytes32", "address", "bytes32", "bytes32", "address"], _id, _account, _dataPath, _dataStorageId, _dataStorage); },
        addProcessInterface: (_interfaceId: Buffer) => { return client.encode("AF9BFED0", ["bytes32"], _interfaceId); },
        compareArtifactVersion: (_other: string, _version: [number, number, number]) => {
            if (typeof _other === "string")
                return client.encode("5C030138", ["address"], _other);
            if (typeof _version === "string")
                return client.encode("78BC0B0D", ["uint8[3]"], _version);
        },
        compareVersion: (_other: string, _version: [number, number, number]) => {
            if (typeof _other === "string")
                return client.encode("AF9F25A5", ["address"], _other);
            if (typeof _version === "string")
                return client.encode("BB7D8C25", ["uint8[3]"], _version);
        },
        createProcessDefinition: (_id: Buffer, _artifactsFinder: string) => { return client.encode("EF663E88", ["bytes32", "address"], _id, _artifactsFinder); },
        getArtifactVersion: () => { return client.encode("756B2E6C", []); },
        getArtifactVersionMajor: () => { return client.encode("57E0EBCA", []); },
        getArtifactVersionMinor: () => { return client.encode("7589ADB7", []); },
        getArtifactVersionPatch: () => { return client.encode("F085F6DD", []); },
        getAuthor: () => { return client.encode("A5FAA125", []); },
        getConditionalParticipant: (_dataPath: Buffer, _dataStorageId: Buffer, _dataStorage: string) => { return client.encode("FD735B14", ["bytes32", "bytes32", "address"], _dataPath, _dataStorageId, _dataStorage); },
        getDataDefinitionDetailsAtIndex: (_index: number) => { return client.encode("AF23A8D3", ["uint256"], _index); },
        getId: () => { return client.encode("5D1CA631", []); },
        getModelFileReference: () => { return client.encode("093F2AD6", []); },
        getNumberOfDataDefinitions: () => { return client.encode("F4172E7C", []); },
        getNumberOfParticipants: () => { return client.encode("C80C28A2", []); },
        getNumberOfProcessDefinitions: () => { return client.encode("B408F71C", []); },
        getNumberOfProcessInterfaces: () => { return client.encode("7DA706F4", []); },
        getParticipantAtIndex: (_idx: number) => { return client.encode("51EB4554", ["uint256"], _idx); },
        getParticipantData: (_id: Buffer) => { return client.encode("ECD4A335", ["bytes32"], _id); },
        getProcessDefinition: (_id: Buffer) => { return client.encode("18D995D5", ["bytes32"], _id); },
        getProcessDefinitionAtIndex: (_idx: number) => { return client.encode("DA9D7285", ["uint256"], _idx); },
        getVersion: () => { return client.encode("0D8E6E2C", []); },
        getVersionMajor: () => { return client.encode("0815511B", []); },
        getVersionMinor: () => { return client.encode("93AA73D5", []); },
        getVersionPatch: () => { return client.encode("9AC98F94", []); },
        hasParticipant: (_id: Buffer) => { return client.encode("58F2A46D", ["bytes32"], _id); },
        hasProcessInterface: (_interfaceId: Buffer) => { return client.encode("7180F973", ["bytes32"], _interfaceId); },
        initialize: (_id: Buffer, _version: [number, number, number], _author: string, _isPrivate: boolean, _modelFileReference: string) => { return client.encode("37E9B161", ["bytes32", "uint8[3]", "address", "bool", "string"], _id, _version, _author, _isPrivate, _modelFileReference); },
        isPrivate: () => { return client.encode("FAFF660E", []); },
        setModelFileReference: (_modelFileReference: string) => { return client.encode("03FED10B", ["string"], _modelFileReference); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        ERC165_ID_VERSIONED_ARTIFACT: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        EVENT_ID_PROCESS_DEFINITIONS: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        EVENT_ID_PROCESS_MODELS: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        EVENT_ID_PROCESS_MODEL_DATA: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        OBJECT_CLASS_PROCESS_DEFINITION: (): [string] => { return client.decode(data, ["string"]); },
        addDataDefinition: (): void => { return; },
        addParticipant: (): {
            error: number;
        } => {
            const [error] = client.decode(data, ["uint256"]);
            return { error: error };
        },
        addProcessInterface: (): {
            error: number;
        } => {
            const [error] = client.decode(data, ["uint256"]);
            return { error: error };
        },
        compareArtifactVersion: (): {
            result: number;
        } => {
            const [result] = client.decode(data, ["int256"]);
            return { result: result };
        },
        compareVersion: (): {
            result: number;
        } => {
            const [result] = client.decode(data, ["int256"]);
            return { result: result };
        },
        createProcessDefinition: (): {
            newAddress: string;
        } => {
            const [newAddress] = client.decode(data, ["address"]);
            return { newAddress: newAddress };
        },
        getArtifactVersion: (): [[number, number, number]] => { return client.decode(data, ["uint8[3]"]); },
        getArtifactVersionMajor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionMinor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionPatch: (): [number] => { return client.decode(data, ["uint8"]); },
        getAuthor: (): [string] => { return client.decode(data, ["address"]); },
        getConditionalParticipant: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        getDataDefinitionDetailsAtIndex: (): {
            key: Buffer;
            parameterType: number;
        } => {
            const [key, parameterType] = client.decode(data, ["bytes32", "uint256"]);
            return { key: key, parameterType: parameterType };
        },
        getId: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        getModelFileReference: (): [string] => { return client.decode(data, ["string"]); },
        getNumberOfDataDefinitions: (): [number] => { return client.decode(data, ["uint256"]); },
        getNumberOfParticipants: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfProcessDefinitions: (): [number] => { return client.decode(data, ["uint256"]); },
        getNumberOfProcessInterfaces: (): [number] => { return client.decode(data, ["uint256"]); },
        getParticipantAtIndex: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        getParticipantData: (): {
            account: string;
            dataPath: Buffer;
            dataStorageId: Buffer;
            dataStorage: string;
        } => {
            const [account, dataPath, dataStorageId, dataStorage] = client.decode(data, ["address", "bytes32", "bytes32", "address"]);
            return { account: account, dataPath: dataPath, dataStorageId: dataStorageId, dataStorage: dataStorage };
        },
        getProcessDefinition: (): [string] => { return client.decode(data, ["address"]); },
        getProcessDefinitionAtIndex: (): [string] => { return client.decode(data, ["address"]); },
        getVersion: (): [[number, number, number]] => { return client.decode(data, ["uint8[3]"]); },
        getVersionMajor: (): [number] => { return client.decode(data, ["uint8"]); },
        getVersionMinor: (): [number] => { return client.decode(data, ["uint8"]); },
        getVersionPatch: (): [number] => { return client.decode(data, ["uint8"]); },
        hasParticipant: (): [boolean] => { return client.decode(data, ["bool"]); },
        hasProcessInterface: (): [boolean] => { return client.decode(data, ["bool"]); },
        initialize: (): void => { return; },
        isPrivate: (): [boolean] => { return client.decode(data, ["bool"]); },
        setModelFileReference: (): void => { return; }
    }; };
}