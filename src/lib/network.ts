import { Networks } from "@stellar/stellar-sdk";
import testnet from "../../deployments/testnet.json";
import mainnet from "../../deployments/mainnet.json";

export type NetworkName = "testnet" | "mainnet";

export interface ContractRegistry {
  asset: string | null;
  reconciliation: string | null;
  compliance: string | null;
  yield: string | null;
  solvency: string | null;
  pricing: string | null;
  chainlinkProxy: string;
  payoutToken: string;
}

export interface NetworkConfig {
  name: NetworkName;
  label: string;
  passphrase: string;
  rpcUrl: string;
  explorer: string;
  admin: string | null;
  treasury: string | null;
  contracts: ContractRegistry;
  /** True once the LedgerSync contract suite is deployed on this network. */
  deployed: boolean;
}

const name: NetworkName = process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet" ? "mainnet" : "testnet";
const manifest = name === "mainnet" ? mainnet : testnet;

export const network: NetworkConfig = {
  name,
  label: name === "mainnet" ? "Stellar Mainnet" : "Stellar Testnet",
  passphrase: name === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
  rpcUrl:
    process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    (name === "mainnet" ? "https://mainnet.sorobanrpc.com" : "https://soroban-testnet.stellar.org"),
  explorer: `https://stellar.expert/explorer/${name === "mainnet" ? "public" : "testnet"}`,
  admin: manifest.admin,
  treasury: manifest.treasury,
  contracts: manifest.contracts,
  deployed: Boolean(manifest.contracts.asset),
};

/** Freighter reports the network as "PUBLIC" or "TESTNET". */
export const freighterNetwork = name === "mainnet" ? "PUBLIC" : "TESTNET";

export const ASSET_DECIMALS = 7;

export function txUrl(hash: string): string {
  return `${network.explorer}/tx/${hash}`;
}

export function contractUrl(id: string): string {
  return `${network.explorer}/contract/${id}`;
}

export function requireContract(key: keyof Omit<ContractRegistry, "chainlinkProxy" | "payoutToken">): string {
  const id = network.contracts[key];
  if (!id) throw new Error(`The ${key} contract is not deployed on ${network.label} yet.`);
  return id;
}
