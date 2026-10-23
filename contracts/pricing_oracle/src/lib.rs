#![no_std]
//! On-chain valuation via Chainlink Data Feeds on Stellar.
//!
//! Chainlink exposes every feed through one `DataFeedsProxy` contract keyed by a 32-byte `data_id`
//! (mainnet `CDQBHEUGLDHMSUHG4IH33RJBUTMNCZOT4JIAQR4WZFRDZW6DR6S32ZLZ`, testnet
//! `CBUF6IADAWPWIDWRTHJNINKXHG2UTIQ6TU2F2HRAXWAI7OT3KJPKK6O4`). Answers are I256 at the
//! requested precision; this contract normalises them to i128 and rejects stale rounds.

use soroban_sdk::{
    contract, contractclient, contracterror, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, I256,
};

/// Precision used for all prices returned by this contract.
pub const PRICE_DECIMALS: u32 = 8;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum OracleError {
    StalePrice = 1,
    InvalidPrice = 2,
}

/// Mirrors `Round` in smartcontractkit/chainlink-stellar.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Round {
    pub answer: I256,
    pub round_id: u64,
    pub timestamp: u64,
}

#[contractclient(name = "DataFeedsProxyClient")]
pub trait DataFeedsProxy {
    fn latest_round(env: Env, data_id: BytesN<32>, decimals: u32) -> Round;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Price {
    pub price: i128,
    pub decimals: u32,
    pub round_id: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Proxy,
    MaxAge,
}

#[contract]
pub struct PricingOracle;

#[contractimpl]
impl PricingOracle {
    /// `max_age_secs` bounds how old a round may be (Chainlink heartbeat on Stellar is 24h).
    pub fn __constructor(env: Env, admin: Address, proxy: Address, max_age_secs: u64) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Proxy, &proxy);
        s.set(&DataKey::MaxAge, &max_age_secs);
    }

    pub fn price(env: Env, data_id: BytesN<32>) -> Price {
        let proxy: Address = env.storage().instance().get(&DataKey::Proxy).unwrap();
        let max_age: u64 = env.storage().instance().get(&DataKey::MaxAge).unwrap();
        let round = DataFeedsProxyClient::new(&env, &proxy).latest_round(&data_id, &PRICE_DECIMALS);

        let price = round
            .answer
            .to_i128()
            .filter(|p| *p > 0)
            .unwrap_or_else(|| panic_with_error!(&env, OracleError::InvalidPrice));
        if env.ledger().timestamp().saturating_sub(round.timestamp) > max_age {
            panic_with_error!(&env, OracleError::StalePrice);
        }
        Price { price, decimals: PRICE_DECIMALS, round_id: round.round_id, timestamp: round.timestamp }
    }

    /// USD value (8 decimals) of `amount` base units of an asset with `amount_decimals`.
    pub fn valuation(env: Env, data_id: BytesN<32>, amount: i128, amount_decimals: u32) -> i128 {
        let p = Self::price(env, data_id);
        p.price.checked_mul(amount).unwrap() / 10i128.pow(amount_decimals)
    }

    pub fn set_max_age(env: Env, max_age_secs: u64) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.storage().instance().set(&DataKey::MaxAge, &max_age_secs);
    }

    pub fn proxy(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Proxy).unwrap()
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{contract, contractimpl, testutils::{Address as _, Ledger}};

    #[contract]
    struct MockProxy;

    #[contractimpl]
    impl MockProxy {
        pub fn latest_round(env: Env, _data_id: BytesN<32>, decimals: u32) -> Round {
            // XLM/USD = 0.17559400 at the requested precision.
            let answer = 17_559_400i128 * 10i128.pow(decimals) / 100_000_000;
            Round { answer: I256::from_i128(&env, answer), round_id: 7, timestamp: 1_000 }
        }
    }

    fn setup(now: u64) -> (Env, PricingOracleClient<'static>) {
        let env = Env::default();
        env.ledger().set_timestamp(now);
        let proxy = env.register(MockProxy, ());
        let id = env.register(PricingOracle, (Address::generate(&env), proxy, 86_400u64));
        (env.clone(), PricingOracleClient::new(&env, &id))
    }

    #[test]
    fn reads_and_values_from_chainlink_round() {
        let (env, c) = setup(2_000);
        let feed = BytesN::from_array(&env, &[1u8; 32]);
        let p = c.price(&feed);
        assert_eq!(p.price, 17_559_400);
        assert_eq!(p.round_id, 7);
        // 1,000 XLM (7 decimals) = $175.594
        assert_eq!(c.valuation(&feed, &10_000_000_000, &7), 17_559_400_000);
    }

    #[test]
    fn rejects_stale_rounds() {
        let (env, c) = setup(1_000 + 86_401);
        assert!(c.try_price(&BytesN::from_array(&env, &[1u8; 32])).is_err());
    }
}
