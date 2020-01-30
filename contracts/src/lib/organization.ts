import { CallOnBehalfOf } from './utils'
import { Organization } from '../commons-auth/Organization';
import { Client } from './client';
import { Manager } from './manager';
import { Controller } from './control';

export class OrganizationController extends Controller {
    constructor(client: Client, manager: Manager) {
        super(client, manager);
    }

    async createOrganization(org: { approvers: string[]; defaultDepartmentId: Buffer; }) {
        return this.manager.ParticipantsManager
            .createOrganization(org.approvers ? org.approvers : [], org.defaultDepartmentId)
            .then(value => value[0]);
    }

    async addUserToOrganization(userAddress: any, organizationAddress: any, actingUserAddress: any) {
        const payload = Organization.Encode(this.client).addUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).addUser();
        return data.successful;
    }

    async removeUserFromOrganization(userAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUser(userAddress);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).removeUser();
        return data.successful;
    }

    async addApproverToOrganization(approverAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addApprover(approverAddress);
        await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
    }

    async removeApproverFromOrganization(approverAddress: string, organizationAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeApprover(approverAddress);
        return CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
    }

    async createDepartment(organizationAddress: string, id: Buffer, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addDepartment(id);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).addDepartment();
        return data[0];
    }

    async removeDepartment(organizationAddress: string, id: Buffer, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeDepartment(id);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).removeDepartment();
        return data.successful;
    }

    async addDepartmentUser(organizationAddress: string, depId: Buffer, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).addUserToDepartment(userAddress, depId);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).addUserToDepartment();
        return data.successful;
    }

    async removeDepartmentUser(organizationAddress: string, depId: Buffer, userAddress: string, actingUserAddress: string) {
        const payload = Organization.Encode(this.client).removeUserFromDepartment(userAddress, depId);
        const response = await CallOnBehalfOf(this.client, actingUserAddress, organizationAddress, payload);
        const data = Organization.Decode(this.client, response).removeUserFromDepartment();
        return data[0];
    }
}