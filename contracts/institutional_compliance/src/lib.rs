#![no_std]
//! On-chain registry of KYC'd institutions. Only the admin (LedgerSync trust anchor) can onboard an
//! institution; the AML oracle can freeze or unfreeze one. Tokenized assets query `is_compliant`
//! before every mint and transfer.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, Vec,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ComplianceError {
    NotRegistered = 1,
    Frozen = 2,
    InsufficientSignatures = 3,
    ProhibitedYieldOnStablecoin = 4,
    InvalidThreshold = 5,
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
    pub threshold: u32,
    pub authorized_officers: Vec<Address>,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Oracle,
    Profile(Address),
}

#[contractevent]
pub struct InstitutionRegistered {
    #[topic]
    pub wallet: Address,
    pub lei_hash: BytesN<32>,
}

#[contractevent]
pub struct ComplianceStatusChanged {
    #[topic]
    pub wallet: Address,
    pub is_active: bool,
}

#[contract]
pub struct InstitutionalCompliance;

fn profile(env: &Env, wallet: &Address) -> InstitutionalProfile {
    env.storage()
        .persistent()
        .get(&DataKey::Profile(wallet.clone()))
        .unwrap_or_else(|| panic_with_error!(env, ComplianceError::NotRegistered))
}

#[contractimpl]
impl InstitutionalCompliance {
    pub fn __constructor(env: Env, admin: Address, oracle: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Oracle, &oracle);
    }

    pub fn register_institution(
        env: Env,
        institution_wallet: Address,
        lei_hash: BytesN<32>,
        threshold: u32,
        authorized_officers: Vec<Address>,
    ) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        if threshold == 0 || threshold > authorized_officers.len() {
            panic_with_error!(&env, ComplianceError::InvalidThreshold);
        }

        let p = InstitutionalProfile {
            lei_hash: lei_hash.clone(),
            threshold,
            authorized_officers,
            is_active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Profile(institution_wallet.clone()), &p);
        InstitutionRegistered { wallet: institution_wallet, lei_hash }.publish(&env);
    }

    /// Called by the AML/OFAC oracle (or admin) to freeze or reinstate an institution.
    pub fn update_compliance_status(env: Env, caller: Address, institution_wallet: Address, is_active: bool) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        let oracle: Address = env.storage().instance().get(&DataKey::Oracle).unwrap();
        if caller != admin && caller != oracle {
            panic_with_error!(&env, ComplianceError::InsufficientSignatures);
        }
        caller.require_auth();

        let mut p = profile(&env, &institution_wallet);
        p.is_active = is_active;
        env.storage()
            .persistent()
            .set(&DataKey::Profile(institution_wallet.clone()), &p);
        ComplianceStatusChanged { wallet: institution_wallet, is_active }.publish(&env);
    }

    pub fn is_compliant(env: Env, wallet: Address) -> bool {
        env.storage()
            .persistent()
            .get::<_, InstitutionalProfile>(&DataKey::Profile(wallet))
            .map(|p| p.is_active)
            .unwrap_or(false)
    }

    pub fn get_profile(env: Env, wallet: Address) -> InstitutionalProfile {
        profile(&env, &wallet)
    }

    /// M-of-N officer check for an institutional action.
    pub fn verify_execution(
        env: Env,
        institution_wallet: Address,
        signing_officers: Vec<Address>,
        asset_class: AssetClass,
        is_yield_action: bool,
    ) -> bool {
        let p = profile(&env, &institution_wallet);
        if !p.is_active {
            panic_with_error!(&env, ComplianceError::Frozen);
        }
        if is_yield_action && asset_class == AssetClass::PaymentStablecoin {
            panic_with_error!(&env, ComplianceError::ProhibitedYieldOnStablecoin);
        }

        let mut seen: Vec<Address> = Vec::new(&env);
        for officer in signing_officers.iter() {
            if p.authorized_officers.contains(&officer) && !seen.contains(&officer) {
                officer.require_auth();
                seen.push_back(officer);
            }
        }
        if seen.len() < p.threshold {
            panic_with_error!(&env, ComplianceError::InsufficientSignatures);
        }
        true
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).unwrap()
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec};

    fn setup() -> (Env, InstitutionalComplianceClient<'static>, Address, Address) {
        let env = Env::default();
        let admin = Address::generate(&env);
        let oracle = Address::generate(&env);
        let id = env.register(InstitutionalCompliance, (&admin, &oracle));
        (env.clone(), InstitutionalComplianceClient::new(&env, &id), admin, oracle)
    }

    #[test]
    fn only_admin_can_register() {
        let (env, c, admin, _) = setup();
        let wallet = Address::generate(&env);
        let officer = Address::generate(&env);
        let lei = BytesN::from_array(&env, &[7u8; 32]);
        assert!(c.try_register_institution(&wallet, &lei, &1, &vec![&env, officer.clone()]).is_err());

        env.mock_all_auths();
        c.register_institution(&wallet, &lei, &1, &vec![&env, officer]);
        assert_eq!(env.auths()[0].0, admin);
        assert!(c.is_compliant(&wallet));
        assert!(!c.is_compliant(&Address::generate(&env)));
    }

    #[test]
    fn oracle_can_freeze_and_others_cannot() {
        let (env, c, _, oracle) = setup();
        env.mock_all_auths();
        let wallet = Address::generate(&env);
        c.register_institution(&wallet, &BytesN::from_array(&env, &[1u8; 32]), &1, &vec![&env, wallet.clone()]);

        assert!(c.try_update_compliance_status(&Address::generate(&env), &wallet, &false).is_err());
        c.update_compliance_status(&oracle, &wallet, &false);
        assert!(!c.is_compliant(&wallet));
    }

    #[test]
    fn verify_execution_enforces_threshold_without_double_counting() {
        let (env, c, _, _) = setup();
        env.mock_all_auths();
        let wallet = Address::generate(&env);
        let (o1, o2) = (Address::generate(&env), Address::generate(&env));
        c.register_institution(&wallet, &BytesN::from_array(&env, &[2u8; 32]), &2, &vec![&env, o1.clone(), o2.clone()]);

        assert!(c.try_verify_execution(&wallet, &vec![&env, o1.clone(), o1.clone()], &AssetClass::SecInvestmentContract, &false).is_err());
        assert!(c.verify_execution(&wallet, &vec![&env, o1.clone(), o2.clone()], &AssetClass::SecInvestmentContract, &false));
        assert!(c.try_verify_execution(&wallet, &vec![&env, o1, o2], &AssetClass::PaymentStablecoin, &true).is_err());
    }

    #[test]
    fn invalid_threshold_rejected() {
        let (env, c, _, _) = setup();
        env.mock_all_auths();
        let wallet = Address::generate(&env);
        assert!(c.try_register_institution(&wallet, &BytesN::from_array(&env, &[3u8; 32]), &2, &vec![&env, wallet.clone()]).is_err());
    }
}
