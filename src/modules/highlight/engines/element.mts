/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, elementsPurgeClass, getTermClass } from "/dist/modules/common.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import { elementsRemakeUnfocusable } from "/dist/modules/highlight/engines/element/common.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";

type MutationUpdates = { observe: () => void, disconnect: () => void }

interface UnbrokenNodeListItem {
	value: Text
	next: UnbrokenNodeListItem | null
}

/**
 * Singly linked list implementation for efficient highlight matching of node DOM 'flow' groups.
 */
class UnbrokenNodeList {
	first: UnbrokenNodeListItem | null;
	last: UnbrokenNodeListItem | null;

	push (value: Text) {
		if (this.last) {
			this.last.next = { value, next: null };
			this.last = this.last.next;
		} else {
			this.first = { value, next: null };
			this.last = this.first;
		}
	}

	insertAfter (itemBefore: UnbrokenNodeListItem | null, value: Text | null) {
		if (value) {
			if (itemBefore) {
				itemBefore.next = { next: itemBefore.next, value };
			} else {
				this.first = { next: this.first, value };
			}
		}
	}

	getText () {
		let text = "";
		let current = this.first;
		do {
			text += (current as UnbrokenNodeListItem).value.textContent;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as UnbrokenNodeListItem).next);
		return text;
	}

	clear () {
		this.first = null;
		this.last = null;
	}

	*[Symbol.iterator] () {
		let current = this.first;
		do {
			yield current as UnbrokenNodeListItem;
		// eslint-disable-next-line no-cond-assign
		} while (current = (current as UnbrokenNodeListItem).next);
	}
}

class ElementEngine {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #highlightingUpdatedListeners = new Set<() => void>();

	readonly terms: { current: ReadonlyArray<MatchTerm> } = { current: [] };
	readonly hues: { current: ReadonlyArray<number> } = { current: [] };

	readonly #mutationUpdates: MutationUpdates;

	readonly #rejectSelector = Array.from(highlightTags.reject).join(", ");

