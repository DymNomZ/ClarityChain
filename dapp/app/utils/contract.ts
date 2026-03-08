import { getContract } from 'viem';
import { publicClient, getWalletClient } from './viem';
import ClarityChainABI from '../../abis/ClarityChain.json';

export const CONTRACT_ADDRESS = '0xbf0a89253c1f590dcb25a4e5b7ef4b7ef691d585' as `0x${string}`;
export const CONTRACT_ABI = ClarityChainABI.abi;

// Create a function to get a contract instance for reading
export const getContractInstance = () => {
  return getContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    client: publicClient,
  });
};

// Create a function to get a contract instance with a signer for writing
export const getSignedContract = async () => {
  const walletClient = await getWalletClient();
  return getContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    client: walletClient,
  });
};
