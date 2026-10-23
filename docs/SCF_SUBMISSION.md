# SCF Build Award: submission map

Source: <https://stellar.gitbook.io/scf-handbook/scf-awards/build-award/submission-criteria>.
Reviewers consider only what is in the submission, so every claim below points to verifiable artifacts.

| Criterion | Status | Evidence / action |
| --- | --- | --- |
| Participant eligibility | Owner to confirm | Entity, jurisdiction, no conflicting SDF funding |
| Product readiness & traction | **Needs owner input** | Working Testnet product (this repo). Traction must be verifiable: LOIs, pilot issuers, custodian conversations, or a validated need from someone with Stellar ecosystem experience |
| Submission quality | Ready | README, [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md) |
| Stellar use case & integration | Ready | Six Soroban contracts, Chainlink on Stellar, SEP-41 payouts, Freighter signing |
| Complete architecture outline | Ready | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Build readiness | Ready | Reproducible `scripts/deploy.sh`, CI with contract + app tests, IaC (`main.tf`) |
| Stellar relevance (not storage-only) | Ready | Supply control, compliance gating, atomic yield, on-chain oracle consumption |
| Open-source smart contracts | **Add LICENSE** | Contracts in `contracts/`; add Apache-2.0 `LICENSE` |
| Budget alignment | **Needs owner input** | Development costs for Stellar-integrated components only; no marketing |
| Ecosystem value & differentiation | Ready | Brings custodian-backed RWA supply + Chainlink RWA feeds (FLHY, XAUM, USPC NAV) to Stellar with a regulated audit trail |

## Suggested tranches

| Tranche | Deliverables | Verification |
| --- | --- | --- |
| 1: MVP (done) | Six contracts with tests; dashboard on Testnet; Plaid sandbox bridge; Chainlink reads; WORM archive | Testnet contract IDs in `deployments/testnet.json`; CI run; live dashboard URL |
| 2: Testnet hardening | Multisig admin; separate oracle keys; event indexer + monitoring alerts from SECURITY.md; STRIDE threat model (SECURITY.md) and monitoring plan implemented; Plaid production access with a pilot custodian; inclusion-proof endpoint for holders | Indexer dashboard; alert screenshots; threat model doc |
| 3: Mainnet | Independent audit; `./scripts/deploy.sh mainnet`; first pilot issuance | Mainnet contract IDs registered at award time; audit report |

Integration-track metric commitment (if applicable): on-chain NAV of LedgerSync-issued assets
(`total_supply × NAV`) over a stated window, attributed via the Mainnet contract IDs and issuer admin account.

## Wording to keep accurate

- Proof of reserves is **Merkle-committed**, not zero-knowledge. Describe it as such.
- SEC 17a-4(f) compliance also requires a designated third party / undertaking and an audit-system
  description; S3 Object Lock in COMPLIANCE mode is the storage control, not the whole regime.
- Chainlink on Stellar currently has crypto, stablecoin and three RWA feeds; there are no equity or
  Treasury-yield feeds.
