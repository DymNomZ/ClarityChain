'use client'

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { CONTRACT_ABI, CONTRACT_ADDRESS } from "../utils/contract";
import { publicClient } from "../utils/viem";

interface AuthContextType {
    account: string | null,
    setAccount: (account: string | null) => void,
    isVendorWhitelisted: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [account, setAccount] = useState<string | null>(null);
    const [isVendorWhitelisted, setIsVendorWhitelisted] = useState<boolean>(false);
    const abortFetch = useRef<AbortController>(new AbortController())

    async function fetchVendorWhitelistStatus() {
        try {
            abortFetch.current = new AbortController()

            const whitelistPromise = publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: CONTRACT_ABI,
                functionName: "whitelistedVendors",
                args: [account!],
            })

            const abortPromise = new Promise((_, reject) => {
                abortFetch.current.signal.addEventListener("abort", () =>
                    reject(new DOMException("Aborted", "AbortError"))
                );
            });

            const isWhitelisted = await Promise.race([whitelistPromise, abortPromise]) as boolean
            setIsVendorWhitelisted(isWhitelisted);
        } catch (err) {
            if (err instanceof DOMException && err.name === "AbortError") {
                // Fetch was aborted, likely due to account change — ignore this error
                return;
            }
            console.error("Error fetching account:", err);
        }
    }

    useEffect(() => {
        if (account) {
            fetchVendorWhitelistStatus();
        }

        return () => {
            abortFetch.current.abort()
            setIsVendorWhitelisted(false);
        }
    }, [account])

    return (
        <AuthContext.Provider value={{
            account: account,
            setAccount: setAccount,
            isVendorWhitelisted: isVendorWhitelisted
        }}>
            { children }
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (context == undefined) {
        throw new Error('Called outside AuthProvider');
    }

    return context
}