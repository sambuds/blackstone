import { Client } from "../lib/client";
import { DOUG } from "../commons-management/DOUG.abi";
import { CallTx } from "@hyperledger/burrow/proto/payload_pb";
import { DeadlineOracle } from "./DeadlineOracle.abi";
import { DefaultBpmService } from "../bpm-runtime/DefaultBpmService.abi";
import { DefaultApplicationRegistry } from "../bpm-runtime/DefaultApplicationRegistry.abi";
import { WaitOracle } from "./WaitOracle.abi";

export async function DeployDeadline(
    client: Client,
    doug: DOUG.Contract<CallTx>,
    service: Promise<DefaultBpmService.Contract<CallTx>>,
    registry: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
    errorsLib: Promise<string>,
){
    const bpmService = await service;
    const errorsLibAddress = await errorsLib;
    const oracleAddress = await DeadlineOracle.Deploy(client, errorsLibAddress, bpmService.address)
    
    const applicationRegistry = await registry;
    return Promise.all([
        applicationRegistry.addApplication(Buffer.from("Deadline Oracle"), 0, oracleAddress, Buffer.from(''), Buffer.from('')),
        applicationRegistry.addAccessPoint(Buffer.from("Deadline Oracle"), Buffer.from("Deadline"), 8, 0),
        doug.deploy("DeadlineOracle", oracleAddress),
    ]);
}

export async function DeployWait(
    client: Client,
    doug: DOUG.Contract<CallTx>,
    service: Promise<DefaultBpmService.Contract<CallTx>>,
    registry: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
    errorsLib: Promise<string>,
){
    const bpmService = await service;
    const errorsLibAddress = await errorsLib;
    const oracleAddress = await WaitOracle.Deploy(client, errorsLibAddress, bpmService.address)
    
    const applicationRegistry = await registry;
    return Promise.all([
        applicationRegistry.addApplication(Buffer.from("WaitOracle"), 0, oracleAddress, Buffer.from(''), Buffer.from('')),
        applicationRegistry.addAccessPoint(Buffer.from("WaitOracle"), Buffer.from("Frequency"), 2, 0),
        doug.deploy("WaitOracle", oracleAddress),
    ]);
}