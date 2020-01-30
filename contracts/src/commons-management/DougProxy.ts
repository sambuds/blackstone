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
export module DougProxy {
    export function Deploy<Tx>(client: Provider<Tx>, commons_base_ErrorsLib_sol_ErrorsLib: string, _doug: string): Promise<string> {
        let bytecode = "608060405234801561001057600080fd5b506040516106983803806106988339818101604052602081101561003357600080fd5b81019080805190602001909291905050508080806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055505033600160006101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050506105bf806100d96000396000f3fe608060405234801561001057600080fd5b50600436106100415760003560e01c8063441c2d67146101d7578063893d20e81461021b578063bc7f3b5014610265575b600061004b6102af565b905073__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef600073ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff161461009f6102d8565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b838110156101005780820151818401526020810190506100e5565b50505050905090810190601f16801561012d5780820380516001836020036101000a031916815260200191505b50848103835260158152602001807f416273747261637444656c656761746550726f7879000000000000000000000081525060200184810382526029815260200180610562602991396040019550505050505060006040518083038186803b15801561019857600080fd5b505af41580156101ac573d6000803e3d6000fd5b5050505060405136600082376000813683855af43d806000843e81600081146101d3578184f35b8184fd5b610219600480360360208110156101ed57600080fd5b81019080803573ffffffffffffffffffffffffffffffffffffffff169060200190929190505050610315565b005b6102236104fa565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b61026d6102af565b604051808273ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200191505060405180910390f35b60008060009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60606040518060400160405280600681526020017f4552523630300000000000000000000000000000000000000000000000000000815250905090565b73__$ecfb6c4d3c3ceff197e19e585a0a53728c$__6375d7bdef600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff163373ffffffffffffffffffffffffffffffffffffffff161415610389610524565b6040518363ffffffff1660e01b81526004018083151515158152602001806020018060200180602001848103845285818151815260200191508051906020019080838360005b838110156103ea5780820151818401526020810190506103cf565b50505050905090810190601f1680156104175780820380516001836020036101000a031916815260200191505b50848103835260198152602001807f446f756750726f78792e7072655f6f6e6c7942794f776e6572000000000000008152506020018481038252601f8152602001807f546865206d73672e73656e646572206973206e6f7420746865206f776e6572008152506020019550505050505060006040518083038186803b15801561049f57600080fd5b505af41580156104b3573d6000803e3d6000fd5b50505050806000806101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050565b6000600160009054906101000a900473ffffffffffffffffffffffffffffffffffffffff16905090565b60606040518060400160405280600681526020017f455252343033000000000000000000000000000000000000000000000000000081525090509056fe44656c6567617465207461726765742061646472657373206d757374206e6f7420626520656d707479a265627a7a723158207558d3eed9a9df6a7a9dfc3d928de92b723e58d951bbb4d4c91e13838d6a149c64736f6c634300050c0032";
        bytecode = Replace(bytecode, "$ecfb6c4d3c3ceff197e19e585a0a53728c$", commons_base_ErrorsLib_sol_ErrorsLib);
        const data = bytecode + client.encode("", ["address"], _doug);
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
        getDelegate() {
            const data = Encode(this.client).getDelegate();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getDelegate();
            });
        }
        getOwner() {
            const data = Encode(this.client).getOwner();
            return Call<Tx, [string]>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).getOwner();
            });
        }
        setProxiedDoug(_doug: string) {
            const data = Encode(this.client).setProxiedDoug(_doug);
            return Call<Tx, void>(this.client, this.address, data, (exec: Uint8Array) => {
                return Decode(this.client, exec).setProxiedDoug();
            });
        }
    }
    export const Encode = <Tx>(client: Provider<Tx>) => { return {
        getDelegate: () => { return client.encode("BC7F3B50", []); },
        getOwner: () => { return client.encode("893D20E8", []); },
        setProxiedDoug: (_doug: string) => { return client.encode("441C2D67", ["address"], _doug); }
    }; };
    export const Decode = <Tx>(client: Provider<Tx>, data: Uint8Array) => { return {
        getDelegate: (): [string] => { return client.decode(data, ["address"]); },
        getOwner: (): [string] => { return client.decode(data, ["address"]); },
        setProxiedDoug: (): void => { return; }
    }; };
}