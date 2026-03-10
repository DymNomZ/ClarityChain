'use client'

import { createPortal } from "react-dom";

interface ModalProps {
    hide: boolean,
    setHidden: () => void,
    children: React.ReactNode,
    className: string
}

export default function Modal({hide, setHidden, children, className}: ModalProps) {
    return createPortal((
        <div onClick={() => setHidden()} className={`fixed top-0 left-0 h-screen w-screen bg-black/70 backdrop-blur-[1px] z-20 flex flex-col justify-center ${hide ? 'hidden' : ''}`}>
            <div onClick={(e) => e.stopPropagation()} className={`w-4/6 max-h-5/6 overflow-y-auto ${className}`}>
                { children }
            </div>
        </div>),
        document.body
    )
}