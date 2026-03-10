'use client'

import { createContext, useContext } from "react";

interface FeedContextType {
    
}

const FeedContext = createContext<FeedContextType | undefined>(undefined);

export function FeedProvider({ children }: { children: React.ReactNode }) {
    

    return (
        <FeedContext.Provider value={{
            
        }}>
            { children }
        </FeedContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (context == undefined) {
        throw new Error('Called outside AuthProvider');
    }

    return context
}