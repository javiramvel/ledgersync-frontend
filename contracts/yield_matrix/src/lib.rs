#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, Address, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum YieldError {
    AlreadyInitialized = 1,
    YieldNotActive = 2,
    AlreadyClaimed = 3,
    ArithmeticOverflow = 4,
    Unauthorized = 5,
}

const ADMIN: Symbol = symbol_short!("ADMIN");
const YIELD_POOL: Symbol = symbol_short!("POOL");
const SUPPLY_SNAP: Symbol = symbol_short!("SNAP");
const ASSET_TICKER: Symbol = symbol_short!("TICKER");

#[contract]
pub struct YieldDistributionContract;

#[contractimpl]
impl YieldDistributionContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), YieldError> {
        if env.storage().instance().has(&ADMIN) {
            return Err(YieldError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        Ok(())
    }

    /// Direct entrypoint called by soroban.ts DISTRIBUTE_YIELD action
    pub fn distribute_yield(
        env: Env,
        asset_code: Symbol,
        yield_amount: i128,
    ) -> Result<(), YieldError> {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        env.storage().instance().set(&ASSET_TICKER, &asset_code);
        env.storage().instance().set(&YIELD_POOL, &yield_amount);
        Ok(())
    }

    /// Locks aggregate snapshot for pro-rata dividend execution
    pub fn initialize_snapshot(
        env: Env,
        admin: Address,
        total_supply: i128,
        total_yield: i128,
    ) -> Result<(), YieldError> {
        admin.require_auth();
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&SUPPLY_SNAP, &total_supply);
        env.storage().instance().set(&YIELD_POOL, &total_yield);
        Ok(())
    }

    /// Zero-dust shareholder claim function
    pub fn claim_pro_rata(
        env: Env,
        user: Address,
        user_balance_at_snapshot: i128,
    ) -> Result<i128, YieldError> {
        user.require_auth();

        let claimed_key = (symbol_short!("CLAIM"), user.clone());
        if env.storage().persistent().has(&claimed_key) {
            return Err(YieldError::AlreadyClaimed);
        }

        let total_supply: i128 = env.storage().instance().get(&SUPPLY_SNAP).unwrap_or(0);
        let total_yield: i128 = env.storage().instance().get(&YIELD_POOL).unwrap_or(0);

        if total_supply == 0 || total_yield == 0 {
            return Err(YieldError::YieldNotActive);
        }

        let user_share = user_balance_at_snapshot
            .checked_mul(total_yield)
            .and_then(|val| val.checked_div(total_supply))
            .ok_or(YieldError::ArithmeticOverflow)?;

        env.storage().persistent().set(&claimed_key, &true);
        Ok(user_share)
    }
}