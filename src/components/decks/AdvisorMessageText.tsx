"use client";

import React, { useMemo } from "react";
import { CardPreviewTrigger } from "@/components/CardHoverPreview";

const EXCLUDED_TERMS = new Set([
  "NORM",
  "FIRE",
  "WATER",
  "WIND",
  "ARCANE",
  "ASTRA",
  "CRUX",
  "EXALTED",
  "EXIA",
  "LUXEM",
  "NEOS",
  "TERA",
  "UMBRA",
  "BASIC",
  "ADVANCED",
  "SPECIAL",
  "FAST",
  "SLOW",
  "FLOATING MEMORY",
  "MAIN DECK",
  "MATERIAL DECK",
  "SIDEBOARD",
  "WARRIOR",
  "MAGE",
  "RANGER",
  "GUARDIAN",
  "CLERIC",
  "ASSASSIN",
  "RECOMMENDATION",
  "GAMEPLAY TIP",
  "FLEXIBILITY",
  "MEMORY FILTERING",
  "SYNERGY WITH YOUR DECK",
  "MAGE CLASS BONUS",
  "ADVANCED ELEMENTS",
  "BASIC ELEMENTS",
  "BASIC/NON-ELEMENTAL",
  "UP TO THREE",
  "2 COPIES",
  "TIER 1",
  "TIER 2",
  "TIER 3",
]);

function isCardCandidate(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 45) return false;
  if (/[:\n#*]/.test(trimmed)) return false;
  if (EXCLUDED_TERMS.has(trimmed.toUpperCase())) return false;
  if (/^(step|phase|level|turn|tier|option|part|section)\s+\d+/i.test(trimmed)) return false;
  if (/\(tier\s+\d+\)/i.test(trimmed)) return false;
  return /^[A-Z][a-zA-Z0-9 ',—()\-.]+$/.test(trimmed);
}

function tryExtractCard(text: string): { cardName: string; suffix: string } | null {
  const trimmed = text.trim();
  const parentheticalMatch = trimmed.match(/^([^(\n*:]+?)\s*(\([^)]+\))(:)?$/);
  if (parentheticalMatch && isCardCandidate(parentheticalMatch[1])) {
    return {
      cardName: parentheticalMatch[1].trim(),
      suffix: ` ${parentheticalMatch[2]}${parentheticalMatch[3] || ""}`,
    };
  }
  const directMatch = trimmed.match(/^([^:\n*]+?)(:)?$/);
  if (directMatch && isCardCandidate(directMatch[1])) {
    return { cardName: directMatch[1].trim(), suffix: directMatch[2] || "" };
  }
  return null;
}

interface TextSegment {
  type: "text" | "card" | "bold" | "italic" | "code";
  value: string;
}

function parseLineSegments(line: string): TextSegment[] {
  // Matches [[Card Name]], **Bold**, `code`, or *Italic*
  const pattern = /\[\[([A-Z][^\]\n]+)\]\]|\*\*([^*\n]+?)\*\*|`([^`\n]+)`|(?<!^|\n|\s\*\s+)\*([^*\n]+?)\*/g;
  let lastIndex = 0;
  const segments: TextSegment[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: line.slice(lastIndex, match.index) });
    }

    const matchedCard = match[1];
    const matchedBold = match[2];
    const matchedCode = match[3];
    const matchedItalic = match[4];

    if (matchedCard) {
      segments.push({ type: "card", value: matchedCard.trim() });
    } else if (matchedBold) {
      const extracted = tryExtractCard(matchedBold);
      if (extracted) {
        segments.push({ type: "card", value: extracted.cardName });
        if (extracted.suffix) {
          segments.push({ type: "bold", value: extracted.suffix });
        }
      } else {
        segments.push({ type: "bold", value: matchedBold });
      }
    } else if (matchedCode) {
      segments.push({ type: "code", value: matchedCode });
    } else if (matchedItalic) {
      const extracted = tryExtractCard(matchedItalic);
      if (extracted) {
        segments.push({ type: "card", value: extracted.cardName });
        if (extracted.suffix) {
          segments.push({ type: "italic", value: extracted.suffix });
        }
      } else {
        segments.push({ type: "italic", value: matchedItalic });
      }
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < line.length) {
    segments.push({ type: "text", value: line.slice(lastIndex) });
  }

  return segments;
}

function renderSegments(segments: TextSegment[]): React.ReactNode {
  return segments.map((s, idx) => {
    if (s.type === "card") {
      return (
        <CardPreviewTrigger
          key={idx}
          name={s.value}
          className="text-cyan-300 hover:text-cyan-100 hover:underline decoration-cyan-400/50 cursor-pointer font-medium transition-colors inline-block"
        >
          {s.value}
        </CardPreviewTrigger>
      );
    }
    if (s.type === "bold") {
      return (
        <strong key={idx} className="font-semibold text-white">
          {s.value}
        </strong>
      );
    }
    if (s.type === "italic") {
      return <em key={idx}>{s.value}</em>;
    }
    if (s.type === "code") {
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/10 font-mono text-[11px] text-cyan-200"
        >
          {s.value}
        </code>
      );
    }
    return <span key={idx}>{s.value}</span>;
  });
}

export function AdvisorMessageText({ content }: { content: string }) {
  const elements = useMemo(() => {
    const lines = content.split("\n");
    return lines.map((line, lineIdx) => {
      // Empty line -> spacing
      if (!line.trim()) {
        return <div key={lineIdx} className="h-2" />;
      }

      // Horizontal rule
      if (/^---+$/.test(line.trim())) {
        return <hr key={lineIdx} className="my-2 border-white/10" />;
      }

      // Header matching (#, ##, ###, ####)
      const headerMatch = line.match(/^(#{1,4})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2];
        const segments = parseLineSegments(text);
        return (
          <div
            key={lineIdx}
            className={`font-semibold text-white tracking-tight ${
              level <= 2 ? "text-sm mt-3 mb-1.5" : "text-xs mt-2.5 mb-1"
            }`}
          >
            {renderSegments(segments)}
          </div>
        );
      }

      // Bullet matching (- item, * item, 1. item)
      const bulletMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/);
      if (bulletMatch) {
        const bulletPrefix = bulletMatch[2];
        const isNumbered = /^\d+\./.test(bulletPrefix);
        const bulletText = bulletMatch[3];
        const segments = parseLineSegments(bulletText);
        return (
          <div key={lineIdx} className="flex gap-2 text-xs leading-relaxed ml-2 my-0.5">
            <span className="text-slate-400 shrink-0 select-none">
              {isNumbered ? bulletPrefix : "•"}
            </span>
            <div className="flex-1">{renderSegments(segments)}</div>
          </div>
        );
      }

      // Regular line
      const segments = parseLineSegments(line);
      return (
        <div key={lineIdx} className="text-xs leading-relaxed">
          {renderSegments(segments)}
        </div>
      );
    });
  }, [content]);

  return <div className="space-y-0.5">{elements}</div>;
}
