"use server";

import * as StellarSdk from '@stellar/stellar-sdk';

export async function executeAtomicSwap() {
    try {
        const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
        const networkPassphrase = StellarSdk.Networks.TESTNET;

        // simulated DID / KYC Oracle check
        const KYC_WHITELIST: string[] = [];

        const treasury = StellarSdk.Keypair.random(); 
        const buyer = StellarSdk.Keypair.random(); 
        const seller = StellarSdk.Keypair.random(); 

        // 1. Identity Verification
        KYC_WHITELIST.push(buyer.publicKey(), seller.publicKey());
        if (!KYC_WHITELIST.includes(buyer.publicKey()) || !KYC_WHITELIST.includes(seller.publicKey())) {
            throw new Error("COMPLIANCE BLOCK: Unverified Identity.");
        }

        // 2. Provision Blockchain State (Parallel fetching for speed)
        await Promise.all([
            fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(treasury.publicKey())}`),
            fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(buyer.publicKey())}`),
            fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(seller.publicKey())}`)
        ]);

        const REFA_STOCK = new StellarSdk.Asset("REFA", treasury.publicKey());
        const USDC_STABLE = new StellarSdk.Asset("USDC", treasury.publicKey());

        let buyerAcc = await server.loadAccount(buyer.publicKey());
        let sellerAcc = await server.loadAccount(seller.publicKey());

        // Open trustlines
        const setupTx1 = new StellarSdk.TransactionBuilder(buyerAcc, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.changeTrust({ asset: REFA_STOCK }))
            .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_STABLE }))
            .setTimeout(30).build();
        setupTx1.sign(buyer);
        await server.submitTransaction(setupTx1);

        const setupTx2 = new StellarSdk.TransactionBuilder(sellerAcc, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.changeTrust({ asset: REFA_STOCK }))
            .addOperation(StellarSdk.Operation.changeTrust({ asset: USDC_STABLE }))
            .setTimeout(30).build();
        setupTx2.sign(seller);
        await server.submitTransaction(setupTx2);

        // Treasury mints to simulate secondary market holdings
        const treasuryAcc = await server.loadAccount(treasury.publicKey());
        const mintTx = new StellarSdk.TransactionBuilder(treasuryAcc, { fee: StellarSdk.BASE_FEE, networkPassphrase })
            .addOperation(StellarSdk.Operation.payment({ destination: buyer.publicKey(), asset: USDC_STABLE, amount: "5000" }))
            .addOperation(StellarSdk.Operation.payment({ destination: seller.publicKey(), asset: REFA_STOCK, amount: "50" }))
            .setTimeout(30).build();
        mintTx.sign(treasury);
        await server.submitTransaction(mintTx);

        // 3. THE ATOMIC SWAP
        const latestBuyerAcc = await server.loadAccount(buyer.publicKey());
        
        const atomicSwapTx = new StellarSdk.TransactionBuilder(latestBuyerAcc, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase
        })
        .addOperation(StellarSdk.Operation.payment({
            source: buyer.publicKey(),
            destination: seller.publicKey(),
            asset: USDC_STABLE,
            amount: "5000"
        }))
        .addOperation(StellarSdk.Operation.payment({
            source: seller.publicKey(),
            destination: buyer.publicKey(),
            asset: REFA_STOCK,
            amount: "50"
        }))
        .setTimeout(30)
        .build();

        // Dual signatures required for zero-counterparty risk
        atomicSwapTx.sign(buyer);
        atomicSwapTx.sign(seller);

        const result = await server.submitTransaction(atomicSwapTx);
        
        return { success: true, hash: result.hash };
        
    } catch (error: any) {
        console.error("Atomic Swap Failed:", error);
        return { success: false, error: error.message || "Transaction failed on the Stellar network." };
    }
}
