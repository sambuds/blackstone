import { HexFromString, CallOnBehalfOf } from './utils'
import { ActiveAgreement } from '../agreements/ActiveAgreement';
import { Client } from './client';
import { Manager } from './manager';
import { Controller } from './control';

type AgreementObject = {
    archetype: string,
    creator: string
    owner: string
    privateParametersFileReference: string
    isPrivate?: boolean
    parties: string[]
    collectionId: Buffer
    governingAgreements: string[]
}

export class AgreementsController extends Controller {
    constructor(client: Client, manager: Manager) {
        super(client, manager);
    }

    async createAgreement(agreement: AgreementObject) {
        const {
            archetype,
            creator,
            owner,
            privateParametersFileReference,
            parties,
            collectionId,
            governingAgreements,
        } = agreement;
        const isPrivate = agreement.isPrivate || false;

        return this.manager.ActiveAgreementRegistry
            .createAgreement(archetype, creator, owner, privateParametersFileReference, isPrivate, parties, collectionId, governingAgreements);
    }
    
    async setLegalState(agreementAddress: string, legalState: number) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        const permissionId = (await agreement.ROLE_ID_LEGAL_STATE_CONTROLLER())[0]
        const hasPermission = (await agreement.hasPermission(permissionId, this.account))[0];
        if (!hasPermission) await agreement.grantPermission(permissionId, this.account);
        await agreement.setLegalState(legalState);
        await agreement.revokePermission(permissionId, this.account);
    }
    
    async initializeObjectAdministrator(agreementAddress: string) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        await agreement.initializeObjectAdministrator(this.account)
    }

    async setMaxNumberOfAttachments(agreementAddress: string, maxNumberOfAttachments: number) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        await agreement.setMaxNumberOfEvents(maxNumberOfAttachments)
    }

    async setAddressScopeForAgreementParameters(agreementAddress: string, parameters: Array<{ name: string, value: string, scope: Buffer }>) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);

        return parameters.map(({ name, value, scope }) => new Promise((resolve, reject) => {
            return agreement.setAddressScope(value, HexFromString(name), scope, Buffer.from(''), Buffer.from(''), '0x0')
        }));
    }

    async updateAgreementFileReference(fileKey: any, agreementAddress: string, hoardGrant: string) {
        const agreement = new ActiveAgreement.Contract(this.client, agreementAddress);
        switch (fileKey) {
            case 'EventLog':
                await agreement.setEventLogReference(hoardGrant);
                break;
            case 'SignatureLog':
                await agreement.setSignatureLogReference(hoardGrant);
                break;
            case 'PrivateParameters':
                await agreement.setPrivateParametersReference(hoardGrant);
                break;
        }
    }

    async createAgreementCollection(author: string, collectionType: number, packageId: Buffer) {
        return this.manager.ActiveAgreementRegistry
            .createAgreementCollection(author, collectionType, packageId)
            .catch(err => console.log(err));
    }

    async addAgreementToCollection(collectionId: Buffer, agreement: string) {
        return this.manager.ActiveAgreementRegistry
            .addAgreementToCollection(collectionId, agreement)
            .catch(err => console.log(err));
    }

    async signAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).sign()
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async isAgreementSignedBy(agreementAddress: string, userAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).isSignedBy(userAddress);
        const response = await CallOnBehalfOf(this.client, userAddress, agreementAddress, payload);
        const data = ActiveAgreement.Decode(this.client, response).isSignedBy();
        const isSignedBy = data[0].valueOf();
        return isSignedBy;
    }

    async cancelAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).cancel();
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async redactAgreement(actingUserAddress: string, agreementAddress: string) {
        const payload = ActiveAgreement.Encode(this.client).redact();
        return CallOnBehalfOf(this.client, actingUserAddress, agreementAddress, payload);
    }

    async getActiveAgreementData(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .getActiveAgreementData(agreementAddress);
    }

    async startProcessFromAgreement(agreementAddress: string) {
        return this.manager.ActiveAgreementRegistry
            .startProcessLifecycle(agreementAddress)
            .then(data => data.processInstance);
    }
}