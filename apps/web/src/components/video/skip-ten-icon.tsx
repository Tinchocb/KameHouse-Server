/** Flecha circular con "10" dentro, como los botones de AVKit. */
export function SkipTenIcon({ direction }: { direction: "back" | "forward" }) {
    return (
        <svg viewBox="0 0 32 32" aria-hidden className="w-full h-full">
            <g transform={direction === "forward" ? "translate(32 0) scale(-1 1)" : undefined}>
                <path d="M7.5 9.5A11 11 0 1 1 5 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M7.8 3.8v6h6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
            <text x="16" y="20.2" textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">10</text>
        </svg>
    )
}

