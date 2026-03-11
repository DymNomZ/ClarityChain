"use client";

// =============================================================================
// WalletConnect.tsx
// Issue #11 — Added MetaMask event listeners for accountsChanged and
// chainChanged so the app reacts cleanly when the user switches wallets
// or networks mid-session.
// =============================================================================

import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { polkadotTestnet } from "../utils/viem";

const WalletConnect: React.FC = () => {
  const { account, setAccount } = useAuth()
  const [chainId, setChainId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);

  // ---------------------------------------------------------------------------
  // Issue #11: Listen for MetaMask account and network changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const ethereum = window.ethereum;
    if (!ethereum) return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        // User disconnected all accounts
        setAccount(null);
      } else {
        const newAccount = accounts[0];
        setAccount(newAccount);
      }
    };

    const handleChainChanged = () => {
      // Reload on network switch — safest approach to avoid stale state
      window.location.reload();
    };

    ethereum.on("accountsChanged", handleAccountsChanged);
    ethereum.on("chainChanged", handleChainChanged);

    // Cleanup listeners on unmount
    return () => {
      ethereum.removeListener("accountsChanged", handleAccountsChanged);
      ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [setAccount]);

  // ---------------------------------------------------------------------------
  // Check if already connected on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === "undefined" || !window.ethereum) return;
      try {
        const accounts = (await window.ethereum.request({
          method: "eth_accounts",
        })) as string[];

        if (accounts.length > 0) {
          setAccount(accounts[0]);
          const chainIdHex = (await window.ethereum.request({
            method: "eth_chainId",
          })) as string;
          setChainId(parseInt(chainIdHex, 16));
        }
      } catch (err) {
        console.error("Error checking connection:", err);
      }
    };

    checkConnection();
  }, []);

  // ---------------------------------------------------------------------------
  // Connect wallet
  // ---------------------------------------------------------------------------
  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask not detected. Please install it first.");
      return;
    }

    try {
      setIsConnecting(true);
      setError("");

      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];

      const chainIdHex = (await window.ethereum.request({
        method: "eth_chainId",
      })) as string;
      const currentChainId = parseInt(chainIdHex, 16);

      setAccount(accounts[0]);
      setChainId(currentChainId);
    } catch (err: any) {
      if (err.code === 4001) {
        setError("Connection cancelled.");
      } else {
        setError("Failed to connect wallet. Try again.");
      }
    } finally {
      setIsConnecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Disconnect (clears local state — MetaMask doesn't have a true disconnect)
  // ---------------------------------------------------------------------------
  const disconnectWallet = () => {
    setAccount(null);
    setChainId(null);
  };

  // ---------------------------------------------------------------------------
  // Switch to correct network
  // ---------------------------------------------------------------------------
  const switchNetwork = async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${polkadotTestnet.id.toString(16)}` }],
      });
    } catch (err: any) {
      // Chain not added yet — add it
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${polkadotTestnet.id.toString(16)}`,
              chainName: polkadotTestnet.name,
              nativeCurrency: polkadotTestnet.nativeCurrency,
              rpcUrls: [polkadotTestnet.rpcUrls.default.http[0]],
            },
          ],
        });
      }
    }
  };

  const isWrongNetwork = chainId !== null && chainId !== polkadotTestnet.id;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="relative">
      {!account ? (
        <div className="space-y-1">
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed text-sm"
          >
            {isConnecting ? "Connecting..." : "Connect Wallet"}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="text-right space-y-1">
          <div className="text-xs text-gray-400">Connected</div>
          <div className="text-sm font-mono text-pink-400">
            {account.substring(0, 6)}...{account.substring(38)}
          </div>
          {isWrongNetwork && (
            <button
              onClick={switchNetwork}
              className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-2 py-1 rounded transition"
            >
              ⚠️ Switch to Polkadot Hub
            </button>
          )}
          <button
            onClick={disconnectWallet}
            className="block text-xs text-gray-500 hover:text-gray-300 transition"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletConnect;