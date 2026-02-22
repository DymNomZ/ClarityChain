"use client";

import React, { useState, useEffect } from "react";
import { publicClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { formatEther } from "viem";

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

const TransactionFeed: React.FC = () => {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);

      // Fetch all event types from the contract
      const logs = await publicClient.getLogs({
        address: CONTRACT_ADDRESS,
        fromBlock: 0n,
        toBlock: "latest",
      });

      // Parse each log using the ABI
      const parsed: FeedEvent[] = [];

      for (const log of logs) {
        try {
          const { decodeEventLog } = await import("viem");
          const decoded = decodeEventLog({
            abi: CONTRACT_ABI,
            data: log.data,
            topics: log.topics,
          });

          const eventName = decoded.eventName as string;
          const args = decoded.args as Record<string, any>;

          // Format args into readable strings
          const data: Record<string, string> = {};
          for (const [key, val] of Object.entries(args)) {
            if (typeof val === "bigint") {
              // Try to detect if it's an amount (large number) or an ID (small number)
              if (val > 1_000_000_000n) {
                data[key] = `${formatEther(val)} PAS`;
              } else {
                data[key] = val.toString();
              }
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
          // Skip logs that don't match our ABI (e.g., from other contracts)
          continue;
        }
      }

      // Most recent first
      parsed.reverse();
      setEvents(parsed);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white">Public Transaction Feed</h2>
          <p className="text-sm text-gray-400 mt-1">
            Every action on ClarityChain is public and permanent. Don't trust — verify.
          </p>
        </div>
        <button
          onClick={fetchEvents}
          className="text-sm text-pink-400 hover:text-pink-300 transition"
        >
          ↻ Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Loading transaction history...</div>
      ) : events.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          No transactions yet. Create a campaign and make a donation to see them here.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={index}
              className={`rounded-xl border-l-4 bg-gray-900 p-4 ${EVENT_COLORS[event.type] || "border-gray-600"}`}
            >
              {/* Event header */}
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-white">
                  {EVENT_ICONS[event.type] || "📌"} {event.type}
                </span>
                <span className="text-xs text-gray-500">Block #{event.blockNumber.toString()}</span>
              </div>

              {/* Event data */}
              <div className="space-y-1">
                {Object.entries(event.data).map(([key, val]) => (
                  <div key={key} className="flex gap-2 text-sm flex-wrap">
                    <span className="text-gray-400 capitalize min-w-[100px]">{key}:</span>
                    <span className="text-gray-200 break-all">{val}</span>
                  </div>
                ))}
              </div>

              {/* Tx hash link */}
              {event.txHash && (
                <a
                  href={`https://blockscout-passet-hub.parity-testnet.parity.io/tx/${event.txHash}`}
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
  );
};

export default TransactionFeed;
