#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, token, Address, Env, Symbol, symbol_short};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SyncError {
    InvalidSequence = 1,
    Unauthorized = 2,
    ReplayAttackDetected = 3,
}

const ADMIN: Symbol = symbol_short!("ADMIN");
const NONCE: Symbol = symbol_short!("NONCE");
const SUPPLY: Symbol = symbol_short!("SUPPLY");
const TOKEN_ID: Symbol = symbol_short!("TOKEN_ID");

#[contract]
pub struct DeltaReconciliationContract;

#[contractimpl]
impl DeltaReconciliationContract {
    pub fn initialize(env: Env, admin: Address, token_id: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&TOKEN_ID, &token_id);
        env.storage().instance().set(&NONCE, &0u64);
        env.storage().instance().set(&SUPPLY, &0i128);
    }

    pub fn sync_state(
        env: Env,
        expected_nonce: u64,
        new_supply: i128,
    ) -> Result<(), SyncError> {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        
        let current_nonce: u64 = env.storage().instance().get(&NONCE).unwrap();
        
        if expected_nonce <= current_nonce {
            return Err(SyncError::ReplayAttackDetected);
        }
        
        if expected_nonce != current_nonce + 1 {
            return Err(SyncError::InvalidSequence);
        }
        
        env.storage().instance().set(&NONCE, &expected_nonce);
        env.storage().instance().set(&SUPPLY, &new_supply);
        
        Ok(())
    }

    pub fn mint_asset(env: Env, _ticker: Symbol, amount: i128, to: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        
        let token_address: Address = env.storage().instance().get(&TOKEN_ID).unwrap();
        let token_client = token::StellarAssetClient::new(&env, &token_address);
        
        token_client.mint(&to, &amount);
    }

    pub fn burn_asset(env: Env, _ticker: Symbol, amount: i128, from: Address) {
        let admin: Address = env.storage().instance().get(&ADMIN).unwrap();
        admin.require_auth();
        
        let token_address: Address = env.storage().instance().get(&TOKEN_ID).unwrap();
        let token_client = token::Client::new(&env, &token_address);
        
        token_client.burn(&from, &amount);
    }
}