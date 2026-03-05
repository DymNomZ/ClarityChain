'use client'

import { createContext, useContext, useState } from "react"

interface AuthContextType {
    account: string | null,
    setAccount: (account: string | null) => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [account, setAccount] = useState<string | null>(null);

    const value: AuthContextType = {
        account: account,
        setAccount: setAccount
    }

    return (
        <AuthContext.Provider value={value}>
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