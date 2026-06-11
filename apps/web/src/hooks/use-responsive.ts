import { useState, useEffect } from "react";

export interface ResponsiveBreakpoints {
    isMobile: boolean;
    isTablet: boolean;
    isDesktop: boolean;
    isWide: boolean;
}

export function useResponsive(): ResponsiveBreakpoints {
    const [breakpoints, setBreakpoints] = useState<ResponsiveBreakpoints>({
        isMobile: false,
        isTablet: false,
        isDesktop: false,
        isWide: false,
    });

    useEffect(() => {
        const mobileQuery = window.matchMedia("(max-width: 767px)");
        const tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1023px)");
        const desktopQuery = window.matchMedia("(min-width: 1024px)");
        const wideQuery = window.matchMedia("(min-width: 1440px)");

        const update = () => {
            setBreakpoints({
                isMobile: mobileQuery.matches,
                isTablet: tabletQuery.matches,
                isDesktop: desktopQuery.matches,
                isWide: wideQuery.matches,
            });
        };

        // Initial trigger
        update();

        // Listeners
        if (typeof mobileQuery.addEventListener === "function") {
            mobileQuery.addEventListener("change", update);
            tabletQuery.addEventListener("change", update);
            desktopQuery.addEventListener("change", update);
            wideQuery.addEventListener("change", update);
        } else {
            // Fallback for older browsers
            mobileQuery.addListener(update);
            tabletQuery.addListener(update);
            desktopQuery.addListener(update);
            wideQuery.addListener(update);
        }

        return () => {
            if (typeof mobileQuery.removeEventListener === "function") {
                mobileQuery.removeEventListener("change", update);
                tabletQuery.removeEventListener("change", update);
                desktopQuery.removeEventListener("change", update);
                wideQuery.removeEventListener("change", update);
            } else {
                mobileQuery.removeListener(update);
                tabletQuery.removeListener(update);
                desktopQuery.removeListener(update);
                wideQuery.removeListener(update);
            }
        };
    }, []);

    return breakpoints;
}
