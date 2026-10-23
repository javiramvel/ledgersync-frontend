#![no_std]
//! Merkle-committed proof of reserves. The reserve oracle publishes the root of a Merkle tree over
//! custodial holdings together with the attested reserve total and the token supply it backs.
//! Individual account balances never touch the ledger; any holder can verify inclusion off-chain.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env,
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ProofError {
    StaleTimestamp = 1,
    NoProof = 2,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReserveProof {
    pub merkle_root: BytesN<32>,
    pub reserves: i128,
    pub supply: i128,
    pub timestamp: u64,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Oracle,
    Latest,
}

#[contractevent]
pub struct RootPublished {
    #[topic]
    pub merkle_root: BytesN<32>,
    pub reserves: i128,
    pub supply: i128,
    pub timestamp: u64,
}

#[contract]
pub struct SolvencyProof;

#[contractimpl]
impl SolvencyProof {
    pub fn __constructor(env: Env, oracle: Address) {
        env.storage().instance().set(&DataKey::Oracle, &oracle);
    }

    pub fn publish_root(env: Env, merkle_root: BytesN<32>, reserves: i128, supply: i128, timestamp: u64) {
        let oracle: Address = env.storage().instance().get(&DataKey::Oracle).unwrap();
        oracle.require_auth();

        if let Some(prev) = env.storage().instance().get::<_, ReserveProof>(&DataKey::Latest) {
            if timestamp <= prev.timestamp {
                panic_with_error!(&env, ProofError::StaleTimestamp);
            }
        }
        let proof = ReserveProof {
            merkle_root: merkle_root.clone(),
            reserves,
            supply,
            timestamp,
            ledger: env.ledger().sequence(),
        };
        env.storage().instance().set(&DataKey::Latest, &proof);
        RootPublished { merkle_root, reserves, supply, timestamp }.publish(&env);
    }

    pub fn latest(env: Env) -> ReserveProof {
        env.storage()
            .instance()
            .get(&DataKey::Latest)
            .unwrap_or_else(|| panic_with_error!(&env, ProofError::NoProof))
    }

    /// True when the last attested reserves fully back the supply recorded with them.
    pub fn is_solvent(env: Env) -> bool {
        let p = Self::latest(env);
        p.reserves >= p.supply
    }

    pub fn oracle(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Oracle).unwrap()
    }
}

#[cfg(test)]
mod test {
    extern crate std;
    use super::*;
    use soroban_sdk::testutils::Address as _;

    #[test]
    fn publishes_and_rejects_stale_roots() {
        let env = Env::default();
        let oracle = Address::generate(&env);
        let id = env.register(SolvencyProof, (&oracle,));
        let c = SolvencyProofClient::new(&env, &id);
        let root = BytesN::from_array(&env, &[5u8; 32]);

        assert!(c.try_latest().is_err());
        assert!(c.try_publish_root(&root, &100, &100, &10).is_err()); // no auth

        env.mock_all_auths();
        c.publish_root(&root, &100, &90, &10);
        assert_eq!(env.auths()[0].0, oracle);
        assert!(c.is_solvent());
        assert_eq!(c.latest().merkle_root, root);

        assert!(c.try_publish_root(&root, &100, &100, &10).is_err());
        c.publish_root(&root, &80, &90, &11);
        assert!(!c.is_solvent());
    }
}
