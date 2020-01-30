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
export module ArchetypeRegistryDb {
    export function Deploy<Tx>(client: Provider<Tx>, commons_base_ErrorsLib_sol_ErrorsLib: string, commons_collections_MappingsLib_sol_MappingsLib: string, commons_utils_ArrayUtilsLib_sol_ArrayUtilsLib: string): Promise<string> {
        let bytecode = "608060405234801561001057600080fd5b50336000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555061182a806100606000396000f3fe608060405234801561001057600080fd5b50600436106101005760003560e01c8063a9b3524011610097578063d119d31e11610066578063d119d31e146104c9578063d2739ef01461053e578063eba7df041461059a578063faca9c86146105c857610100565b8063a9b352401461035b578063b4d6d4c7146103a1578063b8019b6814610425578063c589e0fd1461048757610100565b80637f692a2a116100d35780637f692a2a146101ff578063861f62141461024957806387bd4a22146102c1578063a29602071461031957610100565b80630a452ad614610105578063187dd6aa14610149578063524de76b146101c3578063786e3f41146101e1575b600080fd5b6101476004803603602081101561011b57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506105f6565b005b6101ad6004803603608081101561015f57600080fd5b8101908080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291908035151590602001909291908035151590602001909291905050506109f3565b6040518082815260200191505060405180910390f35b6101cb610d0b565b6040518082815260200191505060405180910390f35b6101e9610d1b565b6040518082815260200191505060405180910390f35b610207610d2a565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61027f6004803603604081101561025f57600080fd5b810190808035906020019092919080359060200190929190505050610d53565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b610303600480360360208110156102d757600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610daf565b6040518082815260200191505060405180910390f35b6103456004803603602081101561032f57600080fd5b8101908080359060200190929190505050610fed565b6040518082815260200191505060405180910390f35b6103876004803603602081101561037157600080fd5b8101908080359060200190929190505050611016565b604051808215151515815260200191505060405180910390f35b6103cd600480360360208110156103b757600080fd5b8101908080359060200190929190505050611046565b604051808473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018315151515815260200182151515158152602001935050505060405180910390f35b6104716004803603604081101561043b57600080fd5b8101908080359060200190929190803573ffffffffffffffffffffffffffffffffffffffff1690602001909291905050506110e9565b6040518082815260200191505060405180910390f35b6104b36004803603602081101561049d57600080fd5b81019080803590602001909291905050506114c3565b6040518082815260200191505060405180910390f35b6104f5600480360360208110156104df57600080fd5b81019080803590602001909291905050506114e7565b604051808381526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019250505060405180910390f35b6105806004803603602081101561055457600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050611595565b604051808215151515815260200191505060405180910390f35b6105c6600480360360208110156105b057600080fd5b810190808035906020019092919050505061165f565b005b6105f4600480360360208110156105de57600080fd5b8101908080359060200190929190505050611697565b005b73__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff1614156106696116cf565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b838110156106ca5780820151818401526020810190506106af565b50505050905090810190601f1680156106f75780820380516001836020036101000a031916815260200191505b50848103835260218152602001806117d5602191396040018481038252602681526020018061178a602691396040019550505050505060006040518083038186803b15801561074557600080fd5b505af4158015610759573d6000803e3d6000fd5b5050505073__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16146107af61170c565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b838110156108105780820151818401526020810190506107f5565b50505050905090810190601f16801561083d5780820380516001836020036101000a031916815260200191505b508481038352602381526020018061176760239139604001848103825260258152602001806117b0602591396040019550505050505060006040518083038186803b15801561088b57600080fd5b505af415801561089f573d6000803e3d6000fd5b505050508073ffffffffffffffffffffffffffffffffffffffff166000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16146109f0577f0814a6975d95b7ef86d699e601b879308be10e8f2c4c77a940021f3d61b09eaf6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1682604051808373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019250505060405180910390a1806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505b50565b600073__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610a686116cf565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b83811015610ac9578082015181840152602081019050610aae565b50505050905090810190601f168015610af65780820380516001836020036101000a031916815260200191505b50848103835260218152602001806117d5602191396040018481038252602681526020018061178a602691396040019550505050505060006040518083038186803b158015610b4457600080fd5b505af4158015610b58573d6000803e3d6000fd5b505050506003600001600086815260200190815260200160002060040160009054906101000a900460ff1615610b9757610b90611749565b9050610d03565b600360010185908060018154018082558091505090600182039060005260206000200160009091929091909150556003600001600087815260200190815260200160002060000181905550846003600001600087815260200190815260200160002060010160000181905550836003600001600087815260200190815260200160002060010160010160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550826003600001600087815260200190815260200160002060010160010160146101000a81548160ff021916908315150217905550816003600001600087815260200190815260200160002060010160010160156101000a81548160ff02191690831515021790555060016003600001600087815260200190815260200160002060040160006101000a81548160ff021916908315150217905550610d00611753565b90505b949350505050565b6000600360010180549050905090565b60006001800180549050905090565b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b6000600360000160008481526020019081526020016000206001016002018281548110610d7c57fe5b9060005260206000200160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905092915050565b600073__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610e246116cf565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b83811015610e85578082015181840152602081019050610e6a565b50505050905090810190601f168015610eb25780820380516001836020036101000a031916815260200191505b50848103835260218152602001806117d5602191396040018481038252602681526020018061178a602691396040019550505050505060006040518083038186803b158015610f0057600080fd5b505af4158015610f14573d6000803e3d6000fd5b50505050600173__$5e3d4bda46c81e962f48c99e99f980d175$__633d4f1a2a90918460016040518463ffffffff1660e01b8152600401808481526020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200182151515158152602001935050505060206040518083038186803b158015610fab57600080fd5b505af4158015610fbf573d6000803e3d6000fd5b505050506040513d6020811015610fd557600080fd5b81019080805190602001909291905050509050919050565b600060036000016000838152602001908152602001600020600101600201805490509050919050565b60006003600001600083815260200190815260200160002060040160009054906101000a900460ff169050919050565b60008060006003600001600085815260200190815260200160002060010160010160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1692506003600001600085815260200190815260200160002060010160010160149054906101000a900460ff1691506003600001600085815260200190815260200160002060010160010160159054906101000a900460ff1690509193909250565b600073__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef6000809054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff16141561115e6116cf565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b838110156111bf5780820151818401526020810190506111a4565b50505050905090810190601f1680156111ec5780820380516001836020036101000a031916815260200191505b50848103835260218152602001806117d5602191396040018481038252602681526020018061178a602691396040019550505050505060006040518083038186803b15801561123a57600080fd5b505af415801561124e573d6000803e3d6000fd5b505050506003600001600084815260200190815260200160002060040160009054906101000a900460ff1661128c5761128561175c565b90506114bd565b6003600001600084815260200190815260200160002060010160020180548060200260200160405190810160405280929190818152602001828054801561132857602002820191906000526020600020905b8160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200190600101908083116112de575b505050505073__$6c578ef14ebe2070bb2319c6842ae291e1$__633da80d669091846040518363ffffffff1660e01b815260040180806020018373ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001828103825284818151815260200191508051906020019060200280838360005b838110156113ce5780820151818401526020810190506113b3565b50505050905001935050505060206040518083038186803b1580156113f257600080fd5b505af4158015611406573d6000803e3d6000fd5b505050506040513d602081101561141c57600080fd5b81019080805190602001909291905050506114b257600360000160008481526020019081526020016000206001016002018290806001815401808255809150509060018203906000526020600020016000909192909190916101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550505b6114ba611753565b90505b92915050565b6000600360010182815481106114d557fe5b90600052602060002001549050919050565b600080600173__$5e3d4bda46c81e962f48c99e99f980d175$__6380ed56bd9091856040518363ffffffff1660e01b81526004018083815260200182815260200192505050604080518083038186803b15801561154357600080fd5b505af4158015611557573d6000803e3d6000fd5b505050506040513d604081101561156d57600080fd5b8101908080519060200190929190805190602001909291905050508092508193505050915091565b6000600173__$5e3d4bda46c81e962f48c99e99f980d175$__63f755018d9091846040518363ffffffff1660e01b8152600401808381526020018273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1681526020019250505060206040518083038186803b15801561161d57600080fd5b505af4158015611631573d6000803e3d6000fd5b505050506040513d602081101561164757600080fd5b81019080805190602001909291905050509050919050565b60016003600001600083815260200190815260200160002060010160010160156101000a81548160ff02191690831515021790555050565b60006003600001600083815260200190815260200160002060010160010160156101000a81548160ff02191690831515021790555050565b60606040518060400160405280600681526020017f4552523430330000000000000000000000000000000000000000000000000000815250905090565b60606040518060400160405280600681526020017f4552523631310000000000000000000000000000000000000000000000000000815250905090565b60006103ea905090565b60006001905090565b60006103e990509056fe53797374656d4f776e65642e7472616e7366657253797374656d4f776e657273686970546865206d73672e73656e646572206973206e6f74207468652073797374656d206f776e6572546865206e65772073797374656d206f776e6572206d757374206e6f74206265204e554c4c53797374656d4f776e65642e7072655f6f6e6c79427953797374656d4f776e6572a265627a7a723158200d789a5c6388b41f5f222b588f166ae4ea1b35fd3f2c37c998b13fe6f95db82864736f6c634300050c0032";
        bytecode = Replace(bytecode, "$ecfb6c4d3c3ceff197e19e585a0a53728c$", commons_base_ErrorsLib_sol_ErrorsLib);
        bytecode = Replace(bytecode, "$5e3d4bda46c81e962f48c99e99f980d175$", commons_collections_MappingsLib_sol_MappingsLib);
        bytecode = Replace(bytecode, "$6c578ef14ebe2070bb2319c6842ae291e1$", commons_utils_ArrayUtilsLib_sol_ArrayUtilsLib);
        const data = bytecode + client.encode("", []);
        const payload = client.payload(data);
        return new Promise((resolve, reject) => {
            client.deploy(payload, (err, addr) => {
                if (err)
                    reject(err);
                else {
                    const address = Buffer.from(addr).toString("hex").toUpperCase();
                    resolve(address);
                }
            });
        });
    }
    export class Contract<Tx> {
        private client: Provider<Tx>;
        public address: string;
        constructor(client: Provider<Tx>, address: string) {
            this.client = client;
            this.address = address;
        }
        LogSystemOwnerChanged(callback: (err: Error, event: any) => void): Readable { return this.client.listen("LogSystemOwnerChanged", this.address, callback); }
        activatePackage(_id: Buffer) {
            const data = Encode(this.client).activatePackage(_id);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).activatePackage();
            });
        }
        addArchetype(_archetype: string) {
            const data = Encode(this.client).addArchetype(_archetype);
            return Call<Tx, {
                error: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).addArchetype();
            });
        }
        addArchetypeToPackage(_id: Buffer, _archetype: string) {
            const data = Encode(this.client).addArchetypeToPackage(_id, _archetype);
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).addArchetypeToPackage();
            });
        }
        archetypeExists(_archetype: string) {
            const data = Encode(this.client).archetypeExists(_archetype);
            return Call<Tx, [boolean]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).archetypeExists();
            });
        }
        createPackage(_id: Buffer, _author: string, _isPrivate: boolean, _active: boolean) {
            const data = Encode(this.client).createPackage(_id, _author, _isPrivate, _active);
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).createPackage();
            });
        }
        deactivatePackage(_id: Buffer) {
            const data = Encode(this.client).deactivatePackage(_id);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).deactivatePackage();
            });
        }
        getArchetypeAtIndex(_index: number) {
            const data = Encode(this.client).getArchetypeAtIndex(_index);
            return Call<Tx, {
                error: number;
                archetype: string;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArchetypeAtIndex();
            });
        }
        getArchetypeAtIndexInPackage(_packageId: Buffer, _index: number) {
            const data = Encode(this.client).getArchetypeAtIndexInPackage(_packageId, _index);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getArchetypeAtIndexInPackage();
            });
        }
        getNumberOfArchetypes() {
            const data = Encode(this.client).getNumberOfArchetypes();
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfArchetypes();
            });
        }
        getNumberOfArchetypesInPackage(_packageId: Buffer) {
            const data = Encode(this.client).getNumberOfArchetypesInPackage(_packageId);
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfArchetypesInPackage();
            });
        }
        getNumberOfPackages() {
            const data = Encode(this.client).getNumberOfPackages();
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getNumberOfPackages();
            });
        }
        getPackageAtIndex(_index: number) {
            const data = Encode(this.client).getPackageAtIndex(_index);
            return Call<Tx, [Buffer]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getPackageAtIndex();
            });
        }
        getPackageData(_id: Buffer) {
            const data = Encode(this.client).getPackageData(_id);
            return Call<Tx, {
                author: string;
                isPrivate: boolean;
                active: boolean;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getPackageData();
            });
        }
        getSystemOwner() {
            const data = Encode(this.client).getSystemOwner();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getSystemOwner();
            });
        }
        packageExists(_id: Buffer) {
            const data = Encode(this.client).packageExists(_id);
            return Call<Tx, [boolean]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).packageExists();
            });
        }
        transferSystemOwnership(_newOwner: string) {
            const data = Encode(this.client).transferSystemOwnership(_newOwner);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).transferSystemOwnership();
            });
        }
    }
    export const Encode = <Tx>(client: Provider<Tx>) => { return {
        activatePackage: (_id: Buffer) => { return client.encode("EBA7DF04", ["bytes32"], _id); },
        addArchetype: (_archetype: string) => { return client.encode("87BD4A22", ["address"], _archetype); },
        addArchetypeToPackage: (_id: Buffer, _archetype: string) => { return client.encode("B8019B68", ["bytes32", "address"], _id, _archetype); },
        archetypeExists: (_archetype: string) => { return client.encode("D2739EF0", ["address"], _archetype); },
        createPackage: (_id: Buffer, _author: string, _isPrivate: boolean, _active: boolean) => { return client.encode("187DD6AA", ["bytes32", "address", "bool", "bool"], _id, _author, _isPrivate, _active); },
        deactivatePackage: (_id: Buffer) => { return client.encode("FACA9C86", ["bytes32"], _id); },
        getArchetypeAtIndex: (_index: number) => { return client.encode("D119D31E", ["uint256"], _index); },
        getArchetypeAtIndexInPackage: (_packageId: Buffer, _index: number) => { return client.encode("861F6214", ["bytes32", "uint256"], _packageId, _index); },
        getNumberOfArchetypes: () => { return client.encode("786E3F41", []); },
        getNumberOfArchetypesInPackage: (_packageId: Buffer) => { return client.encode("A2960207", ["bytes32"], _packageId); },
        getNumberOfPackages: () => { return client.encode("524DE76B", []); },
        getPackageAtIndex: (_index: number) => { return client.encode("C589E0FD", ["uint256"], _index); },
        getPackageData: (_id: Buffer) => { return client.encode("B4D6D4C7", ["bytes32"], _id); },
        getSystemOwner: () => { return client.encode("7F692A2A", []); },
        packageExists: (_id: Buffer) => { return client.encode("A9B35240", ["bytes32"], _id); },
        transferSystemOwnership: (_newOwner: string) => { return client.encode("0A452AD6", ["address"], _newOwner); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        activatePackage: (): void => { return; },
        addArchetype: (): {
            error: number;
        } => {
            const [error] = client.decode(data, ["uint256"]);
            return { error: error };
        },
        addArchetypeToPackage: (): [number] => { return client.decode(data, ["uint256"]); },
        archetypeExists: (): [boolean] => { return client.decode(data, ["bool"]); },
        createPackage: (): [number] => { return client.decode(data, ["uint256"]); },
        deactivatePackage: (): void => { return; },
        getArchetypeAtIndex: (): {
            error: number;
            archetype: string;
        } => {
            const [error, archetype] = client.decode(data, ["uint256", "address"]);
            return { error: error, archetype: archetype };
        },
        getArchetypeAtIndexInPackage: (): [string] => { return client.decode(data, ["address"]); },
        getNumberOfArchetypes: (): [number] => { return client.decode(data, ["uint256"]); },
        getNumberOfArchetypesInPackage: (): [number] => { return client.decode(data, ["uint256"]); },
        getNumberOfPackages: (): [number] => { return client.decode(data, ["uint256"]); },
        getPackageAtIndex: (): [Buffer] => { return client.decode(data, ["bytes32"]); },
        getPackageData: (): {
            author: string;
            isPrivate: boolean;
            active: boolean;
        } => {
            const [author, isPrivate, active] = client.decode(data, ["address", "bool", "bool"]);
            return { author: author, isPrivate: isPrivate, active: active };
        },
        getSystemOwner: (): [string] => { return client.decode(data, ["address"]); },
        packageExists: (): [boolean] => { return client.decode(data, ["bool"]); },
        transferSystemOwnership: (): void => { return; }
    }; };
}