#![no_std]
//! Tokenized security issued through LedgerSync.
//!
//! * Supply can only change through the `minter` (the delta-reconciliation contract), so on-chain
//!   supply always tracks the custodian's attested balance.
//! * Every holder must be active in the institutional-compliance registry (transfer restriction).
//! * Stock splits re-scale every balance in O(1) by updating a global ratio.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, Env, String,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum AssetError {
    InvalidAmount = 1,
    InvalidSplitRatio = 2,
    InsufficientBalance = 3,
    NotCompliant = 4,
    IndivisibleAmount = 5,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Minter,
    Compliance,
    Name,
    Symbol,
    SplitNum,
    SplitDen,
    RawSupply,
    RawBalance(Address),
}

/// Minimal view of the institutional-compliance contract used for transfer restrictions.
#[contractclient(name = "ComplianceClient")]
pub trait ComplianceView {
    fn is_compliant(env: Env, wallet: Address) -> bool;
}

#[contractevent]
pub struct Mint {
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Burn {
    #[topic]
    pub from: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Transfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

#[contractevent]
pub struct Split {
    pub numerator: u32,
    pub denominator: u32,
}

const DECIMALS: u32 = 7;

#[contract]
pub struct WallStreetAsset;

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

fn ratio(env: &Env) -> (i128, i128) {
    let s = env.storage().instance();
    (
        s.get(&DataKey::SplitNum).unwrap(),
        s.get(&DataKey::SplitDen).unwrap(),
    )
}

fn raw_balance(env: &Env, who: &Address) -> i128 {
    env.storage()
        .persistent()
        .get(&DataKey::RawBalance(who.clone()))
        .unwrap_or(0)
}

fn set_raw_balance(env: &Env, who: &Address, raw: i128) {
    env.storage()
        .persistent()
        .set(&DataKey::RawBalance(who.clone()), &raw);
}

/// Converts a share amount into raw ledger units, rejecting amounts that cannot be represented
/// exactly at the current split ratio.
fn to_raw(env: &Env, amount: i128) -> i128 {
    if amount <= 0 {
        panic_with_error!(env, AssetError::InvalidAmount);
    }
    let (num, den) = ratio(env);
    let scaled = amount.checked_mul(den).unwrap();
    if scaled % num != 0 {
        panic_with_error!(env, AssetError::IndivisibleAmount);
    }
    scaled / num
}

fn to_shares(env: &Env, raw: i128) -> i128 {
    let (num, den) = ratio(env);
    raw.checked_mul(num).unwrap() / den
}

fn require_compliant(env: &Env, who: &Address) {
    let registry: Address = env.storage().instance().get(&DataKey::Compliance).unwrap();
    if !ComplianceClient::new(env, &registry).is_compliant(who) {
        panic_with_error!(env, AssetError::NotCompliant);
    }
}

#[contractimpl]
impl WallStreetAsset {
    pub fn __constructor(
        env: Env,
        admin: Address,
        minter: Address,
        compliance: Address,
        name: String,
        symbol: String,
    ) {
        let s = env.storage().instance();
        s.set(&DataKey::Admin, &admin);
        s.set(&DataKey::Minter, &minter);
        s.set(&DataKey::Compliance, &compliance);
        s.set(&DataKey::Name, &name);
        s.set(&DataKey::Symbol, &symbol);
        s.set(&DataKey::SplitNum, &1i128);
        s.set(&DataKey::SplitDen, &1i128);
        s.set(&DataKey::RawSupply, &0i128);
    }

    // ----- supply management (minter only) -----

    pub fn mint(env: Env, to: Address, amount: i128) {
        let minter: Address = env.storage().instance().get(&DataKey::Minter).unwrap();
        minter.require_auth();
        require_compliant(&env, &to);

        let raw = to_raw(&env, amount);
        set_raw_balance(&env, &to, raw_balance(&env, &to) + raw);
        let supply: i128 = env.storage().instance().get(&DataKey::RawSupply).unwrap();
        env.storage().instance().set(&DataKey::RawSupply, &(supply + raw));
        Mint { to, amount }.publish(&env);
    }

    /// Issuer-controlled burn (regulated clawback); only the reconciliation minter can call it.
    pub fn burn(env: Env, from: Address, amount: i128) {
        let minter: Address = env.storage().instance().get(&DataKey::Minter).unwrap();
        minter.require_auth();

        let raw = to_raw(&env, amount);
        let balance = raw_balance(&env, &from);
        if balance < raw {
            panic_with_error!(&env, AssetError::InsufficientBalance);
        }
        set_raw_balance(&env, &from, balance - raw);
        let supply: i128 = env.storage().instance().get(&DataKey::RawSupply).unwrap();
        env.storage().instance().set(&DataKey::RawSupply, &(supply - raw));
        Burn { from, amount }.publish(&env);
    }

    // ----- holder operations -----

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        require_compliant(&env, &from);
        require_compliant(&env, &to);

        let raw = to_raw(&env, amount);
        let balance = raw_balance(&env, &from);
        if balance < raw {
            panic_with_error!(&env, AssetError::InsufficientBalance);
        }
        set_raw_balance(&env, &from, balance - raw);
        set_raw_balance(&env, &to, raw_balance(&env, &to) + raw);
        Transfer { from, to, amount }.publish(&env);
    }

    // ----- corporate actions (admin only) -----

    pub fn execute_split(env: Env, numerator: u32, denominator: u32) {
        admin(&env).require_auth();
        if numerator == 0 || denominator == 0 {
            panic_with_error!(&env, AssetError::InvalidSplitRatio);
        }
        let (num, den) = ratio(&env);
        let s = env.storage().instance();
        s.set(&DataKey::SplitNum, &num.checked_mul(numerator as i128).unwrap());
        s.set(&DataKey::SplitDen, &den.checked_mul(denominator as i128).unwrap());
        Split { numerator, denominator }.publish(&env);
    }

    pub fn set_minter(env: Env, minter: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Minter, &minter);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // ----- views -----

    pub fn balance(env: Env, id: Address) -> i128 {
        to_shares(&env, raw_balance(&env, &id))
    }

    pub fn total_supply(env: Env) -> i128 {
        let raw: i128 = env.storage().instance().get(&DataKey::RawSupply).unwrap();
        to_shares(&env, raw)
    }

    pub fn split_ratio(env: Env) -> (i128, i128) {
        ratio(&env)
    }

    pub fn decimals(_env: Env) -> u32 {
        DECIMALS
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).unwrap()
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).unwrap()
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }

    pub fn minter(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Minter).unwrap()
    }
}

#[cfg(test)]
mod test;
