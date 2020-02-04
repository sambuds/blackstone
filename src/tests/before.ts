import { Deploy } from "../deploy";
import { Client } from "../lib/client";
import { resolve } from "path";
import { config } from "dotenv";
import { Load } from "../lib/contracts";

before(function(done) {
    this.timeout(0);
    config({ path: resolve(__dirname, "../../.env") })
    const client = new Client(process.env.CHAIN_URL_GRPC, process.env.SIGNING_ADDRESS);
    Deploy(client).then(() => done());
})

export function load() {
    config({ path: resolve(__dirname, "../../.env") })
    return Load(process.env.CHAIN_URL_GRPC, process.env.SIGNING_ADDRESS, process.env.IDENTITY_PROVIDER);
}