/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { getTermClass } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";

class TermCounter {
	readonly #termTokens: TermTokens;

	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	countBetter (term: MatchTerm): number {
		return this.countFaster(term);
	}

	/**
	 * Gets the number of matches for a term in the document.  
	 * **Warning:** This method overestimates depending on how many elements different highlights are split into.
	 * @param term A term to get the occurrence count for.
	 * @returns The occurrence count for the term.
	 */
	countFaster (term: MatchTerm): number {
		const occurrences = document.body.getElementsByClassName(getTermClass(term, this.#termTokens));
		//const matches = occurrences.map(occurrence => occurrence.textContent).join("").match(term.pattern);
		//return matches ? matches.length : 0; // Works poorly in situations such as matching whole words.
		return occurrences.length; // Poor and changeable heuristic, but so far the most reliable efficient method.
	}

	exists (term: MatchTerm): boolean {
		const occurrences = document.body.getElementsByClassName(getTermClass(term, this.#termTokens));
		return occurrences.length > 0;
	}
}

export { TermCounter };
