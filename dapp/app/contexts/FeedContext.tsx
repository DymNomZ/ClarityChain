'use client'

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { formatEther, parseAbiItem } from "viem";
import { abortableFetch } from "../utils/abortableFetch";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { publicClient } from "../utils/viem";
import { useCampaign } from "./CampaignContext";

interface FeedContextType {
    vendorMap: VendorMap,
    events: FeedEvent[],
    loading: boolean,
    fetchEvents: () => void,
    fetchError: string
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
    const [vendorMap, setVendorMap] = useState<VendorMap>(new Map());
    const [events, setEvents] = useState<FeedEvent[]>([]);
    const [loading, setLoading] = useState(false);
    const [fetchError, setFetchError] = useState("");
    const abortVendor = useRef(new AbortController());
    const abortFeed = useRef(new AbortController());
    const {campaigns} = useCampaign()

    const fetchVendorMap = async () => {
        try {
            abortVendor.current.abort();
            abortVendor.current = new AbortController();

            const result = await abortableFetch(
                publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: "getWhitelistedVendors",
                }),
                abortVendor.current.signal
            ) as [string[], string[]];

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
            // If Aborted, ignored
            //
            // Non-fatal — feed still works, just no vendor badges
        }
    };

    const fetchEvents = async () => {
        fetchVendorMap();

        try {
            abortFeed.current.abort();
            abortFeed.current = new AbortController();
            setLoading(true);
            setFetchError("");

            const logs = await abortableFetch(
                publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    fromBlock: 0n,
                    toBlock: "latest",
                }),
                abortFeed.current.signal
            );

            const parsed: FeedEvent[] = [];
            const txHashIndexMap = new Map<string, number>();
            const { decodeEventLog } = await import("viem");
            
            var i = 0;
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
                            // strip pipe-separated links from vendorName
                            data[key] = key === "vendorName" ? val.split("|")[0] : val;
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

                    if (log.transactionHash) {
                        txHashIndexMap.set(log.transactionHash, i++);
                    }
                } catch {
                    continue;
                }
            }

            for (const campaign of campaigns) {
                const eventExtData = await abortableFetch(publicClient.getLogs({
                    address: CONTRACT_ADDRESS,
                    events: [
                        parseAbiItem("event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount)"),
                        parseAbiItem("event WithdrawalToVendor(uint256 indexed campaignId, address indexed vendor, string vendorName, uint256 amount)"),
                    ],
                    args: { campaignId: BigInt(campaign.id) } as any,
                    fromBlock: 0n,
                }), abortFeed.current.signal);

                for (const extLog of eventExtData) {
                    if (extLog.transactionHash) {
                        const index = txHashIndexMap.get(extLog.transactionHash);
                        if (index !== undefined) {
                            parsed[index].campaignId = campaign.id;
                            parsed[index].campaignNgo = campaign.ngo;
                        }
                    }
                }
            }
    
            parsed.reverse();
            setEvents(parsed);
        } catch (err: any) {
            if (err.name === "AbortError") return;
            console.error("Failed to fetch events:", err);
            setFetchError("Failed to load transaction history. Check your network connection and try again.");
        }
        setLoading(false);
      };

    useEffect(() => {
        fetchEvents();
    }, [campaigns]);

    return (
        <FeedContext.Provider value={{
            vendorMap,
            events,
            loading,
            fetchEvents,
            fetchError
        }}>
            { children }
        </FeedContext.Provider>
    )
}

export function useFeed() {
    const context = useContext(FeedContext);

    if (context == undefined) {
        throw new Error('Called outside FeedProvider');
    }

    return context
}