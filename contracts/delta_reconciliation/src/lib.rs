#![no_std]
//! Deterministic delta reconciliation: the custodian's attested balance is the source of truth, and
//! a single `reconcile` call mints or burns exactly the difference against live on-chain supply.
//! A strictly increasing nonce makes every attestation replay-proof and gap-free.

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, Address, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum SyncError {
    ReplayDetected = 1,
    InvalidSequence = 2,
    NegativeBalance = 3,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Admin,
    Token,
    Nonce,
    CustodianBalance,
}

#[contractclient(name = "AssetClient")]
pub trait SupplyControlled {
    fn mint(env: Env, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
    fn total_supply(env: Env) -> i128;
}

#[contractevent]
pub struct Reconciled {
    #[topic]
    pub nonce: u64,
    pub custodian_balance: i128,
    pub previous_supply: i128,
    /// Positive = minted, negative = burned, zero = already at parity.
    pub delta: i128,
}

#[contract]
pub struct DeltaReconciliation;

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&DataKey::Admin).unwrap()
}

#[contractimpl]
impl DeltaReconciliation {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Nonce, &0u64);
        env.storage().instance().set(&DataKey::CustodianBalance, &0i128);
    }

    /// Binds the token this contract controls. The token must name this contract as its minter.
    pub fn set_token(env: Env, token: Address) {
        admin(&env).require_auth();
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Brings on-chain supply to exactly `custodian_balance`, minting to or burning from `holder`.
    pub fn reconcile(env: Env, expected_nonce: u64, custodian_balance: i128, holder: Address) -> i128 {
        admin(&env).require_auth();
        if custodian_balance < 0 {
            panic_with_error!(&env, SyncError::NegativeBalance);
        }
        let nonce: u64 = env.storage().instance().get(&DataKey::Nonce).unwrap();
        if expected_nonce <= nonce {
            panic_with_error!(&env, SyncError::ReplayDetected);
        }
        if expected_nonce != nonce + 1 {
            panic_with_error!(&env, SyncError::InvalidSequence);
        }

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let asset = AssetClient::new(&env, &token);
        let supply = asset.total_supply();
        let delta = custodian_balance - supply;
        if delta > 0 {
            asset.mint(&holder, &delta);
        } else if delta < 0 {
            asset.burn(&holder, &(-delta));
        }

        env.storage().instance().set(&DataKey::Nonce, &expected_nonce);
        env.storage().instance().set(&DataKey::CustodianBalance, &custodian_balance);
        Reconciled {
            nonce: expected_nonce,
            custodian_balance,
            previous_supply: supply,
            delta,
        }
        .publish(&env);
        delta
    }

    pub fn nonce(env: Env) -> u64 {
        env.storage().instance().get(&DataKey::Nonce).unwrap()
    }

    pub fn custodian_balance(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::CustodianBalance).unwrap()
    }

    pub fn token(env: Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Token)
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::{testutils::Address as _, vec, BytesN, String};
    use institutional_compliance::{InstitutionalCompliance, InstitutionalComplianceClient};
    use wall_street_asset::{WallStreetAsset, WallStreetAssetClient};

    struct Setup {
        env: Env,
        recon: DeltaReconciliationClient<'static>,
        asset: WallStreetAssetClient<'static>,
        holder: Address,
    }

    fn setup() -> Setup {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let holder = Address::generate(&env);

        let compliance_id = env.register(InstitutionalCompliance, (&admin, &admin));
        let compliance = InstitutionalComplianceClient::new(&env, &compliance_id);
        compliance.register_institution(&holder, &BytesN::from_array(&env, &[9u8; 32]), &1, &vec![&env, holder.clone()]);

        let recon_id = env.register(DeltaReconciliation, (&admin,));
        let asset_id = env.register(
            WallStreetAsset,
            (&admin, &recon_id, &compliance_id, String::from_str(&env, "Fund"), String::from_str(&env, "FND")),
        );
        let recon = DeltaReconciliationClient::new(&env, &recon_id);
        recon.set_token(&asset_id);
        Setup { asset: WallStreetAssetClient::new(&env, &asset_id), recon, env, holder }
    }

    #[test]
    fn reconcile_mints_then_burns_to_parity() {
        let s = setup();
        assert_eq!(s.recon.reconcile(&1, &1_000, &s.holder), 1_000);
        assert_eq!(s.asset.total_supply(), 1_000);

        assert_eq!(s.recon.reconcile(&2, &750, &s.holder), -250);
        assert_eq!(s.asset.total_supply(), 750);
        assert_eq!(s.asset.balance(&s.holder), 750);

        assert_eq!(s.recon.reconcile(&3, &750, &s.holder), 0);
        assert_eq!(s.recon.nonce(), 3);
        assert_eq!(s.recon.custodian_balance(), 750);
    }

    #[test]
    fn replayed_or_skipped_nonce_is_rejected() {
        let s = setup();
        s.recon.reconcile(&1, &10, &s.holder);
        assert!(s.recon.try_reconcile(&1, &20, &s.holder).is_err());
        assert!(s.recon.try_reconcile(&3, &20, &s.holder).is_err());
    }

    #[test]
    fn only_admin_can_reconcile() {
        let s = setup();
        s.env.set_auths(&[]);
        assert!(s.recon.try_reconcile(&1, &10, &s.holder).is_err());
    }

    #[test]
    fn token_rejects_direct_mint_from_anyone_but_reconciler() {
        let s = setup();
        s.env.set_auths(&[]);
        assert!(s.asset.try_mint(&s.holder, &1).is_err());
    }
}
