"use client";

import React, { useState } from "react";
import WalletConnect from "./components/WalletConnect";
import CampaignList from "./components/CampaignList";
import CreateCampaign from "./components/CreateCampaign";
import WithdrawToVendor from "./components/WithdrawToVendor";
import VendorManagement from "./components/VendorManagement";
import TransactionFeed from "./components/TransactionFeed";

type Tab = "donate" | "ngo" | "vendors" | "feed";

export default function Home() {
  const [account, setAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("donate");

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "donate", label: "Donate", icon: "💰" },
    { id: "ngo", label: "NGO Dashboard", icon: "🏕️" },
    { id: "vendors", label: "Vendor Governance", icon: "🗳️" },
    { id: "feed", label: "Public Feed", icon: "📡" },
  ];

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Clarity<span className="text-pink-500">Chain</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Don't trust. Verify. — Built on Polkadot Hub
            </p>
          </div>
          <WalletConnect onConnect={setAccount} />
        </div>
      </header>

      {/* Tagline banner */}
      <div className="bg-pink-600 text-white text-center text-sm py-2 px-4">
        🔒 NGOs can <strong>only</strong> withdraw to whitelisted vendors. The contract enforces this. No exceptions.
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                  activeTab === tab.id
                    ? "border-pink-500 text-pink-400"
                    : "border-transparent text-gray-400 hover:text-gray-200"
                }`}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === "donate" && (
          <CampaignList account={account} />
        )}

        {activeTab === "ngo" && (
          <div className="space-y-8">
            <CreateCampaign account={account} />
            <WithdrawToVendor account={account} />
          </div>
        )}

        {activeTab === "vendors" && (
          <VendorManagement account={account} />
        )}

        {activeTab === "feed" && (
          <TransactionFeed />
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16 py-6 text-center text-xs text-gray-600">
        ClarityChain — Polkadot Solidity Hackathon 2026, Cebu Edition
        <br />
        Contract:{" "}
        <a
          href={`https://blockscout-testnet.polkadot.io/address/0xfa26ab4f40387ddaae9c338abbb9984678ce0c29`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pink-500 hover:text-pink-400"
        >
          0xfa26ab4f40387ddaae9c338abbb9984678ce0c29
        </a>
      </footer>
    </main>
  );
}
