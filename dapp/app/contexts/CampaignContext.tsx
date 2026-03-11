'use client'

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { publicClient } from "../utils/viem";
import { useAuth } from "./AuthContext";

interface CampaignContextType {
    campaigns: Campaign[],
    vendorCampaigns: Campaign[],
    myCampaigns: Campaign[],
    fetchCampaigns: () => void,
    loading: boolean,
    setCampaigns: (campaigns: Campaign[]) => void
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([])
    const [vendorCampaigns, setVendorCampaigns] = useState<Campaign[]>([])
    const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const abortController = useRef(new AbortController());
    const {account} = useAuth()

    const fetchCampaigns = async () => {
        try {
            setLoading(true);
            abortController.current.abort()
            abortController.current = new AbortController()

            const countPromise = publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "campaignCount",
            });
    
            const abortPromise = new Promise((_, reject) => {
                abortController.current.signal.addEventListener("abort", () =>
                    reject(new DOMException("Aborted", "AbortError"))
                );
            });

            const count = await Promise.race([countPromise, abortPromise]) as bigint

            const fetched: Campaign[] = [];
            for (let i = 0; i < Number(count); i++) {
                // getCampaign now returns 7 fields — refundsEnabled added at index [6]
                const campaignPromise = publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: "getCampaign",
                    args: [BigInt(i)],
                })

                const result = await Promise.race([campaignPromise, abortPromise]) as any

                const vendorsPromise = publicClient.readContract({
                    address: CONTRACT_ADDRESS,
                    abi: CONTRACT_ABI,
                    functionName: "getCampaignVendorList",
                    args: [BigInt(i)],
                })


                const vendors = await Promise.race([vendorsPromise, abortPromise]) as string[]
        
                fetched.push({
                    id: i,
                    name: result[0],
                    ngo: result[1],
                    goalAmount: result[2],
                    raisedAmount: result[3],
                    withdrawnAmount: result[4],
                    active: result[5],
                    refundsEnabled: result[6],
                    vendors: vendors
                });
            }
            setCampaigns(fetched);

            if (account != null) {
                setVendorCampaigns(fetched.filter((campaign) => campaign.vendors.some((vendor) => vendor.toLowerCase() == account)))
                setMyCampaigns(fetched.filter((campaign) => campaign.ngo.toLowerCase() == account))
            } else {
                setVendorCampaigns([])
                setMyCampaigns([])
            }
        } catch (err: any) {
            if (err.name === "AbortError") return; // Cancelled
            console.error("Failed to fetch campaigns:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCampaigns()
    }, [account])

    return (
        <CampaignContext.Provider value={{
            campaigns: campaigns,
            vendorCampaigns: vendorCampaigns,
            myCampaigns: myCampaigns,
            fetchCampaigns: fetchCampaigns,
            loading: loading,
            setCampaigns: setCampaigns
        }}>
            { children }
        </CampaignContext.Provider>
    )
}

export function useCampaign() {
    const context = useContext(CampaignContext);

    if (context == undefined) {
        throw new Error('Called outside CampaignProvider');
    }

    return context
}