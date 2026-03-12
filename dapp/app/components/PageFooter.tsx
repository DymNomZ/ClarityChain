'use client'

export default function PageFooter() {
    return (
        <footer className="border-t border-gray-800 mt-auto py-6 text-center text-xs text-gray-600">
            ClarityChain — Polkadot Solidity Hackathon 2026, Cebu Edition
            <br />
            Contract:{" "}
            <a
            href={`https://blockscout-testnet.polkadot.io/address/0xbf0a89253c1f590dcb25a4e5b7ef4b7ef691d585`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-500 hover:text-pink-400"
            >
            0xbf0a89253c1f590dcb25a4e5b7ef4b7ef691d585
            </a>
        </footer>
    )
}