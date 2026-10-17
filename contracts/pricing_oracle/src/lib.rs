#![no_std]
use soroban_sdk::{contract, contractimpl, contractclient, Address, Env};

// 1. Define the Chainlink Feed Interface for Soroban
#[contractclient(name = "ChainlinkFeedClient")]
pub trait ChainlinkFeed {
    fn latest_answer(env: Env) -> i128;
    fn decimals(env: Env) -> u32;
}

#[contract]
pub struct LedgerSyncPricingOracle;

#[contractimpl]
impl LedgerSyncPricingOracle {
    /// Fetches the live, tamper-proof price from Chainlink
    pub fn get_live_valuation(
        env: Env, 
        chainlink_feed_address: Address, 
        token_amount: i128
    ) -> i128 {
        // Connect directly to the Chainlink feed contract
        let feed = ChainlinkFeedClient::new(&env, &chainlink_feed_address);
        
        let price = feed.latest_answer();
        let decimals = feed.decimals();
        
        // Calculate total fiat value of the token amount
        let base: i128 = 10;
        let divisor = base.pow(decimals);
        
        price.checked_mul(token_amount).unwrap() / divisor
    }
}