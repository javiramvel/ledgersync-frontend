#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

const ADMIN: Symbol = symbol_short!("ADMIN");
const YIELD_POOL: Symbol = symbol_short!("POOL");
const SUPPLY_SNAP: Symbol = symbol_short!("SNAP");
const ASSET_TICKER: Symbol = symbol_short!("TICKER");

#[contract]
pub struct YieldDistributionContract;

#[contractimpl]
impl YieldDistributionContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
    }

    pub fn distribute_yield(env: Env, asset_code: Symbol, yield_amount: i128) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap_or_else(|| panic!("Not initialized"));
        admin.require_auth();

        env.storage().instance().set(&ASSET_TICKER, &asset_code);
        env.storage().instance().set(&YIELD_POOL, &yield_amount);
    }

    pub fn initialize_snapshot(env: Env, admin: Address, total_supply: i128, total_yield: i128) {
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&SUPPLY_SNAP, &total_supply);
        env.storage().instance().set(&YIELD_POOL, &total_yield);
    }

    pub fn claim_pro_rata(env: Env, user: Address, user_balance_at_snapshot: i128) -> i128 {
        user.require_auth();

        let claimed_key = (symbol_short!("CLAIM"), user.clone());
        if env.storage().persistent().has(&claimed_key) {
            panic!("Yield already claimed for this address");
        }

        let total_supply: i128 = env.storage().instance().get(&SUPPLY_SNAP).unwrap_or(0);
        let total_yield: i128 = env.storage().instance().get(&YIELD_POOL).unwrap_or(0);

        if total_supply == 0 || total_yield == 0 {
            panic!("Yield matrix is not active");
        }

        let user_share = user_balance_at_snapshot
            .checked_mul(total_yield)
            .and_then(|val| val.checked_div(total_supply))
            .unwrap_or_else(|| panic!("Arithmetic overflow during yield calculation"));

        env.storage().persistent().set(&claimed_key, &true);
        user_share
    }
}