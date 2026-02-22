"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";

interface Proposal {
  id: number;
  vendor: string;
  vendorName: string;
  approvals: number;
  executed: boolean;
}

interface VendorManagementProps {
  account: string | null;
}

const VendorManagement: React.FC<VendorManagementProps> = ({ account }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isValidator, setIsValidator] = useState(false);
  const [newVendorAddress, setNewVendorAddress] = useState("");
  const [newVendorName, setNewVendorName] = useState("");
  const [proposeStatus, setProposeStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [approveStatus, setApproveStatus] = useState<Record<number, { type: string; message: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const REQUIRED_APPROVALS = 3;

  const checkIfValidator = async () => {
    if (!account) return;
    try {
      const validators = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getValidators",
      }) as string[];
      setIsValidator(validators.some((v) => v.toLowerCase() === account.toLowerCase()));
    } catch (err) {
      console.error("Failed to check validator:", err);
    }
  };

  const fetchProposals = async () => {
    try {
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "proposalCount",
      }) as bigint;

      const fetched: Proposal[] = [];
      for (let i = 0; i < Number(count); i++) {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getProposalStatus",
          args: [BigInt(i)],
        }) as [string, string, bigint, boolean];

        fetched.push({
          id: i,
          vendor: result[0],
          vendorName: result[1],
          approvals: Number(result[2]),
          executed: result[3],
        });
      }
      setProposals(fetched);
    } catch (err) {
      console.error("Failed to fetch proposals:", err);
    }
  };

  useEffect(() => {
    checkIfValidator();
    fetchProposals();
  }, [account]);

  const handlePropose = async () => {
    if (!account || !isValidator) {
      setProposeStatus({ type: "error", message: "Only validators can propose vendors." });
      return;
    }
    if (!newVendorAddress || newVendorAddress.length !== 42) {
      setProposeStatus({ type: "error", message: "Enter a valid vendor address." });
      return;
    }
    if (!newVendorName.trim()) {
      setProposeStatus({ type: "error", message: "Enter a vendor name." });
      return;
    }

    try {
      setIsSubmitting(true);
      setProposeStatus({ type: "info", message: "Confirm in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "proposeVendor",
        args: [newVendorAddress as `0x${string}`, newVendorName.trim()],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setProposeStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });
      setProposeStatus({ type: "success", message: `Vendor proposed! Now ${REQUIRED_APPROVALS - 1} more validator approvals needed.` });
      setNewVendorAddress("");
      setNewVendorName("");
      fetchProposals();
    } catch (err: any) {
      setProposeStatus({ type: "error", message: err.message || "Failed to propose vendor." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (proposalId: number) => {
    if (!account || !isValidator) return;

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
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "success", message: "Approval signed!" } });
      fetchProposals();
    } catch (err: any) {
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "error", message: err.message || "Approval failed." } });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Validator status banner */}
      {account && (
        <div className={`text-sm p-3 rounded-lg ${isValidator ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-400"}`}>
          {isValidator
            ? "✅ Your wallet is a validator. You can propose and approve vendors."
            : "ℹ️ Your wallet is not a validator. You can view proposals but cannot sign them."}
        </div>
      )}

      {/* Propose new vendor */}
      {isValidator && (
        <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg">
          <h2 className="text-xl font-bold text-white">Propose a Vendor</h2>
          <p className="text-sm text-gray-400">
            Propose a vendor for whitelisting. {REQUIRED_APPROVALS} validator signatures are required before they can receive funds.
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
              <label className="block text-sm text-gray-400 mb-1">Vendor Name</label>
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
              <label className="block text-sm text-gray-400 mb-1">Vendor Wallet Address</label>
              <input
                type="text"
                placeholder="0x..."
                value={newVendorAddress}
                onChange={(e) => setNewVendorAddress(e.target.value.trim())}
                disabled={isSubmitting}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
            <button
              onClick={handlePropose}
              disabled={isSubmitting}
              className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600"
            >
              {isSubmitting ? "Proposing..." : "Propose Vendor"}
            </button>
          </div>
        </div>
      )}

      {/* Pending proposals */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Vendor Proposals</h2>
          <button onClick={fetchProposals} className="text-sm text-pink-400 hover:text-pink-300">
            ↻ Refresh
          </button>
        </div>

        {proposals.length === 0 ? (
          <p className="text-gray-500 text-sm">No vendor proposals yet.</p>
        ) : (
          proposals.map((p) => (
            <div
              key={p.id}
              className={`rounded-xl border p-5 space-y-3 ${
                p.executed ? "border-green-600 bg-gray-800 opacity-80" : "border-gray-600 bg-gray-900"
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{p.vendorName}</p>
                  <p className="text-xs text-gray-400 break-all mt-1">{p.vendor}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                  p.executed ? "bg-green-900 text-green-300" : "bg-yellow-900 text-yellow-300"
                }`}>
                  {p.executed ? "✅ Whitelisted" : "Pending"}
                </span>
              </div>

              {/* Approval progress bar */}
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
                <button
                  onClick={() => handleApprove(p.id)}
                  disabled={approvingId === p.id}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600"
                >
                  {approvingId === p.id ? "Signing..." : "Sign Approval"}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VendorManagement;
