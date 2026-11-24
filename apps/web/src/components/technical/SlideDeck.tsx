"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface SlideDeckProps {
  slides: ReactNode[];
  titles: string[];
}

/** One slide at a time. Arrow keys, Page Up/Down, Home and End move between slides. */
export function SlideDeck({ slides, titles }: SlideDeckProps) {
  const stage = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const last = slides.length - 1;

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(last, next))), [last]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, select, textarea, [contenteditable]")) return;
      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        setIndex((current) => Math.min(last, current + 1));
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        setIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setIndex(last);
      }
    };
    const onFullscreen = () => setIsFullscreen(document.fullscreenElement === stage.current);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [last]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void stage.current?.requestFullscreen?.();
  };

  return (
    <div className="deck">
      <div
        ref={stage}
        className="deck-stage"
        role="region"
        aria-roledescription="slide deck"
        aria-label={`Slide ${index + 1} of ${slides.length}: ${titles[index]}`}
        onClick={(event) => {
          // In full screen, a click on the slide advances, like a presentation remote.
          if (isFullscreen && !(event.target as HTMLElement).closest("a, button")) go(index + 1);
        }}
      >
        {slides[index]}
        <div className="deck-progress" aria-hidden="true">
          <span style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
        </div>
      </div>

      <div className="deck-footer">
        <div className="deck-controls">
          <button
            type="button"
            className="button button-secondary icon-button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            aria-label="Previous slide"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <span className="deck-counter" aria-live="polite">
            {index + 1} / {slides.length}
          </span>
          <button
            type="button"
            className="button button-secondary icon-button"
            onClick={() => go(index + 1)}
            disabled={index === last}
            aria-label="Next slide"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <select
            className="select-input"
            value={index}
            onChange={(event) => go(Number(event.target.value))}
            aria-label="Go to slide"
          >
            {titles.map((title, slideIndex) => (
              <option key={title} value={slideIndex}>
                {slideIndex + 1}. {title}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="button button-primary" onClick={toggleFullscreen}>
          {isFullscreen ? <Minimize2 size={16} aria-hidden /> : <Maximize2 size={16} aria-hidden />}
          {isFullscreen ? "Exit full screen" : "Present full screen"}
        </button>
      </div>
    </div>
  );
}
