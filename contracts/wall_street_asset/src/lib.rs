#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Address, Env, Symbol};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AssetError {
    AlreadyInitialized = 1,
    Unauthorized = 2,
    InvalidSplitRatio = 3,
}

const ADMIN: Symbol = symbol_short!("ADMIN");
const TOTAL_SUPPLY: Symbol = symbol_short!("SUPPLY");
const SPLIT_NUM: Symbol = symbol_short!("SPLT_N");
const SPLIT_DEN: Symbol = symbol_short!("SPLT_D");

#[contract]
pub struct WallStreetAssetContract;

#[contractimpl]
impl WallStreetAssetContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), AssetError> {
        if env.storage().instance().has(&ADMIN) {
            return Err(AssetError::AlreadyInitialized);
        }
        
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOTAL_SUPPLY, &0i128);
        
        env.storage().instance().set(&SPLIT_NUM, &1i128);
        env.storage().instance().set(&SPLIT_DEN, &1i128);
        
        Ok(())
    }

    pub fn execute_split(env: Env, numerator: i128, denominator: i128) -> Result<(), AssetError> {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();

        if numerator <= 0 || denominator <= 0 {
            return Err(AssetError::InvalidSplitRatio);
        }

        let current_num: i128 = env.storage().instance().get(&SPLIT_NUM).unwrap();
        let current_den: i128 = env.storage().instance().get(&SPLIT_DEN).unwrap();

        let new_num = current_num.checked_mul(numerator).unwrap();
        let new_den = current_den.checked_mul(denominator).unwrap();

        env.storage().instance().set(&SPLIT_NUM, &new_num);
        env.storage().instance().set(&SPLIT_DEN, &new_den);

        Ok(())
    }

    // Removed the Result Enum to perfectly align the Wasm signature with the Oracle invoke call
    pub fn mint(env: Env, to: Address, amount: i128) {
        let mut current_supply: i128 = env.storage().instance().get(&TOTAL_SUPPLY).unwrap_or(0);
        current_supply += amount;
        env.storage().instance().set(&TOTAL_SUPPLY, &current_supply);

        let balance_key = (symbol_short!("BAL"), to.clone());
        let mut user_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        user_balance += amount;
        
        env.storage().persistent().set(&balance_key, &user_balance);
    }

    // Removed the Result Enum; reverts via panic for insufficient balances
    pub fn burn(env: Env, from: Address, amount: i128) {
        let balance_key = (symbol_short!("BAL"), from.clone());
        let mut user_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        
        if user_balance < amount {
            panic!("Execution Halted: Insufficient On-Chain Balance");
        }

        user_balance -= amount;
        env.storage().persistent().set(&balance_key, &user_balance);

        let mut current_supply: i128 = env.storage().instance().get(&TOTAL_SUPPLY).unwrap_or(0);
        current_supply -= amount;
        env.storage().instance().set(&TOTAL_SUPPLY, &current_supply);
    }

    pub fn get_scaled_balance(env: Env, user: Address) -> i128 {
        let balance_key = (symbol_short!("BAL"), user);
        let raw_balance: i128 = env.storage().persistent().get(&balance_key).unwrap_or(0);
        
        let num: i128 = env.storage().instance().get(&SPLIT_NUM).unwrap();
        let den: i128 = env.storage().instance().get(&SPLIT_DEN).unwrap();

        (raw_balance * num) / den
    }
}