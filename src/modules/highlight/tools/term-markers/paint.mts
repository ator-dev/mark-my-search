/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleID, getElementYRelative, getTermTokenClass } from "/dist/modules/common.mjs";
import { ElementProperty, type ElementInfo } from "/dist/modules/highlight/models/tree-cache/element-properties.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";

class TermMarker {
	readonly #termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
		const gutter = document.createElement("div");
		gutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", gutter);
	}

	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insert (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		if (terms.length === 0) {
			return; // Efficient escape in case of no possible markers to be inserted.
		}
		// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
		const termSelectorsAllowed = new Set(terms.slice(0, hues.length).map(term => this.#termTokens.get(term)));
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		let markersHtml = "";
		for (const element of document.body.querySelectorAll<HTMLElement>("[markmysearch-h_id], [markmysearch-h_beneath]")) {
			const termSelectors: Set<string> = new Set((element[ElementProperty.INFO] as ElementInfo | undefined)?.flows
				.flatMap(flow => flow.boxesInfo
					.map(boxInfo => this.#termTokens.get(boxInfo.term))
					.filter(termSelector => termSelectorsAllowed.has(termSelector))
				)
			);
			const yRelative = getElementYRelative(element);
			// TODO use single marker with custom style
			markersHtml += Array.from(termSelectors).map((termSelector, i) => `<div class="${
				getTermTokenClass(termSelector)
			}" top="${yRelative}" style="top: ${yRelative * 100}%; padding-left: ${i * 5}px; z-index: ${i * -1}"></div>`);
		}
		gutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		gutter.innerHTML = markersHtml;
	}

	deactivate () {
		const gutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		gutter.remove();
	}

	raise () {}
}

export { TermMarker };
