'use client'

import { useEffect, useState } from "react";
import { getValidatorProfile } from "../utils/validators";

export const EVENT_ICONS: Record<string, string> = {
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

export const EVENT_COLORS: Record<string, string> = {
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

// Address-type fields that may belong to a known validator or verified identity.
export const ADDRESS_FIELDS = new Set(["validator", "ngo", "donor", "vendor", "proposedby", "applicant"]);
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

// Renders a feed event field. Priority for address fields:
//   1. Validator  → pink,  name,       "who is this?"
//   2. Vendor     → green, 🏪 name,    "who is this?"
//   3. Verified   → cyan,  name,       "who is this?"
const ValidatorAwareField: React.FC<{
  fieldKey: string;
  value: string;
  vendorMap: VendorMap
}> = ({ fieldKey, value, vendorMap }) => {
  const [showLinks, setShowLinks] = useState(false);
  const [identity, setIdentity] = useState<IdentityInfo | null>(null);

  useEffect(() => {
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
          const name = parts[0];
          const links = parts.slice(1).filter((l: string) => l.startsWith("http"));
          setIdentity({ name, links, tier: "verified" });
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

interface TransactionCardProps {
    event: FeedEvent;
    vendorMap: VendorMap;
    backgroundColor?: string;
    borderColor?: string;
}

export default function TransactionCard({event, vendorMap, backgroundColor = "bg-gray-900", borderColor = "border-gray-600"}: TransactionCardProps) {
    return (
        <div
            className={`rounded-xl border-l-4 ${backgroundColor} p-4 ${EVENT_COLORS[event.type] || borderColor}`}
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
    )
}