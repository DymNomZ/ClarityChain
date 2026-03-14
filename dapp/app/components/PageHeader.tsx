'use client'

import WalletConnect from "./WalletConnect"

export default function PageHeader() {
    return (
        <header className="border-b border-gray-800 bg-gray-900">
            <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <img src="/ClarityChain-logo.png" alt="ClarityChain logo" className="w-12 h-12" />
                <div>
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        Clarity<span className="text-pink-500">Chain</span>
                    </h1>
                    <p className="text-xs text-gray-400 mt-0.5">
                        Built on Polkadot Hub
                    </p>
                </div>
            </div>
            <WalletConnect />
            </div>
        </header>
    )
}