import { Client } from './lib/client';
import { Manager, NewManager } from './lib/manager';
import { AgreementsController } from './lib/agreements';
import { ArchetypesController } from './lib/archetypes';
import { BPMController } from './lib/bpm';
import { EcosystemController, RegisterEcosystem } from './lib/ecosystem';
import { OrganizationController } from './lib/organization';
import { GetFromNameRegistry } from './lib/utils';

export class Contracts {
    client: Client;
    account: string;

    agreements: AgreementsController;
    archetypes: ArchetypesController;
    bpm: BPMController;
    ecosystem: EcosystemController;
    organization: OrganizationController;

    constructor(client: Client, manager: Manager, ecosystem: string) {
        this.client = client;

        this.agreements = new AgreementsController(client, manager);
        this.archetypes = new ArchetypesController(client, manager);
        this.bpm = new BPMController(client, manager);
        this.ecosystem = new EcosystemController(client, manager, ecosystem);
        this.organization = new OrganizationController(client, manager);
    }
}

async function NewContracts(url: string, account: string, ecosystemName: string) {
    const client = new Client(url, account);
    const manager = await NewManager(client);
    
    let ecosystemAddress = await GetFromNameRegistry(client, ecosystemName);
    if (!ecosystemAddress) {
        ecosystemAddress = await RegisterEcosystem(client, manager, account, ecosystemName);
    }
    
    return new Contracts(client, manager, ecosystemAddress);
}

NewContracts('localhost:10997', '1CA0D665087CACE1B965F6B04873D96EC5C7F8BA', 'AN')