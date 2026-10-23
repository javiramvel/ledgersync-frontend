# LedgerSync

Institutional tokenization, reconciliation and audit infrastructure on Stellar.

LedgerSync lets a regulated issuer mirror assets held at a traditional custodian as Soroban tokens, keep
on-chain supply in exact 1:1 parity with the custodian's books, run corporate actions (splits, yield
distributions) on-chain, price everything with Chainlink Data Feeds on Stellar, and keep an SEC Rule
17a-4(f) WORM audit trail of every state change.

> Stellar provides the rails, Chainlink the price signals, LedgerSync the execution layer.

## What works today (Stellar Testnet)

| Capability | How it is implemented | Revenue line |
| --- | --- | --- |
| Asset tokenization | `wall_street_asset`: compliance-gated token whose supply only the reconciliation contract can change | Tokenization-as-a-Service |
| Custodian bridge | Plaid Investments → server-side holdings read, access token encrypted in an httpOnly cookie | AUM license (bps on custodied value) |
| Delta reconciliation | `delta_reconciliation.reconcile(nonce, custodian_balance, holder)` mints/burns the exact delta, replay-proof | Action-based execution fees |
| Stock splits | `wall_street_asset.execute_split` re-scales every balance in O(1) | Action-based execution fees |
| Institution onboarding | `institutional_compliance`: admin-registered KYC'd entities, oracle freeze, M-of-N officer checks | Action-based execution fees |
| Yield distribution | `yield_matrix.distribute`: atomic pro-rata payout in any SEP-41 token, margin (bps) to the LedgerSync treasury | Yield routing margin |
| Proof of reserves | `solvency_proof.publish_root`: Merkle root of custodial holdings + attested reserves vs supply | Audit fees |
| Chainlink pricing | Live reads from the `DataFeedsProxy` (10 feeds incl. RWA: FLHY, XAUM, USPC NAV) with off-chain parity check; `pricing_oracle` contract consumes the same feeds on-chain | — |
| 17a-4(f) audit trail | Every confirmed tx is re-verified on-chain by the server and written to S3 Object Lock (COMPLIANCE, 6 years) | Audit fees |

All state-changing transactions are built in the browser, signed in **Freighter**, and submitted to
Soroban RPC. The web server never holds a Stellar secret key.

## Deployed contracts

Contract IDs are the single source of truth in [`deployments/testnet.json`](deployments/testnet.json)
(written by `scripts/deploy.sh`). Mainnet ([`deployments/mainnet.json`](deployments/mainnet.json)) is
intentionally empty until the suite is audited; see [docs/SCF_SUBMISSION.md](docs/SCF_SUBMISSION.md).

| Contract | Testnet |
| --- | --- |
| wall_street_asset (REFA) | `CAXXYVMMG3W4ZFDZGAOLQSWYQRR6W2RPZBEDKOAKK4TIJVLWQ6YB7VKO` |
| delta_reconciliation | `CCXMFG3BBRRQ4QZHEGRJEDMY34PKZOKZ5XWAUW7W722CSXITNMUDAYLL` |
| institutional_compliance | `CCFKDVUEF46M47X62KX4347IR2NYDQCJIHFZN67IIFYYNT5UD3A6JIDK` |
| yield_matrix | `CCFPGVQMKMI2Q5V7G65CNX4WBUZFYVMJP23NVVANYM2JCGH5BOW7M46C` |
| solvency_proof | `CDJ2UFGOCWQTR2VDGYRZLCTLS5C2CZAHC6AJ66DFBCH5EYP55YC66NWC` |
| pricing_oracle | `CB46PPWESZML2C2SXTTK6QWSLAJMPXYXCJISTNFAPMP2MGTBXSN4FY5G` |
| Chainlink DataFeedsProxy | `CBUF6IADAWPWIDWRTHJNINKXHG2UTIQ6TU2F2HRAXWAI7OT3KJPKK6O4` (mainnet `CDQBHEUGLDHMSUHG4IH33RJBUTMNCZOT4JIAQR4WZFRDZW6DR6S32ZLZ`) |

## Repository layout

```
contracts/            Soroban workspace (soroban-sdk 28), one crate per contract, unit tests in each
deployments/          Contract IDs per network (generated)
scripts/deploy.sh     Build + deploy + wire the suite to a network
scripts/verify-integrations.mts   Live check of the WORM archive and Plaid integrations
src/app               Next.js App Router: page (Server Component), server actions, audit download route
src/components        Dashboard UI (client components) and data hooks
src/lib               network config, Soroban/Chainlink reads, Freighter signing, Plaid, WORM audit, Merkle
tests/                TypeScript unit tests
main.tf               AWS: ECS Fargate, ALB, CloudFront + WAF, Secrets Manager, KMS, IAM
docs/                 Architecture, security (threat model, monitoring), SCF submission map
```

## Running locally

Prerequisites: Node 22+, Rust + `stellar` CLI ≥ 25.2, the [Freighter](https://freighter.app) extension.

```bash
cp .env.example .env.local        # fill in Plaid, Finnhub and AWS values
npm install
npm run dev                        # http://localhost:3000
```

To operate as the issuer, import the Testnet admin key into Freighter (`stellar keys show ledgersync-admin`)
and switch Freighter to Testnet. Any other wallet can browse but not execute admin actions.

## Tests

```bash
npm run test:contracts   # 21 Soroban unit tests
npm test                 # TypeScript unit tests (Merkle tree, unit conversion)
npm run lint && npm run typecheck
```

## Deploying

```bash
./scripts/deploy.sh testnet                         # contracts → deployments/testnet.json
docker build --build-arg NEXT_PUBLIC_STELLAR_NETWORK=testnet .
terraform plan && terraform apply                   # infrastructure (secrets via terraform.tfvars, never committed)
```

Pushing to `main` runs lint, typecheck and all tests, then builds and rolls the ECS service.
Switching to Mainnet is `ADMIN_IDENTITY=<funded key> ./scripts/deploy.sh mainnet` plus
`STELLAR_NETWORK: mainnet` in the workflow; no code changes.

## License

Smart contracts are intended to be released as open source (SCF requirement). Add a `LICENSE` file
(Apache-2.0 recommended) before submission.
