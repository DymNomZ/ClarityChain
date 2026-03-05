"use client";

// =============================================================================
// TransactionFeed.tsx
// Issue #9 — Improved loading skeleton, error state, and event legend.
// =============================================================================

import React, { useState, useEffect } from "react";
import { publicClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { formatEther } from "viem";
import NavigationBar from "../components/NavigationBar";

interface FeedEvent {
  type: string;
  txHash: string;
  blockNumber: bigint;
  data: Record<string, string>;
}

const EVENT_ICONS: Record<string, string> = {
  CampaignCreated: "🏕️",
  DonationReceived: "💰",
  WithdrawalToVendor: "✅",
  VendorProposed: "📋",
  VendorApprovalSigned: "✍️",
  VendorWhitelisted: "🟢",
  CampaignClosed: "🔒",
};

const EVENT_COLORS: Record<string, string> = {
  CampaignCreated: "border-blue-600",
  DonationReceived: "border-green-600",
  WithdrawalToVendor: "border-pink-500",
  VendorProposed: "border-yellow-600",
  VendorApprovalSigned: "border-yellow-400",
  VendorWhitelisted: "border-green-400",
  CampaignClosed: "border-gray-500",
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  CampaignCreated: "An NGO opened a new fundraising campaign",
  DonationReceived: "A donor sent funds to a campaign",
  WithdrawalToVendor: "An NGO sent funds to a whitelisted vendor",
  VendorProposed: "A validator submitted a vendor for whitelisting",
  VendorApprovalSigned: "A validator signed off on a vendor proposal",
  VendorWhitelisted: "A vendor reached the approval threshold and is now whitelisted",
  CampaignClosed: "An NGO closed a campaign",
};

const FeedSkeleton = () => (
  <div className="rounded-xl border-l-4 border-gray-700 bg-gray-900 p-4 space-y-2 animate-pulse">
    <div className="flex justify-between">
      <div className="h-4 w-36 bg-gray-700 rounded" />
      <div className="h-3 w-20 bg-gray-800 rounded" />
    </div>
    <div className="h-3 w-64 bg-gray-800 rounded" />
    <div className="h-3 w-48 bg-gray-800 rounded" />
  </div>
);

const TransactionFeed: React.FC = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string>("");
  const [showLegend, setShowLegend] = useState(false);

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

          const eventName = decoded.eventName as string;
          const args = decoded.args as Record<string, any>;
          const data: Record<string, string> = {};

          for (const [key, val] of Object.entries(args)) {
            if (typeof val === "bigint") {
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
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-white">Public Transaction Feed</h2>
            <p className="text-sm text-gray-400 mt-1">
              Every action on ClarityChain is permanent and publicly visible. Don't trust — verify.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-2 py-1 rounded"
            >
              {showLegend ? "Hide" : "Legend"}
            </button>
            <button onClick={fetchEvents} className="text-sm text-pink-400 hover:text-pink-300 transition">
              ↻ Refresh
            </button>
          </div>
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 mb-2">Event Types</p>
            {Object.entries(EVENT_DESCRIPTIONS).map(([type, desc]) => (
              <div key={type} className="flex gap-2 text-xs">
                <span className="shrink-0">{EVENT_ICONS[type]}</span>
                <span className="text-gray-300 font-medium w-36 shrink-0">{type}</span>
                <span className="text-gray-500">{desc}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {fetchError && (
          <div className="rounded-xl border border-red-800 bg-red-900/30 p-4 text-sm text-red-300">
            {fetchError}
          </div>
        )}

        {/* Loading */}
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
              <div
                key={index}
                className={`rounded-xl border-l-4 bg-gray-900 p-4 ${EVENT_COLORS[event.type] || "border-gray-600"}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-white">
                    {EVENT_ICONS[event.type] || "📌"} {event.type}
                  </span>
                  <span className="text-xs text-gray-500">Block #{event.blockNumber.toString()}</span>
                </div>

                <div className="space-y-1">
                  {Object.entries(event.data).map(([key, val]) => (
                    <div key={key} className="flex gap-2 text-sm flex-wrap">
                      <span className="text-gray-400 capitalize min-w-[100px]">{key}:</span>
                      <span className="text-gray-200 break-all">{val}</span>
                    </div>
                  ))}
                </div>

                {event.txHash && (
                  <a
                    href={`https://blockscout-testnet.polkadot.io/tx/${event.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pink-400 hover:text-pink-300 mt-2 block"
                  >
                    View on explorer ↗ {event.txHash.slice(0, 20)}...
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </>;
};

export default TransactionFeed;