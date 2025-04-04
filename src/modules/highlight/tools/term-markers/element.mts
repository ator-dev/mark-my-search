/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, EleID, elementsPurgeClass, getElementYRelative, getTermClass } from "/dist/modules/common.mjs";
import { getContainerBlock } from "/dist/modules/highlight/common/container-blocks.mjs";
import { Styles } from "/dist/modules/highlight/tools/term-marker/common.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";

class TermMarker {
	readonly #termTokens: TermTokens;

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #termsStyleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #scrollGutter: HTMLElement;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
		this.#styleManager.setStyle(Styles.mainCSS);
		this.#scrollGutter = document.createElement("div");
		this.#scrollGutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", this.#scrollGutter);
	}

	/**
	 * Inserts markers in the scrollbar to indicate the scroll positions of term highlights.
	 * @param terms Terms highlighted in the page to mark the scroll position of.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param hues Color hues for term styles to cycle through.
	 */
	insert (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		this.setTermsStyle(terms, hues);
		if (terms.length === 0) {
			return; // No terms results in an empty selector, which is not allowed.
		}
		const regexMatchTermSelector = new RegExp(`\\b${EleClass.TERM}(?:-\\w+)+\\b`);
		const containersInfo: Array<{
			container: HTMLElement
			termsAdded: Set<string>
		}> = [];
		let markersHtml = "";
		for (const highlight of document.body.querySelectorAll<HTMLElement>(terms
			.slice(0, hues.length) // The scroll markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms
			.map(term => `mms-h.${getTermClass(term, this.#termTokens)}`)
			.join(", ")
		)) {
			const container = getContainerBlock(highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = (highlight.className.match(regexMatchTermSelector) as RegExpMatchArray)[0];
			const yRelative = getElementYRelative(container);
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(this.getTermSelector(className))) {
						continue;
					} else {
						const termsAddedCount = Array.from(containersInfo[containerIdx].termsAdded).length;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(this.getTermSelector(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ this.getTermSelector(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ this.getTermSelector(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		}
		this.#scrollGutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		this.#scrollGutter.innerHTML = markersHtml;
	}

	setTermsStyle (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		const styles = terms.map((term, i) => Styles.getTermCSS(term, i, hues, this.#termTokens));
		this.#termsStyleManager.setStyle(styles.join(""));
	}

	deactivate () {
		this.#scrollGutter.remove();
	}

	/**
	 * Extracts the selector of a term from its prefixed class name form.
	 * @param highlightClassName The single class name of a term highlight.
	 * @returns The corresponding term selector.
	 */
	getTermSelector (highlightClassName: string) {
		return highlightClassName.slice(EleClass.TERM.length + 1);
	}

	// TODO document
	raise (term: MatchTerm | null, container: HTMLElement) {
		const scrollMarkerGutter = document.getElementById(EleID.MARKER_GUTTER) as HTMLElement;
		elementsPurgeClass(EleClass.FOCUS, scrollMarkerGutter);
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = scrollMarkerGutter.querySelector(
				`${term ? `.${getTermClass(term, this.#termTokens)}` : ""}[top^="${
					Math.trunc(getElementYRelative(container) * precision) / precision
				}"]`
			) as HTMLElement | null;
			if (scrollMarker) {
				scrollMarker.classList.add(EleClass.FOCUS);
				return true;
			}
			return false;
		});
	}
}

export { TermMarker };
