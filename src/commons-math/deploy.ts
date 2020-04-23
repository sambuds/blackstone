import { Client } from "../lib/client";
import { Addition } from "./Addition.abi";
import { CallTx } from "@hyperledger/burrow/proto/payload_pb";
import { DefaultApplicationRegistry } from "../bpm-runtime/DefaultApplicationRegistry.abi";
import { Subtraction } from "./Subtraction.abi";
import { Multiplication } from "./Multiplication.abi";
import { Division } from "./Division.abi";
import { MakeZero } from "./MakeZero.abi";
import { Increment } from "./Increment.abi";
import { Decrement } from "./Decrement.abi";
import { IsEqual } from "./IsEqual.abi";
import { IsNotEqual } from "./IsNotEqual.abi";
import { GreaterThan } from "./GreaterThan.abi";
import { GreaterThanEqual } from "./GreaterThanEqual.abi";
import { LessThan } from "./LessThan.abi";
import { LessThanEqual } from "./LessThanEqual.abi";

async function addApplication(
    registry: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
    _id: string, _type: number, _location: Promise<string>, _function: string, _webForm: string
){
    return (await registry).addApplication(Buffer.from(_id), _type, await _location, Buffer.from(_function), Buffer.from(_webForm));
}

async function addAccessPoint(
    registry: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
    _id: string, _accessPointId: string, _dataType: number, _direction: number
){
    return (await registry).addAccessPoint(Buffer.from(_id), Buffer.from(_accessPointId), _dataType, _direction);
}

export async function DeployNumbers(
    client: Client,
    registry: Promise<DefaultApplicationRegistry.Contract<CallTx>>,
){
    const addition = Addition.Deploy(client);
    const subtraction = Subtraction.Deploy(client);
    const multiplication = Multiplication.Deploy(client);
    const division = Division.Deploy(client);
    const zeroize = MakeZero.Deploy(client);
    const increment = Increment.Deploy(client);
    const decrement = Decrement.Deploy(client);
    const isEqual = IsEqual.Deploy(client);
    const isNotEqual = IsNotEqual.Deploy(client);
    const greaterThan = GreaterThan.Deploy(client);
    const greaterThanEqual = GreaterThanEqual.Deploy(client);
    const lessThan = LessThan.Deploy(client);
    const lessThanEqual = LessThanEqual.Deploy(client);

  return Promise.all([
    addApplication(registry, "Numbers - Addition", 1, addition, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Addition", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - Addition", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - Addition", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Subtraction", 1, subtraction, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Subtraction", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - Subtraction", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - Subtraction", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Multiplication", 1, multiplication, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Multiplication", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - Multiplication", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - Multiplication", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Division", 1, division, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Division", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - Division", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - Division", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Zeroize", 1, zeroize, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Zeroize", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Increment", 1, increment, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Increment", "numberIn", 8, 0),
      addAccessPoint(registry, "Numbers - Increment", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - Decrement", 1, decrement, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - Decrement", "numberIn", 8, 0),
      addAccessPoint(registry, "Numbers - Decrement", "numberOut", 8, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - IsEqual", 1, isEqual, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - IsEqual", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - IsEqual", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - IsEqual", "result", 1, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - IsNotEqual", 1, isNotEqual, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - IsNotEqual", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - IsNotEqual", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - IsNotEqual", "result", 1, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - GreaterThan", 1, greaterThan, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - GreaterThan", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - GreaterThan", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - GreaterThan", "result", 1, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - GreaterThanEqual", 1, greaterThanEqual, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - GreaterThanEqual", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - GreaterThanEqual", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - GreaterThanEqual", "result", 1, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - LessThan", 1, lessThan, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - LessThan", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - LessThan", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - LessThan", "result", 1, 1),
    ]).then(() => res)),

    addApplication(registry, "Numbers - LessThanEqual", 1, lessThanEqual, "", "").then((res) => Promise.all([
      addAccessPoint(registry, "Numbers - LessThanEqual", "numberInOne", 8, 0),
      addAccessPoint(registry, "Numbers - LessThanEqual", "numberInTwo", 8, 0),
      addAccessPoint(registry, "Numbers - LessThanEqual", "result", 1, 1),
    ]).then(() => res)),
  ]);
}