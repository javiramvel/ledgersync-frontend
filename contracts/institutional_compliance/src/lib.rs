#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, BytesN, Env, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum AssetClass {
    PaymentStablecoin = 0,
    SecInvestmentContract = 1,
    CftcDigitalCommodity = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InstitutionalProfile {
    pub lei_hash: BytesN<32>,
    pub trust_anchor: Address,
    pub threshold: u32,
    pub authorized_officers: Vec<Address>,
    pub is_active: bool,
}

const ORACLE: Symbol = symbol_short!("ORACLE");
const ADMIN: Symbol = symbol_short!("ADMIN");

#[contract]
pub struct InstitutionalComplianceContract;

#[contractimpl]
impl InstitutionalComplianceContract {
    pub fn initialize(env: Env, admin: Address, oracle: Address) {
        if env.storage().instance().has(&ADMIN) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&ORACLE, &oracle);
    }

    pub fn register_institution(
        env: Env,
        trust_anchor: Address,
        institution_wallet: Address,
        lei_hash: BytesN<32>,
        threshold: u32,
        authorized_officers: Vec<Address>,
    ) {
        trust_anchor.require_auth();

        let profile = InstitutionalProfile {
            lei_hash,
            trust_anchor,
            threshold,
            authorized_officers,
            is_active: true,
        };

        env.storage().persistent().set(&institution_wallet, &profile);
    }

    pub fn update_compliance_status(env: Env, institution_wallet: Address, is_active: bool) {
        let oracle: Address = env.storage().instance().get(&ORACLE).unwrap_or_else(|| panic!("Not initialized"));
        oracle.require_auth();

        if let Some(mut profile) = env
            .storage()
            .persistent()
            .get::<Address, InstitutionalProfile>(&institution_wallet)
        {
            profile.is_active = is_active;
            env.storage().persistent().set(&institution_wallet, &profile);
        } else {
            panic!("Invalid Trust Anchor or Unregistered Institution");
        }
    }

    pub fn verify_execution(
        env: Env,
        institution_wallet: Address,
        signing_officers: Vec<Address>,
        asset_class: AssetClass,
        is_yield_action: bool,
    ) -> bool {
        let profile: InstitutionalProfile = env
            .storage()
            .persistent()
            .get(&institution_wallet)
            .unwrap_or_else(|| panic!("Invalid Trust Anchor"));

        if !profile.is_active {
            panic!("Entity compliance status frozen or revoked");
        }

        if is_yield_action && asset_class == AssetClass::PaymentStablecoin {
            panic!("Prohibited: Yield execution on Payment Stablecoins");
        }

        let mut valid_signatures: u32 = 0;
        for i in 0..signing_officers.len() {
            let officer = signing_officers.get(i).unwrap();
            if profile.authorized_officers.contains(&officer) {
                officer.require_auth();
                valid_signatures += 1;
            }
        }

        if valid_signatures < profile.threshold {
            panic!("Insufficient authorized signatures for execution");
        }

        true
    }
}