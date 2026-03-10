'use client'

interface RefreshButtonProps {
    onClick: () => void,
    className?: string,
}

export default function RefreshButton({ onClick, className = "" }: RefreshButtonProps) {
    return (
        <button className={`text-sm text-pink-400 hover:text-pink-300 transition ${className}`} onClick={onClick}>
            ↻ Refresh
        </button>
    )
}