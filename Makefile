# /$$       /$$                     /$$                   /$$
# | $$      | $$                    | $$                  | $$
# | $$$$$$$ | $$  /$$$$$$   /$$$$$$$| $$   /$$  /$$$$$$$ /$$$$$$    /$$$$$$  /$$$$$$$   /$$$$$$
# | $$__  $$| $$ |____  $$ /$$_____/| $$  /$$/ /$$_____/|_  $$_/   /$$__  $$| $$__  $$ /$$__  $$
# | $$  \ $$| $$  /$$$$$$$| $$      | $$$$$$/ |  $$$$$$   | $$    | $$  \ $$| $$  \ $$| $$$$$$$$
# | $$  | $$| $$ /$$__  $$| $$      | $$_  $$  \____  $$  | $$ /$$| $$  | $$| $$  | $$| $$_____/
# | $$$$$$$/| $$|  $$$$$$$|  $$$$$$$| $$ \  $$ /$$$$$$$/  |  $$$$/|  $$$$$$/| $$  | $$|  $$$$$$$
# |_______/ |__/ \_______/ \_______/|__/  \__/|_______/    \___/   \______/ |__/  |__/ \_______/
#

CI_IMAGE="quay.io/monax/blackstone:ci"

# Provide environment
# Probably best if we don't talk about this...
# Convert each assigment to if-not-set '?=' assignment to match behaviour of dotenv module within files
dotenv := $(shell grep -v '^\#' .env | sed 's/=/?=/')
# This is work-around my makefile syntax checker...
exp:=export
$(foreach pair,$(dotenv),$(eval $(exp) $(pair)))

### Contracts

.PHONY: build_contracts
build_contracts:
	contracts/build_contracts $(tgt)

.PHONY: deploy_contracts
deploy_contracts:
	cd contracts/src && burrow deploy --timeout 60 --chain=$(CHAIN_URL_GRPC) --address=$(CONTRACTS_DEPLOYMENT_ADDRESS) $(if $(tgt),deploy-$(tgt).yaml,deploy.yaml)

.PHONY: test_contracts
test_contracts:
	cd contracts/src && burrow deploy --chain=$(CHAIN_URL_GRPC) --address=$(CONTRACTS_DEPLOYMENT_ADDRESS) $(if $(tgt),build-test-$(tgt).yaml,build-test-*.yaml)
	cd contracts/src && burrow deploy --chain=$(CHAIN_URL_GRPC) --address=$(CONTRACTS_DEPLOYMENT_ADDRESS) $(if $(tgt),test-$(tgt).yaml,test-*.yaml)

.PHONY: copy_abis
copy_abis:
	contracts/copy_abis

### Node API

.PHONY: install_api
install_api:
	cd api && npm install

.PHONY: test_api
test_api: copy_abis
	cd api && npm test

### Run and test

.PHONY: all
all: | build_contracts deploy_contracts copy_abis install_api

# Full test (run by CI)
.PHONY: test
# Ordered execution
test: | all test_contracts

.PHONY: clean
clean:
	test/clean.sh

.PHONY: clean_all
clean_all:
	test/clean.sh all

### Documentation
.PHONY: docs
docs:
	docs/generate.sh

.PHONY: push_docs
push_docs: docs
	docs/push.sh

### Docker Compose

# To catch DCB args above so we build with CI user
.PHONY: docker_test
docker_test: docker_run_deps
	docker-compose logs -f > test/docker-compose.log &
	docker-compose run api make test

# Just run the dependency services in docker compose (you can build and deploy contracts and the run the API locally)
.PHONY: docker_run_deps
docker_run_deps:
	docker-compose up -d chain vent postgres

# Build all the contracts and run the API its dependencies
.PHONY: docker_run_all
docker_run_all:
	docker-compose run api make all
	docker-compose up -d
	docker-compose logs --follow api &

# Just run the API and its dependencies
.PHONY: docker_run
docker_run:
	docker-compose up -d
	docker-compose logs --follow api &

# API image for CI use outside of compose

.PHONY: build_ci_image
build_ci_image:
	docker build -t ${CI_IMAGE} .

.PHONY: push_ci_image
push_ci_image: build_ci_image
	docker push ${CI_IMAGE}
