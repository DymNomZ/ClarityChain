'use client'

export default function PageFooter() {
    return (
        <footer className="border-t border-gray-800 mt-auto py-6 text-center text-xs text-gray-600">
            ClarityChain — Polkadot Solidity Hackathon 2026, Cebu Edition
            <br />
            Contract:{" "}
            <a
            href={`https://blockscout-testnet.polkadot.io/address/0xc88bc54dd0186bf954e3bb9f3b8be32dfd6a46b6`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-pink-500 hover:text-pink-400"
            >
            0xc88bc54dd0186bf954e3bb9f3b8be32dfd6a46b6
            </a>
        </footer>
    )
}