import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractTermMarker {
	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insert: (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<HTMLElement>,
	) => void

	// TODO document
	raise: (
		term: MatchTerm | null,
		container: HTMLElement,
	) => void
}

export type { AbstractTermMarker };
