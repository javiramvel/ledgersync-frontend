#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, BytesN, Env,
    Symbol, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ComplianceError {
    AlreadyInitialized = 1,
    EntityFrozenOrRevoked = 2,
    InsufficientSignatures = 3,
    InvalidTrustAnchor = 4,
    ProhibitedYieldOnStablecoin = 5,
}

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
    pub fn initialize(env: Env, admin: Address, oracle: Address) -> Result<(), ComplianceError> {
        if env.storage().instance().has(&ADMIN) {
            return Err(ComplianceError::AlreadyInitialized);
        }
        env.storage().instance().set(&ADMIN, &admin);
        env.storage().instance().set(&ORACLE, &oracle);
        Ok(())
    }

    pub fn register_institution(
        env: Env,
        trust_anchor: Address,
        institution_wallet: Address,
        lei_hash: BytesN<32>,
        threshold: u32,
        authorized_officers: Vec<Address>,
    ) -> Result<(), ComplianceError> {
        trust_anchor.require_auth();

        let profile = InstitutionalProfile {
            lei_hash,
            trust_anchor,
            threshold,
            authorized_officers,
            is_active: true,
        };

        env.storage().persistent().set(&institution_wallet, &profile);
        Ok(())
    }

    pub fn update_compliance_status(
        env: Env,
        institution_wallet: Address,
        is_active: bool,
    ) -> Result<(), ComplianceError> {
        let oracle: Address = env.storage().instance().get(&ORACLE).unwrap();
        oracle.require_auth();

        if let Some(mut profile) = env
            .storage()
            .persistent()
            .get::<Address, InstitutionalProfile>(&institution_wallet)
        {
            profile.is_active = is_active;
            env.storage().persistent().set(&institution_wallet, &profile);
            Ok(())
        } else {
            Err(ComplianceError::InvalidTrustAnchor)
        }
    }

    pub fn verify_execution(
        env: Env,
        institution_wallet: Address,
        signing_officers: Vec<Address>,
        asset_class: AssetClass,
        is_yield_action: bool,
    ) -> Result<bool, ComplianceError> {
        let profile: InstitutionalProfile = env
            .storage()
            .persistent()
            .get(&institution_wallet)
            .ok_or(ComplianceError::InvalidTrustAnchor)?;

        if !profile.is_active {
            return Err(ComplianceError::EntityFrozenOrRevoked);
        }

        if is_yield_action && asset_class == AssetClass::PaymentStablecoin {
            return Err(ComplianceError::ProhibitedYieldOnStablecoin);
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
            return Err(ComplianceError::InsufficientSignatures);
        }

        Ok(true)
    }
}
