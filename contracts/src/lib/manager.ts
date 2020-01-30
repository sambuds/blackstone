import { Client } from './client';
import { CallTx } from '@hyperledger/burrow/proto/payload_pb';
import { DOUG } from '../commons-management/DOUG';
import { EcosystemRegistry } from '../commons-auth/EcosystemRegistry';
import { ParticipantsManager } from '../commons-auth/ParticipantsManager';
import { ArchetypeRegistry } from '../agreements/ArchetypeRegistry';
import { ActiveAgreementRegistry } from '../agreements/ActiveAgreementRegistry';
import { ProcessModelRepository } from '../bpm-model/ProcessModelRepository';
import { ApplicationRegistry } from '../bpm-runtime/ApplicationRegistry';
import { BpmService } from '../bpm-runtime/BpmService';
import { GetFromNameRegistry } from './utils';

async function lookup(doug: DOUG.Contract<CallTx>, contract: string) {
    const result = await doug.lookup(contract);
    return result.contractAddress;
}

export type Manager = {
    EcosystemRegistry: EcosystemRegistry.Contract<CallTx>
    ParticipantsManager: ParticipantsManager.Contract<CallTx>
    ArchetypeRegistry: ArchetypeRegistry.Contract<CallTx>
    ActiveAgreementRegistry: ActiveAgreementRegistry.Contract<CallTx>
    ProcessModelRepository: ProcessModelRepository.Contract<CallTx>
    ApplicationRegistry: ApplicationRegistry.Contract<CallTx>
    BpmService: BpmService.Contract<CallTx>
}

export async function NewManager(client: Client) {
    const addr = await GetFromNameRegistry(client, 'DOUG');
    const doug = new DOUG.Contract(client, addr);

    return {
        EcosystemRegistry: new EcosystemRegistry.Contract(client, await lookup(doug, 'EcosystemRegistry')),
        ParticipantsManager: new ParticipantsManager.Contract(client, await lookup(doug, 'ParticipantsManager')),
        ArchetypeRegistry: new ArchetypeRegistry.Contract(client, await lookup(doug, 'ArchetypeRegistry')),
        ActiveAgreementRegistry: new ActiveAgreementRegistry.Contract(client, await lookup(doug, 'ActiveAgreementRegistry')),
        ProcessModelRepository: new ProcessModelRepository.Contract(client, await lookup(doug, 'ProcessModelRepository')),
        ApplicationRegistry: new ApplicationRegistry.Contract(client, await lookup(doug, 'ApplicationRegistry')),
        BpmService: new BpmService.Contract(client, await lookup(doug, 'BpmService')),
    } as Manager;
}