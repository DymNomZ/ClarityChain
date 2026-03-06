"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { formatEther, parseEther } from "viem";
import { useAuth } from "../contexts/AuthContext";

interface Campaign {
  id: number;
  name: string;
  available: bigint;
}

const AssociateVendor: React.FC = () => {
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<number | "">("");
  const [vendorAddress, setVendorAddress] = useState("");
  const [isVendorWhitelisted, setIsVendorWhitelisted] = useState<boolean | null>(null);
  const [vendorDisplayName, setVendorDisplayName] = useState("");
  const [cap, setCap] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { account } = useAuth();

  useEffect(() => {
    const fetchMyCampaigns = async () => {
      if (!account) return;
      try {
        const count = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "campaignCount",
        }) as bigint;

        const mine: Campaign[] = [];
        for (let i = 0; i < Number(count); i++) {
          const result = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "getCampaign",
            args: [BigInt(i)],
          }) as [string, string, bigint, bigint, bigint, boolean, boolean];

          if (result[1].toLowerCase() === account.toLowerCase() && result[5]) {
            mine.push({
              id: i,
              name: result[0],
              available: result[3] - result[4],
            });
          }
        }
        setMyCampaigns(mine);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      }
    };
    fetchMyCampaigns();
  }, [account]);

  // Live whitelist check as vendor address is typed
  useEffect(() => {
    const checkVendor = async () => {
      if (!vendorAddress || vendorAddress.length !== 42 || !vendorAddress.startsWith("0x")) {
        setIsVendorWhitelisted(null);
        setVendorDisplayName("");
        return;
      }
      try {
        const isWhitelisted = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "isVendorWhitelisted",
          args: [vendorAddress as `0x${string}`],
        }) as boolean;
        setIsVendorWhitelisted(isWhitelisted);

        if (isWhitelisted) {
          const rawName = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "vendorNames",
            args: [vendorAddress as `0x${string}`],
          }) as string;
          // Strip pipe-encoded links — show only the vendor name
          setVendorDisplayName(rawName.split("|")[0]);
        } else {
          setVendorDisplayName("");
        }
      } catch {
        setIsVendorWhitelisted(null);
      }
    };
    checkVendor();
  }, [vendorAddress]);

  const handleAssociate = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (selectedCampaign === "") {
      setStatus({ type: "error", message: "Select a campaign." });
      return;
    }
    if (!vendorAddress || vendorAddress.length !== 42) {
      setStatus({ type: "error", message: "Enter a valid vendor address." });
      return;
    }
    if (!isVendorWhitelisted) {
      setStatus({ type: "error", message: "Vendor must be whitelisted before they can be associated." });
      return;
    }
    if (!cap || isNaN(Number(cap)) || Number(cap) <= 0) {
      setStatus({ type: "error", message: "Enter a valid spending cap." });
      return;
    }
    if (!instructions.trim()) {
      setStatus({ type: "error", message: "Procurement instructions cannot be empty." });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm the transaction in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "associateVendor",
        args: [
          BigInt(selectedCampaign),
          vendorAddress as `0x${string}`,
          parseEther(cap),
          instructions.trim(),
        ],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });

      setStatus({
        type: "success",
        message: `✅ ${vendorDisplayName} associated with campaign. Cap: ${cap} PAS. Instructions stored on-chain.`,
      });
      setVendorAddress("");
      setCap("");
      setInstructions("");
      setSelectedCampaign("");
    } catch (err: any) {
      setStatus({ type: "error", message: parseContractError(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white">Associate a Vendor</h2>
        <p className="text-sm text-gray-400 mt-1">
          Link a whitelisted vendor to your campaign. Set their spending cap and
          record what they're contracted to do — stored permanently on-chain.
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

      {!account ? (
        <p className="text-gray-500 text-sm">Connect your wallet to associate vendors.</p>
      ) : myCampaigns.length === 0 ? (
        <p className="text-gray-500 text-sm">You have no active campaigns. Create one above first.</p>
      ) : (
        <div className="space-y-3">
          {/* Campaign selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Campaign</label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value === "" ? "" : Number(e.target.value))}
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-pink-500"
            >
              <option value="">-- Select a campaign --</option>
              {myCampaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({formatEther(c.available)} PAS available)
                </option>
              ))}
            </select>
          </div>

          {/* Vendor address with live whitelist check */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Vendor Wallet Address</label>
            <input
              type="text"
              placeholder="0x..."
              value={vendorAddress}
              onChange={(e) => setVendorAddress(e.target.value.trim())}
              disabled={isSubmitting}
              className={`w-full p-3 rounded-lg bg-gray-800 border text-white placeholder-gray-500 focus:outline-none ${
                isVendorWhitelisted === true ? "border-green-500"
                : isVendorWhitelisted === false ? "border-red-500"
                : "border-gray-600 focus:border-pink-500"
              }`}
            />
            {isVendorWhitelisted === true && (
              <p className="text-green-400 text-xs mt-1">✅ Whitelisted: {vendorDisplayName}</p>
            )}
            {isVendorWhitelisted === false && (
              <p className="text-red-400 text-xs mt-1">
                🚫 Not whitelisted — propose this vendor in the Vendor Governance tab first.
              </p>
            )}
          </div>

          {/* Spending cap */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Spending Cap (PAS)</label>
            <input
              type="number"
              placeholder="e.g., 5"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
              disabled={isSubmitting}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
            />
            <p className="text-xs text-gray-600 mt-1">
              Maximum amount this vendor can receive from this campaign.
            </p>
          </div>

          {/* Procurement instructions */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Procurement Instructions</label>
            <textarea
              placeholder='e.g., "Purchase 500 sacks of rice and deliver to Barangay Ermita evacuation center by March 20"'
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={isSubmitting}
              rows={3}
              className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500 resize-none text-sm"
            />
            <p className="text-xs text-gray-600 mt-1">
              Stored permanently on-chain. Public record of what this vendor is contracted to do.
            </p>
          </div>

          <button
            onClick={handleAssociate}
            disabled={isSubmitting || !isVendorWhitelisted}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Associating..." : "Associate Vendor"}
          </button>
        </div>
      )}
    </div>
  );
};

export default AssociateVendor;