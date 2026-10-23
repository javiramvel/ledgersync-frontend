#!/usr/bin/env bash
# Builds and deploys the LedgerSync contract suite, wired together via constructors.
#
#   ./scripts/deploy.sh testnet                 # admin = CLI identity "ledgersync-admin" (auto-funded)
#   ADMIN_IDENTITY=my-key ./scripts/deploy.sh mainnet
#
# The admin identity signs deployment and becomes admin of every contract. Import the same key into
# Freighter (or set ADMIN_IDENTITY to a key you already use there) to operate the dashboard.
set -euo pipefail

NETWORK="${1:-testnet}"
ADMIN_IDENTITY="${ADMIN_IDENTITY:-ledgersync-admin}"
TREASURY_IDENTITY="${TREASURY_IDENTITY:-ledgersync-treasury}"
MARGIN_BPS="${MARGIN_BPS:-50}"            # yield routing margin, 0.50%
ASSET_NAME="${ASSET_NAME:-LedgerSync Real Estate Fund A}"
ASSET_SYMBOL="${ASSET_SYMBOL:-REFA}"

case "$NETWORK" in
  testnet) CHAINLINK_PROXY=CBUF6IADAWPWIDWRTHJNINKXHG2UTIQ6TU2F2HRAXWAI7OT3KJPKK6O4 ;;
  mainnet) CHAINLINK_PROXY=CDQBHEUGLDHMSUHG4IH33RJBUTMNCZOT4JIAQR4WZFRDZW6DR6S32ZLZ ;;
  *) echo "network must be testnet or mainnet" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/contracts/target/wasm32v1-none/release"

ensure_key() {
  if ! stellar keys address "$1" >/dev/null 2>&1; then
    if [ "$NETWORK" = mainnet ]; then echo "identity $1 not found; create and fund it first" >&2; exit 1; fi
    stellar keys generate "$1" --network testnet --fund >/dev/null
  fi
}
ensure_key "$ADMIN_IDENTITY"
ensure_key "$TREASURY_IDENTITY"
ADMIN=$(stellar keys address "$ADMIN_IDENTITY")
TREASURY=$(stellar keys address "$TREASURY_IDENTITY")

(cd "$ROOT/contracts" && stellar contract build >/dev/null 2>&1)

deploy() { # name, then constructor args
  local name=$1; shift
  stellar contract deploy --wasm "$WASM/$name.wasm" --source "$ADMIN_IDENTITY" --network "$NETWORK" --alias "ls-$name" -- "$@" 2>/dev/null | tail -1
}
invoke() { stellar contract invoke --source "$ADMIN_IDENTITY" --network "$NETWORK" --id "$@" >/dev/null; }

echo "Deploying to $NETWORK as $ADMIN"
COMPLIANCE=$(deploy institutional_compliance --admin "$ADMIN" --oracle "$ADMIN")
RECON=$(deploy delta_reconciliation --admin "$ADMIN")
ASSET=$(deploy wall_street_asset --admin "$ADMIN" --minter "$RECON" --compliance "$COMPLIANCE" --name "$ASSET_NAME" --symbol "$ASSET_SYMBOL")
invoke "$RECON" -- set_token --token "$ASSET"
YIELD=$(deploy yield_matrix --admin "$ADMIN" --asset "$ASSET" --treasury "$TREASURY" --margin_bps "$MARGIN_BPS")
SOLVENCY=$(deploy solvency_proof --oracle "$ADMIN")
PRICING=$(deploy pricing_oracle --admin "$ADMIN" --proxy "$CHAINLINK_PROXY" --max_age_secs 86400)
XLM_SAC=$(stellar contract id asset --asset native --network "$NETWORK")

# The admin wallet holds the institutional position, so it must be a registered institution.
invoke "$COMPLIANCE" -- register_institution --institution_wallet "$ADMIN" \
  --lei_hash "$(printf 'LEDGERSYNC-ADMIN' | shasum -a 256 | cut -d' ' -f1)" --threshold 1 --authorized_officers "[\"$ADMIN\"]"

cat > "$ROOT/deployments/$NETWORK.json" <<JSON
{
  "network": "$NETWORK",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "admin": "$ADMIN",
  "treasury": "$TREASURY",
  "contracts": {
    "asset": "$ASSET",
    "reconciliation": "$RECON",
    "compliance": "$COMPLIANCE",
    "yield": "$YIELD",
    "solvency": "$SOLVENCY",
    "pricing": "$PRICING",
    "chainlinkProxy": "$CHAINLINK_PROXY",
    "payoutToken": "$XLM_SAC"
  }
}
JSON
cat "$ROOT/deployments/$NETWORK.json"
