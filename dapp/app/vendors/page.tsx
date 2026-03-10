"use client";

import React, { useEffect, useState } from "react";
import { formatEther } from "viem";
import IdentityProposals from "../components/IdentityProposals";
import NavigationBar from "../components/NavigationBar";
import RefreshButton from "../components/RefreshButton";
import { useAuth } from "../contexts/AuthContext";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { getWalletClient, publicClient } from "../utils/viem";

// =============================================================================
// Helpers
// =============================================================================

const DELIMITER = "|";
const REQUIRED_APPROVALS = 3;

function encodeVendorName(name: string, links: string[]): string {
  const validLinks = links.map((l) => l.trim()).filter((l) => l.length > 0);
  return validLinks.length > 0 ? `${name}${DELIMITER}${validLinks.join(DELIMITER)}` : name;
}

function decodeVendorName(encoded: string): { name: string; links: string[] } {
  const parts = encoded.split(DELIMITER);
  return { name: parts[0], links: parts.slice(1).filter((l) => l.startsWith("http")) };
}

// =============================================================================
// Types
// =============================================================================

interface Proposal {
  id: number;
  vendor: string;
  vendorName: string;
  displayName: string;
  links: string[];
  approvals: number;
  executed: boolean;
}

interface VendorCampaign {
  id: number;
  name: string;
  ngo: string;
  goalAmount: bigint;
  raisedAmount: bigint;
  cap: bigint;
  spent: bigint;
  instructions: string;
}

// =============================================================================
// Skeletons
// =============================================================================

const ProposalSkeleton = () => (
  <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-3 animate-pulse">
    <div className="flex justify-between">
      <div className="space-y-2">
        <div className="h-4 w-40 bg-gray-700 rounded" />
        <div className="h-3 w-64 bg-gray-800 rounded" />
      </div>
      <div className="h-6 w-20 bg-gray-700 rounded-full" />
    </div>
    <div className="h-2 w-full bg-gray-700 rounded-full" />
  </div>
);

const CampaignSkeleton = () => (
  <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 animate-pulse h-28" />
);

// =============================================================================
// Modal overlay
// =============================================================================

const ModalOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={onClose}>
    <div
      className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 shadow-2xl"
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  </div>
);

// =============================================================================
// Propose Vendor Form (in modal)
// =============================================================================

