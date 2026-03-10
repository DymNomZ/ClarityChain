"use client";

import React, { useState } from "react";
import CampaignCard from "../components/CampaignCard";
import CampaignModal from "../components/CampaignModal";
import CampaignSkeleton from "../components/CampaignSkeleton";
import NavigationBar from "../components/NavigationBar";
import RefreshButton from "../components/RefreshButton";
import { useCampaign } from "../contexts/CampaignContext";

const CampaignList: React.FC = () => {
  const [campaignModal, setCampaignModal] = useState<Campaign | null>(null)
  const {campaigns, loading, fetchCampaigns} = useCampaign();
  const [filter, setFilter] = useState<"active" | "completed">("active");

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

  const activeCampaigns = campaigns.filter(c => c.raisedAmount < c.goalAmount);
  const completedCampaigns = campaigns.filter(c => c.raisedAmount >= c.goalAmount);
  const filteredCampaigns = filter === "active" ? activeCampaigns : completedCampaigns;

  return <>
    <NavigationBar activeTab="donate" />
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white">Donate to a cause</h2>
              <p className="text-sm text-gray-400 mt-1">Support campaigns tracked transparently on-chain.</p>
            </div>
            <RefreshButton onClick={fetchCampaigns} className="shrink-0 mt-1" />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm w-fit">
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-1.5 font-medium transition ${filter === "active" ? "bg-green-800 text-green-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              🟢 Active <span className="ml-1 text-xs opacity-70">({activeCampaigns.length})</span>
            </button>
            <button
              onClick={() => setFilter("completed")}
              className={`px-4 py-1.5 font-medium transition ${filter === "completed" ? "bg-teal-800 text-teal-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
            >
              ✅ Completed <span className="ml-1 text-xs opacity-70">({completedCampaigns.length})</span>
            </button>
          </div>
        </div>

        {filteredCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} setCampaignModal={setCampaignModal} />
        ))}
      </div>
    </div>
    <CampaignModal campaign={campaignModal} setCampaign={setCampaignModal} />
  </>;
};

export default CampaignList;