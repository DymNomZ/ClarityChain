'use client'

import { useEffect, useRef, useState } from "react";
import { useFeed } from "../contexts/FeedContext";
import { CloseButton } from "./CloseButton";
import { FeedModalSkeleton } from "./FeedSkeleton";
import Modal from "./Modal";
import RefreshButton from "./RefreshButton";
import TransactionCard from "./TransactionCard";

interface CampaignModalProps {
    campaign: Campaign | null,
    setCampaign: (campaign: Campaign | null) => void
}

export default function CampaignModal({campaign, setCampaign}: CampaignModalProps) {
    const {vendorMap, events, loading, fetchError, fetchEvents} = useFeed()
    const [campaignEvents, setCampaignEvents] = useState<FeedEvent[]>([])
    const abortFetch = useRef<AbortController>(new AbortController())

    useEffect(() => {
        if (campaign) {
            document.body.classList.add('overflow-hidden');
            setCampaignEvents(events.filter(e => e.campaignId === campaign.id))
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
                <div className="flex gap-6">
                    <RefreshButton onClick={() => fetchEvents()} />
                    <CloseButton onClick={() => setCampaign(null)} />
                </div>
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
            ) : campaignEvents.length === 0 ? (
                <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
                    <p className="text-gray-400">No transactions yet.</p>
                </div>
            ) : (
                <div className="space-y-3">
                {campaignEvents.map((event, index) => (
                    <TransactionCard key={index} event={event} backgroundColor="bg-gray-800" vendorMap={vendorMap} />
                ))}
                </div>
            )}
        </Modal>
    )
}