extern crate std;

use super::*;
use soroban_sdk::{contract, contractimpl, testutils::Address as _, Map};

/// Stand-in compliance registry: every address is compliant unless explicitly blocked.
#[contract]
struct MockCompliance;

#[contractimpl]
impl MockCompliance {
    pub fn block(env: Env, wallet: Address) {
        let mut m: Map<Address, bool> = env.storage().instance().get(&0u32).unwrap_or(Map::new(&env));
        m.set(wallet, true);
        env.storage().instance().set(&0u32, &m);
    }
    pub fn is_compliant(env: Env, wallet: Address) -> bool {
        let m: Map<Address, bool> = env.storage().instance().get(&0u32).unwrap_or(Map::new(&env));
        !m.contains_key(wallet)
    }
}

struct Setup {
    env: Env,
    asset: WallStreetAssetClient<'static>,
    compliance: MockComplianceClient<'static>,
    admin: Address,
    minter: Address,
}

fn setup() -> Setup {
    let env = Env::default();
    let admin = Address::generate(&env);
    let minter = Address::generate(&env);
    let compliance_id = env.register(MockCompliance, ());
    let asset_id = env.register(
        WallStreetAsset,
        (
            &admin,
            &minter,
            &compliance_id,
            String::from_str(&env, "LedgerSync Real Estate Fund A"),
            String::from_str(&env, "REFA"),
        ),
    );
    Setup {
        asset: WallStreetAssetClient::new(&env, &asset_id),
        compliance: MockComplianceClient::new(&env, &compliance_id),
        env,
        admin,
        minter,
    }
}

#[test]
fn mint_requires_minter_auth() {
    let s = setup();
    let holder = Address::generate(&s.env);
    // No auth mocked: anyone calling mint must fail.
    assert!(s.asset.try_mint(&holder, &100).is_err());

    s.env.mock_all_auths();
    s.asset.mint(&holder, &100);
    let auths = s.env.auths();
    assert_eq!(auths[0].0, s.minter);
    assert_eq!(s.asset.balance(&holder), 100);
    assert_eq!(s.asset.total_supply(), 100);
}

#[test]
fn mint_to_non_compliant_wallet_fails() {
    let s = setup();
    s.env.mock_all_auths();
    let holder = Address::generate(&s.env);
    s.compliance.block(&holder);
    assert!(s.asset.try_mint(&holder, &100).is_err());
}

#[test]
fn transfer_moves_balance_and_checks_compliance() {
    let s = setup();
    s.env.mock_all_auths();
    let a = Address::generate(&s.env);
    let b = Address::generate(&s.env);
    s.asset.mint(&a, &100);
    s.asset.transfer(&a, &b, &40);
    assert_eq!(s.asset.balance(&a), 60);
    assert_eq!(s.asset.balance(&b), 40);

    s.compliance.block(&b);
    assert!(s.asset.try_transfer(&a, &b, &10).is_err());
    assert!(s.asset.try_transfer(&a, &Address::generate(&s.env), &1000).is_err());
}

#[test]
fn split_rescales_balances_and_supply() {
    let s = setup();
    s.env.mock_all_auths();
    let a = Address::generate(&s.env);
    s.asset.mint(&a, &100);

    s.asset.execute_split(&2, &1);
    assert_eq!(s.env.auths()[0].0, s.admin);
    assert_eq!(s.asset.balance(&a), 200);
    assert_eq!(s.asset.total_supply(), 200);

    s.asset.execute_split(&1, &4);
    assert_eq!(s.asset.balance(&a), 50);
    assert_eq!(s.asset.split_ratio(), (2, 4));
}

#[test]
fn burn_reduces_supply_and_rejects_overdraw() {
    let s = setup();
    s.env.mock_all_auths();
    let a = Address::generate(&s.env);
    s.asset.mint(&a, &100);
    s.asset.burn(&a, &30);
    assert_eq!(s.asset.total_supply(), 70);
    assert!(s.asset.try_burn(&a, &71).is_err());
}

#[test]
fn invalid_inputs_are_rejected() {
    let s = setup();
    s.env.mock_all_auths();
    let a = Address::generate(&s.env);
    assert!(s.asset.try_mint(&a, &0).is_err());
    assert!(s.asset.try_execute_split(&0, &1).is_err());
}
