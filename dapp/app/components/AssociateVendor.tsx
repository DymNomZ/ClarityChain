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
  goalAmount: bigint;
}

interface WhitelistedVendor {
  address: string;
  displayName: string;
}

interface Props {
  refreshKey?: number;
  preselectedCampaignId?: number;
  preselectedCampaignName?: string;
  onSuccess?: () => void;
}

const AssociateVendor: React.FC<Props> = ({ refreshKey = 0, preselectedCampaignId, preselectedCampaignName, onSuccess }) => {
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [whitelistedVendors, setWhitelistedVendors] = useState<WhitelistedVendor[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<number | "">(preselectedCampaignId ?? "");
  const [selectedVendorAddress, setSelectedVendorAddress] = useState("");
  const [cap, setCap] = useState("");
  const [instructions, setInstructions] = useState("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [campaignGoal, setCampaignGoal] = useState<bigint>(0n);
  const [alreadyAllocated, setAlreadyAllocated] = useState<bigint>(0n);
  const [associatedVendorAddresses, setAssociatedVendorAddresses] = useState<Set<string>>(new Set());
  const { account } = useAuth();

  // Sync preselected campaign when prop changes
  useEffect(() => {
    if (preselectedCampaignId !== undefined) {
      setSelectedCampaign(preselectedCampaignId);
    }
  }, [preselectedCampaignId]);

  // Fetch NGO's active campaigns
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
              goalAmount: result[2],
            });
          }
        }
        setMyCampaigns(mine);
      } catch (err) {
        console.error("Failed to fetch campaigns:", err);
      }
    };
    fetchMyCampaigns();
  }, [account, refreshKey]);

  // When campaign selection changes, fetch its goal and sum existing vendor caps
  useEffect(() => {
    const fetchCampaignBudget = async () => {
      if (selectedCampaign === "") {
        setCampaignGoal(0n);
        setAlreadyAllocated(0n);
        setAssociatedVendorAddresses(new Set());
        return;
      }
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getCampaign",
          args: [BigInt(selectedCampaign)],
        }) as [string, string, bigint, bigint, bigint, boolean, boolean];
        setCampaignGoal(result[2]);

        // Sum caps of all already-associated vendors
        const vendorAddresses = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getCampaignVendorList",
          args: [BigInt(selectedCampaign)],
        }) as string[];

        setAssociatedVendorAddresses(new Set(vendorAddresses.map((a) => a.toLowerCase())));

        let total = 0n;
        for (const addr of vendorAddresses) {
          const cv = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "getCampaignVendor",
            args: [BigInt(selectedCampaign), addr as `0x${string}`],
          }) as [bigint, bigint, string, boolean];
          total += cv[0]; // cv[0] = cap
        }
        setAlreadyAllocated(total);
      } catch (err) {
        console.error("Failed to fetch campaign budget:", err);
      }
    };
    fetchCampaignBudget();
  }, [selectedCampaign]);

  // Fetch all whitelisted vendors from contract in one call
  useEffect(() => {
    const fetchWhitelistedVendors = async () => {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getWhitelistedVendors",
        }) as [string[], string[]];

        const vendors: WhitelistedVendor[] = result[0].map((addr, i) => ({
          address: addr,
          // Strip pipe-encoded links — show only the vendor name
          displayName: result[1][i].split("|")[0],
        }));
        setWhitelistedVendors(vendors);
      } catch (err) {
        console.error("Failed to fetch whitelisted vendors:", err);
      }
    };
    fetchWhitelistedVendors();
  }, []);

  const handleAssociate = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (selectedCampaign === "") {
      setStatus({ type: "error", message: "Select a campaign." });
      return;
    }
    if (!selectedVendorAddress) {
      setStatus({ type: "error", message: "Select a vendor." });
      return;
    }
    if (associatedVendorAddresses.has(selectedVendorAddress.toLowerCase())) {
      setStatus({ type: "error", message: "This vendor is already associated with this campaign." });
      return;
    }
    if (!cap || isNaN(Number(cap)) || Number(cap) <= 0) {
      setStatus({ type: "error", message: "Enter a valid spending cap." });
      return;
    }
    const capWei = parseEther(cap);
    const remainingBudget = campaignGoal - alreadyAllocated;
    if (capWei > remainingBudget) {
      const remainingPAS = formatEther(remainingBudget);
      setStatus({
        type: "error",
        message: `Cap exceeds remaining campaign budget. Only ${remainingPAS} PAS can still be allocated across vendors for this campaign.`,
      });
      return;
    }
    if (!instructions.trim()) {
      setStatus({ type: "error", message: "Procurement instructions cannot be empty." });
      return;
    }

    const selectedVendor = whitelistedVendors.find((v) => v.address === selectedVendorAddress);

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
          selectedVendorAddress as `0x${string}`,
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
        message: `✅ ${selectedVendor?.displayName ?? selectedVendorAddress} associated. Cap: ${cap} PAS. Instructions stored on-chain.`,
      });
      setSelectedVendorAddress("");
      setCap("");
      setInstructions("");
      if (preselectedCampaignId === undefined) setSelectedCampaign("");
      onSuccess?.();
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
      ) : myCampaigns.length === 0 && preselectedCampaignId === undefined ? (
        <p className="text-gray-500 text-sm">You have no active campaigns. Create one first.</p>
      ) : (
        <div className="space-y-3">
          {/* Campaign selector — hidden when preselected from parent */}
          {preselectedCampaignId !== undefined ? (
            <div className="p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm">
              <span className="text-gray-400">Campaign: </span>
              <span className="text-white font-medium">{preselectedCampaignName ?? `Campaign #${preselectedCampaignId}`}</span>
            </div>
          ) : (
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
                    {c.name} ({formatEther(c.goalAmount)} PAS Goal)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Vendor dropdown — populated from getWhitelistedVendors() */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Whitelisted Vendor</label>
            {whitelistedVendors.length === 0 ? (
              <div className="p-3 rounded-lg bg-gray-800 border border-yellow-700 text-yellow-400 text-sm">
                No whitelisted vendors yet. Propose one in the Vendor Governance tab.
              </div>
            ) : (
              <select
                value={selectedVendorAddress}
                onChange={(e) => setSelectedVendorAddress(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-pink-500"
              >
                <option value="">-- Select a vendor --</option>
                {whitelistedVendors.map((v) => (
                  <option key={v.address} value={v.address}>
                    {v.displayName}
                  </option>
                ))}
              </select>
            )}
            {selectedVendorAddress && (
              <p className="text-xs text-gray-600 mt-1 break-all">{selectedVendorAddress}</p>
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
            {selectedCampaign !== "" && campaignGoal > 0n && (
              <p className={`text-xs mt-1 ${
                alreadyAllocated >= campaignGoal
                  ? "text-red-400"
                  : campaignGoal - alreadyAllocated < parseEther("1")
                  ? "text-yellow-400"
                  : "text-gray-500"
              }`}>
                Budget remaining for vendors:{" "}
                {formatEther(campaignGoal - alreadyAllocated)} /{" "}
                {formatEther(campaignGoal)} PAS
              </p>
            )}
            {selectedCampaign !== "" && alreadyAllocated >= campaignGoal && (
              <p className="text-xs text-red-400 mt-0.5">
                ⚠️ Campaign budget fully allocated — no more vendors can be added.
              </p>
            )}
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
            disabled={isSubmitting || !selectedVendorAddress}
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