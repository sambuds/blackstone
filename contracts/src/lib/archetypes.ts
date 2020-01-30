import { HexFromString, CallOnBehalfOf } from './utils'
import { Archetype } from '../agreements/Archetype';
import { Manager } from './manager';
import { Client } from './client';
import { Controller } from './control';

type ArchetypeObject = {
    price: number
    isPrivate?: boolean
    active: boolean
    author: string
    owner: string
    formationProcess: string
    executionProcess: string
    packageId: Buffer
    governingArchetypes: string[]
}

export class ArchetypesController extends Controller {
    constructor(client: Client, manager: Manager) {
        super(client, manager);
    }

    async createArchetype(archetype: ArchetypeObject) {
        const {
            price,
            active,
            author,
            owner,
            formationProcess,
            executionProcess,
            packageId,
            governingArchetypes,
        } = archetype;
        const isPrivate = archetype.isPrivate || false;

        return this.manager.ArchetypeRegistry
            .createArchetype(price, isPrivate, active, author, owner, formationProcess, executionProcess, packageId, governingArchetypes)
            .then(value => value.archetype);
    }

    async isActiveArchetype(archetypeAddress: string) {
        return new Archetype.Contract(this.client, archetypeAddress)
            .isActive()
            .then(value => value[0])
            .catch(err => console.log(err));
    }

    async getArchetypeAuthor(archetypeAddress: string) {
        return new Archetype.Contract(this.client, archetypeAddress)
            .getAuthor()
            .then(value => value[0])
            .catch(err => console.log(err));
    }

    async activateArchetype(archetypeAddress: string, userAccount: string) {
        const payload = Archetype.Encode(this.client).activate();
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async deactivateArchetype(archetypeAddress: string, userAccount: string) {
        const payload = Archetype.Encode(this.client).deactivate();
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async setArchetypeSuccessor(archetypeAddress, successorAddress, userAccount) {
        const payload = Archetype.Encode(this.client).setSuccessor(successorAddress);
        await CallOnBehalfOf(this.client, userAccount, archetypeAddress, payload);
    }
    
    async getArchetypeSuccessor(archetypeAddress: string) {
        return this.manager.ArchetypeRegistry
            .getArchetypeSuccessor(archetypeAddress)
            .then(value => value[0]);
    }

    async addArchetypeParameters(address: string, parameters: Array<{ type: string, name: string }>) {
        const paramTypes: number[] = [];
        const paramNames: Buffer[] = [];
        for (let i = 0; i < parameters.length; i += 1) {
          paramTypes[i] = parseInt(parameters[i].type, 10);
          paramNames[i] = HexFromString(parameters[i].name);
        }
        return this.manager.ArchetypeRegistry
            .addParameters(address, paramTypes, paramNames)
            .then(value => value.error);
    }
    
    async addArchetypeDocument(address: string, fileReference: string) {
        return this.manager.ArchetypeRegistry
            .addDocument(address, fileReference);
    }
    
    async addArchetypeDocuments(archetypeAddress: string, documents: Array<{ grant: string }>) {
        const resolvedDocs = await Promise.all(documents.map(async ({ grant }) => {
          const result = await this.addArchetypeDocument(archetypeAddress, grant);
          return result;
        }));
        return resolvedDocs;
    }
    
    async setArchetypePrice(address: string, price: number) {
        const priceInCents = Math.floor(price * 100); // monetary unit conversion to cents which is the recorded unit on chain
        return this.manager.ArchetypeRegistry
            .setArchetypePrice(address, priceInCents);
    }
    
    async createArchetypePackage(author: string, isPrivate: boolean, active: boolean) {
        return this.manager.ArchetypeRegistry
            .createArchetypePackage(author, isPrivate, active)
            .then(value => value.id);
      }
    
    async activateArchetypePackage(packageId: Buffer, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .activatePackage(packageId, userAccount);
    }
    
    async deactivateArchetypePackage(packageId: Buffer, userAccount: string) {
        return this.manager.ArchetypeRegistry
            .deactivatePackage(packageId, userAccount);

    }

    async addArchetypeToPackage(packageId: Buffer, archetype: string) {
        return this.manager.ArchetypeRegistry
            .addArchetypeToPackage(packageId, archetype);
    }

    async addJurisdictions(address: string, jurisdictions: Array<{ country: string, regions: Array<string>}>) {
        const countries: Buffer[] = [];
        const regions: Buffer[] = [];
        jurisdictions.forEach((item) => {
            if (item.regions.length > 0) {
                item.regions.forEach((region) => {
                    countries.push(HexFromString(item.country));
                    regions.push(HexFromString(region));
                });
            } else {
                countries.push(HexFromString(item.country));
                regions.push(Buffer.from(''));
            }
        });

        return this.manager.ArchetypeRegistry
            .addJurisdictions(address, countries, regions);
    }


    async getArchetypeProcesses(archAddress: string) {
        const data = await this.manager.ArchetypeRegistry.getArchetypeData(archAddress)
        return {
            formation: data.formationProcessDefinition,
            execution: data.executionProcessDefinition,
        }
    }
}