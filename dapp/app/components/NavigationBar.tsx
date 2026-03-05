'use client'

import { useRouter } from "next/navigation";

type Tab = "donate" | "ngo" | "vendors" | "feed";

interface NavigationBarProps {
    activeTab: Tab
}

export default function NavigationBar({ activeTab }: NavigationBarProps) {
    const router = useRouter();
    const tabs: { id: Tab; label: string; icon: string }[] = [
        { id: "donate", label: "Donate", icon: "💰" },
        { id: "ngo", label: "NGO Dashboard", icon: "🏕️" },
        { id: "vendors", label: "Vendor Governance", icon: "🗳️" },
        { id: "feed", label: "Public Feed", icon: "📡" },
    ];

    function navigate(tabId: string) {
        if (tabId != activeTab) {
            router.push(tabId);
        }
    }

    return (
        <div className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4">
                <div className="flex gap-1">
                {tabs.map((tab) => (
                    <button
                    key={tab.id}
                    onClick={() => navigate(tab.id)}
                    className={`px-4 py-3 text-sm font-medium transition border-b-2 ${
                        activeTab === tab.id
                        ? "border-pink-500 text-pink-400"
                        : "border-transparent text-gray-400 hover:text-gray-200"
                    }`}
                    >
                    {tab.icon} {tab.label}
                    </button>
                ))}
                </div>
            </div>
        </div>
    );
}