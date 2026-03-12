"use client";

import React, { useEffect, useState } from "react";
import { formatEther, parseEther } from "viem";
import ApplyForVerification from "../components/ApplyForVerification";
import AssociateVendor from "../components/AssociateVendor";
import { CloseButton } from "../components/CloseButton";
import NavigationBar from "../components/NavigationBar";
import WithdrawToVendor from "../components/WithdrawToVendor";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { getWalletClient, publicClient } from "../utils/viem";

interface Campaign {
  id: number;
  name: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  withdrawnAmount: bigint;
  active: boolean;
}

type ModalState =
  | { type: "none" }
  | { type: "create" }
  | { type: "verify" }
  | { type: "campaign"; campaign: Campaign };

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CampaignStatusBadge({ campaign }: { campaign: Campaign }) {
  const completed = campaign.raisedAmount >= campaign.goalAmount;
  return completed ? (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 shrink-0">
      ✅ Completed
    </span>
  ) : (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900 text-green-400 shrink-0">
      🟢 Active
    </span>
  );
}

function ProgressBar({ raised, goal }: { raised: bigint; goal: bigint }) {
  const pct = goal > 0n ? Math.min(100, Number((raised * 100n) / goal)) : 0;
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div
        className={`h-1.5 rounded-full transition-all ${pct >= 100 ? "bg-teal-500" : "bg-pink-500"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create Campaign Form
// ---------------------------------------------------------------------------

const CreateCampaignForm: React.FC<{ onSuccess: () => void; onCancel: () => void }> = ({
  onSuccess,
  onCancel,
}) => {
  const [name, setName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { setStatus({ type: "error", message: "Campaign name cannot be empty." }); return; }
    if (!goalAmount || isNaN(Number(goalAmount)) || Number(goalAmount) <= 0) {
      setStatus({ type: "error", message: "Enter a valid goal amount." }); return;
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
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ type: "success", message: "Campaign created!" });
      setTimeout(onSuccess, 800);
    } catch (err: any) {
      setStatus({ type: "error", message: err.message || "Failed to create campaign." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Create a Campaign</h2>
      <p className="text-sm text-gray-400">
        Your wallet becomes the NGO for this campaign. You can only withdraw funds
        to associated, whitelisted vendors.
      </p>

      {status.message && (
        <div className={`text-sm p-3 rounded-lg break-words ${
          status.type === "error" ? "bg-red-900 text-red-300"
          : status.type === "success" ? "bg-green-900 text-green-300"
          : "bg-blue-900 text-blue-300"
        }`}>
          {status.message}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Campaign Name</label>
          <input
            type="text"
            placeholder="e.g., Typhoon Relief Fund"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSubmitting}
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
            disabled={isSubmitting}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 border border-gray-600 text-gray-300 hover:text-white font-semibold py-3 rounded-lg transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting}
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating..." : "Create Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({
  onClose,
  children,
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
    onClick={onClose}
  >
    <div
      className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl scrollbar scrollbar-thumb-gray-800 scrollbar-hover:scrollbar-thumb-gray-700"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Campaign Detail (inside modal when card clicked)
// ---------------------------------------------------------------------------

const CampaignDetail: React.FC<{ campaign: Campaign; onClose: () => void }> = ({
  campaign: initialCampaign,
  onClose,
}) => {
  const [campaign, setCampaign] = React.useState<Campaign>(initialCampaign);
  const [vendorRefreshKey, setVendorRefreshKey] = React.useState(0);

  // Re-fetch this campaign's live data from the contract
  const refreshCampaign = React.useCallback(async () => {
    try {
      const result = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getCampaign",
        args: [BigInt(initialCampaign.id)],
      }) as [string, string, bigint, bigint, bigint, boolean, boolean];
      setCampaign({
        id: initialCampaign.id,
        name: result[0],
        goalAmount: result[2],
        raisedAmount: result[3],
        withdrawnAmount: result[4],
        active: result[5],
      });
    } catch { /* silently keep showing last known values */ }
  }, [initialCampaign.id]);

  const handleAction = () => {
    setVendorRefreshKey((k) => k + 1);
    refreshCampaign();
  };

  return (
  <div className="space-y-6">
    <div className="flex justify-between items-start">
      <div>
        <h2 className="text-xl font-bold text-white">{campaign.name}</h2>
        <p className="text-xs text-gray-500 mt-0.5">Campaign #{campaign.id}</p>
      </div>
      <div className="flex items-center gap-2">
        <CampaignStatusBadge campaign={campaign} />
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white text-xl leading-none ml-1"
        >
          ✕
        </button>
      </div>
    </div>

    {/* Stats */}
    <div className="rounded-lg bg-gray-800 border border-gray-700 p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-400">Goal</span>
        <span className="text-white font-medium">{formatEther(campaign.goalAmount)} PAS</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Raised</span>
        <span className="text-white font-medium">{formatEther(campaign.raisedAmount)} PAS</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Withdrawn</span>
        <span className="text-white font-medium">{formatEther(campaign.withdrawnAmount)} PAS</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-400">Available to withdraw</span>
        <span className="text-green-400 font-semibold">
          {formatEther(campaign.raisedAmount - campaign.withdrawnAmount)} PAS
        </span>
      </div>
      <div className="pt-1">
        <ProgressBar raised={campaign.raisedAmount} goal={campaign.goalAmount} />
        <p className="text-xs text-gray-600 mt-1 text-right">
          {campaign.goalAmount > 0n
            ? Math.min(100, Number((campaign.raisedAmount * 100n) / campaign.goalAmount))
            : 0}% funded
        </p>
      </div>
    </div>

    {/* Associate Vendor */}
    <div>
      <p className="text-xs font-semibold text-pink-400 uppercase tracking-widest mb-3">
        Associate a Vendor
      </p>
      <AssociateVendor
        preselectedCampaignId={campaign.id}
        preselectedCampaignName={campaign.name}
        onSuccess={handleAction}
      />
    </div>

    {/* Withdraw to Vendor */}
    <div>
      <p className="text-xs font-semibold text-pink-400 uppercase tracking-widest mb-3">
        Withdraw to Vendor
      </p>
      <WithdrawToVendor
        preselectedCampaignId={campaign.id}
        preselectedCampaignName={campaign.name}
        vendorRefreshKey={vendorRefreshKey}
        onSuccess={handleAction}
      />
    </div>
  </div>
  );
};

// ---------------------------------------------------------------------------
// Campaign Card
// ---------------------------------------------------------------------------

const CampaignCard: React.FC<{ campaign: Campaign; onClick: () => void }> = ({
  campaign,
  onClick,
}) => {
  const pct =
    campaign.goalAmount > 0n
      ? Math.min(100, Number((campaign.raisedAmount * 100n) / campaign.goalAmount))
      : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-700 bg-gray-900 hover:border-pink-500 hover:bg-gray-800 transition p-4 space-y-3 group"
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white group-hover:text-pink-300 transition truncate">
            {campaign.name}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Campaign #{campaign.id}</p>
        </div>
        <CampaignStatusBadge campaign={campaign} />
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>
            {formatEther(campaign.raisedAmount)} / {formatEther(campaign.goalAmount)} PAS raised
          </span>
          <span>{pct}%</span>
        </div>
        <ProgressBar raised={campaign.raisedAmount} goal={campaign.goalAmount} />
      </div>

      <p className="text-xs text-gray-600 group-hover:text-gray-500 transition">
        Click to manage vendors and withdrawals →
      </p>
    </button>
  );
};

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

const MyCampaignsPage: React.FC = () => {
  const {myCampaigns, loading, fetchCampaigns} = useCampaign();
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [filter, setFilter] = useState<"active" | "completed">("active");
  const { account } = useAuth();

  // Clear modal and filter on wallet switch
  useEffect(() => { setModal({ type: "none" }); setFilter("active"); }, [account]);

  return (
    <>
      <NavigationBar activeTab="ngo" />

      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">My Campaigns</h1>
            <p className="text-sm text-gray-400 mt-1">
              Campaigns where your wallet is the NGO.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setModal({ type: "verify" })}
              className="px-4 py-2 rounded-lg border border-cyan-600 text-cyan-400 hover:bg-cyan-900/30 text-sm font-semibold transition"
            >
              ✓ Get Verified
            </button>
            <button
              onClick={() => setModal({ type: "create" })}
              className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition"
            >
              + Create Campaign
            </button>
          </div>
        </div>

        {/* Campaign list */}
        {!account ? (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
            <p className="text-gray-500">Connect your wallet to see your campaigns.</p>
          </div>
        ) : loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-24" />
            ))}
          </div>
        ) : myCampaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-12 text-center space-y-3">
            <p className="text-gray-400">You haven't created any campaigns yet.</p>
            <button
              onClick={() => setModal({ type: "create" })}
              className="px-5 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition"
            >
              + Create your first campaign
            </button>
          </div>
        ) : (
          <>
            {/* Filter toggle */}
            {(() => {
              const active = myCampaigns.filter(c => c.raisedAmount < c.goalAmount);
              const completed = myCampaigns.filter(c => c.raisedAmount >= c.goalAmount);
              const filtered = filter === "active" ? active : completed;
              return (
                <>
                  <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm mb-4 w-fit">
                    <button
                      onClick={() => setFilter("active")}
                      className={`px-4 py-1.5 font-medium transition ${filter === "active" ? "bg-green-800 text-green-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                    >
                      🟢 Active <span className="ml-1 text-xs opacity-70">({active.length})</span>
                    </button>
                    <button
                      onClick={() => setFilter("completed")}
                      className={`px-4 py-1.5 font-medium transition ${filter === "completed" ? "bg-teal-800 text-teal-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
                    >
                      ✅ Completed <span className="ml-1 text-xs opacity-70">({completed.length})</span>
                    </button>
                  </div>
                  {filtered.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-10 text-center">
                      <p className="text-gray-500 text-sm">No {filter} campaigns.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filtered.map((c) => (
                        <CampaignCard
                          key={c.id}
                          campaign={c}
                          onClick={() => setModal({ type: "campaign", campaign: c })}
                        />
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </div>

      {/* Create Campaign modal */}
      {modal.type === "create" && (
        <ModalOverlay onClose={() => setModal({ type: "none" })}>
          <CreateCampaignForm
            onSuccess={() => { setModal({ type: "none" }); fetchCampaigns(); }}
            onCancel={() => setModal({ type: "none" })}
          />
        </ModalOverlay>
      )}

      {/* Get Verified modal */}
      {modal.type === "verify" && (
        <ModalOverlay onClose={() => setModal({ type: "none" })}>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Identity Verification</h2>
              <CloseButton onClick={() => setModal({ type: "none" })} />
            </div>
            <ApplyForVerification key={account ?? "none"} />
          </div>
        </ModalOverlay>
      )}

      {/* Campaign detail modal */}
      {modal.type === "campaign" && (
        <ModalOverlay onClose={() => setModal({ type: "none" })}>
          <CampaignDetail
            campaign={modal.campaign}
            onClose={() => setModal({ type: "none" })}
          />
        </ModalOverlay>
      )}
    </>
  );
};

export default MyCampaignsPage;