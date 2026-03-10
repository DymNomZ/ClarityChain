"use client";

import React, { useEffect, useState } from "react";
import CampaignCard from "../components/CampaignCard";
import CampaignModal from "../components/CampaignModal";
import CampaignSkeleton from "../components/CampaignSkeleton";
import NavigationBar from "../components/NavigationBar";
import RefreshButton from "../components/RefreshButton";
import { useCampaign } from "../contexts/CampaignContext";

const CampaignList: React.FC = () => {
  const [campaignModal, setCampaignModal] = useState<Campaign | null>(null)
  const {campaigns, loading, fetchCampaigns} = useCampaign();
  const [query, setQuery] = useState("");
  const [queriedCampaigns, setQueriedCampaigns] = useState<Campaign[]>(campaigns);
  const [filter, setFilter] = useState<"active" | "completed">("active");

  const activeCampaigns = campaigns.filter(c => c.raisedAmount < c.goalAmount);
  const completedCampaigns = campaigns.filter(c => c.raisedAmount >= c.goalAmount);

  useEffect(() => {
    const filteredCampaigns = filter === "active" ? activeCampaigns : completedCampaigns;

    if (query.trim() === "") {
      setQueriedCampaigns(filteredCampaigns);
    } else {
      const lowerQuery = query.toLowerCase();
      setQueriedCampaigns(filteredCampaigns.filter(c => c.name.toLowerCase().includes(lowerQuery) || c.ngo.toLowerCase().includes(lowerQuery)));
    }
  }, [query, campaigns, filter]);

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
        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-white">Donate to a cause</h2>
              <p className="text-sm text-gray-400 mt-1">Support campaigns tracked transparently on-chain.</p>
            </div>
            <RefreshButton onClick={fetchCampaigns} className="shrink-0 mt-1" />
          </div>
          <div className="grid grid-cols-4">
            <div className="col-span-2 flex rounded-lg overflow-hidden border border-gray-700 text-sm w-fit">
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
            <input
              type="text"
              placeholder="🔍 Search campaigns"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="col-span-1 col-start-4 rounded-lg px-3 py-2 bg-gray-800 border border-gray-700 text-gray-400 placeholder:text-gray-500 focus:ring-1 focus:ring-pink-500 focus:outline-none"
            />
          </div>
        </div>
        {queriedCampaigns.map((campaign) => (
          <CampaignCard key={campaign.id} campaign={campaign} setCampaignModal={setCampaignModal} />
        ))}
      </div>
    </div>
    <CampaignModal campaign={campaignModal} setCampaign={setCampaignModal} />
  </>;
};

export default CampaignList;