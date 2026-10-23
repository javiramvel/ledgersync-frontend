#![no_std]
//! Yield routing: distributes a payout (USDC, XLM or any SEP-41 token) pro-rata to holders of a
//! LedgerSync asset in a single atomic transaction, routing a configurable margin (basis points) to
//! the LedgerSync treasury. The holder list must cover the entire supply exactly, so nobody can be
//! skipped or paid twice.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum YieldError {
    InvalidAmount = 1,
    IncompleteHolderSet = 2,
    MarginTooHigh = 3,
    NoSupply = 4,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Asset,
    Treasury,
    MarginBps,
    Count,
}

#[contractclient(name = "AssetClient")]
pub trait HolderLedger {
    fn balance(env: Env, id: Address) -> i128;
    fn total_supply(env: Env) -> i128;
}

#[contractevent]
pub struct YieldDistributed {
    #[topic]
    pub distribution_id: u32,
    #[topic]
    pub payout_token: Address,
    pub gross: i128,
    pub margin: i128,
    pub holders: u32,
}

/// Hard cap on the routing margin: 10%.
const MAX_MARGIN_BPS: u32 = 1_000;

#[contract]
pub struct YieldMatrix;

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

#[contractimpl]
impl YieldMatrix {
    pub fn __constructor(env: Env, admin: Address, asset: Address, treasury: Address, margin_bps: u32) {
        if margin_bps > MAX_MARGIN_BPS {
            panic_with_error!(&env, YieldError::MarginTooHigh);
        }
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Asset, &asset);
        s.set(&DataKey::Treasury, &treasury);
        s.set(&DataKey::MarginBps, &margin_bps);
        s.set(&DataKey::Count, &0u32);
    }

    /// Pays `gross` of `payout_token` from the admin: margin to treasury, remainder pro-rata to
    /// `holders` by their current balance. Integer-division dust also goes to the treasury.
    pub fn distribute(env: Env, payout_token: Address, gross: i128, holders: Vec<Address>) -> u32 {
        let admin = admin(&env);
        admin.require_auth();
        if gross <= 0 {
            panic_with_error!(&env, YieldError::InvalidAmount);
        }

        let asset_id: Address = env.storage().instance().get(&DataKey::Asset).unwrap();
        let asset = AssetClient::new(&env, &asset_id);
        let supply = asset.total_supply();
        if supply <= 0 {
            panic_with_error!(&env, YieldError::NoSupply);
        }

        let mut balances: Vec<i128> = Vec::new(&env);
        let mut covered: i128 = 0;
        for h in holders.iter() {
            let b = asset.balance(&h);
            covered += b;
            balances.push_back(b);
        }
        if covered != supply {
            panic_with_error!(&env, YieldError::IncompleteHolderSet);
        }

        let margin_bps: u32 = env.storage().instance().get(&DataKey::MarginBps).unwrap();
        let margin = gross * margin_bps as i128 / 10_000;
        let net = gross - margin;

        let pay = token::Client::new(&env, &payout_token);
        let mut paid: i128 = 0;
        for (i, h) in holders.iter().enumerate() {
            let share = net * balances.get(i as u32).unwrap() / supply;
            if share > 0 {
                pay.transfer(&admin, &h, &share);
                paid += share;
            }
        }
        let treasury: Address = env.storage().instance().get(&DataKey::Treasury).unwrap();
        let to_treasury = gross - paid;
        if to_treasury > 0 {
            pay.transfer(&admin, &treasury, &to_treasury);
        }

        let id: u32 = env.storage().instance().get::<_, u32>(&DataKey::Count).unwrap() + 1;
        env.storage().instance().set(&DataKey::Count, &id);
        YieldDistributed {
            distribution_id: id,
            payout_token,
            gross,
            margin: to_treasury,
            holders: holders.len(),
        }
        .publish(&env);
        id
    }

    pub fn set_margin_bps(env: Env, margin_bps: u32) {
        admin(&env).require_auth();
        if margin_bps > MAX_MARGIN_BPS {
            panic_with_error!(&env, YieldError::MarginTooHigh);
        }
        env.storage().instance().set(&DataKey::MarginBps, &margin_bps);
    }

    pub fn margin_bps(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::MarginBps).unwrap()
    }

    pub fn distributions(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Count).unwrap()
    }

    pub fn asset(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Asset).unwrap()
    }

    pub fn treasury(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Treasury).unwrap()
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{contract, contractimpl, testutils::Address as _, vec, Map};

    /// Holder ledger stand-in with directly settable balances.
    #[contract]
    struct MockAsset;

    #[contractimpl]
    impl MockAsset {
        pub fn set(env: Env, id: Address, amount: i128) {
            let mut m: Map<Address, i128> = env.storage().instance().get(&0u32).unwrap_or(Map::new(&env));
            m.set(id, amount);
            env.storage().instance().set(&0u32, &m);
        }
        pub fn balance(env: Env, id: Address) -> i128 {
            let m: Map<Address, i128> = env.storage().instance().get(&0u32).unwrap_or(Map::new(&env));
            m.get(id).unwrap_or(0)
        }
        pub fn total_supply(env: Env) -> i128 {
            let m: Map<Address, i128> = env.storage().instance().get(&0u32).unwrap_or(Map::new(&env));
            m.values().iter().sum()
        }
    }

    struct Setup {
        env: Env,
        ym: YieldMatrixClient<'static>,
        asset: MockAssetClient<'static>,
        usdc: token::Client<'static>,
        treasury: Address,
    }

    fn setup(margin_bps: u32) -> Setup {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let treasury = Address::generate(&env);
        let asset_id = env.register(MockAsset, ());
        let ym_id = env.register(YieldMatrix, (&admin, &asset_id, &treasury, margin_bps));
        let sac = env.register_stellar_asset_contract_v2(admin.clone());
        token::StellarAssetClient::new(&env, &sac.address()).mint(&admin, &1_000_000);
        Setup {
            ym: YieldMatrixClient::new(&env, &ym_id),
            asset: MockAssetClient::new(&env, &asset_id),
            usdc: token::Client::new(&env, &sac.address()),
            env,
            treasury,
        }
    }

    #[test]
    fn pays_pro_rata_and_routes_margin() {
        let s = setup(250); // 2.5%
        let (a, b) = (Address::generate(&s.env), Address::generate(&s.env));
        s.asset.set(&a, &750);
        s.asset.set(&b, &250);

        s.ym.distribute(&s.usdc.address, &100_000, &vec![&s.env, a.clone(), b.clone()]);
        assert_eq!(s.usdc.balance(&s.treasury), 2_500);
        assert_eq!(s.usdc.balance(&a), 73_125);
        assert_eq!(s.usdc.balance(&b), 24_375);
        assert_eq!(s.ym.distributions(), 1);
    }

    #[test]
    fn rejects_incomplete_or_duplicated_holder_sets() {
        let s = setup(0);
        let (a, b) = (Address::generate(&s.env), Address::generate(&s.env));
        s.asset.set(&a, &500);
        s.asset.set(&b, &500);
        assert!(s.ym.try_distribute(&s.usdc.address, &1_000, &vec![&s.env, a.clone()]).is_err());
        assert!(s.ym.try_distribute(&s.usdc.address, &1_000, &vec![&s.env, a.clone(), a.clone(), b.clone()]).is_err());
    }

    #[test]
    fn margin_is_capped() {
        let s = setup(0);
        assert!(s.ym.try_set_margin_bps(&1_001).is_err());
        s.ym.set_margin_bps(&1_000);
        assert_eq!(s.ym.margin_bps(), 1_000);
    }

    #[test]
    fn requires_admin_auth() {
        let s = setup(0);
        let a = Address::generate(&s.env);
        s.asset.set(&a, &1);
        s.env.set_auths(&[]);
        assert!(s.ym.try_distribute(&s.usdc.address, &10, &vec![&s.env, a]).is_err());
    }
}
