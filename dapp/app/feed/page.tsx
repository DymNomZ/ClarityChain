"use client";

import React, { useState, useEffect } from "react";
import { publicClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { formatEther } from "viem";
import NavigationBar from "../components/NavigationBar";
import { getValidatorProfile } from "../utils/validators";

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
  VendorAssociated: "🔗",
  VendorRefundedCampaign: "↩️",
  VendorProposed: "📋",
  VendorApprovalSigned: "✍️",
  VendorWhitelisted: "🟢",
  CampaignClosed: "🔒",
  RefundsEnabled: "🔁",
  RefundClaimed: "💸",
  IdentityVerificationApplied: "🪪",
  IdentityVerificationSigned: "✍️",
  IdentityVerified: "✔️",
};

const EVENT_COLORS: Record<string, string> = {
  CampaignCreated: "border-blue-600",
  DonationReceived: "border-green-600",
  WithdrawalToVendor: "border-pink-500",
  VendorAssociated: "border-purple-500",
  VendorRefundedCampaign: "border-orange-500",
  VendorProposed: "border-yellow-600",
  VendorApprovalSigned: "border-yellow-400",
  VendorWhitelisted: "border-green-400",
  CampaignClosed: "border-gray-500",
  RefundsEnabled: "border-yellow-600",
  RefundClaimed: "border-blue-400",
  IdentityVerificationApplied: "border-indigo-500",
  IdentityVerificationSigned: "border-indigo-400",
  IdentityVerified: "border-teal-400",
};

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

// Address-type fields that may belong to a known validator or verified identity.
const ADDRESS_FIELDS = new Set(["validator", "ngo", "donor", "vendor", "proposedby", "applicant"]);

type IdentityTier = "validator" | "vendor" | "verified";

interface IdentityInfo {
  name: string;
  links: string[];
  tier: IdentityTier;
}

const TIER_STYLES: Record<IdentityTier, string> = {
  validator: "text-pink-400",
  vendor:    "text-green-400",
  verified:  "text-cyan-400",
};

const TIER_ICON: Record<IdentityTier, string> = {
  validator: "",
  vendor:    "🏪 ",
  verified:  "",
};

// Vendor map fetched once at TransactionFeed level and passed as prop.
// Map key is lowercase address, value is { name, links }.
type VendorMap = Map<string, { name: string; links: string[] }>;

// Renders a feed event field. Priority for address fields:
//   1. Validator  → pink,  name,       "who is this?"
//   2. Vendor     → green, 🏪 name,    "who is this?"
//   3. Verified   → cyan,  name,       "who is this?"
const ValidatorAwareField: React.FC<{
  fieldKey: string;
  value: string;
  vendorMap: VendorMap;
}> = ({ fieldKey, value, vendorMap }) => {
  const [showLinks, setShowLinks] = React.useState(false);
  const [identity, setIdentity] = React.useState<IdentityInfo | null>(null);

  React.useEffect(() => {
    if (!value.startsWith("0x") || !ADDRESS_FIELDS.has(fieldKey.toLowerCase())) return;

    // Tier 1 — validator (synchronous, no RPC)
    const validatorProfile = getValidatorProfile(value);
    if (validatorProfile) {
      setIdentity({ name: validatorProfile.name, links: validatorProfile.links, tier: "validator" });
      return;
    }

    // Tier 2 — whitelisted vendor (from pre-fetched map, no extra RPC per field)
    const vendorProfile = vendorMap.get(value.toLowerCase());
    if (vendorProfile) {
      setIdentity({ name: vendorProfile.name, links: vendorProfile.links, tier: "vendor" });
      return;
    }

    // Tier 3 — on-chain identity verification
    const checkOnChain = async () => {
      try {
        const { publicClient } = await import("../utils/viem");
        const { CONTRACT_ADDRESS, CONTRACT_ABI } = await import("../utils/contract");
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getIdentityInfo",
          args: [value as `0x${string}`],
        }) as [boolean, string];

        if (result[0]) {
          const parts = result[1].split("|");
          setIdentity({
            name: parts[0],
            links: parts.slice(1).filter((l: string) => l.startsWith("http")),
            tier: "verified",
          });
        }
      } catch {
        // Not verified — leave identity null
      }
    };
    checkOnChain();
  }, [fieldKey, value, vendorMap]);

  return (
    <div className="flex gap-2 text-sm flex-wrap items-start">
      <span className="text-gray-400 capitalize min-w-[120px]">{fieldKey}:</span>
      <span className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-gray-200 break-all">{value}</span>
          {identity && (
            <>
              <span className={`font-semibold text-xs ${TIER_STYLES[identity.tier]}`}>
                ({TIER_ICON[identity.tier]}{identity.name})
              </span>
              {identity.links.length > 0 && (
                <button
                  onClick={() => setShowLinks((p) => !p)}
                  className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
                >
                  who is this?
                </button>
              )}
            </>
          )}
        </span>
        {showLinks && identity && (
          <span className="flex flex-col gap-0.5 pl-1">
            {identity.links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 truncate max-w-xs"
              >
                ↗ {link}
              </a>
            ))}
          </span>
        )}
      </span>
    </div>
  );
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

          const eventName = decoded.eventName as string;
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
            <button onClick={fetchEvents} className="text-sm text-pink-400 hover:text-pink-300 transition">
              ↻ Refresh
            </button>
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
                    <ValidatorAwareField key={key} fieldKey={key} value={val} vendorMap={vendorMap} />
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