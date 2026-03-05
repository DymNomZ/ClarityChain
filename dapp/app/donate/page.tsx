"use client";

// =============================================================================
// CampaignList.tsx
// Issue #9 — Improved loading skeleton, better error messages via
//            parseContractError, network check before donating.
// =============================================================================

import React, { useState, useEffect } from "react";
import { publicClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import NavigationBar from "../components/NavigationBar";
import CampaignCard from "../components/CampaignCard";
import CampaignModal from "../components/CampaignModal";

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
  const [campaignModal, setCampaignModal] = useState<Campaign | null>(null)

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
        const result = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getCampaign",
          args: [BigInt(i)],
        })) as [string, string, bigint, bigint, bigint, boolean];

        fetched.push({
          id: i,
          name: result[0],
          ngo: result[1],
          goalAmount: result[2],
          raisedAmount: result[3],
          withdrawnAmount: result[4],
          active: result[5],
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

  if (loading) {
    return <>
      <NavigationBar activeTab="donate" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
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
          <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
          <button onClick={fetchCampaigns} className="text-sm text-pink-400 hover:text-pink-300 transition">
            ↻ Refresh
          </button>
        </div>

        {campaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} fetchCampaigns={fetchCampaigns} setCampaignModal={setCampaignModal} />
        ))}
      </div>
    </div>
    <CampaignModal campaign={campaignModal} setCampaign={setCampaignModal} />
  </>;
};

export default CampaignList;