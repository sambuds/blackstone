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
export module ProcessModelRepository {
    export class Contract<Tx> {
        private client: Provider<Tx>;
        public address: string;
        constructor(client: Provider<Tx>, address: string) {
            this.client = client;
            this.address = address;
        }
        LogProcessModelActivation(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogProcessModelActivation", this.address, callback); }
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
        OBJECT_CLASS_PROCESS_DEFINITION() {
            const data = Encode(this.client).OBJECT_CLASS_PROCESS_DEFINITION();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).OBJECT_CLASS_PROCESS_DEFINITION();
            });
        }
        OBJECT_CLASS_PROCESS_MODEL() {
            const data = Encode(this.client).OBJECT_CLASS_PROCESS_MODEL();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).OBJECT_CLASS_PROCESS_MODEL();
            });
        }
        activateModel(_model: string) {
            const data = Encode(this.client).activateModel(_model);
            return Call<Tx, {
                error: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).activateModel();
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
        createProcessDefinition(_processModelAddress: string, _processDefinitionId: Buffer) {
            const data = Encode(this.client).createProcessDefinition(_processModelAddress, _processDefinitionId);
            return Call<Tx, {
                newAddress: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).createProcessDefinition();
            });
        }
        createProcessModel(_id: Buffer, _version: [number, number, number], _author: string, _isPrivate: boolean, _modelFileReference: string) {
            const data = Encode(this.client).createProcessModel(_id, _version, _author, _isPrivate, _modelFileReference);
            return Call<Tx, {
                error: number;
                modelAddress: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).createProcessModel();
            });
        }
        getActivityAtIndex(_model: string, _processDefinition: string, _index: number) {
            const data = Encode(this.client).getActivityAtIndex(_model, _processDefinition, _index);
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getActivityAtIndex();
            });
        }
        getActivityData(_model: string, _processDefinition: string, _id: Buffer) {
            const data = Encode(this.client).getActivityData(_model, _processDefinition, _id);
            return Call<Tx, {
                activityType: number;
                taskType: number;
                taskBehavior: number;
                assignee: Buffer;
                multiInstance: boolean;
                application: Buffer;
                subProcessModelId: Buffer;
                subProcessDefinitionId: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getActivityData();
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
        getModel(_id: Buffer) {
            const data = Encode(this.client).getModel(_id);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getModel();
            });
        }
        getModelAtIndex(_idx: number) {
            const data = Encode(this.client).getModelAtIndex(_idx);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getModelAtIndex();
            });
        }
        getModelByVersion(_id: Buffer, _version: [number, number, number]) {
            const data = Encode(this.client).getModelByVersion(_id, _version);
            return Call<Tx, {
                error: number;
                modelAddress: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getModelByVersion();
            });
        }
        getNumberOfActivities(_model: string, _processDefinition: string) {
            const data = Encode(this.client).getNumberOfActivities(_model, _processDefinition);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfActivities();
            });
        }
        getNumberOfModels() {
            const data = Encode(this.client).getNumberOfModels();
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfModels();
            });
        }
        getNumberOfProcessDefinitions(_model: string) {
            const data = Encode(this.client).getNumberOfProcessDefinitions(_model);
            return Call<Tx, {
                size: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfProcessDefinitions();
            });
        }
        getProcessDefinition(_modelId: Buffer, _processId: Buffer) {
            const data = Encode(this.client).getProcessDefinition(_modelId, _processId);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getProcessDefinition();
            });
        }
        getProcessDefinitionAtIndex(_model: string, _idx: number) {
            const data = Encode(this.client).getProcessDefinitionAtIndex(_model, _idx);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getProcessDefinitionAtIndex();
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
        ERC165_ID_ObjectFactory: () => { return client.encode("54AF67B7", []); },
        ERC165_ID_Upgradeable: () => { return client.encode("B21C815F", []); },
        ERC165_ID_VERSIONED_ARTIFACT: () => { return client.encode("E10533C6", []); },
        OBJECT_CLASS_PROCESS_DEFINITION: () => { return client.encode("2B50AA2B", []); },
        OBJECT_CLASS_PROCESS_MODEL: () => { return client.encode("212718B3", []); },
        activateModel: (_model: string) => { return client.encode("14E0D518", ["address"], _model); },
        compareArtifactVersion: (_other: string, _version: [number, number, number]) => {
            if (typeof _other === "string")
                return client.encode("5C030138", ["address"], _other);
            if (typeof _version === "string")
                return client.encode("78BC0B0D", ["uint8[3]"], _version);
        },
        createProcessDefinition: (_processModelAddress: string, _processDefinitionId: Buffer) => { return client.encode("B0DCEEBC", ["address", "bytes32"], _processModelAddress, _processDefinitionId); },
        createProcessModel: (_id: Buffer, _version: [number, number, number], _author: string, _isPrivate: boolean, _modelFileReference: string) => { return client.encode("FE2D7895", ["bytes32", "uint8[3]", "address", "bool", "string"], _id, _version, _author, _isPrivate, _modelFileReference); },
        getActivityAtIndex: (_model: string, _processDefinition: string, _index: number) => { return client.encode("A73D9874", ["address", "address", "uint256"], _model, _processDefinition, _index); },
        getActivityData: (_model: string, _processDefinition: string, _id: Buffer) => { return client.encode("8F2986CC", ["address", "address", "bytes32"], _model, _processDefinition, _id); },
        getArtifactVersion: () => { return client.encode("756B2E6C", []); },
        getArtifactVersionMajor: () => { return client.encode("57E0EBCA", []); },
        getArtifactVersionMinor: () => { return client.encode("7589ADB7", []); },
        getArtifactVersionPatch: () => { return client.encode("F085F6DD", []); },
        getModel: (_id: Buffer) => { return client.encode("21E7C498", ["bytes32"], _id); },
        getModelAtIndex: (_idx: number) => { return client.encode("B8CB2516", ["uint256"], _idx); },
        getModelByVersion: (_id: Buffer, _version: [number, number, number]) => { return client.encode("75CD669D", ["bytes32", "uint8[3]"], _id, _version); },
        getNumberOfActivities: (_model: string, _processDefinition: string) => { return client.encode("CA20515E", ["address", "address"], _model, _processDefinition); },
        getNumberOfModels: () => { return client.encode("665584A8", []); },
        getNumberOfProcessDefinitions: (_model: string) => { return client.encode("B08E081D", ["address"], _model); },
        getProcessDefinition: (_modelId: Buffer, _processId: Buffer) => { return client.encode("619FF7B5", ["bytes32", "bytes32"], _modelId, _processId); },
        getProcessDefinitionAtIndex: (_model: string, _idx: number) => { return client.encode("677AEF26", ["address", "uint256"], _model, _idx); },
        upgrade: (_successor: string) => { return client.encode("0900F010", ["address"], _successor); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        ERC165_ID_ObjectFactory: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        ERC165_ID_Upgradeable: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        ERC165_ID_VERSIONED_ARTIFACT: (): [Buffer] => { return client.decode(data, ["bytes4"]); },
        OBJECT_CLASS_PROCESS_DEFINITION: (): [string] => { return client.decode(data, ["string"]); },
        OBJECT_CLASS_PROCESS_MODEL: (): [string] => { return client.decode(data, ["string"]); },
        activateModel: (): {
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
        createProcessDefinition: (): {
            newAddress: string;
        } => {
            const [newAddress] = client.decode(data, ["address"]);
            return { newAddress: newAddress };
        },
        createProcessModel: (): {
            error: number;
            modelAddress: string;
        } => {
            const [error, modelAddress] = client.decode(data, ["uint256", "address"]);
            return { error: error, modelAddress: modelAddress };
        },
        getActivityAtIndex: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        getActivityData: (): {
            activityType: number;
            taskType: number;
            taskBehavior: number;
            assignee: Buffer;
            multiInstance: boolean;
            application: Buffer;
            subProcessModelId: Buffer;
            subProcessDefinitionId: Buffer;
        } => {
            const [activityType, taskType, taskBehavior, assignee, multiInstance, application, subProcessModelId, subProcessDefinitionId] = client.decode(data, ["uint8", "uint8", "uint8", "bytes32", "bool", "bytes32", "bytes32", "bytes32"]);
            return { activityType: activityType, taskType: taskType, taskBehavior: taskBehavior, assignee: assignee, multiInstance: multiInstance, application: application, subProcessModelId: subProcessModelId, subProcessDefinitionId: subProcessDefinitionId };
        },
        getArtifactVersion: (): [[number, number, number]] => { return client.decode(data, ["uint8[3]"]); },
        getArtifactVersionMajor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionMinor: (): [number] => { return client.decode(data, ["uint8"]); },
        getArtifactVersionPatch: (): [number] => { return client.decode(data, ["uint8"]); },
        getModel: (): [string] => { return client.decode(data, ["address"]); },
        getModelAtIndex: (): [string] => { return client.decode(data, ["address"]); },
        getModelByVersion: (): {
            error: number;
            modelAddress: string;
        } => {
            const [error, modelAddress] = client.decode(data, ["uint256", "address"]);
            return { error: error, modelAddress: modelAddress };
        },
        getNumberOfActivities: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfModels: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getNumberOfProcessDefinitions: (): {
            size: number;
        } => {
            const [size] = client.decode(data, ["uint256"]);
            return { size: size };
        },
        getProcessDefinition: (): [string] => { return client.decode(data, ["address"]); },
        getProcessDefinitionAtIndex: (): [string] => { return client.decode(data, ["address"]); },
        upgrade: (): {
            success: boolean;
        } => {
            const [success] = client.decode(data, ["bool"]);
            return { success: success };
        }
    }; };
}