"use client";

import { cn } from "@/lib/utils";
import {
    type AnimationOptions,
    motion,
    stagger,
    useAnimate,
    useReducedMotion,
} from "framer-motion";
import { useCallback, useEffect, useState } from "react";

interface LetterCascadeProps {
    /** The text to animate */
    text: string;
    /** Additional CSS classes for the container */
    className?: string;
    /** CSS classes applied to each individual letter */
    letterClassName?: string;
    /** Stagger delay between each letter in seconds */
    staggerDuration?: number;
    /** Where the stagger wave originates */
    staggerFrom?: "first" | "last" | "center" | number;
    /** Spring stiffness — higher = snappier */
    stiffness?: number;
    /** Spring damping — lower = bouncier */
    damping?: number;
    /** Trigger the animation on click instead of hover */
    triggerOnClick?: boolean;
    /** Callback when the full animation cycle completes */
    onComplete?: () => void;
    /* ─── Ajouts Day 1 ─── */
    /** Joue une fois au montage (après `autoPlayDelay` secondes). */
    autoPlay?: boolean;
    /** Délai avant la lecture automatique, en secondes. */
    autoPlayDelay?: number;
    /** `false` : aucun déclenchement au survol / clic (texte de lecture, pas un jouet). */
    interactive?: boolean;
}

export function LetterCascade({
    text,
    className,
    letterClassName,
    staggerDuration = 0.04,
    staggerFrom = "first",
    stiffness = 220,
    damping = 16,
    triggerOnClick = false,
    onComplete,
    autoPlay = false,
    autoPlayDelay = 0,
    interactive = true,
}: LetterCascadeProps) {
    const [scope, animate] = useAnimate();
    const [blocked, setBlocked] = useState(false);
    /* prefers-reduced-motion : le texte reste immobile, la face avant visible. */
    const reduceMotion = useReducedMotion();

    const trigger = useCallback(() => {
        if (blocked || reduceMotion) return;
        setBlocked(true);

        const merge = (base: AnimationOptions): AnimationOptions => ({
            ...base,
            delay: stagger(staggerDuration, { from: staggerFrom }),
        });

        const spring: AnimationOptions = {
            type: "spring",
            stiffness,
            damping,
        };

        // ── Phase 1: front tilts back, echo flips in from below ──
        animate(
            ".cascade-front",
            {
                rotateX: 90,
                opacity: 0,
                y: -6,
                filter: "blur(4px)",
            },
            merge(spring)
        ).then(() => {
            // Instantly reset front
            animate(
                ".cascade-front",
                { rotateX: 0, opacity: 1, y: 0, filter: "blur(0px)" },
                { duration: 0 }
            ).then(() => {
                setBlocked(false);
                onComplete?.();
            });
        });

        animate(
            ".cascade-echo",
            {
                rotateX: 0,
                opacity: 1,
                y: 0,
                scale: 1,
                filter: "blur(0px)",
            },
            merge(spring)
        ).then(() => {
            // Instantly reset echo
            animate(
                ".cascade-echo",
                {
                    rotateX: -90,
                    opacity: 0,
                    y: 6,
                    scale: 0.8,
                    filter: "blur(4px)",
                },
                { duration: 0 }
            );
        });
    }, [
        blocked,
        reduceMotion,
        animate,
        staggerDuration,
        staggerFrom,
        stiffness,
        damping,
        onComplete,
    ]);

    /* Lecture automatique, une fois par montage (et par changement de texte). */
    useEffect(() => {
        if (!autoPlay) return;
        const id = window.setTimeout(trigger, autoPlayDelay * 1000);
        return () => window.clearTimeout(id);
        // `trigger` change à chaque cycle (blocked) : ne rejouer qu'au montage / texte.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoPlay, autoPlayDelay, text]);

    const handlers = !interactive
        ? {}
        : triggerOnClick
          ? { onClick: trigger }
          : { onMouseEnter: trigger };

    return (
        <span
            ref={scope}
            className={cn(
                "inline-flex items-center justify-center",
                interactive ? "cursor-pointer select-none" : "select-text",
                className
            )}
            {...handlers}
            aria-label={text}
        >
            {/* Texte lisible d'un bloc par les lecteurs d'écran ; les lettres
                animées sont décoratives. */}
            <span className="sr-only">{text}</span>
            {text.split("").map((letter, i) => (
                <span
                    key={i}
                    aria-hidden="true"
                    className="relative inline-flex whitespace-pre"
                    style={{ perspective: "500px" }}
                >
                    {/* Front face — visible by default, tilts backward on trigger */}
                    <motion.span
                        className={cn("cascade-front inline-block", letterClassName)}
                        style={{
                            rotateX: 0,
                            y: 0,
                            transformOrigin: "bottom center",
                            backfaceVisibility: "hidden",
                        }}
                    >
                        {letter}
                    </motion.span>

                    {/* Echo face — hidden below, flips up into view on trigger */}
                    <motion.span
                        className={cn(
                            "cascade-echo absolute inset-0 inline-block",
                            letterClassName
                        )}
                        style={{
                            rotateX: -90,
                            opacity: 0,
                            y: 6,
                            scale: 0.8,
                            filter: "blur(4px)",
                            transformOrigin: "top center",
                            backfaceVisibility: "hidden",
                        }}
                    >
                        {letter}
                    </motion.span>
                </span>
            ))}
        </span>
    );
}
