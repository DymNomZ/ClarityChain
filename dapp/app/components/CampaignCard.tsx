import { ChangeEvent, useEffect, useState } from "react";
import { parseEther, formatEther } from "viem";
import { useAuth } from "../contexts/AuthContext";
import { getWalletClient, polkadotTestnet, publicClient } from "../utils/viem";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { parseContractError } from "../utils/errors";
import VerifiedBadge from "./VerifiedBadge";

interface CampaignCardProps {
    campaign: Campaign,
    fetchCampaigns: () => void,
    setCampaignModal: (campaign: Campaign | null) => void
}

const getProgressPercent = (raised: bigint, goal: bigint) => {
    if (goal === 0n) return 0;
    return Math.min(100, Number((raised * 100n) / goal));
};

const getCampaignStatusLabel = (campaign: Campaign) => {
    if (campaign.refundsEnabled) return { label: "Refunding", classes: "bg-yellow-900 text-yellow-300" };
    if (!campaign.active) return { label: "Closed", classes: "bg-gray-700 text-gray-400" };
    return { label: "Active", classes: "bg-green-900 text-green-300" };
};

export default function CampaignCard({campaign, fetchCampaigns, setCampaignModal}: CampaignCardProps) {
    const [donation, setDonation] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [type, setType] = useState<string>('')
    const [message, setMessage] = useState<string | null>(null);
    const {account} = useAuth();

    useEffect(() => {
        setDonation('')
    }, [account])

    function handleOnChange(e: ChangeEvent<HTMLInputElement, HTMLInputElement>) {
        if (e.target.value == '') {
            setDonation('')
            return;
        }

        const amount: number = parseFloat(e.target.value);
        const maxDonation = Number(formatEther(campaign.goalAmount)) - Number(formatEther(campaign.raisedAmount));

        if (amount > maxDonation) {
            setDonation(Math.max(0, maxDonation).toString())
        } else if (amount >= 0) { 
            setDonation(e.target.value);
        }
    }

    const handleDonate = async (campaignId: number) => {
        if (!account) {
            setType("error")
            setMessage("Connect your wallet first.")
            return;
        }

        const amount = donation;
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            setType("error")
            setMessage("Enter a valid donation amount.")
            return;
        }

        if (campaign && parseEther(amount) > campaign.goalAmount - campaign.raisedAmount) {
            setType("error")
            setMessage(`Too much! Only ${formatEther(campaign.goalAmount - campaign.raisedAmount)} PAS left to reach the goal.`)
            return;
        }

        try {
            setSubmitting(true);
            setType("info")
            setMessage("Confirm in your wallet...")

            const walletClient = await getWalletClient();
            if (!walletClient) throw new Error("Wallet not available");

            // Network check before attempting transaction
            const walletChainId = await walletClient.getChainId();
            if (walletChainId !== polkadotTestnet.id) {
                setType("error")
                setMessage("Please switch MetaMask to Polkadot Hub TestNet before donating.")
                return;
            }

            const { request } = await publicClient.simulateContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "donate",
                args: [BigInt(campaignId)],
                value: parseEther(amount),
                account: walletClient.account,
            });

            const hash = await walletClient.writeContract(request);
            setType("info")
            setMessage("Waiting for confirmation...")

            await publicClient.waitForTransactionReceipt({ hash });

            setType("success")
            setMessage(`Donated ${amount} PAS successfully! Tx: ${hash.slice(0, 18)}...`)
            setDonation('')
            fetchCampaigns();
        } catch (err: any) {
            setType("error")
            setMessage(parseContractError(err))
        } finally {
            setSubmitting(false)
        }
    };

    const statusLabel = getCampaignStatusLabel(campaign);

    return (
        <div onDoubleClick={() => setCampaignModal(campaign)} className={`rounded-xl border hover:border-pink-300 duration-150 p-5 space-y-4 ${campaign.active ? "border-pink-500 bg-gray-900" : "border-gray-600 bg-gray-800 opacity-60"}`}>
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-lg font-bold text-white">{campaign.name}</h3>
                    <p className="text-xs text-gray-400 mt-1 break-all flex items-start gap-1 flex-wrap">NGO: {campaign.ngo} <VerifiedBadge address={campaign.ngo} /></p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold shrink-0 ml-2 ${statusLabel.classes}`}>
                  {statusLabel.label}
                </span>
            </div>

            <div>
                <div className="flex justify-between text-sm text-gray-400 mb-1">
                    <span>{formatEther(campaign.raisedAmount)} PAS raised</span>
                    <span>Goal: {formatEther(campaign.goalAmount)} PAS</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                        className="bg-pink-500 h-2 rounded-full transition-all"
                        style={{ width: `${getProgressPercent(campaign.raisedAmount, campaign.goalAmount)}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                    Available to spend: {formatEther(campaign.raisedAmount - campaign.withdrawnAmount)} PAS
                </p>
                {campaign.active && campaign.goalAmount > campaign.raisedAmount && (
                    <p className="text-xs text-gray-600 mt-0.5">
                        Remaining to goal: {formatEther(campaign.goalAmount - campaign.raisedAmount)} PAS
                    </p>
                )}
                {campaign.active && campaign.goalAmount === campaign.raisedAmount && (
                    <p className="text-xs text-teal-500 mt-0.5 font-medium">
                        ✓ Goal reached
                    </p>
                )}
            </div>

            {/* Refund notice */}
            {campaign.refundsEnabled && (
                <div className="rounded-lg bg-yellow-900/40 border border-yellow-700 px-3 py-2 text-xs text-yellow-300">
                    ⚠️ This campaign has been closed by the NGO and refunds are enabled. Contact the NGO if you donated and need to claim your refund.
                </div>
            )}

            {/* Donate form — only for active campaigns */}
            {campaign.active && (
                <div className="space-y-2">
                {message && (
                    <div className={`text-sm p-2 rounded-md ${
                        type === "error" ? "bg-red-900 text-red-300"
                        : type === "success" ? "bg-green-900 text-green-300"
                        : "bg-blue-900 text-blue-300"
                        }`}>
                        {message}
                    </div>
                )}
                    <div className="flex gap-2">
                        <input
                            type="number"
                            placeholder="Amount (PAS)"
                            value={donation}
                            onChange={(e) => handleOnChange(e)}
                            onDoubleClick={(e) => e.stopPropagation()}
                            disabled={submitting || !account}
                            className="flex-1 p-2 rounded-lg bg-gray-800 border border-gray-600 text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                        />
                        <button
                            onClick={() => handleDonate(campaign.id)}
                            disabled={submitting || !account}
                            onDoubleClick={(e) => e.stopPropagation()}
                            className="bg-pink-500 hover:bg-pink-600 text-white font-bold py-2 px-4 rounded-lg transition disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            {submitting ? "..." : "Donate"}
                        </button>
                    </div>
                    {!account && <p className="text-xs text-gray-500">Connect your wallet to donate.</p>}
                </div>
            )}
        </div>
    );
}