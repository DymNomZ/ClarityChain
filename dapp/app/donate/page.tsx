"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient, polkadotTestnet } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { parseEther, formatEther } from "viem";
import { useAuth } from "../contexts/AuthContext";
import NavigationBar from "../components/NavigationBar";

interface Campaign {
  id: number;
  name: string;
  ngo: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  withdrawnAmount: bigint;
  active: boolean;
  refundsEnabled: boolean;
}

const CampaignSkeleton = () => (
  <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-4 animate-pulse">
    <div className="flex justify-between">
      <div className="space-y-2">
        <div className="h-5 w-48 bg-gray-700 rounded" />
        <div className="h-3 w-72 bg-gray-800 rounded" />
      </div>
      <div className="h-6 w-16 bg-gray-700 rounded-full" />
    </div>
    <div className="space-y-1">
      <div className="flex justify-between">
        <div className="h-3 w-32 bg-gray-800 rounded" />
        <div className="h-3 w-24 bg-gray-800 rounded" />
      </div>
      <div className="h-2 w-full bg-gray-700 rounded-full" />
    </div>
  </div>
);

const CampaignList: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [donationAmounts, setDonationAmounts] = useState<Record<number, string>>({});
  const [status, setStatus] = useState<Record<number, { type: string; message: string }>>({});
  const [submitting, setSubmitting] = useState<Record<number, boolean>>({});
  const { account } = useAuth();

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "campaignCount",
      })) as bigint;

      const fetched: Campaign[] = [];
      for (let i = 0; i < Number(count); i++) {
        // getCampaign now returns 7 fields — refundsEnabled added at index [6]
        const result = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getCampaign",
          args: [BigInt(i)],
        })) as [string, string, bigint, bigint, bigint, boolean, boolean];

        fetched.push({
          id: i,
          name: result[0],
          ngo: result[1],
          goalAmount: result[2],
          raisedAmount: result[3],
          withdrawnAmount: result[4],
          active: result[5],
          refundsEnabled: result[6],
        });
      }
      setCampaigns(fetched);
    } catch (err) {
      console.error("Failed to fetch campaigns:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleDonate = async (campaignId: number) => {
    if (!account) {
      setStatus({ ...status, [campaignId]: { type: "error", message: "Connect your wallet first." } });
      return;
    }
    const amount = donationAmounts[campaignId];
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setStatus({ ...status, [campaignId]: { type: "error", message: "Enter a valid donation amount." } });
      return;
    }

    try {
      setSubmitting({ ...submitting, [campaignId]: true });
      setStatus({ ...status, [campaignId]: { type: "info", message: "Confirm in your wallet..." } });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const walletChainId = await walletClient.getChainId();
      if (walletChainId !== polkadotTestnet.id) {
        setStatus({ ...status, [campaignId]: { type: "error", message: "Please switch MetaMask to Polkadot Hub TestNet before donating." } });
        return;
      }

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "donate",
        args: [BigInt(campaignId)],
        value: parseEther(amount),
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ ...status, [campaignId]: { type: "info", message: "Waiting for confirmation..." } });

      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ ...status, [campaignId]: { type: "success", message: `Donated ${amount} PAS! Tx: ${hash.slice(0, 18)}...` } });
      setDonationAmounts({ ...donationAmounts, [campaignId]: "" });
      fetchCampaigns();
    } catch (err: any) {
      setStatus({ ...status, [campaignId]: { type: "error", message: parseContractError(err) } });
    } finally {
      setSubmitting({ ...submitting, [campaignId]: false });
    }
  };

  const getProgressPercent = (raised: bigint, goal: bigint) => {
    if (goal === 0n) return 0;
    return Math.min(100, Number((raised * 100n) / goal));
  };

  const getCampaignStatusLabel = (campaign: Campaign) => {
    if (campaign.refundsEnabled) return { label: "Refunding", classes: "bg-yellow-900 text-yellow-300" };
    if (!campaign.active) return { label: "Closed", classes: "bg-gray-700 text-gray-400" };
    return { label: "Active", classes: "bg-green-900 text-green-300" };
  };

  if (loading) {
    return <>
      <NavigationBar activeTab="donate" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Campaigns</h2>
          </div>
          <CampaignSkeleton />
          <CampaignSkeleton />
        </div>
      </div>
    </>;
  }

  if (campaigns.length === 0) {
    return <>
      <NavigationBar activeTab="donate" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
          <p className="text-gray-400 text-lg">No campaigns yet.</p>
          <p className="text-gray-600 text-sm mt-2">NGOs can create one in the NGO Dashboard tab.</p>
        </div>
      </div>
    </>;
  }

  return <>
    <NavigationBar activeTab="donate" />
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Campaigns</h2>
          <button onClick={fetchCampaigns} className="text-sm text-pink-400 hover:text-pink-300 transition">
            ↻ Refresh
          </button>
        </div>

        {campaigns.map((campaign) => {
          const statusLabel = getCampaignStatusLabel(campaign);
          return (
            <div
              key={campaign.id}
              className={`rounded-xl border p-5 space-y-4 ${
                campaign.active ? "border-pink-500 bg-gray-900" : "border-gray-600 bg-gray-800 opacity-60"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">{campaign.name}</h3>
                  <p className="text-xs text-gray-400 mt-1 break-all">NGO: {campaign.ngo}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ml-2 ${statusLabel.classes}`}>
                  {statusLabel.label}
                </span>
              </div>

              <div>
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                  <span>{formatEther(campaign.raisedAmount)} PAS raised</span>
                  <span>Goal: {formatEther(campaign.goalAmount)} PAS</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-pink-500 h-2 rounded-full transition-all"
                    style={{ width: `${getProgressPercent(campaign.raisedAmount, campaign.goalAmount)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Available: {formatEther(campaign.raisedAmount - campaign.withdrawnAmount)} PAS
                </p>
              </div>

              {/* Refund notice */}
              {campaign.refundsEnabled && (
                <div className="rounded-lg bg-yellow-900/40 border border-yellow-700 px-3 py-2 text-xs text-yellow-300">
                  ⚠️ This campaign has been closed by the NGO and refunds are enabled. Contact the NGO if you donated and need to claim your refund.
                </div>
              )}

              {/* Donate form — only for active campaigns */}
              {campaign.active && (
                <div className="space-y-2">
                  {status[campaign.id]?.message && (
                    <div className={`text-sm p-2 rounded-md ${
                      status[campaign.id].type === "error" ? "bg-red-900 text-red-300"
                      : status[campaign.id].type === "success" ? "bg-green-900 text-green-300"
                      : "bg-blue-900 text-blue-300"
                    }`}>
                      {status[campaign.id].message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Amount (PAS)"
                      value={donationAmounts[campaign.id] || ""}
                      onChange={(e) => setDonationAmounts({ ...donationAmounts, [campaign.id]: e.target.value })}
                      disabled={submitting[campaign.id] || !account}
                      className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                    />
                    <button
                      onClick={() => handleDonate(campaign.id)}
                      disabled={submitting[campaign.id] || !account}
                      className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {submitting[campaign.id] ? "..." : "Donate"}
                    </button>
                  </div>
                  {!account && <p className="text-xs text-gray-500">Connect your wallet to donate.</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  </>;
};

export default CampaignList;