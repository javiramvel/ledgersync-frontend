#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env, Symbol};

const ORACLE: Symbol = symbol_short!("ORACLE");
const LATEST_ROOT: Symbol = symbol_short!("ROOT");
const LAST_UPDATE: Symbol = symbol_short!("TIME");

#[contract]
pub struct SolvencyProofContract;

#[contractimpl]
impl SolvencyProofContract {
    pub fn initialize(env: Env, oracle: Address) {
        if env.storage().instance().has(&ORACLE) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ORACLE, &oracle);
        env.storage().instance().set(&LAST_UPDATE, &0u64);
    }

    pub fn publish_root(env: Env, merkle_root: BytesN<32>, timestamp: u64) {
        let oracle: Address = env.storage().instance().get(&ORACLE).unwrap_or_else(|| panic!("Not initialized"));
        oracle.require_auth();

        let last_time: u64 = env.storage().instance().get(&LAST_UPDATE).unwrap_or(0);
        if timestamp <= last_time {
            panic!("Stale timestamp provided");
        }

        env.storage().instance().set(&LATEST_ROOT, &merkle_root);
        env.storage().instance().set(&LAST_UPDATE, &timestamp);
    }

    pub fn verify_reserves(env: Env, _asset_code: Symbol) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&LATEST_ROOT)
            .unwrap_or_else(|| panic!("No cryptographic proof recorded"))
    }

    pub fn get_latest_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&LATEST_ROOT)
            .unwrap_or_else(|| panic!("No cryptographic proof recorded"))
    }
}