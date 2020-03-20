```
/$$       /$$                     /$$                   /$$
| $$      | $$                    | $$                  | $$
| $$$$$$$ | $$  /$$$$$$   /$$$$$$$| $$   /$$  /$$$$$$$ /$$$$$$    /$$$$$$  /$$$$$$$   /$$$$$$
| $$__  $$| $$ |____  $$ /$$_____/| $$  /$$/ /$$_____/|_  $$_/   /$$__  $$| $$__  $$ /$$__  $$
| $$  \ $$| $$  /$$$$$$$| $$      | $$$$$$/ |  $$$$$$   | $$    | $$  \ $$| $$  \ $$| $$$$$$$$
| $$  | $$| $$ /$$__  $$| $$      | $$_  $$  \____  $$  | $$ /$$| $$  | $$| $$  | $$| $$_____/
| $$$$$$$/| $$|  $$$$$$$|  $$$$$$$| $$ \  $$ /$$$$$$$/  |  $$$$/|  $$$$$$/| $$  | $$|  $$$$$$$
|_______/ |__/ \_______/ \_______/|__/  \__/|_______/    \___/   \______/ |__/  |__/ \_______/
```

<table>
  <tr>
    <td>The <strong>Blackstone</strong> codebase is a collection of smart contracts which together form the basis for the Agreements Network.
    <br/><br/>
    It is named after <a href="https://en.wikipedia.org/wiki/William_Blackstone">Sir William Blackstone</a>, an English jurist, judge, and politician of the eighteenth century.
    <br/><br/>
    This collection includes a full-feature business process execution engine in Solidity, with Typescript bindings. It also include an object management suite utilized by the Agreements Network.</td>
    <td><img src="https://upload.wikimedia.org/wikipedia/commons/a/a6/SirWilliamBlackstone.jpg" width="220px"/></td>
  </tr>
</table>

## Preliminary Note

While the code in this repository is geared towards its use in the [Agreements Network](https://agreements.network), the lower-level functions and smart contracts are highly reusable and suited to build any blockchain-based ecosystem application. If you would like to learn more about the interfaces used in this system please visit the [documentation site](https://docs.agreements.network) for the network.

To ask questions or to learn more feel free to join the [Agreements Network mailing list](https://lists.agreements.network) to ask questions or to join the community.

## Prerequisites

- `make`
- `docker`
- `yarn`

```bash
yarn add global ts-node
yarn add global typescript
```

## Getting Started

Install all dependencies.

```bash
yarn install
```

Run a single-node [Burrow](https://github.com/hyperledger/burrow) chain.

```bash
make docker_run_chain
```

Launch the tests, deploying the suite beforehand.

```bash
yarn test
```

## Compilation

If you update the Solidity contracts, you must re-compile the framework to get up-to-date bindings.

```bash
yarn build
```

This will also compile the Typescript, saving build artifacts to `./dist`. 
There are separate scripts listed in `package.json`.

Alternatively, we also support compilation, linking and deployment via the legacy deploy tooling.

```bash
make build_contracts
```

## Upgrades

```bash
cd ./src
burrow deploy --chain=localhost:10997 --address=${ADDRESS} --bin-path ./bin ../upgrades/${UPGRADE}.yaml
```
