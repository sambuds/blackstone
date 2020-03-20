**Note**: This documentation is no longer applicable to this project and is kept only for reference in regards to the previous project structure.

# Smart Contract SDKs and Bundles - Developer Guide

The following are guidelines as wells as technical details required to understand when working as a developer with Monax SDKs.

## SDK repository structure

This is the typical file structure of an SDK repository:

- `build/` - Contains the SDK [build tools](https://github.com/monax/contracts-sdk-build-tools).
copied to the ~/.monax/bundles local bundle cache by the create_release.sh script where they can be picked up for standard dependency resolution.
- `doc/` - Contains the public documentation for the SDK, including auto-generated API doc.
- `src/` - The source code for Contract Bundles with folder names reflecting the bundle name.
- `LICENSE.md` - The Monax SDK license
- `package.json` - The SDK descriptor in the form of a NPM package.json. This file dictates the release version of the SDK. It also specifies JavaScript dependencies and is used to provide shortcut commands like (`npm test` or `npm run build`).
- `README.md` - The repository landing page
- `ReleaseNotes.md` - The SDK's latest Release Notes

## Bundle File Structure

Each bundle typically contains the following (see below for further details on some of these files):

- bundle.json - the *Bundle Manifest*
- README.md - the readme describing the bundle
- epm.yaml - the test jobs for the bundle
- contracts/ - directory containing the smart contracts of the bundle
- contract_bundles/ - A dynamically created directory in which bundle dependencies are unpacked
- test/ - directory containing smart contracts used in tests

## SDK Build / Test / Release

### Prerequisites

#### Running on host

**Note**: Operating systems other than Linux will no longer be supported for the stand-alone CLI in the future.

Example:
```
docker run --rm -it -v `pwd`:/app -v $HOME/.config/gcloud:/root/.config/gcloud -v $HOME/.monax:/root/.monax --workdir /app quay.io/monax/monax:0.19.6-platform_deployer npm test
```


### Initial Project Setup

Execute `npm install` after a fresh checkout of an SDK repository

### Dependency Management

The dependencies of one bundle to other bundles are declared in the `bundle.json` file (see example below).
Dependencies are retrieved from a local directory also referred to as *bundles cache*. The default location of the bundles cache is the `~/.monax/bundles` directory.
Scripts in the `build/` folder, e.g. `create_release.sh` and `test_contracts.sh` automatically run dependency resolution for all bundles, but it can also be run for a single bundle as in this example:

```
cd src/\<bundlename\>
../../build/install_deps.sh
```

#### Bundle Manifest

Each bundle manifest contains meta data about the bundle to be able to uniquely identify and version it as well as handle its dependencies. By convention the manifest should be named `bundle.json` and its format is based on NPM's package.json with the following differences:

- There are two additional fields: `groupId` and `bundleId`
- The bundle dependencies are an array of dependency objects

Example:
```
{
  "groupId": "monax",
  "bundleId": "financial-money-market",
  "name": "Monax Money Market Instruments",
  "version": "0.0.1",
  "description": "Contracts representing assets and functionality around Money Market Instruments.",
  "dependencies": [
    {
      "groupId": "monax",
      "bundleId": "financial-negotiable",
      "version": "0.0.1"
    },
    {
      "groupId": "monax",
      "bundleId": "commons-workflow",
      "version": "0.0.1"
    }
  ]
}
```

### Building a release version

Creating a release is achieved by compiling each bundle's content according to a build configuration (`build-config.json`, see further below) and creating release artifacts (\<bundlename\>-\<version\>.tgz and \<bundlename\>-doc-\<version\>.tgz). The script creates temporary directories under `build/assembly` and stores the build result under `build/release`. The release archives are also installed into the local bundles cache.
Since a bundle can have dependencies on external bundles as well as on bundles within the same SDK, note that the `create_release.sh` script respects the order in which bundles are passed as a parameter. This makes sure lower-level bundles get created first, so they're available via the same dependency resolution mechanism for other bundles in the SDK.

There are two options for building:


#### 1. NPM Script (recommended)

From the SDK root run `npm run build` to execute the pre-configured "build" task in `package.json` that will include all bundles of the src/ folder.

#### 2. Manual Parameterization

In case you need to change either the product name or the order or number of bundles to include, you can run the following from the SDK root. Example:

```
./build/create_release.sh documents-sdk "documents-commons,documents-bpm"
```

### Running Tests

The tests include starting the pre-configured blockchain `build/chain`, building a release of all bundles, and then iterating through the bundles in the `src/` directory and for each bundle running the bundle's epm.yaml file.

**Note**: Some tests work with pre-compiled, binary contracts where possible and therefore rely on the availability of the declared dependencies in the local repository.

There are two options to execute the SDK tests. Both options support running only a subset of the bundles in the SDK and additionally turn off time-consuming operations like importing keys, starting/disposing of the chain, and building the release artifacts (see examples below):

#### 1. NPM Script (recommended)

From the SDK root run `npm test` to test all bundles or a subset with options, for example:
```
npm test -- commons-base,commons-management --skip-keys --skip-chain --skip-build
```

#### 2. Manual Invocation

From the SDK root folder run `./build/test_contracts.sh` to test all bundles or a subset with options, for example:
```
./build/test_contracts.sh commons-collections --skip-keys
```

### Running Bundle Tests (manually)

Instead of running SDK-wide tests as described above, a test can also be run per bundle to save time. In order to do so, the steps performed by the `test_contracts.sh` script need to be executed manually.

Execute the below commands inside an appropriate docker container:
`docker run --rm -it -v `pwd`:/app -v $HOME/.config/gcloud:/root/.config/gcloud -v $HOME/.monax:/root/.monax --workdir /app quay.io/monax/monax:0.19.6-platform_deployer bash`

To test bundle XYZ, from the SDK root directory execute:

```
$> monax chains start bundles-test --init-dir build/chain/chain_full_000/
$> npm run build
$> cd src/XYZ
$> monax pkgs do -c bundles-test -a <PK-of-full_000-account>
```

## Bundle Build Configuration

Each bundle requires a `build-config.json` file to be placed in its bundle folder in order to participate in the release assembly.
This file has the following structure and the available options to set for each contract are `abi, bin, src, doc`. Setting any of these
to `true` will generate the corresponding artifacts to be included in the release.

```
{
   "contracts": [{
   	                 "file": "Contract1.sol",
   				     "config": {
   				         "abi":true,
   				         "bin":true,
   				         "src":true,
   				         "doc":true
   				     }
   				 },
   				 {
   				     "file": "Contract2.sol",
   				     "config": {
   				         "abi":true,
   				         "bin":true
   				     }
   				 }]
}
```
