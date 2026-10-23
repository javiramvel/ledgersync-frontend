# LedgerSync architecture

## System overview

```
                         ┌──────────────────────────── Browser ────────────────────────────┐
                         │  Next.js client components                                       │
                         │  • reads contract state via Soroban RPC simulation               │
                         │  • builds txs, signs in Freighter (keys never leave the wallet)  │
                         └───────┬──────────────────────────────┬──────────────────────────┘
                     server actions                       signed XDR
                                 │                              │
┌───────────── AWS (ECS Fargate behind CloudFront + WAF) ──────┐│      ┌──────── Stellar (Soroban) ────────┐
│ Next.js server                                               ││      │ institutional_compliance          │
│ • Chainlink + Finnhub reads (Server Component, 60s ISR)      │└─────►│ wall_street_asset ◄── delta_recon │
│ • Plaid: link, holdings, Merkle attestation (server only)    │       │ yield_matrix ──► SEP-41 payout    │
│ • 17a-4 archiver: re-verifies tx on RPC → S3 Object Lock     │──RPC─►│ solvency_proof                    │
└───────┬───────────────────────────┬──────────────────────────┘       │ pricing_oracle ──► Chainlink proxy│
        │                           │                                  └───────────────────────────────────┘
   Plaid Investments          S3 (Object Lock, COMPLIANCE, 6y)
   (custodian of record)      Secrets Manager / KMS
```

## Contracts

| Contract | Responsibility | Auth model |
| --- | --- | --- |
| `institutional_compliance` | Registry of KYC'd institutions (LEI hash, officers, threshold, active flag). `is_compliant` is queried by the asset on every mint/transfer. | Admin registers; admin or AML oracle freezes. |
| `wall_street_asset` | Tokenized security: balances, transfers, split ratio. Supply changes only via `mint`/`burn`. | `mint`/`burn`: minter (= delta_reconciliation) only. `execute_split`, `set_minter`, `set_admin`: admin. `transfer`: holder + both parties compliant. |
| `delta_reconciliation` | `reconcile(nonce, custodian_balance, holder)` computes `custodian_balance − total_supply` and mints/burns exactly that, atomically. Strictly sequential nonce prevents replays and gaps. | Admin. |
| `yield_matrix` | `distribute(token, gross, holders)` pays the margin (bps, capped at 10%) to the treasury and the rest pro-rata by balance. Holder balances must sum to total supply, so no holder can be skipped or paid twice. | Admin (payer). |
| `solvency_proof` | Stores the latest Merkle root of custodial holdings with attested reserves, the supply it backs, timestamp and ledger. `is_solvent` = reserves ≥ supply. | Reserve oracle. |
| `pricing_oracle` | Reads Chainlink `latest_round(data_id, decimals)`, normalises the I256 answer to 8-decimal i128, rejects rounds older than `max_age`. `valuation()` prices token amounts in USD. | Admin sets max age. |

All contracts are initialized in their constructors (no front-runnable `initialize`) and emit events
for every state change (`Mint`, `Burn`, `Transfer`, `Split`, `Reconciled`, `YieldDistributed`,
`RootPublished`, `InstitutionRegistered`, `ComplianceStatusChanged`).

## Core flows

**Tokenize / reconcile**
1. Issuer connects the custodian through Plaid Link; the access token is exchanged server-side and stored AES-256-GCM-encrypted in an httpOnly cookie.
2. The issuer selects the position that backs the token. The server re-reads holdings from Plaid (the client value is never trusted) and returns the attested quantity.
3. The browser builds `reconcile(nonce+1, quantity, holder)`, Freighter signs, the contract mints or burns the delta.
4. The server fetches the confirmed transaction from RPC, checks it invoked a LedgerSync contract, and writes the normalized record (+ envelope/result XDR, SHA-256 digest) to S3 Object Lock.

**Proof of reserves**: the server builds a domain-separated SHA-256 Merkle tree over every custodial position; the root, attested reserve and current supply are anchored via `publish_root`. Individual balances never reach the ledger; a holder given their leaf and path can verify inclusion.

**Yield**: the dashboard reads balances for the supplied cap table, refuses to submit unless they cover 100% of supply, then `distribute` pays holders and the treasury margin in one transaction.

## Chainlink on Stellar

One `DataFeedsProxy` contract serves all feeds by 32-byte `data_id` (identical on Testnet and Mainnet).
Live feeds (Oct 2026): XLM, BTC, ETH, LINK, USDC, USDT, EURC, FLHY (tokenized fund), XAUM (tokenized
gold), USPC NAV. No equity or Treasury-yield feeds exist on Stellar yet; equity benchmarks are shown
from Finnhub and labeled off-chain. The Markets view displays each Chainlink price beside an
independent exchange quote and its deviation.

## Network configuration

`NEXT_PUBLIC_STELLAR_NETWORK` (`testnet` | `mainnet`) selects passphrase, RPC, explorer and the
contract manifest in `deployments/<network>.json`. The UI label, Freighter network check and transaction
passphrase all derive from the same object, so they cannot disagree.
