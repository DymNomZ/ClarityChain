"use client";

import React, { useEffect, useState } from "react";
import { formatEther } from "viem";
import { FeedSkeleton } from "../components/FeedSkeleton";
import NavigationBar from "../components/NavigationBar";
import RefreshButton from "../components/RefreshButton";
import TransactionCard, { EVENT_ICONS } from "../components/TransactionCard";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { publicClient } from "../utils/viem";

const EVENT_DESCRIPTIONS: Record<string, string> = {
  CampaignCreated: "An NGO opened a new fundraising campaign",
  DonationReceived: "A donor sent funds to a campaign",
  WithdrawalToVendor: "An NGO sent funds to a whitelisted, associated vendor",
  VendorAssociated: "An NGO linked a vendor to their campaign with a cap and procurement instructions",
  VendorRefundedCampaign: "A vendor returned funds to the originating campaign",
  VendorProposed: "A wallet submitted a vendor for community whitelisting",
  VendorApprovalSigned: "A validator signed off on a vendor proposal",
  VendorWhitelisted: "A vendor reached the approval threshold and is now whitelisted",
  CampaignClosed: "An NGO closed a campaign",
  RefundsEnabled: "An NGO enabled refund mode — donors can now claim their proportional refund",
  RefundClaimed: "A donor claimed their refund from a closed campaign",
  IdentityVerificationApplied: "A wallet applied for identity verification",
  IdentityVerificationSigned: "A validator signed an identity verification proposal",
  IdentityVerified: "A wallet was verified by validator multi-sig",
};

const TransactionFeed: React.FC = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string>("");
  const [showLegend, setShowLegend] = useState(false);
  const [vendorMap, setVendorMap] = useState<VendorMap>(new Map());

  // Fetch all whitelisted vendors once on mount — builds a Map for O(1) lookup per field
  useEffect(() => {
    const fetchVendorMap = async () => {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getWhitelistedVendors",
        }) as [string[], string[]];

        const map: VendorMap = new Map();
        result[0].forEach((addr, i) => {
          const parts = result[1][i].split("|");
          map.set(addr.toLowerCase(), {
            name: parts[0],
            links: parts.slice(1).filter((l) => l.startsWith("http")),
          });
        });
        setVendorMap(map);
      } catch {
        // Non-fatal — feed still works, just no vendor badges
      }
    };
    fetchVendorMap();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setFetchError("");

      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: 0n,
        toBlock: "latest",
      });

      const parsed: FeedEvent[] = [];
      const { decodeEventLog } = await import("viem");

      for (const log of logs) {
        try {
          const decoded = decodeEventLog({
            abi: CONTRACT_ABI,
            data: log.data,
            topics: log.topics,
          });

          const eventName = decoded.eventName as unknown as string;
          const args = decoded.args as Record<string, any>;
          const data: Record<string, string> = {};

          for (const [key, val] of Object.entries(args)) {
            if (typeof val === "bigint") {
              // Amounts are in wei — only format as PAS if they look like token amounts
              data[key] = val > 1_000_000_000n ? `${formatEther(val)} PAS` : val.toString();
            } else if (typeof val === "string") {
              data[key] = val;
            } else if (typeof val === "boolean") {
              data[key] = val ? "Yes" : "No";
            } else {
              data[key] = String(val);
            }
          }

          parsed.push({
            type: eventName,
            txHash: log.transactionHash || "",
            blockNumber: log.blockNumber || 0n,
            data,
          });
        } catch {
          continue;
        }
      }

      parsed.reverse();
      setEvents(parsed);
    } catch (err: any) {
      console.error("Failed to fetch events:", err);
      setFetchError("Failed to load transaction history. Check your network connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return <>
    <NavigationBar activeTab="feed" />
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">Public Transaction Feed</h2>
            <p className="text-sm text-gray-400 mt-1">
              Every action on ClarityChain is permanent and publicly visible.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-2 py-1 rounded"
            >
              {showLegend ? "Hide" : "Legend"}
            </button>
            <RefreshButton onClick={fetchEvents} />
          </div>
        </div>

        {showLegend && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Event Types</p>
            {Object.entries(EVENT_DESCRIPTIONS).map(([type, desc]) => (
              <div key={type} className="flex gap-2 text-xs">
                <span className="shrink-0">{EVENT_ICONS[type]}</span>
                <span className="text-gray-300 font-medium w-48 shrink-0">{type}</span>
                <span className="text-gray-500">{desc}</span>
              </div>
            ))}
          </div>
        )}

        {fetchError && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
            {fetchError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
            <p className="text-gray-400">No transactions yet.</p>
            <p className="text-gray-600 text-sm mt-2">
              Create a campaign and make a donation — they'll appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event, index) => (
              <TransactionCard key={index} event={event} vendorMap={vendorMap} />
            ))}
          </div>
        )}
      </div>
    </div>
  </>;
};

export default TransactionFeed;