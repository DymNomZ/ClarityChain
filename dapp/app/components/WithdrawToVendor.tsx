"use client";

import React, { useState, useEffect } from "react";
import { publicClient, getWalletClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import { parseEther, formatEther } from "viem";
import { useAuth } from "../contexts/AuthContext";

interface Campaign {
  id: number;
  name: string;
  available: bigint;
  goalAmount: bigint;
}

interface AssociatedVendor {
  address: string;
  displayName: string;
  cap: bigint;
  spent: bigint;
  remaining: bigint;
  instructions: string;
}

interface Props {
  preselectedCampaignId?: number;
  preselectedCampaignName?: string;
  vendorRefreshKey?: number;
  onSuccess?: () => void;
}

const WithdrawToVendor: React.FC<Props> = ({ preselectedCampaignId, preselectedCampaignName, vendorRefreshKey = 0, onSuccess }) => {
  const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<number | "">(preselectedCampaignId ?? "");
  const [associatedVendors, setAssociatedVendors] = useState<AssociatedVendor[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<AssociatedVendor | null>(null);
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<{ type: string | null; message: string }>({ type: null, message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  }, [account]);

  // When a campaign is selected, load its associated vendors
  useEffect(() => {
    const fetchAssociatedVendors = async () => {
      if (selectedCampaign === "") {
        setAssociatedVendors([]);
        setSelectedVendor(null);
        return;
      }
      try {
        setLoadingVendors(true);
        setSelectedVendor(null);

        const vendorAddresses = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getCampaignVendorList",
          args: [BigInt(selectedCampaign)],
        }) as string[];

        const vendors: AssociatedVendor[] = [];
        for (const addr of vendorAddresses) {
          const [cap, spent, instructions] = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "getCampaignVendor",
            args: [BigInt(selectedCampaign), addr as `0x${string}`],
          }) as [bigint, bigint, string, boolean];

          const rawName = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: CONTRACT_ABI,
            functionName: "vendorNames",
            args: [addr as `0x${string}`],
          }) as string;

          vendors.push({
            address: addr,
            displayName: rawName.split("|")[0],
            cap,
            spent,
            remaining: cap - spent,
            instructions,
          });
        }
        setAssociatedVendors(vendors);
      } catch (err) {
        console.error("Failed to fetch associated vendors:", err);
      } finally {
        setLoadingVendors(false);
      }
    };
    fetchAssociatedVendors();
  }, [selectedCampaign, vendorRefreshKey]);

  const handleWithdraw = async () => {
    if (!account) {
      setStatus({ type: "error", message: "Connect your wallet first." });
      return;
    }
    if (selectedCampaign === "" || !selectedVendor) {
      setStatus({ type: "error", message: "Select a campaign and a vendor." });
      return;
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setStatus({ type: "error", message: "Enter a valid amount." });
      return;
    }
    if (parseEther(amount) > selectedVendor.remaining) {
      setStatus({
        type: "error",
        message: `Amount exceeds remaining cap for this vendor (${formatEther(selectedVendor.remaining)} PAS left).`,
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus({ type: "info", message: "Confirm the transaction in your wallet..." });

      const walletClient = await getWalletClient();
      if (!walletClient) throw new Error("Wallet not available");

      // simulateContract reverts here if any of the three contract layers reject.
      // Layer 1: global whitelist. Layer 2: campaign association. Layer 3: cap.
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: "withdrawToVendor",
        args: [
          BigInt(selectedCampaign),
          selectedVendor.address as `0x${string}`,
          parseEther(amount),
        ],
        account: walletClient.account,
      });

      const hash = await walletClient.writeContract(request);
      setStatus({ type: "info", message: "Waiting for confirmation..." });
      await publicClient.waitForTransactionReceipt({ hash });

      setStatus({
        type: "success",
        message: `✅ ${amount} PAS sent to ${selectedVendor.displayName} | Tx: ${hash.slice(0, 20)}...`,
      });
      setAmount("");
      setSelectedVendor(null);
      // Re-fetch vendor list for this campaign so spent/remaining update immediately.
      // Only clear campaign selection if not preselected by parent.
      if (preselectedCampaignId === undefined) {
        setSelectedCampaign("");
      } else {
        // Trigger re-fetch by nudging selectedCampaign through a temporary reset
        setSelectedCampaign("");
        setTimeout(() => setSelectedCampaign(preselectedCampaignId), 50);
        onSuccess?.();
      }
    } catch (err: any) {
      // The demo money shot — VendorNotWhitelistedRejected surfaces here
      setStatus({ type: "error", message: parseContractError(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-pink-500 bg-gray-900 p-6 space-y-4 max-w-lg mx-auto">
      <div>
        <h2 className="text-xl font-bold text-white">Withdraw to Vendor</h2>
        <p className="text-sm text-gray-400 mt-1">
          Only vendors explicitly associated with this campaign can receive funds,
          and only up to their agreed cap.
        </p>
      </div>

      {status.message && (
        <div className={`text-sm p-3 rounded-lg break-words ${
          status.type === "error" ? "bg-red-900 text-red-300 font-semibold"
          : status.type === "success" ? "bg-green-900 text-green-300"
          : "bg-blue-900 text-blue-300"
        }`}>
          {status.message}
        </div>
      )}

      {!account ? (
        <p className="text-gray-500 text-sm">Connect your wallet to manage withdrawals.</p>
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
                onChange={(e) => {
                  setSelectedCampaign(e.target.value === "" ? "" : Number(e.target.value));
                  setStatus({ type: null, message: "" });
                }}
                disabled={isSubmitting}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-pink-500"
              >
                <option value="">-- Select a campaign --</option>
                {myCampaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({formatEther(c.available)} PAS remaining)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Vendor selector — populated from on-chain associations */}
          {selectedCampaign !== "" && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Associated Vendor</label>
              {loadingVendors ? (
                <div className="p-3 rounded-lg bg-gray-800 border border-gray-600 text-gray-500 text-sm animate-pulse">
                  Loading vendors...
                </div>
              ) : associatedVendors.length === 0 ? (
                <div className="p-3 rounded-lg bg-gray-800 border border-yellow-700 text-yellow-400 text-sm">
                  No vendors associated with this campaign yet. Use "Associate a Vendor" above first.
                </div>
              ) : (
                <select
                  value={selectedVendor?.address ?? ""}
                  onChange={(e) => {
                    const v = associatedVendors.find((v) => v.address === e.target.value) ?? null;
                    setSelectedVendor(v);
                    setAmount("");
                  }}
                  disabled={isSubmitting}
                  className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white focus:outline-none focus:border-pink-500"
                >
                  <option value="">-- Select a vendor --</option>
                  {associatedVendors.map((v) => (
                    <option key={v.address} value={v.address}>
                      {v.displayName} ({formatEther(v.remaining)} PAS remaining)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Vendor details card */}
          {selectedVendor && (
            <div className="rounded-lg bg-gray-800 border border-gray-700 p-3 space-y-1 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Cap</span>
                <span className="text-white">{formatEther(selectedVendor.cap)} PAS</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Spent</span>
                <span className="text-white">{formatEther(selectedVendor.spent)} PAS</span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Remaining</span>
                <span className="text-green-400 font-semibold">{formatEther(selectedVendor.remaining)} PAS</span>
              </div>
              {selectedVendor.instructions && (
                <div className="pt-1 border-t border-gray-700">
                  <p className="text-gray-500 mb-0.5">Instructions</p>
                  <p className="text-gray-300 leading-relaxed">{selectedVendor.instructions}</p>
                </div>
              )}
            </div>
          )}

          {/* Amount */}
          {selectedVendor && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Amount (PAS)</label>
              <input
                type="number"
                placeholder={`Max: ${formatEther(selectedVendor.remaining)} PAS`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isSubmitting}
                className="w-full p-3 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
              />
            </div>
          )}

          <button
            onClick={handleWithdraw}
            disabled={isSubmitting || !selectedVendor}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Processing..." : "Withdraw to Vendor"}
          </button>
        </div>
      )}
    </div>
  );
};

export default WithdrawToVendor;