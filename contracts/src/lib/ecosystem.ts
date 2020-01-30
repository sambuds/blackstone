import { Ecosystem } from '../commons-auth/Ecosystem';
import { Manager } from './manager';
import { Client } from './client';
import { Controller } from './control';
import { SetToNameRegistry } from './utils';

export async function RegisterEcosystem(client: Client, manager: Manager, account: string, name: string) {
    const address = await manager.EcosystemRegistry
        .createEcosystem(name)
        .then(data => data[0]);
    await new Ecosystem.Contract(client, address).addExternalAddress(account);
    await SetToNameRegistry(client, name, address);
    return address;
}

export class EcosystemController extends Controller {
    ecosystem: string;

    constructor(client: Client, manager: Manager, ecosystem: string) {
        super(client, manager);
        this.ecosystem = ecosystem;
    }

    async addExternalAddressToEcosystem(externalAddress: string, ecosystemAddress: string) {
        await new Ecosystem.Contract(this.client, ecosystemAddress).addExternalAddress(externalAddress);
    }

    async createUserInEcosystem(user: { username: Buffer; }, ecosystemAddress: string) {
        return this.manager.ParticipantsManager
            .createUserAccount(user.username, '0x0', ecosystemAddress)
            .then(data => data.userAccount);
    }

    async createUser(user: { username: Buffer; }) {
        return this.createUserInEcosystem(user, this.ecosystem);
    }

    async getUserByIdAndEcosystem(id: Buffer, ecosystemAddress: string) {
        return new Ecosystem.Contract(this.client, ecosystemAddress)
            .getUserAccount(id)
            .then(result => { return {address: result[0]}})
    }

    async getUserByUsername(username: Buffer) {
        return this.getUserByIdAndEcosystem(username, this.ecosystem);
    }

    async getUserByUserId(userid: Buffer) {
        return this.getUserByIdAndEcosystem(userid, this.ecosystem);
    }

    async addUserToEcosystem(username: Buffer, address: string) {
        return new Ecosystem.Contract(this.client, this.ecosystem)
            .addUserAccount(username, address);
    }
}