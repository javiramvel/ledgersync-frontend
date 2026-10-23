# SCF Build Award: application draft (Integration Track)

Fields marked **[OWNER]** must be completed with verifiable facts before submitting. Everything else
is backed by artifacts in this repository.

---

## 1. Interest form (communityfund.stellar.org)

**Project title:** LedgerSync

**Project description:**
LedgerSync is the execution layer that lets regulated issuers bring custodian-held assets onto Stellar
and keep them provably in sync. Issuers connect their custodian, and LedgerSync mints or burns Soroban
tokens so on-chain supply always equals the custodian's books (deterministic delta reconciliation).
It runs corporate actions (stock splits, pro-rata yield distribution) atomically on-chain, gates
every holder through an institutional compliance registry, publishes Merkle-committed proofs of
reserves, prices assets with Chainlink Data Feeds on Stellar, and archives every state change to an
SEC Rule 17a-4(f) WORM store.

**Project category:** Infrastructure / Developer tooling for RWA issuance (select the closest option offered)

**Current traction:** [OWNER] Verifiable evidence only, e.g.:
- Signed LOIs or pilot agreements with issuers, broker-dealers or custodians (name, date, scope)
- A validated need confirmed by someone with Stellar ecosystem experience (name, role, quote)
- Working product: Testnet deployment with contract IDs in `deployments/testnet.json`, live dashboard URL

**Website:** [OWNER] public URL of the dashboard (CloudFront) or landing page

**Planned Stellar integration:**
Six open-source Soroban contracts (asset, delta reconciliation, compliance registry, yield routing,
proof of reserves, Chainlink pricing oracle) deployed and tested on Testnet; Chainlink DataFeedsProxy
read on-chain and in the app; SEP-41 token payouts (XLM / USDC SAC); Freighter for all signing;
Soroban RPC for reads and submission. Mainnet launch is the final tranche.

**Build track:** Integration Track (integrates Chainlink Data Feeds on Stellar, SEP-41/SAC, Freighter)

---

## 2. Full submission

### Problem and use case
RWA issuance on Stellar grows quickly, but issuers still reconcile custodian records against token
supply by hand, settle corporate actions off-chain, and cannot give auditors a tamper-proof trail.
LedgerSync automates the bridge: the custodian is the source of truth, Soroban enforces parity, and
every action is provable on-chain and archived for regulators.

### Why Stellar
- Soroban auth model lets supply control, compliance gating and multi-officer approval live on-chain.
- Low, predictable fees make per-action reconciliation and frequent reserve attestations economical.
- Chainlink Data Feeds on Stellar include RWA feeds (FLHY, XAUM, USPC NAV) that LedgerSync consumes directly.
- Native asset contracts (SAC) let yield be paid in USDC or XLM without bridges.

### Technical architecture
See [ARCHITECTURE.md](ARCHITECTURE.md) (diagram, contract responsibilities, auth model, flows) and
[SECURITY.md](SECURITY.md) (STRIDE threat model, monitoring plan).

### Business model (how LedgerSync drives volume to Stellar)
| Revenue line | Mechanism |
| --- | --- |
| Tokenization-as-a-Service | Setup + per-asset issuance fee |
| AUM license | Basis points on custodied value under management (custodian valuation × bps) |
| Action-based execution & audit fees | Per reconciliation, split, onboarding, proof-of-reserves and audit export |
| Yield routing margin | On-chain `margin_bps` (capped at 10%) taken in `yield_matrix.distribute` |

### Team
[OWNER] For each member: name, role, relevant experience (Soroban/Rust, TypeScript, TradFi
compliance), links (GitHub, LinkedIn). SCF requires developers experienced in the tools used.

### Roadmap, deliverables and budget
Total request: [OWNER] (cap $150,000 in XLM; ~4 months of development). Development costs for
Stellar-integrated components only; no marketing, token giveaways or non-Stellar work.

| Tranche | Deliverable | How reviewers verify | Cost [OWNER] |
| --- | --- | --- | --- |
| 1: MVP | D1.1 Contract suite with unit tests (done) | `cargo test` in CI; source in `contracts/` | $ |
| | D1.2 Dashboard on Testnet: reconciliation, splits, onboarding, yield, proof of reserves (done) | Testnet contract IDs + live URL | $ |
| | D1.3 Chainlink price parity + on-chain `pricing_oracle` (done) | Markets view; `pricing_oracle.price` on Testnet | $ |
| 2: Testnet | D2.1 Multisig issuer admin + separate oracle keys | Account signers on StellarExpert | $ |
| | D2.2 Event indexer + alerting per the monitoring plan | Dashboard + alert test evidence | $ |
| | D2.3 STRIDE threat model and monitoring plan (required) | `docs/SECURITY.md` | $ |
| | D2.4 Holder inclusion-proof API for proof of reserves | Public endpoint + verification script | $ |
| | D2.5 Plaid production + pilot custodian integration | Pilot sign-off [OWNER] | $ |
| 3: Mainnet | D3.1 Independent audit (apply to the SCF Audit Bank) | Audit report link | $ |
| | D3.2 Mainnet deployment via `scripts/deploy.sh mainnet` | Mainnet contract IDs | $ |
| | D3.3 First pilot issuance on Mainnet | On-chain supply + proof of reserves | $ |

### Final-tranche metric commitment (Integration Track)
- **Metric:** on-chain NAV of LedgerSync-issued assets (`total_supply × NAV`)
- **Threshold and window:** [OWNER] modest, credible, e.g. $X NAV sustained over 30 days after launch
- **On-chain footprint registered at award:** Mainnet contract IDs (asset, reconciliation, yield,
  solvency) and the issuer admin account

### Open source
All Soroban contracts are Apache-2.0 licensed in this repository (`LICENSE`).

### Eligibility checklist [OWNER]
- [ ] No active SDF Matching Fund or Enterprise Fund award; no overlapping SDF grant
- [ ] Outstanding SDF grant obligations (if any) fulfilled
- [ ] Every contributor able to complete KYC/KYB (stellar.org/bd-kyc) if selected
- [ ] If a fiat-backed token is issued: Stellar Info File (stellar.toml) with a link to a reserve audit
