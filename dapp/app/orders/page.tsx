'use client'

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import CampaignCard from "../components/CampaignCard";
import CampaignModal from "../components/CampaignModal";
import CampaignSkeleton from "../components/CampaignSkeleton";
import NavigationBar from "../components/NavigationBar";
import RefreshButton from "../components/RefreshButton";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export default function OrdersPage() {
    const [campaignModal, setCampaignModal] = useState<Campaign | null>(null)
    const {vendorCampaigns, loading, fetchCampaigns} = useCampaign();
    const {isVendorWhitelisted} = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isVendorWhitelisted) {
            router.push("/donate")
        }
    }, [isVendorWhitelisted])

    if (loading) {
        return <>
            <NavigationBar activeTab="orders" />
            <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Vendor Campaigns</h2>
                </div>
                <CampaignSkeleton />
                <CampaignSkeleton />
            </div>
            </div>
        </>;
    }

    if (vendorCampaigns.length === 0) {
    return <>
        <NavigationBar activeTab="orders" />
        <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-12 text-center">
            <p className="text-gray-400 text-lg">No vendor campaigns yet.</p>
        </div>
        </div>
    </>;
    }

    return <>
        <NavigationBar activeTab="orders" />
        <div className="max-w-5xl mx-auto px-4 py-8">
            <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Vendor Campaigns</h2>
                <RefreshButton onClick={fetchCampaigns} />
            </div>

            {vendorCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} setCampaignModal={setCampaignModal} />
            ))}
            </div>
        </div>
        
        <CampaignModal campaign={campaignModal} setCampaign={setCampaignModal} />
    </>;
};