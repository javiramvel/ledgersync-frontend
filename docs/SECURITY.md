# Security: threat model, monitoring and incidents

## Trust boundaries

1. **Freighter wallet**: holds issuer/admin keys; signs every state change. The web tier holds no Stellar keys.
2. **Next.js server**: holds Plaid credentials and AWS role access; trusted to read custodian data and archive audit records, not to move assets.
3. **Soroban contracts**: enforce all authorization on-chain.
4. **External oracles**: Chainlink (prices), Plaid (custodian holdings).

## STRIDE threat model

| # | Threat | Asset / component | Mitigation | Residual risk |
| --- | --- | --- | --- | --- |
| S1 | Spoofed issuer submits mint/burn | asset supply | `mint`/`burn` require the reconciliation contract's auth; `reconcile` requires admin auth | Admin key compromise (→ multisig, below) |
| S2 | Attacker poses as a compliant holder | transfer restrictions | `is_compliant` checked for sender and receiver on every transfer and mint | Registry admin compromise |
| T1 | Tampered custodian balance from the browser | reconciliation input | Server re-reads Plaid holdings at attestation; client values ignored | Plaid/custodian compromise |
| T2 | Audit record altered after the fact | 17a-4 trail | S3 Object Lock COMPLIANCE (no deletion, even by root); SHA-256 digest; full XDR stored | Bucket misconfiguration |
| T3 | Forged audit entries | 17a-4 trail | Server only archives txs it fetches from RPC as SUCCESS that invoke a LedgerSync contract | — |
| R1 | Issuer denies a corporate action | governance | Every action is an on-chain tx with events + WORM record | — |
| I1 | Leak of account-level holdings | privacy | Only a Merkle root and aggregates go on-chain | Root + aggregates are public by design |
| I2 | Plaid token theft | custodian access | AES-256-GCM sealed, httpOnly, SameSite=Strict cookie; secret in Secrets Manager | XSS on the origin |
| D1 | RPC / oracle outage | dashboard | 10s read timeouts; per-feed error states; stale Chainlink rounds rejected on-chain (`max_age`) | Degraded UX during outage |
| D2 | Request floods | web tier | CloudFront + AWS WAF managed rules; tasks reachable only from the ALB | Volumetric attacks beyond WAF |
| E1 | Front-run initialization | all contracts | Constructors (`__constructor`) initialize atomically with deployment | — |
| E2 | Replayed or out-of-order attestations | reconciliation | Strictly sequential nonce (`ReplayDetected`, `InvalidSequence`) | — |
| E3 | Yield paid to omitted or duplicate holders | yield | Holder balances must sum exactly to total supply | Cap-table size limited by tx resources |

Pre-mainnet requirements: independent contract audit; admin = Stellar multisig account (e.g. 2-of-3
officers) instead of a single key; separate oracle key for `solvency_proof` and compliance freezes.

## Monitoring plan

| Signal | Source | Trigger | Response |
| --- | --- | --- | --- |
| `Mint` / `Burn` not preceded by `Reconciled` in the same tx | asset events | any occurrence | Freeze via `set_minter`, investigate |
| `Reconciled.delta` above threshold (e.g. > 5% of supply) | reconciliation events | per event | Manual review against custodian statement |
| `solvency_proof.is_solvent == false` or proof older than 24h | contract read | scheduled check | Halt mints, notify compliance |
| Chainlink round age > heartbeat (86,400s) | proxy `latest_round` | scheduled check | Mark prices stale in UI; block valuations |
| `ComplianceStatusChanged(false)` | compliance events | per event | Confirm with AML provider |
| Audit archive failures | app logs (`Audit archive pending`) | any | Re-run `archiveTransaction(hash)`; idempotent |
| Admin-key activity outside change windows | Horizon account ops | any | Incident response |

## Open incident (October 2026): exposed Stellar admin key

`terraform.tfstate` was committed to the public `ledgersync-frontend` repository and contained the
secret key of `GAMKTQOJDGQKQWIF7VDUMBPALB73T663B3TURUQS3NVL6NZJK5F5Y35J`, admin of the legacy Mainnet
contracts `CD5YKS…`, `CAKD6Q…`, `CDIGJI…`, `CCXUIY…` (zero supply), plus Plaid sandbox credentials.

Containment status:
- [x] Secret removed from the application; server-side signing removed entirely.
- [x] tfstate, env files and build artifacts untracked; `.gitignore` hardened.
- [ ] Move remaining XLM out of `GAMKTQ…` and stop using that key everywhere.
- [ ] Rotate the Plaid secret in the Plaid dashboard.
- [ ] Purge tfstate/.env from git history (git-filter-repo + force push) and request GitHub cache purge.
- [ ] Take down or redeploy the live dashboard (its legacy API routes still sign with the exposed key).
- [ ] Store Terraform state remotely (S3 backend + DynamoDB lock, encrypted) instead of on disk.
