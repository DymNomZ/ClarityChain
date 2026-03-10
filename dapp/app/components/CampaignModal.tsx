'use client'

import { useEffect, useRef, useState } from "react";
import { formatEther } from "viem";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { publicClient } from "../utils/viem";
import { FeedModalSkeleton } from "./FeedSkeleton";
import RefreshButton from "./RefreshButton";
import TransactionCard from "./TransactionCard";
import Modal from "./Modal";

interface CampaignModalProps {
    campaign: Campaign | null,
    setCampaign: (campaign: Campaign | null) => void
}

export default function CampaignModal({campaign, setCampaign}: CampaignModalProps) {
    const [events, setEvents] = useState<FeedEvent[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [fetchError, setFetchError] = useState<string>('')
    const abortFetch = useRef<AbortController>(new AbortController())

    async function fetchTransactions() {
        if (campaign === null) return;

        try {
            setLoading(true);
            setFetchError("");
            abortFetch.current = new AbortController()

            const logsPromise = publicClient.getLogs({
                address: CONTRACT_ADDRESS,
                fromBlock: 0n,
                toBlock: "latest",
            });

            const abortPromise = new Promise((_, reject) => {
                abortFetch.current.signal.addEventListener("abort", () =>
                    reject(new DOMException("Aborted", "AbortError"))
                );
            });

            const logs = (await Promise.race([logsPromise, abortPromise])) as any;

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
            if (err.name === "AbortError") return; // Cancelled
            console.error("Failed to fetch events:", err);
            setFetchError("Failed to load transaction history. Check your network connection and try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (campaign) {
            document.body.classList.add('overflow-hidden');
            fetchTransactions()
        }

        return () => {
            document.body.classList.remove('overflow-hidden');
            abortFetch.current.abort()
        };
    }, [campaign]);

    return (
        <Modal hide={campaign == null} setHidden={() => setCampaign(null)} className="border border-gray-700 bg-gray-900 mx-auto px-11 pt-6 pb-11 rounded-sm scrollbar scrollbar-thumb-gray-800 scrollbar-hover:scrollbar-thumb-gray-700">
            <div className="flex justify-between w-full mb-6">
                <div>
                    <h3 className="text-lg font-bold text-white">{campaign?.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 break-all flex items-start gap-1 flex-wrap">Public Transaction Feed</p>
                </div>
                <RefreshButton onClick={() => fetchTransactions()} />
            </div>
            {fetchError && (
                <div className="rounded-xl border border-red-800 bg-red-900/30 p-4 text-sm text-red-300 mb-2">
                    {fetchError}
                </div>
            )}

            {loading ? (
                <div className="space-y-3">
                    <FeedModalSkeleton />
                    <FeedModalSkeleton />
                    <FeedModalSkeleton />
                </div>
            ) : events.length === 0 ? (
                <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
                    <p className="text-gray-400">No transactions yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                {events.map((event, index) => (
                    <TransactionCard key={index} event={event} backgroundColor="bg-gray-800" />
                ))}
                </div>
            )}
        </Modal>
    )
}