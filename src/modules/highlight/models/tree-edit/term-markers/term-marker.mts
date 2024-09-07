/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractTermMarker } from "/dist/modules/highlight/term-marker.mjs";
import { getContainerBlock } from "/dist/modules/highlight/container-blocks.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import {
	EleID, EleClass, getElementYRelative, elementsPurgeClass,
	getTermClass, getTermClassToken,
} from "/dist/modules/common.mjs";

class TermMarker implements AbstractTermMarker {
	readonly #termTokens: TermTokens;

	readonly #scrollGutter: HTMLElement;
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
		this.#scrollGutter = document.createElement("div");
		this.#scrollGutter.id = EleID.MARKER_GUTTER;
		document.body.insertAdjacentElement("afterend", this.#scrollGutter);
	}

	deactivate () {
		this.#scrollGutter.remove();
	}

	insert (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
		highlightedElements: Iterable<HTMLElement>,
	) {
		const regexMatchTermSelector = new RegExp(`\\b${EleClass.TERM}(?:-\\w+)+\\b`);
		const containersInfo: Array<{
			container: HTMLElement
			termsAdded: Set<string>
		}> = [];
		let markersHtml = "";
		for (const highlight of highlightedElements) {
			const container = getContainerBlock(highlight);
			const containerIdx = containersInfo.findIndex(containerInfo => container.contains(containerInfo.container));
			const className = highlight.className.match(regexMatchTermSelector)![0];
			const yRelative = getElementYRelative(container);
			let markerCss = `top: ${yRelative * 100}%;`;
			if (containerIdx !== -1) {
				if (containersInfo[containerIdx].container === container) {
					if (containersInfo[containerIdx].termsAdded.has(getTermClassToken(className))) {
						continue;
					} else {
						const termsAddedCount = containersInfo[containerIdx].termsAdded.size;
						markerCss += `padding-left: ${termsAddedCount * 5}px; z-index: ${termsAddedCount * -1}`;
						containersInfo[containerIdx].termsAdded.add(getTermClassToken(className));
					}
				} else {
					containersInfo.splice(containerIdx);
					containersInfo.push({ container, termsAdded: new Set([ getTermClassToken(className) ]) });
				}
			} else {
				containersInfo.push({ container, termsAdded: new Set([ getTermClassToken(className) ]) });
			}
			markersHtml += `<div class="${className}" top="${yRelative}" style="${markerCss}"></div>`;
		}
		this.#scrollGutter.replaceChildren(); // Removes children, since inner HTML replacement does not for some reason
		this.#scrollGutter.innerHTML = markersHtml;
	}

	raise (term: MatchTerm | null, container: HTMLElement) {
		elementsPurgeClass(EleClass.FOCUS, this.#scrollGutter);
		[6, 5, 4, 3, 2].some(precisionFactor => {
			const precision = 10**precisionFactor;
			const scrollMarker = this.#scrollGutter.querySelector(
				`${term ? `.${getTermClass(term, this.#termTokens)}` : ""}[top^="${
					Math.trunc(getElementYRelative(container) * precision) / precision
				}"]`
			);
			if (scrollMarker) {
				scrollMarker.classList.add(EleClass.FOCUS);
				return true;
			}
			return false;
		});
	}
}

export { TermMarker };
