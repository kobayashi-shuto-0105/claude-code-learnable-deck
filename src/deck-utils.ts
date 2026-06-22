import type { DeckSpec, Slide } from "./schema.js";

export function normalizeDeck(deck: DeckSpec): DeckSpec {
  return {
    ...deck,
    slides: deck.slides.map((slide, index) => ({
      ...slide,
      id: slide.id || `s${String(index + 1).padStart(2, "0")}`,
      bullets: slide.bullets.slice(0, 3),
      speaker_notes: slide.speaker_notes || `Explain the central message: ${slide.message}`,
      source_refs: slide.source_refs || []
    }))
  };
}

export function createSlide(id: string, title: string, message: string, bullets: string[] = []): Slide {
  return {
    id,
    role: "content",
    title,
    message,
    bullets: bullets.slice(0, 3),
    visual: {
      type: "concept_diagram",
      description: `A simple visual that supports: ${message}`
    },
    speaker_notes: `Explain this slide with a concrete example. Central message: ${message}`,
    source_refs: [
      {
        section: "source",
        locator: "extracted.md"
      }
    ]
  };
}

export function scoreDeck(deck: DeckSpec, renderPass: boolean): {
  source_fidelity: number;
  readability: number;
  structure: number;
  render_pass: boolean;
} {
  const slides = deck.slides;
  const withRefs = slides.filter((s) => s.source_refs.length > 0).length;
  const lowDensity = slides.filter((s) => s.bullets.length <= 3 && s.title.length <= 80 && s.message.length <= 180).length;
  const withNotes = slides.filter((s) => s.speaker_notes.trim().length > 0).length;

  return {
    source_fidelity: slides.length ? withRefs / slides.length : 0,
    readability: slides.length ? lowDensity / slides.length : 0,
    structure: slides.length ? withNotes / slides.length : 0,
    render_pass: renderPass
  };
}
