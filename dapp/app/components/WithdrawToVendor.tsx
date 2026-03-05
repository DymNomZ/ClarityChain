"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseEther, formatEther } from "viem";
import { useAuth } from "../contexts/AuthContext";

interface Campaign {
  id: number;
  name: string;
  ngo: string;
  available: bigint;
  active: boolean;
}

const WithdrawToVendor: React.FC = () => {
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<number | "">("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [isVendorWhitelisted, setIsVendorWhitelisted] = useState<boolean | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({
    type: null,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { account } = useAuth();

  // Fetch only campaigns owned by the connected wallet
  useEffect(() => {
    const fetchMyCampaigns = async () => {
      if (!account) return;
      try {
        const count = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "campaignCount",
        }) as bigint;

        const mine: Campaign[] = [];
        for (let i = 0; i < Number(count); i++) {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "getCampaign",
            args: [BigInt(i)],
          }) as [string, string, bigint, bigint, bigint, boolean];

          if (result[1].toLowerCase() === account.toLowerCase() && result[5]) {
            mine.push({
              id: i,
              name: result[0],
              ngo: result[1],
              available: result[3] - result[4],
              active: result[5],
            });
          }
        }
        setMyCampaigns(mine);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      }
    };
    fetchMyCampaigns();
  }, [account]);

  // Live vendor whitelist check as the user types
  useEffect(() => {
    const checkVendor = async () => {
      if (!vendorAddress || vendorAddress.length !== 42 || !vendorAddress.startsWith("0x")) {
        setIsVendorWhitelisted(null);
        setVendorName("");
        return;
      }
      try {
        const isWhitelisted = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "isVendorWhitelisted",
          args: [vendorAddress as `0x${string}`],
        }) as boolean;
        setIsVendorWhitelisted(isWhitelisted);

        if (isWhitelisted) {
          const name = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "vendorNames",
            args: [vendorAddress as `0x${string}`],
          }) as string;
          setVendorName(name);
        } else {
          setVendorName("");
        }
      } catch {
        setIsVendorWhitelisted(null);
      }
    };
    checkVendor();
  }, [vendorAddress]);

  const handleWithdraw = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (selectedCampaign === "") {
      setStatus({ type: "error", message: "Select a campaign." });
      return;
    }
    if (!vendorAddress || vendorAddress.length !== 42) {
      setStatus({ type: "error", message: "Enter a valid vendor address." });
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setStatus({ type: "error", message: "Enter a valid amount." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm the transaction in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      // simulateContract will REVERT here if vendor is not whitelisted.
      // This is the rejection moment for the demo.
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "withdrawToVendor",
        args: [
          BigInt(selectedCampaign),
          vendorAddress as `0x${string}`,
          parseEther(amount),
        ],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus({
        type: "success",
        message: `✅ Withdrawal confirmed! ${amount} PAS sent to ${vendorName || vendorAddress.slice(0, 10)}... | Tx: ${receipt.transactionHash.slice(0, 20)}...`,
      });
      setAmount("");
      setVendorAddress("");
    } catch (err: any) {
      // Surface the contract's revert reason clearly for the demo
      const msg = err.message || "";
      if (msg.includes("Vendor not whitelisted")) {
        setStatus({
          type: "error",
          message: "🚫 REJECTED BY CONTRACT: Vendor not whitelisted — this is ClarityChain working exactly as designed.",
        });
      } else {
        setStatus({ type: "error", message: err.message || "Withdrawal failed." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-white">Withdraw to Vendor</h2>
      <p className="text-sm text-gray-400">
        As an NGO, you can only send funds to whitelisted vendors.
        Attempts to withdraw to any other address will be rejected on-chain.
      </p>

      {status.message && (
        <div
          className={`text-sm p-3 rounded-lg break-words ${
            status.type === "error"
              ? "bg-red-900 text-red-300 font-semibold"
              : status.type === "success"
              ? "bg-green-900 text-green-300"
              : "bg-blue-900 text-blue-300"
          }`}
        >
          {status.message}
        </div>
      )}

      {!account ? (
        <p className="text-gray-500 text-sm">Connect your wallet to manage withdrawals.</p>
      ) : myCampaigns.length === 0 ? (
        <p className="text-gray-500 text-sm">
          You have no active campaigns. Create one in the NGO Dashboard tab.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Campaign selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Select Your Campaign</label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-pink-500"
            >
              <option value="">-- Select a campaign --</option>
              {myCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatEther(c.available)} PAS available)
                </option>
              ))}
            </select>
          </div>

          {/* Vendor address with live whitelist check */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor Wallet Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={vendorAddress}
              onChange={(e) => setVendorAddress(e.target.value.trim())}
              disabled={isSubmitting}
              className={`w-full p-3 rounded-lg bg-gray-800 border text-white placeholder-gray-500 focus:outline-none ${
                isVendorWhitelisted === true
                  ? "border-green-500"
                  : isVendorWhitelisted === false
                  ? "border-red-500"
                  : "border-gray-600 focus:border-pink-500"
              }`}
            />
            {/* Live feedback under the input — this is powerful for the demo */}
            {isVendorWhitelisted === true && (
              <p className="text-green-400 text-xs mt-1">✅ Whitelisted vendor: {vendorName}</p>
            )}
            {isVendorWhitelisted === false && (
              <p className="text-red-400 text-xs mt-1">
                🚫 Not whitelisted — withdrawal will be REJECTED by the contract
              </p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Amount (PAS)</label>
            <input
              type="number"
              placeholder="e.g., 1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
          </div>

          <button
            onClick={handleWithdraw}
            disabled={isSubmitting}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Processing..." : "Withdraw to Vendor"}
          </button>
        </div>
      )}
    </div>
  );
};

export default WithdrawToVendor;
