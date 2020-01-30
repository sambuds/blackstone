import { Manager } from './manager';
import { Client } from './client';

export class Controller {
    client: Client;
    manager: Manager;
    account: string;

    constructor(client: Client, manager: Manager) {
        this.client = client;
        this.account = client.account;
        this.manager = manager;
    }
}