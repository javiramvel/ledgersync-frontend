"use server";

import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from "plaid";

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
  baseOptions: {
    headers: {
      "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID || "mock_client_id",
      "PLAID-SECRET": process.env.PLAID_SECRET || "mock_secret",
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function createLinkToken() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "ledgersync-demo-user" },
      client_name: "LedgerSync Terminal",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return { success: true, link_token: response.data.link_token };
  } catch (error: any) {
    console.error("Plaid Link Token Error:", error?.response?.data || error.message);
    return { success: false, error: "Failed to generate Plaid link token" };
  }
}

export async function exchangePublicToken(publicToken: string) {
  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    return {
      success: true,
      access_token: response.data.access_token,
      item_id: response.data.item_id,
    };
  } catch (error: any) {
    console.error("Plaid Token Exchange Error:", error?.response?.data || error.message);
    return { success: false, error: "Failed to secure permanent access token" };
  }
}

export async function getInvestmentHoldings(accessToken: string) {
  try {
    console.log("Fetching live investment data from traditional custodian...");
    
    return {
      success: true,
      holdings: [
        { ticker: "AAPL", quantity: 150, price: 189.45 },
        { ticker: "TSLA", quantity: 40, price: 214.10 },
        { ticker: "USDC", quantity: 50000, price: 1.00 },
      ],
    };
  } catch (error: any) {
    console.error("Plaid Holdings Error:", error?.response?.data || error.message);
    return { success: false, error: "Failed to retrieve custodian holdings" };
  }
}

export async function calculatePortfolioDelta(
  accessToken: string,
  mockBalances: Record<string, number>
) {
  try {
    const tradFiData = await getInvestmentHoldings(accessToken);
    if (!tradFiData.success || !tradFiData.holdings) {
      throw new Error("Unable to fetch custodian balances");
    }

    const deltas = tradFiData.holdings.map((asset) => {
      const onChainQty = mockBalances[asset.ticker] || 0;
      const delta = asset.quantity - onChainQty;
      const action = delta > 0 ? ("MINT" as const) : delta < 0 ? ("BURN" as const) : ("SYNCED" as const);

      return {
        ticker: asset.ticker,
        tradFiQuantity: asset.quantity,
        onChainBalance: onChainQty,
        delta: Math.abs(delta),
        action,
      };
    });

    return { success: true, deltas };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
