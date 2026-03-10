export function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="text-gray-500 hover:text-white text-xl leading-none"
        >
        ✕
        </button>
    )
}