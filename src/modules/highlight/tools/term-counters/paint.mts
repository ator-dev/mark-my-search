/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { ElementProperty, type ElementInfo } from "/dist/modules/highlight/models/tree-cache/element-properties.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

class TermCounter {
	countBetter (term: MatchTerm): number {
		return this.countFaster(term);
	}

	/**
	 * Gets the number of matches for a term in the document.
	 * @param term A term to get the occurrence count for.
	 * @returns The occurrence count for the term.
	 */
	countFaster (term: MatchTerm): number {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(ElementProperty.INFO in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let count = 0;
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (!element) {
				break;
			}
			for (const flow of (element[ElementProperty.INFO] as ElementInfo).flows) {
				count += flow.boxesInfo.filter(boxInfo => boxInfo.term === term).length;
			}
		}
		return count;
	}

	exists (term: MatchTerm): boolean {
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, element =>
			(ElementProperty.INFO in element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT);
		let element: Element;
		// eslint-disable-next-line no-cond-assign
		while (element = walker.nextNode() as Element) {
			if (!element) {
				break;
			}
			if ((element[ElementProperty.INFO] as ElementInfo).flows.find(flow =>
				flow.boxesInfo.find(boxInfo => boxInfo.term === term)
			)) {
				return true;
			}
		}
		return false;
	}
}

export { TermCounter };
