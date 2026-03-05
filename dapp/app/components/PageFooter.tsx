'use client'

export default function PageFooter() {
    return (
        <footer className="border-t border-gray-800 mt-auto py-6 text-center text-xs text-gray-600">
            ClarityChain — Polkadot Solidity Hackathon 2026, Cebu Edition
            <br />
            Contract:{" "}
            <a
            href={`https://blockscout-testnet.polkadot.io/address/0xfa26ab4f40387ddaae9c338abbb9984678ce0c29`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-500 hover:text-pink-400"
            >
            0xfa26ab4f40387ddaae9c338abbb9984678ce0c29
            </a>
        </footer>
    )
}