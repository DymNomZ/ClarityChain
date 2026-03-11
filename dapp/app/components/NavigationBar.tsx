'use client'

import { useRouter } from "next/navigation";
import { useAuth } from "../contexts/AuthContext";

type Tab = "donate" | "ngo" | "vendors" | "feed" | "orders";

interface NavigationBarProps {
    activeTab: Tab
}

interface NavigationData {
    id: Tab;
    label: string;
    icon: string 
}

export default function NavigationBar({ activeTab }: NavigationBarProps) {
    const {isVendorWhitelisted} = useAuth();
    const router = useRouter();
    const tabs: NavigationData[] = [
        { id: "donate", label: "Donate", icon: "💰" },
        { id: "ngo", label: "My Campaigns", icon: "🏕️" },
        { id: "vendors", label: "Vendor Governance", icon: "🗳️" },
        { id: "feed", label: "Public Feed", icon: "📡" },
    ];

    if (isVendorWhitelisted) {
        tabs.push({ id: "orders", label: "Vendor Dashboard", icon: "🏪" });
    }

    function navigate(tabId: string) {
        if (tabId != activeTab) {
            router.push(tabId);
        }
    }

    function NavigationButton(tabData: {tab: NavigationData}) {
        const tab = tabData.tab

        return <button
            onClick={() => navigate(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                activeTab === tab.id
                ? "border-pink-500 text-pink-400"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
            >
            {tab.icon} {tab.label}
        </button>
    }

    return (
        <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4">
                <div className="flex gap-1 justify-center">
                    {tabs.map((tab) => (
                        <NavigationButton key={tab.id} tab={tab} />
                    ))}

                    { isVendorWhitelisted ? <NavigationButton key={"orders"} tab={{ id: "orders", label: "Vendor Dashboard", icon: "🏪" }} /> : ''}
                </div>
            </div>
        </div>
    );
}