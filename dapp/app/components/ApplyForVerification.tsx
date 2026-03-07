"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { useAuth } from "../contexts/AuthContext";
import { isKnownValidator } from "../utils/validators";

const ApplyForVerification: React.FC = () => {
  const [orgName, setOrgName] = useState("");
  const [profileLinks, setProfileLinks] = useState(["", "", ""]);
  const [isAlreadyVerified, setIsAlreadyVerified] = useState(false);
  const [hasPendingApplication, setHasPendingApplication] = useState(false);
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { account } = useAuth();

  // Check if wallet is already verified on mount / wallet change
  useEffect(() => {
    const checkVerified = async () => {
      if (!account) return;
      try {
        // Validators are hardcoded — check local map before hitting the contract
        if (isKnownValidator(account)) {
          setIsAlreadyVerified(true);
          return;
        }
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getIdentityInfo",
          args: [account as `0x${string}`],
        }) as [boolean, string];

        if (result[0]) {
          setIsAlreadyVerified(true);
          return;
        }

        // Check for a pending (unexecuted) application from this wallet
        const proposalCount = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "identityProposalCount",
        }) as bigint;

        for (let i = Number(proposalCount) - 1; i >= 0; i--) {
          const proposal = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "getIdentityProposalStatus",
            args: [BigInt(i)],
          }) as [string, string, bigint, boolean];

          if (proposal[0].toLowerCase() === account.toLowerCase() && !proposal[3]) {
            setHasPendingApplication(true);
            return;
          }
        }
      } catch {
        setIsAlreadyVerified(false);
      }
    };
    checkVerified();
  }, [account]);

  const handleLinkChange = (index: number, value: string) => {
    const updated = [...profileLinks];
    updated[index] = value;
    setProfileLinks(updated);
  };

  const handleApply = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (!orgName.trim()) {
      setStatus({ type: "error", message: "Enter your name or organization name." });
      return;
    }

    const filledLinks = profileLinks.map((l) => l.trim()).filter((l) => l.length > 0);
    if (filledLinks.length === 0) {
      setStatus({ type: "error", message: "At least one profile link is required." });
      return;
    }
    for (const link of filledLinks) {
      if (!link.startsWith("https://") && !link.startsWith("http://")) {
        setStatus({ type: "error", message: "Profile links must be valid URLs starting with https://" });
        return;
      }
    }

    // Encode as "Org Name|https://link1|https://link2"
    const encoded = `${orgName.trim()}|${filledLinks.join("|")}`;

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm the transaction in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "applyForVerification",
        args: [encoded],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });

      setStatus({
        type: "success",
        message: "✅ Verification application submitted! Validators will review your links and sign on-chain. Check back after 3 approvals.",
      });
      setOrgName("");
      setProfileLinks(["", "", ""]);
    } catch (err: any) {
      setStatus({ type: "error", message: parseContractError(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!account) return null;

  // Already verified — show a simple badge, no form needed
  if (hasPendingApplication) {
    return (
      <div className="rounded-xl border border-yellow-600 bg-gray-900 p-5 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">⏳</span>
          <p className="text-yellow-300 font-semibold text-sm">Verification pending</p>
        </div>
        <p className="text-xs text-gray-400 mt-2 ml-7">
          Your application has been submitted and is awaiting validator signatures.
          You need {3} approvals to be verified. Check the Vendor Governance tab to
          see how many signatures you've collected so far.
        </p>
      </div>
    );
  }

  if (isAlreadyVerified) {
    return (
      <div className="rounded-xl border border-teal-600 bg-gray-900 p-5 max-w-lg mx-auto">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal-500 text-white text-sm font-bold">✓</span>
          <p className="text-teal-300 font-semibold text-sm">Your wallet is verified on ClarityChain.</p>
        </div>
        <p className="text-xs text-gray-500 mt-1 ml-7">
          A ✓ checkmark will appear next to your address on campaign cards.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white">Get Verified</h2>
        <p className="text-sm text-gray-400 mt-1">
          NGOs and organizations can apply for on-chain identity verification.
          Validators review your submitted links and sign their approval.
          Once verified, a ✓ checkmark appears next to your wallet address
          on all campaign cards — donors can click "who is this?" to see your profile.
        </p>
      </div>

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
          <label className="block text-sm text-gray-400 mb-1">
            Name or Organization <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g., Cebu Food Bank Inc."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={isSubmitting}
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm text-gray-400">
            Profile Links <span className="text-red-400">*</span>{" "}
            <span className="text-gray-600 text-xs">(at least one required)</span>
          </label>
          <p className="text-xs text-gray-600">
            SEC/DTI registration, official website, Facebook page, news coverage, etc.
            Validators use these to verify your identity.
          </p>
          {profileLinks.map((link, i) => (
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
          onClick={handleApply}
          disabled={isSubmitting}
          className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Submitting..." : "Apply for Verification"}
        </button>
      </div>
    </div>
  );
};

export default ApplyForVerification;