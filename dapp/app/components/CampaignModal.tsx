import { useEffect } from "react";

interface CampaignModalProps {
    campaign: Campaign | null,
    setCampaign: (campaign: Campaign | null) => void
}

export default function CampaignModal({campaign, setCampaign}: CampaignModalProps) {
    useEffect(() => {
        if (campaign) {
            document.body.classList.add('overflow-hidden');
        }

        return () => {
            document.body.classList.remove('overflow-hidden');
        };
    }, [campaign]);

    return (
        <div onClick={() => setCampaign(null)} className={`fixed top-0 left-0 h-screen w-screen bg-black/35 backdrop-blur-[1px] z-20 flex flex-col justify-center ${campaign ? '' : 'hidden'}`}>
            <div onClick={(e) => e.stopPropagation()} className="max-w-5xl border border-pink-500 bg-gray-900 mx-auto px-6 py-3 rounded-xl">
                <h3 className="text-lg font-bold text-white">Campaign Feed</h3>
            </div>
        </div>
    )
}