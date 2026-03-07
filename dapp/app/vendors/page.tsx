"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import NavigationBar from "../components/NavigationBar";
import IdentityProposals from "../components/IdentityProposals";

const DELIMITER = "|";

function encodeVendorName(name: string, links: string[]): string {
  const validLinks = links.map((l) => l.trim()).filter((l) => l.length > 0);
  return validLinks.length > 0 ? `${name}${DELIMITER}${validLinks.join(DELIMITER)}` : name;
}

function decodeVendorName(encoded: string): { name: string; links: string[] } {
  const parts = encoded.split(DELIMITER);
  return {
    name: parts[0],
    links: parts.slice(1).filter((l) => l.startsWith("http")),
  };
}

interface Proposal {
  id: number;
  vendor: string;
  vendorName: string;
  displayName: string;
  links: string[];
  approvals: number;
  executed: boolean;
}

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

const VendorManagement: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(true);
  const [isValidator, setIsValidator] = useState(false);
  const [newVendorName, setNewVendorName] = useState("");
  const [newVendorAddress, setNewVendorAddress] = useState("");
  const [verificationLinks, setVerificationLinks] = useState(["", "", ""]);
  const [proposeStatus, setProposeStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approveStatus, setApproveStatus] = useState<Record<number, { type: string; message: string }>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [alreadySigned, setAlreadySigned] = useState<Record<number, boolean>>({});
  const { account } = useAuth();

  const REQUIRED_APPROVALS = 3;

  const checkIfValidator = async () => {
    if (!account) return;
    try {
      const validators = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getValidators",
      })) as string[];
      setIsValidator(validators.some((v) => v.toLowerCase() === account.toLowerCase()));
    } catch (err) {
      console.error("Failed to check validator:", err);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoadingProposals(true);
      const count = (await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "proposalCount",
      })) as bigint;

      const fetched: Proposal[] = [];
      for (let i = 0; i < Number(count); i++) {
        const result = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getProposalStatus",
          args: [BigInt(i)],
        })) as [string, string, bigint, boolean];

        const { name: displayName, links } = decodeVendorName(result[1]);
        fetched.push({
          id: i,
          vendor: result[0],
          vendorName: result[1],
          displayName,
          links,
          approvals: Number(result[2]),
          executed: result[3],
        });
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
        const hasSigned = (await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "proposalApprovals",
          args: [BigInt(p.id), account as `0x${string}`],
        })) as boolean;
        signed[p.id] = hasSigned;
      } catch {
        signed[p.id] = false;
      }
    }
    setAlreadySigned(signed);
  };

  useEffect(() => {
    checkIfValidator();
    fetchProposals();
  }, [account]);

  useEffect(() => {
    if (proposals.length > 0 && account) {
      checkAlreadySigned(proposals);
    }
  }, [proposals, account]);

  const handleLinkChange = (index: number, value: string) => {
    const updated = [...verificationLinks];
    updated[index] = value;
    setVerificationLinks(updated);
  };

  // At least one link is required — mirrors the contract's _containsPipe check.
  const validateLinks = (): boolean => {
    const filled = verificationLinks.filter((l) => l.trim().length > 0);
    if (filled.length === 0) {
      setProposeStatus({ type: "error", message: "At least one verification link is required (DTI registration, Facebook page, official website, etc.)" });
      return false;
    }
    for (const link of filled) {
      if (!link.startsWith("https://") && !link.startsWith("http://")) {
        setProposeStatus({ type: "error", message: "Verification links must be valid URLs starting with https://" });
        return false;
      }
    }
    return true;
  };

  // Anyone can propose a vendor — no validator check needed here.
  const handlePropose = async () => {
    if (!account) {
      setProposeStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (!newVendorName.trim()) {
      setProposeStatus({ type: "error", message: "Enter a vendor name." });
      return;
    }
    if (!newVendorAddress || newVendorAddress.length !== 42 || !newVendorAddress.startsWith("0x")) {
      setProposeStatus({ type: "error", message: "Enter a valid vendor wallet address (0x...)." });
      return;
    }
    if (!validateLinks()) return;

    const encodedName = encodeVendorName(newVendorName.trim(), verificationLinks);

    try {
      setIsSubmitting(true);
      setProposeStatus({ type: "info", message: "Confirm in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "proposeVendor",
        args: [newVendorAddress as `0x${string}`, encodedName],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setProposeStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });
      setProposeStatus({ type: "success", message: "Vendor proposal submitted! Validators will review and sign." });
      setNewVendorName("");
      setNewVendorAddress("");
      setVerificationLinks(["", "", ""]);
      fetchProposals();
    } catch (err: any) {
      setProposeStatus({ type: "error", message: parseContractError(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (proposalId: number) => {
    try {
      setApprovingId(proposalId);
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "info", message: "Confirm in your wallet..." } });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "approveVendor",
        args: [BigInt(proposalId)],
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

  return <>
    <NavigationBar activeTab="vendors" />
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-8">

        {/* Validator status indicator */}
        {account && (
          <div className={`text-sm p-3 rounded-lg ${isValidator ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
            {isValidator
              ? "✅ Your wallet is a validator. You can sign vendor approvals."
              : "ℹ️ Your wallet is not a validator. Anyone can propose a vendor below — validators review and approve."}
          </div>
        )}

        {/* Propose form — open to EVERYONE */}
        {account && (
          <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg mx-auto">
            <h2 className="text-xl font-bold text-white">Propose a Vendor</h2>
            <p className="text-sm text-gray-400">
              Anyone can submit a vendor for community review. Validators independently
              verify the submitted links and sign their approval. {REQUIRED_APPROVALS} signatures
              are required before a vendor can receive funds.
            </p>

            {proposeStatus.message && (
              <div className={`text-sm p-3 rounded-lg ${
                proposeStatus.type === "error" ? "bg-red-900 text-red-300"
                : proposeStatus.type === "success" ? "bg-green-900 text-green-300"
                : "bg-blue-900 text-blue-300"
              }`}>
                {proposeStatus.message}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Vendor Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Cebu Rice Supply Co."
                  value={newVendorName}
                  onChange={(e) => setNewVendorName(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Vendor Wallet Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newVendorAddress}
                  onChange={(e) => setNewVendorAddress(e.target.value.trim())}
                  disabled={isSubmitting}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-gray-400">
                  Verification Links <span className="text-red-400">*</span>{" "}
                  <span className="text-gray-600 text-xs">(at least one required)</span>
                </label>
                <p className="text-xs text-gray-600">
                  DTI registration, Facebook business page, official website, etc.
                  Validators use these to verify legitimacy.
                </p>
                {verificationLinks.map((link, i) => (
                  <input
                    key={i}
                    type="url"
                    placeholder={i === 0 ? "https://  (required)" : "https://  (optional)"}
                    value={link}
                    onChange={(e) => handleLinkChange(i, e.target.value)}
                    disabled={isSubmitting}
                    className={`w-full p-3 rounded-lg bg-gray-800 border text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 text-sm ${
                      i === 0 ? "border-gray-500" : "border-gray-700"
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handlePropose}
                disabled={isSubmitting}
                className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "Proposing..." : "Propose Vendor"}
              </button>
            </div>
          </div>
        )}

        {!account && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 text-center">
            <p className="text-gray-400 text-sm">Connect your wallet to propose or approve vendors.</p>
          </div>
        )}

        {/* Proposals list */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Vendor Proposals</h2>
            <button onClick={fetchProposals} className="text-sm text-pink-400 hover:text-pink-300">↻ Refresh</button>
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

        {/* Identity Verification Proposals — visible to validators only */}
        <IdentityProposals />
      </div>
    </div>
  </>;
};

export default VendorManagement;