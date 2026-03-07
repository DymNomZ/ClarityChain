"use client";

import React, { useState, useEffect } from "react";
import { publicClient } from "../utils/viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI } from "../utils/contract";
import { getValidatorProfile } from "../utils/validators";

interface Props {
  address: string;
}

const VerifiedBadge: React.FC<Props> = ({ address }) => {
  const [verified, setVerified] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [showLinks, setShowLinks] = useState(false);

  useEffect(() => {
    if (!address || address.length !== 42) return;

    // Check hardcoded validator map first — no contract call needed.
    const validatorProfile = getValidatorProfile(address);
    if (validatorProfile) {
      setVerified(true);
      setLinks(validatorProfile.links);
      return;
    }

    // Fall through to on-chain identity verification check.
    const checkOnChain = async () => {
      try {
        const result = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: CONTRACT_ABI,
          functionName: "getIdentityInfo",
          args: [address as `0x${string}`],
        }) as [boolean, string];

        if (result[0]) {
          setVerified(true);
          const parts = result[1].split("|");
          setLinks(parts.slice(1).filter((l) => l.startsWith("http")));
        }
      } catch {
        // Silently fail — unverified is the default
      }
    };
    checkOnChain();
  }, [address]);

  if (!verified) return null;

  return (
    <span className="inline-flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-teal-500 text-white text-xs font-bold leading-none"
          title="Identity verified"
        >
          ✓
        </span>
        {links.length > 0 && (
          <button
            onClick={() => setShowLinks((prev) => !prev)}
            className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition"
          >
            who is this?
          </button>
        )}
      </span>

      {showLinks && (
        <span className="flex flex-col gap-0.5 pl-5">
          {links.map((link, i) => (
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
  );
};

export default VerifiedBadge;