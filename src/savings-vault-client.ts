/**
 * Savings Vault Contract Integration
 * TypeScript/JavaScript example using @stacks/transactions
 */

import { CONTRACT_ADDRESS, CONTRACT_NAME, network } from './stacks-config';
import {
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  standardPrincipalCV,
  cvToValue,
  callReadOnlyFunction,
} from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';


/**
 * Deposit STX into the savings vault
 * @param senderKey - Private key of the sender
 * @param amount - Amount in microSTX (1 STX = 1,000,000 microSTX)
 * @param lockPeriod - Lock period in blocks
 */
export async function deposit(
  senderKey: string,
  amount: number
): Promise<string> {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'deposit',
    functionArgs: [uintCV(amount)],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);

  if (broadcastResponse.error) {
    throw new Error(`Transaction failed: ${broadcastResponse.error}`);
  }

  console.log(`Deposit transaction broadcast: ${broadcastResponse.txid}`);
  return broadcastResponse.txid;
}

/**
 * Withdraw funds from the vault (after lock period)
 * @param senderKey - Private key of the sender
 */
export async function withdraw(senderKey: string): Promise<string> {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'withdraw',
    functionArgs: [],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);

  if (broadcastResponse.error) {
    throw new Error(`Transaction failed: ${broadcastResponse.error}`);
  }

  console.log(`Withdrawal transaction broadcast: ${broadcastResponse.txid}`);
  return broadcastResponse.txid;
}

/**
 * Emergency withdraw with penalty
 * @param senderKey - Private key of the sender
 */
export async function emergencyWithdraw(senderKey: string): Promise<string> {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'emergency-withdraw',
    functionArgs: [],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);

  if (broadcastResponse.error) {
    throw new Error(`Transaction failed: ${broadcastResponse.error}`);
  }

  console.log(`Emergency withdrawal transaction broadcast: ${broadcastResponse.txid}`);
  return broadcastResponse.txid;
}

/**
 * Claim accrued interest
 * @param senderKey - Private key of the sender
 */
export async function claimInterest(senderKey: string): Promise<string> {
  const txOptions = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'claim-interest',
    functionArgs: [],
    senderKey,
    network,
    anchorMode: AnchorMode.Any,
    postConditionMode: PostConditionMode.Deny,
  };

  const transaction = await makeContractCall(txOptions);
  const broadcastResponse = await broadcastTransaction(transaction, network);

  if (broadcastResponse.error) {
    throw new Error(`Transaction failed: ${broadcastResponse.error}`);
  }

  console.log(`Claim interest transaction broadcast: ${broadcastResponse.txid}`);
  return broadcastResponse.txid;
}

/**
 * Get user savings information (read-only)
 * @param userAddress - Principal address of the user
 */
export async function getUserSavings(userAddress: string) {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-user-savings',
    functionArgs: [standardPrincipalCV(userAddress)],
    network,
    senderAddress: userAddress,
  };

  const result = await callReadOnlyFunction(options);
  return cvToValue(result);
}

/**
 * Calculate pending interest (read-only)
 * @param userAddress - Principal address of the user
 */
export async function calculateInterest(userAddress: string): Promise<number> {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'calculate-interest',
    functionArgs: [standardPrincipalCV(userAddress)],
    network,
    senderAddress: userAddress,
  };

  const result = await callReadOnlyFunction(options);
  const value = cvToValue(result);
  return value.value;
}

/**
 * Check if user can withdraw (read-only)
 * @param userAddress - Principal address of the user
 */
export async function canWithdraw(userAddress: string): Promise<boolean> {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'can-withdraw',
    functionArgs: [standardPrincipalCV(userAddress)],
    network,
    senderAddress: userAddress,
  };

  const result = await callReadOnlyFunction(options);
  const value = cvToValue(result);
  return value.value;
}

/**
 * Get unlock block height (read-only)
 * @param userAddress - Principal address of the user
 */
export async function getUnlockBlock(userAddress: string): Promise<number> {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-unlock-block',
    functionArgs: [standardPrincipalCV(userAddress)],
    network,
    senderAddress: userAddress,
  };

  const result = await callReadOnlyFunction(options);
  const value = cvToValue(result);
  return value.value;
}

/**
 * Get contract configuration (read-only)
 */
export async function getContractConfig() {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-contract-config',
    functionArgs: [],
    network,
    senderAddress: CONTRACT_ADDRESS,
  };

  const result = await callReadOnlyFunction(options);
  return cvToValue(result);
}

/**
 * Get total value locked (read-only)
 */
export async function getTVL(): Promise<number> {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-tvl',
    functionArgs: [],
    network,
    senderAddress: CONTRACT_ADDRESS,
  };

  const result = await callReadOnlyFunction(options);
  const value = cvToValue(result);
  return value.value;
}

/**
 * Get user statistics (read-only)
 * @param userAddress - Principal address of the user
 */
export async function getUserStats(userAddress: string) {
  const options = {
    contractAddress: CONTRACT_ADDRESS,
    contractName: CONTRACT_NAME,
    functionName: 'get-user-stats',
    functionArgs: [standardPrincipalCV(userAddress)],
    network,
    senderAddress: userAddress,
  };

  const result = await callReadOnlyFunction(options);
  return cvToValue(result);
}

// Helper functions

/**
 * Convert STX to microSTX
 */
export function stxToMicroStx(stx: number): number {
  return stx * 1_000_000;
}

/**
 * Convert microSTX to STX
 */
export function microStxToStx(microStx: number): number {
  return microStx / 1_000_000;
}

/**
 * Convert days to blocks (approximately)
 */
export function daysToBlocks(days: number): number {
  return Math.floor(days * 144);
}

/**
 * Convert blocks to days (approximately)
 */
export function blocksToDays(blocks: number): number {
  return blocks / 144;
}

// Example usage
async function example() {
  const senderKey = 'your-private-key-here';
  const userAddress = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';

  try {
    // Deposit 10 STX for 30 days
    const depositAmount = stxToMicroStx(10);
    const lockPeriod = daysToBlocks(30);
    const depositTxId = await deposit(senderKey, depositAmount, lockPeriod);
    console.log('Deposit successful:', depositTxId);

    // Wait for transaction confirmation, then check savings
    const savings = await getUserSavings(userAddress);
    console.log('Current savings:', savings);

    // Calculate pending interest
    const interest = await calculateInterest(userAddress);
    console.log('Pending interest:', microStxToStx(interest), 'STX');

    // Check if can withdraw
    const withdrawable = await canWithdraw(userAddress);
    console.log('Can withdraw:', withdrawable);

    // Get contract stats
    const config = await getContractConfig();
    console.log('Contract config:', config);

    const tvl = await getTVL();
    console.log('Total Value Locked:', microStxToStx(tvl), 'STX');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Export all functions
export default {
  deposit,
  withdraw,
  emergencyWithdraw,
  claimInterest,
  getUserSavings,
  calculateInterest,
  canWithdraw,
  getUnlockBlock,
  getContractConfig,
  getTVL,
  getUserStats,
  stxToMicroStx,
  microStxToStx,
  daysToBlocks,
  blocksToDays,
};
