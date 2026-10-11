#!/bin/bash
set -e

stellar network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org \
  --network-passphrase "Public Global Stellar Network ; September 2015"

WASM_ASSET=$(find contracts/wall_street_asset/target/wasm32v1-none/release -name "wall_street_asset.wasm" | head -n 1)
ASSET_ID=$(stellar contract deploy --wasm $WASM_ASSET --source deployer --network mainnet)

stellar contract invoke \
  --id $ASSET_ID \
  --source deployer \
  --network mainnet \
  -- initialize \
  --admin $(stellar keys address deployer)

WASM_ORACLE=$(find contracts/delta_reconciliation/target/wasm32v1-none/release -name "delta_reconciliation_contract.wasm" | head -n 1)
ORACLE_ID=$(stellar contract deploy --wasm $WASM_ORACLE --source deployer --network mainnet)

stellar contract invoke \
  --id $ORACLE_ID \
  --source deployer \
  --network mainnet \
  -- initialize \
  --admin $(stellar keys address deployer) \
  --token_id $ASSET_ID

echo "PRIMARY_ASSET_ID=$ASSET_ID" > .env.production
echo "RECONCILIATION_ORACLE_ID=$ORACLE_ID" >> .env.production
echo "NEXT_PUBLIC_STELLAR_NETWORK=mainnet" >> .env.production
