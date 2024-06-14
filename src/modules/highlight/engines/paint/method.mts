import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface AbstractMethod {
	highlightables: Highlightables

	getCSS: EngineCSS

	endHighlighting: () => void

	getHighlightedElements: () => NodeListOf<HTMLElement>

	/**
	 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
	 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
	 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
	 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
	 */
	constructHighlightStyleRule: (highlightId: string, boxes: Array<Box>, terms: Array<MatchTerm>, hues: Array<number>) => string

	tempReplaceContainers: (root: Element, recurse: boolean) => void

	tempRemoveDrawElement: (element: Element) => void
}

export type { AbstractMethod };