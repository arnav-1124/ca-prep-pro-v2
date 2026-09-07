/**
 * CA Prep Pro - Option Randomization Engine
 *
 * Implements pedagogical option rotation/flipping per student practice appearance.
 * Enforces:
 * 1. Hardcoded display option letters (A, B, C, D) for clean UI consistency.
 * 2. Fully randomized option sequences per session/question appearance to prevent sequence memorization.
 * 3. Preserves canonical option letters and IDs for 100% accurate server-side grading and audit trails.
 * 4. Deterministic per session question instance: reloading the page during the same attempt preserves option positions.
 * 5. Pins "None of the above" / "All of the above" to the final option slot to maintain logical semantic integrity.
 */

export interface RawPracticeOption {
  id: string;
  optionLetter: string;
  optionText: string;
}

export interface ShuffledPracticeOption {
  id: string;
  displayLetter: string; // The UI label: 'A', 'B', 'C', 'D'
  originalLetter: string; // The DB canonical key: 'A', 'B', 'C', 'D'
  optionText: string;
}

// 32-bit FNV-1a hash function for uniform distribution
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Linear Congruential Generator (LCG) for reproducible pseudo-random numbers
function createLcgRng(seed: number) {
  let s = seed || 12345;
  return function next() {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function shufflePracticeOptions(
  options: RawPracticeOption[],
  seedKey: string
): ShuffledPracticeOption[] {
  if (!options || options.length <= 1) {
    return (options || []).map((o, idx) => ({
      id: o.id,
      displayLetter: o.optionLetter || String.fromCharCode(65 + idx),
      originalLetter: o.optionLetter,
      optionText: o.optionText,
    }));
  }

  // True/False special convention: keep True as A and False as B
  const isTrueFalse =
    options.length === 2 &&
    options.some((o) => /^true$/i.test(o.optionText.trim())) &&
    options.some((o) => /^false$/i.test(o.optionText.trim()));

  if (isTrueFalse) {
    // Sort so True is A and False is B
    const sorted = [...options].sort((a, b) => {
      const aIsTrue = /^true$/i.test(a.optionText.trim());
      const bIsTrue = /^true$/i.test(b.optionText.trim());
      return aIsTrue ? -1 : bIsTrue ? 1 : 0;
    });

    return sorted.map((o, idx) => ({
      id: o.id,
      displayLetter: idx === 0 ? "A" : "B",
      originalLetter: o.optionLetter,
      optionText: o.optionText,
    }));
  }

  const rng = createLcgRng(fnv1a(seedKey));

  // Pin "None of the above" / "None of these" / "All of the above" to the final slot if present
  const pinnedIdx = options.findIndex((o) =>
    /\b(?:none of these|none of the above|all of the above|all of these)\b/i.test(o.optionText)
  );

  const toShuffle = [...options];
  let pinnedOption: RawPracticeOption | null = null;

  if (pinnedIdx !== -1) {
    pinnedOption = toShuffle[pinnedIdx];
    toShuffle.splice(pinnedIdx, 1);
  }

  // Fisher-Yates shuffle
  for (let i = toShuffle.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [toShuffle[i], toShuffle[j]] = [toShuffle[j], toShuffle[i]];
  }

  if (pinnedOption) {
    toShuffle.push(pinnedOption);
  }

  const letters = ["A", "B", "C", "D", "E", "F"];

  return toShuffle.map((opt, idx) => ({
    id: opt.id,
    displayLetter: letters[idx] || String.fromCharCode(65 + idx),
    originalLetter: opt.optionLetter,
    optionText: opt.optionText,
  }));
}
