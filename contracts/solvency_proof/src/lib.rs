#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, symbol_short, Address, BytesN, Env, Symbol,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SolvencyError {
    AlreadyInitialized = 1,
    UnauthorizedOracle = 2,
    StaleTimestamp = 3,
    NoProofRecorded = 4,
}

const ORACLE: Symbol = symbol_short!("ORACLE");
const LATEST_ROOT: Symbol = symbol_short!("ROOT");
const LAST_UPDATE: Symbol = symbol_short!("TIME");

#[contract]
pub struct SolvencyProofContract;

#[contractimpl]
impl SolvencyProofContract {
    pub fn initialize(env: Env, oracle: Address) -> Result<(), SolvencyError> {
        if env.storage().instance().has(&ORACLE) {
            return Err(SolvencyError::AlreadyInitialized);
        }
        env.storage().instance().set(&ORACLE, &oracle);
        env.storage().instance().set(&LAST_UPDATE, &0u64);
        Ok(())
    }

    pub fn publish_root(
        env: Env,
        merkle_root: BytesN<32>,
        timestamp: u64,
    ) -> Result<(), SolvencyError> {
        let oracle: Address = env.storage().instance().get(&ORACLE).unwrap();
        oracle.require_auth();

        let last_time: u64 = env.storage().instance().get(&LAST_UPDATE).unwrap();
        if timestamp <= last_time {
            return Err(SolvencyError::StaleTimestamp);
        }

        env.storage().instance().set(&LATEST_ROOT, &merkle_root);
        env.storage().instance().set(&LAST_UPDATE, &timestamp);
        Ok(())
    }

    /// Direct entrypoint called by soroban.ts VERIFY_RESERVES action
    pub fn verify_reserves(env: Env, _asset_code: Symbol) -> Result<BytesN<32>, SolvencyError> {
        env.storage()
            .instance()
            .get(&LATEST_ROOT)
            .ok_or(SolvencyError::NoProofRecorded)
    }

    pub fn get_latest_root(env: Env) -> Result<BytesN<32>, SolvencyError> {
        env.storage()
            .instance()
            .get(&LATEST_ROOT)
            .ok_or(SolvencyError::NoProofRecorded)
    }
}