const ProposeVendorForm: React.FC<{ onSuccess: () => void; onCancel: () => void }> = ({ onSuccess, onCancel }) => {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [links, setLinks] = useState(["", "", ""]);
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { account } = useAuth();

  const handleLinkChange = (i: number, val: string) => {
    const updated = [...links]; updated[i] = val; setLinks(updated);
  };

  const handlePropose = async () => {
    if (!name.trim()) { setStatus({ type: "error", message: "Enter a vendor name." }); return; }
    if (!address || address.length !== 42 || !address.startsWith("0x")) {
      setStatus({ type: "error", message: "Enter a valid vendor wallet address (0x...)." }); return;
    }
    const filledLinks = links.map((l) => l.trim()).filter((l) => l.length > 0);
    if (filledLinks.length === 0) {
      setStatus({ type: "error", message: "At least one verification link is required." }); return;
    }
    for (const link of filledLinks) {
      if (!link.startsWith("https://") && !link.startsWith("http://")) {
        setStatus({ type: "error", message: "Links must start with https://" }); return;
      }
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm in your wallet..." });
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");
      const encoded = encodeVendorName(name.trim(), links);
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: "proposeVendor",
        args: [address as `0x${string}`, encoded],
        account: walletClient.account,
      });
      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus({ type: "success", message: "Vendor proposal submitted! Validators will review and sign." });
      setTimeout(onSuccess, 800);
    } catch (err: any) {
      setStatus({ type: "error", message: parseContractError(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Propose a Vendor</h2>
      <p className="text-sm text-gray-400">
        Anyone can submit a vendor for community review. Validators independently
        verify the submitted links and sign their approval. {REQUIRED_APPROVALS} signatures
        are required before a vendor can receive funds.
      </p>

      {status.message && (
        <div className={`text-sm p-3 rounded-lg break-words ${
          status.type === "error" ? "bg-red-900 text-red-300"
          : status.type === "success" ? "bg-green-900 text-green-300"
          : "bg-blue-900 text-blue-300"
        }`}>{status.message}</div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Vendor Name <span className="text-red-400">*</span></label>
          <input type="text" placeholder="e.g., Cebu Rice Supply Co."
            value={name} onChange={(e) => setName(e.target.value)} disabled={isSubmitting}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">Vendor Wallet Address <span className="text-red-400">*</span></label>
          <input type="text" placeholder="0x..."
            value={address} onChange={(e) => setAddress(e.target.value.trim())} disabled={isSubmitting}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm text-gray-400">
            Verification Links <span className="text-red-400">*</span>{" "}
            <span className="text-gray-600 text-xs">(at least one required)</span>
          </label>
          <p className="text-xs text-gray-600">DTI registration, Facebook business page, official website, etc.</p>
          {links.map((link, i) => (
            <input key={i} type="url"
              placeholder={i === 0 ? "https://  (required)" : "https://  (optional)"}
              value={link} onChange={(e) => handleLinkChange(i, e.target.value)} disabled={isSubmitting}
              className={`w-full p-3 rounded-lg bg-gray-800 border text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 text-sm ${i === 0 ? "border-gray-500" : "border-gray-700"}`}
            />
          ))}
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onCancel} disabled={isSubmitting}
            className="flex-1 border border-gray-600 text-gray-300 hover:text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handlePropose} disabled={isSubmitting}
            className="flex-1 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed">
            {isSubmitting ? "Proposing..." : "Propose Vendor"}
          </button>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// Vendor Campaign Card
// =============================================================================

const VendorCampaignCard: React.FC<{ vc: VendorCampaign }> = ({ vc }) => {
  const completed = vc.raisedAmount >= vc.goalAmount;
  const pct = vc.goalAmount > 0n ? Math.min(100, Number((vc.raisedAmount * 100n) / vc.goalAmount)) : 0;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-3">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate">{vc.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5 break-all">NGO: {vc.ngo}</p>
        </div>
        {completed ? (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-900 text-teal-300 shrink-0">✅ Completed</span>
        ) : (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-900 text-green-400 shrink-0">🟢 Active</span>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-gray-400">
          <span>{formatEther(vc.raisedAmount)} / {formatEther(vc.goalAmount)} PAS raised</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${completed ? "bg-teal-500" : "bg-pink-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Vendor-specific info */}
      <div className="rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-gray-400">Your cap</span>
          <span className="text-white font-medium">{formatEther(vc.cap)} PAS</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">PAS received</span>
          <span className="text-green-400 font-semibold">{formatEther(vc.spent)} PAS</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Remaining cap</span>
          <span className="text-white">{formatEther(vc.cap - vc.spent)} PAS</span>
        </div>
        {vc.instructions && (
          <div className="pt-1 border-t border-gray-700">
            <p className="text-gray-500 mb-0.5">Procurement instructions</p>
            <p className="text-gray-300 leading-relaxed">{vc.instructions}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main Page
// =============================================================================

const VendorManagement: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [isValidator, setIsValidator] = useState(false);
  const [isWhitelistedVendor, setIsWhitelistedVendor] = useState(false);
  const [vendorCampaigns, setVendorCampaigns] = useState<VendorCampaign[]>([]);
  const [loadingVendorCampaigns, setLoadingVendorCampaigns] = useState(false);
  const [vendorFilter, setVendorFilter] = useState<"active" | "completed">("active");
  const [approveStatus, setApproveStatus] = useState<Record<number, { type: string; message: string }>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [alreadySigned, setAlreadySigned] = useState<Record<number, boolean>>({});
  const [showProposeModal, setShowProposeModal] = useState(false);
  const { account } = useAuth();

  // -------------------------------------------------------------------------
  // Fetch helpers
  // -------------------------------------------------------------------------

  const checkRoles = async () => {
    if (!account) { setIsValidator(false); setIsWhitelistedVendor(false); return; }
    try {
      const validators = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "getValidators",
      }) as string[];
      setIsValidator(validators.some((v) => v.toLowerCase() === account.toLowerCase()));

      const whitelisted = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: "isVendorWhitelisted",
        args: [account as `0x${string}`],
      }) as boolean;
      setIsWhitelistedVendor(whitelisted);
    } catch { setIsValidator(false); setIsWhitelistedVendor(false); }
  };

  const fetchVendorCampaigns = async () => {
    if (!account) return;
    try {
      setLoadingVendorCampaigns(true);
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "campaignCount",
      }) as bigint;

      const results: VendorCampaign[] = [];
      for (let i = 0; i < Number(count); i++) {
        const cv = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
          functionName: "getCampaignVendor",
          args: [BigInt(i), account as `0x${string}`],
        }) as [bigint, bigint, string, boolean];

        if (!cv[3]) continue; // not associated

        const campaign = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
          functionName: "getCampaign",
          args: [BigInt(i)],
        }) as [string, string, bigint, bigint, bigint, boolean, boolean];

        results.push({
          id: i,
          name: campaign[0],
          ngo: campaign[1],
          goalAmount: campaign[2],
          raisedAmount: campaign[3],
          cap: cv[0],
          spent: cv[1],
          instructions: cv[2],
        });
      }
      setVendorCampaigns([...results].reverse());
    } catch (err) {
      console.error("Failed to fetch vendor campaigns:", err);
    } finally {
      setLoadingVendorCampaigns(false);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoadingProposals(true);
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: "proposalCount",
      }) as bigint;

      const fetched: Proposal[] = [];
      for (let i = 0; i < Number(count); i++) {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
          functionName: "getProposalStatus", args: [BigInt(i)],
        }) as [string, string, bigint, boolean];
        const { name: displayName, links } = decodeVendorName(result[1]);
        fetched.push({ id: i, vendor: result[0], vendorName: result[1], displayName, links, approvals: Number(result[2]), executed: result[3] });
      }
      setProposals([...fetched].reverse());
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
    } finally {
      setLoadingProposals(false);
    }
  };

  const checkAlreadySigned = async (fetchedProposals: Proposal[]) => {
    if (!account) return;
    const signed: Record<number, boolean> = {};
    for (const p of fetchedProposals) {
      if (p.executed) continue;
      try {
        signed[p.id] = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
          functionName: "proposalApprovals",
          args: [BigInt(p.id), account as `0x${string}`],
        }) as boolean;
      } catch { signed[p.id] = false; }
    }
    setAlreadySigned(signed);
  };

  const handleApprove = async (proposalId: number) => {
    try {
      setApprovingId(proposalId);
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "info", message: "Confirm in your wallet..." } });
      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS, abi: CONTRACT_ABI,
        functionName: "approveVendor", args: [BigInt(proposalId)],
        account: walletClient.account,
      });
      const hash = await walletClient.writeContract(request);
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "info", message: "Waiting for confirmation..." } });
      await publicClient.waitForTransactionReceipt({ hash });
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "success", message: "Approval signed! ✅" } });
      fetchProposals();
    } catch (err: any) {
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "error", message: parseContractError(err) } });
    } finally {
      setApprovingId(null);
    }
  };

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    checkRoles();
    fetchProposals();
  }, [account]);

  useEffect(() => {
    if (isWhitelistedVendor && account) fetchVendorCampaigns();
    else setVendorCampaigns([]);
  }, [isWhitelistedVendor, account]);

  useEffect(() => {
    if (proposals.length > 0 && account) checkAlreadySigned(proposals);
  }, [proposals, account]);

  // Clear state on wallet switch
  useEffect(() => {
    setApproveStatus({});
    setAlreadySigned({});
    setVendorFilter("active");
    setShowProposeModal(false);
  }, [account]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const activeVendorCampaigns = vendorCampaigns.filter(c => c.raisedAmount < c.goalAmount);
  const completedVendorCampaigns = vendorCampaigns.filter(c => c.raisedAmount >= c.goalAmount);
  const filteredVendorCampaigns = vendorFilter === "active" ? activeVendorCampaigns : completedVendorCampaigns;

  return <>
    <NavigationBar activeTab="vendors" />
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-8">

        {/* Header */}
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Vendor Governance</h1>
            <p className="text-sm text-gray-400 mt-1">
              Propose vendors for community review and track on-chain approvals.
            </p>
          </div>
          {account && (
            <button
              onClick={() => setShowProposeModal(true)}
              className="px-4 py-2 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition shrink-0"
            >
              + Propose Vendor
            </button>
          )}
        </div>

        {/* Validator status indicator */}
        {account && (
          <div className={`text-sm p-3 rounded-lg ${isValidator ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
            {isValidator
              ? "✅ Your wallet is a validator. You can sign vendor approvals."
              : "ℹ️ Your wallet is not a validator. Anyone can propose a vendor — validators review and approve."}
          </div>
        )}

        {/* My Vendor Campaigns — only for whitelisted vendors */}
        {account && isWhitelistedVendor && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white">My Vendor Campaigns</h2>
              <p className="text-sm text-gray-400 mt-1">
                Campaigns that have associated your wallet as a vendor.
              </p>
            </div>

            <div className="flex rounded-lg overflow-hidden border border-gray-700 text-sm w-fit">
              <button
                onClick={() => setVendorFilter("active")}
                className={`px-4 py-1.5 font-medium transition ${vendorFilter === "active" ? "bg-green-800 text-green-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                🟢 Active <span className="ml-1 text-xs opacity-70">({activeVendorCampaigns.length})</span>
              </button>
              <button
                onClick={() => setVendorFilter("completed")}
                className={`px-4 py-1.5 font-medium transition ${vendorFilter === "completed" ? "bg-teal-800 text-teal-300" : "bg-gray-800 text-gray-400 hover:text-white"}`}
              >
                ✅ Completed <span className="ml-1 text-xs opacity-70">({completedVendorCampaigns.length})</span>
              </button>
            </div>

            {loadingVendorCampaigns ? (
              <div className="space-y-3">
                <CampaignSkeleton />
                <CampaignSkeleton />
              </div>
            ) : filteredVendorCampaigns.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900 p-8 text-center">
                <p className="text-gray-500 text-sm">No {vendorFilter} campaigns associated with your wallet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredVendorCampaigns.map((vc) => (
                  <VendorCampaignCard key={vc.id} vc={vc} />
                ))}
              </div>
            )}
          </div>
        )}

        {!account && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
            <p className="text-gray-400 text-sm">Connect your wallet to propose or approve vendors.</p>
          </div>
        )}

        {/* Vendor Proposals */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Vendor Proposals</h2>
            <RefreshButton onClick={fetchProposals} />
          </div>

          {loadingProposals ? (
            <div className="space-y-3">
              <ProposalSkeleton />
              <ProposalSkeleton />
            </div>
          ) : proposals.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
              <p className="text-gray-500 text-sm">No vendor proposals yet.</p>
            </div>
          ) : (
            proposals.map((p) => (
              <div
                key={p.id}
                className={`rounded-xl border p-5 space-y-3 ${p.executed ? "border-green-600 bg-gray-800" : "border-gray-600 bg-gray-900"}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white">{p.displayName}</p>
                    <p className="text-xs text-gray-400 break-all mt-1">{p.vendor}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ml-2 ${p.executed ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"}`}>
                    {p.executed ? "✅ Whitelisted" : "Pending"}
                  </span>
                </div>

                {p.links.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Verification links:</p>
                    {p.links.map((link, i) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                        className="block text-xs text-pink-400 hover:text-pink-300 truncate">
                        ↗ {link}
                      </a>
                    ))}
                  </div>
                )}

                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{p.approvals} of {REQUIRED_APPROVALS} approvals</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${p.executed ? "bg-green-500" : "bg-yellow-500"}`}
                      style={{ width: `${Math.min(100, (p.approvals / REQUIRED_APPROVALS) * 100)}%` }}
                    />
                  </div>
                </div>

                {approveStatus[p.id]?.message && (
                  <div className={`text-xs p-2 rounded ${
                    approveStatus[p.id].type === "error" ? "bg-red-900 text-red-300"
                    : approveStatus[p.id].type === "success" ? "bg-green-900 text-green-300"
                    : "bg-blue-900 text-blue-300"
                  }`}>
                    {approveStatus[p.id].message}
                  </div>
                )}

                {isValidator && !p.executed && (
                  alreadySigned[p.id] ? (
                    <div className="w-full text-center text-xs text-gray-500 py-2 border border-gray-700 rounded-lg">
                      ✍️ You have already signed this proposal
                    </div>
                  ) : (
                    <button
                      onClick={() => handleApprove(p.id)}
                      disabled={approvingId === p.id}
                      className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      {approvingId === p.id ? "Signing..." : "Sign Approval"}
                    </button>
                  )
                )}
              </div>
            ))
          )}
        </div>

        {/* Identity Verification Proposals — validators only */}
        <IdentityProposals />

      </div>
    </div>

    {/* Propose Vendor modal */}
    {showProposeModal && (
      <ModalOverlay onClose={() => setShowProposeModal(false)}>
        <ProposeVendorForm
          onSuccess={() => { setShowProposeModal(false); fetchProposals(); checkRoles(); }}
          onCancel={() => setShowProposeModal(false)}
        />
      </ModalOverlay>
    )}
  </>;
};

export default VendorManagement;