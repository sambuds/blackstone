#!/usr/bin/env bash
source "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/preflight"

main() {
  deploy_local
  deploy_vent

  if [[ $1 == "deploy" ]]; then
    exit 0
  fi

  cd $CI_PROJECT_DIR/api
  export NODE_ENV=testing

  if [[ $runAPI == "true" ]]; then
    echo "#### Starting API"
    npm run-script start:dev &
    while true; do sleep 10; done
  else
    echo "#### Starting API Tests"
    echo
    npm install -g mocha
    npm install -g mocha-parallel-tests
    npm run test:parallel
  fi
  cd $CI_PROJECT_DIR

}

deploy_local() {
  echo "Hello! I'm the marmot who tests the Monax Agreements Network API."

  export CHAIN_URL_INFO="localhost:26658"
  export CHAIN_URL_GRPC="localhost:10997"
  test_setup
  sleep 3
  $CI_PROJECT_DIR/contracts/deploy_contracts

  echo
  echo "#### Copying public ABIs to $API_ABI_DIRECTORY_LOCAL"
  configApp

  echo
  echo "#### Agreements Network contracts successfully deployed"
}

deploy_vent() {
  ./bos/vent --db-adapter=postgres --db-url=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/blackstone_development?sslmode=disable \
      --db-schema=blackstone_development --grpc-addr=${CHAIN_URL_GRPC} --log-level=info --spec-file=./api/sqlsol/Tables.spec --abi-dir=./contracts/src/ &
}

configApp() {
  set +e
  mkdir -p $API_ABI_DIRECTORY_LOCAL
  while read -r abi; do
    cp $CONTRACTS_DIRECTORY/bin/$abi.bin $API_ABI_DIRECTORY_LOCAL/$abi.bin
  done < $CI_PROJECT_DIR/contracts/abi.csv
  set -e
}

set -e
main $@
