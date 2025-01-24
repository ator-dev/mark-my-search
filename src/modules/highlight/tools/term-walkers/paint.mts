/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, EleID, elementsPurgeClass, getNodeFinal, isVisible } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { ElementProperty, type ElementInfo } from "/dist/modules/highlight/models/tree-cache/element-properties.mjs";

class TermWalker {
	readonly #termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	deactivate () {}

	cleanup () {}

	/**
	 * Scrolls to the next (downwards) occurrence of a term in the document. Testing begins from the current selection position.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	step (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null, nodeStart?: Node): HTMLElement | null {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		const selection = document.getSelection() as Selection;
		const nodeBegin = reverse ? getNodeFinal(document.body) : document.body;
		const nodeSelected = selection ? selection.anchorNode : null;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || document.activeElement.id === EleID.BAR)
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart
			?? (nodeFocused
				? (nodeSelected ? (nodeFocused.contains(nodeSelected) ? nodeSelected : nodeFocused) : nodeFocused)
				: nodeSelected ?? nodeBegin
			);
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element[ElementProperty.INFO] as ElementInfo | undefined)?.flows.some(flow =>
				term ? flow.boxesInfo.some(boxInfo => this.#termTokens.get(boxInfo.term) === this.#termTokens.get(term)) : flow.boxesInfo.length
			) && isVisible(element)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		if (nodeFocused) {
			nodeFocused.blur();
		}
		const element = walker[nextNodeMethod]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				return this.step(stepNotJump, reverse, term, nodeBegin);
			}
			return null;
		}
		if (!stepNotJump) {
			element.classList.add(EleClass.FOCUS_CONTAINER);
		}
		this.focusClosest(element, element =>
			element[ElementProperty.INFO] && !!(element[ElementProperty.INFO] as ElementInfo).flows
		);
		selection.setBaseAndExtent(element, 0, element, 0);
		element.scrollIntoView({ behavior: stepNotJump ? "auto" : "smooth", block: "center" });
		return element;
	}

	focusClosest (element: HTMLElement, filter: (element: HTMLElement) => boolean) {
		element.focus({ preventScroll: true });
		if (document.activeElement !== element) {
			if (filter(element)) {
				this.focusClosest(element.parentElement as HTMLElement, filter);
			} else if (document.activeElement) {
				(document.activeElement as HTMLElement).blur();
			}
		}
	};
}

export { TermWalker };
