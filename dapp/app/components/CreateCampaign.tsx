"use client";

import React, { useState } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseEther } from "viem";

interface CreateCampaignProps {
  account: string | null;
}

const CreateCampaign: React.FC<CreateCampaignProps> = ({ account }) => {
  const [name, setName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({
    type: null,
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (!name.trim()) {
      setStatus({ type: "error", message: "Campaign name cannot be empty." });
      return;
    }
    if (!goalAmount || isNaN(Number(goalAmount)) || Number(goalAmount) <= 0) {
      setStatus({ type: "error", message: "Enter a valid goal amount." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm the transaction in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "createCampaign",
        args: [name.trim(), parseEther(goalAmount)],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setStatus({
        type: "success",
        message: `Campaign created! Tx: ${receipt.transactionHash.slice(0, 20)}...`,
      });
      setName("");
      setGoalAmount("");
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to create campaign." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg">
      <h2 className="text-xl font-bold text-white">Create a Campaign</h2>
      <p className="text-sm text-gray-400">
        Your wallet becomes the NGO for this campaign. You'll be the only one who can
        withdraw funds — but only to whitelisted vendors.
      </p>

      {status.message && (
        <div
          className={`text-sm p-3 rounded-lg break-words ${
            status.type === "error"
              ? "bg-red-900 text-red-300"
              : status.type === "success"
              ? "bg-green-900 text-green-300"
              : "bg-blue-900 text-blue-300"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Campaign Name</label>
          <input
            type="text"
            placeholder="e.g., Typhoon Odette Relief Fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting || !account}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Fundraising Goal (PAS)</label>
          <input
            type="number"
            placeholder="e.g., 10"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            disabled={isSubmitting || !account}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={isSubmitting || !account}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Creating..." : "Create Campaign"}
        </button>

        {!account && (
          <p className="text-xs text-gray-500 text-center">
            Connect your wallet to create a campaign.
          </p>
        )}
      </div>
    </div>
  );
};

export default CreateCampaign;
