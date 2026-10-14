"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { ElementBadge } from "@/components/common";

interface CardPreviewData {
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
  element?: string | null;
}

interface CardHoverContextValue {
  showPreview: (card: CardPreviewData, e?: React.MouseEvent | MouseEvent) => void;
  updatePosition: (e: React.MouseEvent | MouseEvent) => void;
  hidePreview: () => void;
}

const CardHoverContext = createContext<CardHoverContextValue>({
  showPreview: () => {},
  updatePosition: () => {},
  hidePreview: () => {},
});

export function useCardHover() {
  return useContext(CardHoverContext);
}

const clientImageCache = new Map<string, string>();
const CARD_WIDTH = 270;
const CARD_HEIGHT = 378; // 5:7 aspect ratio (270 * 1.4)

export function CardHoverProvider({ children }: { children: React.ReactNode }) {
  const [activeCard, setActiveCard] = useState<CardPreviewData | null>(null);
  const [resolvedImageUrl, setResolvedImageUrl] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const activeCardRef = useRef<CardPreviewData | null>(null);

  const calculatePosition = useCallback((clientX: number, clientY: number) => {
    if (typeof window === "undefined") return { x: 0, y: 0 };
    const padding = 16;
    let x = clientX + 18;
    let y = clientY + 18;

    // Flip to left if overflowing viewport right
    if (x + CARD_WIDTH + padding > window.innerWidth) {
      x = clientX - CARD_WIDTH - 18;
    }
    // If still overflowing left
    if (x < padding) {
      x = Math.max(padding, window.innerWidth - CARD_WIDTH - padding);
    }

    // Flip or clamp vertically if overflowing viewport bottom
    if (y + CARD_HEIGHT + padding > window.innerHeight) {
      y = window.innerHeight - CARD_HEIGHT - padding;
    }
    if (y < padding) {
      y = padding;
    }

    return { x, y };
  }, []);

  const updatePosition = useCallback((e: React.MouseEvent | MouseEvent) => {
    const newPos = calculatePosition(e.clientX, e.clientY);
    setPos(newPos);
  }, [calculatePosition]);

  const showPreview = useCallback((card: CardPreviewData, e?: React.MouseEvent | MouseEvent) => {
    if (!card.name && !card.slug && !card.imageUrl) return;

    activeCardRef.current = card;
    setActiveCard(card);
    setImageLoaded(false);
    setImageError(false);

    if (e) {
      setPos(calculatePosition(e.clientX, e.clientY));
    }
    setVisible(true);

    const cacheKey = (card.slug || card.name).toLowerCase();

    if (card.imageUrl) {
      clientImageCache.set(cacheKey, card.imageUrl);
      setResolvedImageUrl(card.imageUrl);
      return;
    }

    // Check cache
    const cached = clientImageCache.get(cacheKey);
    if (cached) {
      setResolvedImageUrl(cached);
      return;
    }

    // Query catalog for image fallback
    setResolvedImageUrl(null);
    const query = card.slug || card.name;
    fetch(`/api/catalog?query=${encodeURIComponent(query)}&limit=1`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const foundUrl = data?.cards?.[0]?.editions?.[0]?.imageUrl;
        if (foundUrl) {
          clientImageCache.set(cacheKey, foundUrl);
          if (activeCardRef.current && (activeCardRef.current.slug === card.slug || activeCardRef.current.name === card.name)) {
            setResolvedImageUrl(foundUrl);
          }
        } else {
          if (activeCardRef.current && (activeCardRef.current.slug === card.slug || activeCardRef.current.name === card.name)) {
            setImageError(true);
          }
        }
      })
      .catch(() => {
        if (activeCardRef.current && (activeCardRef.current.slug === card.slug || activeCardRef.current.name === card.name)) {
          setImageError(true);
        }
      });
  }, [calculatePosition]);

  const hidePreview = useCallback(() => {
    activeCardRef.current = null;
    setVisible(false);
    setActiveCard(null);
    setResolvedImageUrl(null);
    setImageLoaded(false);
    setImageError(false);
  }, []);

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (visible) hidePreview();
    };
    window.addEventListener("scroll", handleScrollOrResize, { passive: true });
    window.addEventListener("resize", handleScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [visible, hidePreview]);

  return (
    <CardHoverContext.Provider value={{ showPreview, updatePosition, hidePreview }}>
      {children}
      {visible && activeCard && (
        <div
          role="tooltip"
          aria-hidden={!visible}
          style={{
            position: "fixed",
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            width: `${CARD_WIDTH}px`,
            height: `${CARD_HEIGHT}px`,
          }}
          className="pointer-events-none z-[99999] transition-opacity duration-150 animate-fade-in drop-shadow-[0_20px_35px_rgba(0,0,0,0.85)] select-none"
        >
          <div className="relative h-full w-full overflow-hidden rounded-2xl border border-white/20 bg-[#070a11] shadow-[0_0_30px_rgba(6,182,212,0.25)] ring-1 ring-white/10">
            {resolvedImageUrl && !imageError ? (
              <>
                {!imageLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-[#0d1322] to-[#070a11] p-4 text-center">
                    <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
                    <span className="text-xs font-medium text-slate-300">{activeCard.name}</span>
                  </div>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolvedImageUrl}
                  alt={activeCard.name}
                  onLoad={() => setImageLoaded(true)}
                  onError={() => setImageError(true)}
                  className={`h-full w-full object-contain rounded-2xl transition-opacity duration-200 ${
                    imageLoaded ? "opacity-100" : "opacity-0"
                  }`}
                />
              </>
            ) : (
              <div className="flex h-full w-full flex-col justify-between rounded-2xl bg-gradient-to-br from-[#121829] via-[#0d1322] to-[#070a11] p-5 text-center">
                <div className="flex justify-between items-center">
                  {activeCard.element && <ElementBadge element={activeCard.element} />}
                  <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">Preview</span>
                </div>
                <div className="my-auto space-y-2">
                  <h4 className="text-base font-bold text-white leading-snug">{activeCard.name}</h4>
                  {activeCard.slug && <p className="font-mono text-[11px] text-slate-400">{activeCard.slug}</p>}
                  {imageError && (
                    <p className="text-[11px] text-rose-300/80">Full art picture unavailable</p>
                  )}
                  {!resolvedImageUrl && !imageError && (
                    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                      <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                      <span>Loading card art...</span>
                    </div>
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-500 border-t border-white/[0.06] pt-2">
                  Grand Archive TCG
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </CardHoverContext.Provider>
  );
}

export function CardPreviewTrigger({
  name,
  slug,
  imageUrl,
  element,
  children,
  className = "",
  as: Component = "span",
}: {
  name?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  element?: string | null;
  children: React.ReactNode;
  className?: string;
  as?: any;
}) {
  const { showPreview, updatePosition, hidePreview } = useCardHover();

  const handleMouseEnter = (e: React.MouseEvent) => {
    showPreview(
      {
        name: name || slug || "Card",
        slug,
        imageUrl,
        element,
      },
      e
    );
  };

  return (
    <Component
      onMouseEnter={handleMouseEnter}
      onMouseMove={updatePosition}
      onMouseLeave={hidePreview}
      className={className}
    >
      {children}
    </Component>
  );
}