	constructor (termTokens: TermTokens, termPatterns: TermPatterns) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
		this.#mutationUpdates = this.getMutationUpdates();
	}

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number): string {
		if (cycle === 0) {
			return colorA;
		}
		return `repeating-linear-gradient(${(() => {
			switch (cycle) {
			case 1: return -45;
			case 2: return 45;
			case 3: return 90;
			default: return 0;
			}
		})()}deg, ${colorA}, ${colorA} 2px, ${colorB} 2px, ${colorB} 8px)`;
	}

	startHighlighting (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		this.#mutationUpdates.disconnect();
		this.elementsRestore();
		this.terms.current = terms;
		this.hues.current = hues;
		this.generateHighlightsUnderNode(terms, document.body);
		this.#mutationUpdates.observe();
		for (const listener of this.#highlightingUpdatedListeners) {
			listener();
		}
	}

	endHighlighting () {
		this.#mutationUpdates.disconnect();
		this.elementsRestore();
		this.terms.current = [];
		this.hues.current = [];
	}

	deactivate () {
		this.endHighlighting();
	}

	/**
	 * Gets an object for controlling whether document mutations are listened to (so responded to by performing partial highlighting).
	 * TODO document params
	 */
	getMutationUpdates (): MutationUpdates {
		const mutationUpdates = {
			observe: () => observer.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
			}),
			disconnect: () => observer.disconnect(),
		};
		const observer = (() => {
			const elements: Set<HTMLElement> = new Set;
			let periodDateLast = 0;
			let periodHighlightCount = 0;
			let throttling = false;
			let highlightIsPending = false;
			const highlightElements = () => {
				highlightIsPending = false;
				for (const element of elements) {
					this.elementsRestore([], element);
					this.generateHighlightsUnderNode(this.terms.current, element);
				}
				periodHighlightCount += elements.size;
				elements.clear();
			};
			const highlightElementsLimited = () => {
				const periodInterval = Date.now() - periodDateLast;
				if (periodInterval > 400) {
					const periodHighlightRate = periodHighlightCount / periodInterval; // Highlight calls per millisecond.
					//console.log(periodHighlightCount, periodInterval, periodHighlightRate);
					throttling = periodHighlightRate > 0.006;
					periodDateLast = Date.now();
					periodHighlightCount = 0;
				}
				if (throttling || highlightIsPending) {
					if (!highlightIsPending) {
						highlightIsPending = true;
						setTimeout(highlightElements, 100);
					}
				} else {
					highlightElements();
				}
			};
			return new MutationObserver(mutations => {
				//mutationUpdates.disconnect();
				const elementsKnown: Set<HTMLElement> = new Set;
				for (const mutation of mutations) {
					const element = mutation.target.nodeType === Node.TEXT_NODE
						? mutation.target.parentElement as HTMLElement
						: mutation.target as HTMLElement;
					if (element) {
						if (element["markmysearchKnown"]) {
							elementsKnown.add(element);
						} else if ((mutation.type === "childList" || !element.querySelector("mms-h"))
							&& this.canHighlightElement(element)) {
							elements.add(element);
						}
					}
				}
				for (const element of elementsKnown) {
					delete element["markmysearchKnown"];
				}
				if (elementsKnown.size) {
					//mutationUpdates.observe();
					return;
				}
				for (const element of elements) {
					for (const elementOther of elements) {
						if (elementOther !== element && element.contains(elementOther)) {
							elements.delete(elementOther);
						}
					}
				}
				highlightElementsLimited();
				//mutationUpdates.observe();
				for (const listener of this.#highlightingUpdatedListeners) {
					listener();
				}
			});
		})();
		return mutationUpdates;
	}

	/**
	 * Finds and highlights occurrences of terms, then marks their positions in the scrollbar.
	 * @param terms Terms to find, highlight, and mark.
	 * @param rootNode A node under which to find and highlight term occurrences.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param termCountCheck A function for requesting that term occurrence count indicators be regenerated.
	 */
	generateHighlightsUnderNode (terms: ReadonlyArray<MatchTerm>, rootNode: Node) {
		if (rootNode.nodeType === Node.TEXT_NODE) {
			const nodeItems = new UnbrokenNodeList;
			nodeItems.push(rootNode as Text);
			this.highlightInBlock(terms, nodeItems);
		} else {
			const nodeItems = new UnbrokenNodeList;
			this.insertHighlights(terms, rootNode, nodeItems, false);
			if (nodeItems.first) {
				this.highlightInBlock(terms, nodeItems);
			}
		}
	}
	
	/**
	 * Highlights occurrences of terms in text nodes under a node in the DOM tree.
	 * @param terms Terms to find and highlight.
	 * @param node A root node under which to match terms and insert highlights.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 * @param visitSiblings Whether to visit the siblings of the root node.
	 */
	insertHighlights (terms: ReadonlyArray<MatchTerm>, node: Node, nodeItems = new UnbrokenNodeList, visitSiblings = true) {
		// TODO support for <iframe>?
		do {
			switch (node.nodeType) {
			case Node.ELEMENT_NODE:
			case Node.DOCUMENT_FRAGMENT_NODE: {
				if (highlightTags.reject.has((node as Element).tagName)) {
					break;
				}
				const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
				if (breaksFlow && nodeItems.first) {
					this.highlightInBlock(terms, nodeItems);
					nodeItems.clear();
				}
				if (node.firstChild) {
					this.insertHighlights(terms, node.firstChild, nodeItems);
					if (breaksFlow && nodeItems.first) {
						this.highlightInBlock(terms, nodeItems);
						nodeItems.clear();
					}
				}
				break;
			} case Node.TEXT_NODE: {
				nodeItems.push(node as Text);
				break;
			}}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition)
		} while (node && visitSiblings);
	}
	
	/**
	 * Highlights terms in a block of consecutive text nodes.
	 * @param terms Terms to find and highlight.
	 * @param nodeItems A singly linked list of consecutive text nodes to highlight inside.
	 */
	highlightInBlock (terms: ReadonlyArray<MatchTerm>, nodeItems: UnbrokenNodeList) {
		const textFlow = nodeItems.getText();
		for (const term of terms) {
			let nodeItemPrevious: UnbrokenNodeListItem | null = null;
			let nodeItem: UnbrokenNodeListItem | null = nodeItems.first as UnbrokenNodeListItem;
			let textStart = 0;
			let textEnd = nodeItem.value.length;
			const matches = textFlow.matchAll(this.#termPatterns.get(term));
			for (const match of matches) {
				let highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
				while (true) {
					nodeItemPrevious = this.highlightInsideNode(
						term,
						nodeItem.value,
						highlightStart - textStart,
						Math.min(highlightEnd - textStart, textEnd),
						nodeItems,
						nodeItemPrevious,
					);
					highlightStart = textEnd;
					textStart = highlightEnd;
					if (highlightEnd <= textEnd) {
						break;
					}
					nodeItemPrevious = nodeItem;
					nodeItem = nodeItem.next as UnbrokenNodeListItem;
					textStart = textEnd;
					textEnd += nodeItem.value.length;
				}
			}
		}
	}

	/**
	 * Highlights a term matched in a text node.
	 * @param term The term matched.
	 * @param textEndNode The text node to highlight inside.
	 * @param start The first character index of the match within the text node.
	 * @param end The last character index of the match within the text node.
	 * @param nodeItems The singly linked list of consecutive text nodes being internally highlighted.
	 * @param nodeItemPrevious The previous item in the text node list.
	 * @returns The new previous item (the item just highlighted).
	 */
	highlightInsideNode (term: MatchTerm, textEndNode: Node, start: number, end: number,
		nodeItems: UnbrokenNodeList, nodeItemPrevious: UnbrokenNodeListItem | null): UnbrokenNodeListItem {
		// This is necessarily a destructive strategy. Occasional damage to the webpage and its functionality is unavoidable.
		const text = textEndNode.textContent as string;
		const textStart = text.substring(0, start);
		const highlight = document.createElement("mms-h");
		highlight.classList.add(getTermClass(term, this.#termTokens));
		highlight.textContent = text.substring(start, end);
		textEndNode.textContent = text.substring(end);
		(textEndNode.parentNode as Node).insertBefore(highlight, textEndNode);
		(highlight.parentNode as Node)["markmysearchKnown"] = true;
		nodeItems.insertAfter(nodeItemPrevious, highlight.firstChild as Text);
		if (textStart !== "") {
			const textStartNode = document.createTextNode(textStart);
			(highlight.parentNode as Node).insertBefore(textStartNode, highlight);
			nodeItems.insertAfter(nodeItemPrevious, textStartNode);
			return ((nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem)
				.next as UnbrokenNodeListItem;
		}
		return (nodeItemPrevious ? nodeItemPrevious.next : nodeItems.first) as UnbrokenNodeListItem;
	}

	/**
	 * Revert all direct DOM tree changes introduced by the engine, under a root node.
	 * Circumstantial and non-direct alterations may remain.
	 * @param classNames Class names of the highlights to remove. If left empty, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	elementsRestore (classNames: Array<string> = [], root: HTMLElement | DocumentFragment = document.body) {
		const highlights = Array.from(root.querySelectorAll(classNames.length ? `mms-h.${classNames.join(", mms-h.")}` : "mms-h"))
			.reverse();
		for (const highlight of Array.from(highlights)) {
			highlight.outerHTML = highlight.innerHTML;
		}
		if (root.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
			root = (root as DocumentFragment).getRootNode() as HTMLElement;
			if (root.nodeType === Node.TEXT_NODE) {
				return;
			}
		}
		elementsPurgeClass(EleClass.FOCUS_CONTAINER, root);
		elementsPurgeClass(EleClass.FOCUS, root);
		elementsRemakeUnfocusable(root);
		for (const listener of this.#highlightingUpdatedListeners) {
			listener();
		}
	}

	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param element An element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	canHighlightElement (element: Element): boolean {
		return !element.closest(this.#rejectSelector) && element.tagName !== "MMS-H";
	};

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export { ElementEngine };
