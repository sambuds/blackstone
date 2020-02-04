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
export module TypeUtilsLib {
    export function Deploy<Tx>(client: Provider<Tx>): Promise<string> {
        let bytecode = "61086d610026600b82828239805160001a60731461001957fe5b30600052607381538281f3fe73000000000000000000000000000000000000000030146080604052600436106100875760003560e01c806373aafb531161006557806373aafb531461026c5780638529d576146102ae5780638e8567ae1461037d578063b11a19e8146103c357610087565b806327df8f2a1461008c57806331654b091461015b57806347f534311461019d575b600080fd5b610145600480360360208110156100a257600080fd5b81019080803590602001906401000000008111156100bf57600080fd5b8201836020820111156100d157600080fd5b803590602001918460018302840111640100000000831117156100f357600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f82011690508083019250505050505050919291929050505061046a565b6040518082815260200191505060405180910390f35b6101876004803603602081101561017157600080fd5b8101908080359060200190929190505050610478565b6040518082815260200191505060405180910390f35b610256600480360360208110156101b357600080fd5b81019080803590602001906401000000008111156101d057600080fd5b8201836020820111156101e257600080fd5b8035906020019184600183028401116401000000008311171561020457600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610590565b6040518082815260200191505060405180910390f35b6102986004803603602081101561028257600080fd5b810190808035906020019092919050505061059e565b6040518082815260200191505060405180910390f35b610367600480360360208110156102c457600080fd5b81019080803590602001906401000000008111156102e157600080fd5b8201836020820111156102f357600080fd5b8035906020019184600183028401116401000000008311171561031557600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600081840152601f19601f820116905080830192505050505050509192919290505050610640565b6040518082815260200191505060405180910390f35b6103a96004803603602081101561039357600080fd5b8101908080359060200190929190505050610693565b604051808215151515815260200191505060405180910390f35b6103ef600480360360208110156103d957600080fd5b81019080803590602001909291905050506106a7565b6040518080602001828103825283818151815260200191508051906020019080838360005b8381101561042f578082015181840152602081019050610414565b50505050905090810190601f16801561045c5780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b600060208201519050919050565b60008060008360001c141561049157600091505061058b565b60006fffffffffffffffffffffffffffffffff8460001c1614156104d9576010810190507001000000000000000000000000000000008360001c816104d257fe5b0460001b92505b600067ffffffffffffffff8460001c16141561051157600881019050680100000000000000008360001c8161050a57fe5b0460001b92505b600063ffffffff8460001c161415610541576004810190506401000000008360001c8161053a57fe5b0460001b92505b600061ffff8460001c16141561056d57600281019050620100008360001c8161056657fe5b0460001b92505b600060ff8460001c161415610583576001810190505b806020039150505b919050565b600060208201519050919050565b6000808214156105d0577f30000000000000000000000000000000000000000000000000000000000000009050610638565b5b6000821115610637576101008160001c816105e857fe5b0460001b90507f01000000000000000000000000000000000000000000000000000000000000006030600a848161061b57fe5b06010260001b81179050600a828161062f57fe5b0491506105d1565b5b809050919050565b600080600090505b825181101561068d576001810183510360080260020a83828151811061066a57fe5b602001015160f81c60f81b60f81c60ff1602820191508080600101915050610648565b50919050565b60008061069f83610478565b149050919050565b60608060206040519080825280601f01601f1916602001820160405280156106de5781602001600182028038833980820191505090505b509050600080905060008090505b60208110156107885760008160080260020a8660001c0260001b9050600060f81b817effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff19161461077a578084848151811061074257fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a90535082806001019350505b5080806001019150506106ec565b6060826040519080825280601f01601f1916602001820160405280156107bd5781602001600182028038833980820191505090505b509050600091505b8282101561082c578382815181106107d957fe5b602001015160f81c60f81b8183815181106107f057fe5b60200101907effffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff1916908160001a90535081806001019250506107c5565b8094505050505091905056fea265627a7a723158207753003df406471a184aca6e07433160072c424802e9a3a84ee770b949bf9b7364736f6c634300050c0032";
        const data = bytecode;
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
        contentLength(self: Buffer) {
            const data = Encode(this.client).contentLength(self);
            return Call<Tx, [number]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).contentLength();
            });
        }
        isEmpty(_value: Buffer) {
            const data = Encode(this.client).isEmpty(_value);
            return Call<Tx, [boolean]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).isEmpty();
            });
        }
        toBytes32(s: string, b: Buffer, v: number) {
            const data = Encode(this.client).toBytes32(s, b, v);
            return Call<Tx, {
                result: Buffer;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).toBytes32();
            });
        }
        toString(x: Buffer) {
            const data = Encode(this.client).toString(x);
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).toString();
            });
        }
        toUint(b: Buffer) {
            const data = Encode(this.client).toUint(b);
            return Call<Tx, {
                number: number;
            }>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).toUint();
            });
        }
    }
    export const Encode = <Tx>(client: Provider<Tx>) => { return {
        contentLength: (self: Buffer) => { return client.encode("31654B09", ["bytes32"], self); },
        isEmpty: (_value: Buffer) => { return client.encode("8E8567AE", ["bytes32"], _value); },
        toBytes32: (s: string, b: Buffer, v: number) => {
            if (typeof s === "string")
                return client.encode("27DF8F2A", ["string"], s);
            if (typeof b === "string")
                return client.encode("47F53431", ["bytes"], b);
            if (typeof v === "string")
                return client.encode("73AAFB53", ["uint256"], v);
        },
        toString: (x: Buffer) => { return client.encode("B11A19E8", ["bytes32"], x); },
        toUint: (b: Buffer) => { return client.encode("8529D576", ["bytes"], b); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        contentLength: (): [number] => { return client.decode(data, ["uint256"]); },
        isEmpty: (): [boolean] => { return client.decode(data, ["bool"]); },
        toBytes32: (): {
            result: Buffer;
        } => {
            const [result] = client.decode(data, ["bytes32"]);
            return { result: result };
        },
        toString: (): [string] => { return client.decode(data, ["string"]); },
        toUint: (): {
            number: number;
        } => {
            const [number] = client.decode(data, ["uint256"]);
            return { number: number };
        }
    }; };
}