import { getContract } from 'viem';
import { publicClient, getWalletClient } from './viem';
import ClarityChainABI from '../../abis/ClarityChain.json';

export const CONTRACT_ADDRESS = '0xc88bc54dd0186bf954e3bb9f3b8be32dfd6a46b6' as `0x${string}`;
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
