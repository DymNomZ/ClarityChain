"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";

interface IdentityProposal {
  id: number;
  applicant: string;
  orgName: string;
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

const REQUIRED_APPROVALS = 3;

const IdentityProposals: React.FC = () => {
  const [proposals, setProposals] = useState<IdentityProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isValidator, setIsValidator] = useState(false);
  const [alreadySigned, setAlreadySigned] = useState<Record<number, boolean>>({});
  const [approveStatus, setApproveStatus] = useState<Record<number, { type: string; message: string }>>({});
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const { account } = useAuth();

  const checkIfValidator = async () => {
    if (!account) return;
    try {
      const validators = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "getValidators",
      }) as string[];
      setIsValidator(validators.some((v) => v.toLowerCase() === account.toLowerCase()));
    } catch {
      setIsValidator(false);
    }
  };

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const count = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "identityProposalCount",
      }) as bigint;

      const fetched: IdentityProposal[] = [];
      for (let i = 0; i < Number(count); i++) {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getIdentityProposalStatus",
          args: [BigInt(i)],
        }) as [string, string, bigint, boolean];

        // profileLinks format: "Org Name|https://link1|https://link2"
        const parts = result[1].split("|");
        const orgName = parts[0];
        const links = parts.slice(1).filter((l) => l.startsWith("http"));

        fetched.push({
          id: i,
          applicant: result[0],
          orgName,
          links,
          approvals: Number(result[2]),
          executed: result[3],
        });
      }
      setProposals([...fetched].reverse());
      return [...fetched].reverse();
    } catch (err) {
      console.error("Failed to fetch identity proposals:", err);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const checkAlreadySigned = async (fetched: IdentityProposal[]) => {
    if (!account) return;
    const signed: Record<number, boolean> = {};
    for (const p of fetched) {
      if (p.executed) continue;
      try {
        const hasSigned = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "identityProposalApprovals",
          args: [BigInt(p.id), account as `0x${string}`],
        }) as boolean;
        signed[p.id] = hasSigned;
      } catch {
        signed[p.id] = false;
      }
    }
    setAlreadySigned(signed);
  };

  const refresh = async () => {
    const fetched = await fetchProposals();
    if (fetched.length > 0 && account) {
      await checkAlreadySigned(fetched);
    }
  };

  useEffect(() => {
    checkIfValidator();
    refresh();
  }, [account]);

  const handleApprove = async (proposalId: number) => {
    try {
      setApprovingId(proposalId);
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "info", message: "Confirm in your wallet..." } });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "approveIdentity",
        args: [BigInt(proposalId)],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "info", message: "Waiting for confirmation..." } });
      await publicClient.waitForTransactionReceipt({ hash });
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "success", message: "Approval signed! ✅" } });
      refresh();
    } catch (err: any) {
      setApproveStatus({ ...approveStatus, [proposalId]: { type: "error", message: parseContractError(err) } });
    } finally {
      setApprovingId(null);
    }
  };

  // Non-validators see nothing here — this section is governance-only
  if (!account || !isValidator) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Identity Verification Proposals</h2>
          <p className="text-sm text-gray-400 mt-1">
            Review applicant links and sign to verify their identity on-chain.
          </p>
        </div>
        <button onClick={refresh} className="text-sm text-pink-400 hover:text-pink-300">
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <ProposalSkeleton />
          <ProposalSkeleton />
        </div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
          <p className="text-gray-500 text-sm">No identity verification proposals yet.</p>
        </div>
      ) : (
        proposals.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border p-5 space-y-3 ${
              p.executed ? "border-teal-600 bg-gray-800" : "border-gray-600 bg-gray-900"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-white">{p.orgName || "Unnamed applicant"}</p>
                <p className="text-xs text-gray-400 break-all mt-1">{p.applicant}</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ml-2 ${
                p.executed ? "bg-teal-900 text-teal-300" : "bg-yellow-900 text-yellow-300"
              }`}>
                {p.executed ? "✔️ Verified" : "Pending"}
              </span>
            </div>

            {p.links.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Profile links:</p>
                {p.links.map((link, i) => (
                  <a
                    key={i}
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-xs text-blue-400 hover:text-blue-300 truncate"
                  >
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
                  className={`h-2 rounded-full transition-all ${p.executed ? "bg-teal-500" : "bg-yellow-500"}`}
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

            {!p.executed && (
              alreadySigned[p.id] ? (
                <div className="w-full text-center text-xs text-gray-500 py-2 border border-gray-700 rounded-lg">
                  ✍️ You have already signed this proposal
                </div>
              ) : (
                <button
                  onClick={() => handleApprove(p.id)}
                  disabled={approvingId === p.id}
                  className="w-full bg-teal-700 hover:bg-teal-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {approvingId === p.id ? "Signing..." : "Sign Verification"}
                </button>
              )
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default IdentityProposals;