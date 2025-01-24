/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, EleID, elementsPurgeClass, getNodeFinal, getTermClass, isVisible } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { getContainerBlock } from "/dist/modules/highlight/common/container-blocks.mjs";
import { elementsRemakeUnfocusable } from "/dist/modules/highlight/engines/element/common.mjs";

class TermWalker {
	readonly #termTokens: TermTokens;
	
	constructor (termTokens: TermTokens) {
		this.#termTokens = termTokens;
	}

	step (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		if (stepNotJump) {
			return this.focusOnTermStep(reverse);
		} else {
			return this.focusOnTermJump(reverse, term);
		}
	}

	deactivate () {}

	cleanup () {}

	/**
	 * Scrolls to and focuses the next block containing an occurrence of a term in the document, from the current selection position.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reverse Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param term A term to jump to. If unspecified, the next closest occurrence of any term is jumpted to.
	 */
	focusOnTermJump (reverse: boolean, term: MatchTerm | null): HTMLElement | null {
		const termSelector = term ? getTermClass(term, this.#termTokens) : "";
		const focusBase = document.body
			.getElementsByClassName(EleClass.FOCUS)[0] as HTMLElement;
		const focusContainer = document.body
			.getElementsByClassName(EleClass.FOCUS_CONTAINER)[0] as HTMLElement;
		const selection = document.getSelection();
		const activeElement = document.activeElement;
		if (activeElement && activeElement.tagName === "INPUT" && activeElement.closest(`#${EleID.BAR}`)) {
			(activeElement as HTMLInputElement).blur();
		}
		const selectionFocus = selection && (!activeElement
			|| activeElement === document.body || !document.body.contains(activeElement)
			|| activeElement === focusBase || activeElement.contains(focusContainer)
		)
			? selection.focusNode
			: activeElement ?? document.body;
		if (focusBase) {
			focusBase.classList.remove(EleClass.FOCUS);
			elementsPurgeClass(EleClass.FOCUS_CONTAINER);
			elementsRemakeUnfocusable();
		}
		const selectionFocusContainer = selectionFocus
			? getContainerBlock(
				selectionFocus.nodeType === Node.ELEMENT_NODE || !selectionFocus.parentElement
					? selectionFocus as HTMLElement
					: selectionFocus.parentElement,
			) : undefined;
		const walkSelectionFocusContainer = { accept: false };
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			element.tagName === "MMS-H"
			&& (termSelector ? element.classList.contains(termSelector) : true)
			&& isVisible(element)
			&& (getContainerBlock(element) !== selectionFocusContainer || walkSelectionFocusContainer.accept)
				? NodeFilter.FILTER_ACCEPT
				: NodeFilter.FILTER_SKIP);
		walker.currentNode = selectionFocus ? selectionFocus : document.body;
		const { elementSelected, container } = this.selectNextElement(reverse, walker, walkSelectionFocusContainer);
		if (!elementSelected || !container) {
			return null;
		}
		elementSelected.scrollIntoView({ behavior: "smooth", block: "center" });
		if (selection) {
			selection.setBaseAndExtent(elementSelected, 0, elementSelected, 0);
		}
		document.body.querySelectorAll(`.${EleClass.REMOVE}`).forEach((element: HTMLElement) => {
			element.remove();
		});
		return container; // Should this be elementSelected?
	}

	// TODO document
	selectNextElement (reverse: boolean, walker: TreeWalker, walkSelectionFocusContainer: { accept: boolean },
		elementToSelect?: HTMLElement,
	): { elementSelected: HTMLElement | null, container: HTMLElement | null } {
		const nextNodeMethod = reverse ? "previousNode" : "nextNode";
		let elementTerm = walker[nextNodeMethod]() as HTMLElement;
		if (!elementTerm) {
			let nodeToRemove: Node | null = null;
			if (!document.body.lastChild || document.body.lastChild.nodeType !== Node.TEXT_NODE) {
				nodeToRemove = document.createTextNode("");
				document.body.appendChild(nodeToRemove);
			}
			walker.currentNode = (reverse && document.body.lastChild)
				? document.body.lastChild
				: document.body;
			elementTerm = walker[nextNodeMethod]() as HTMLElement;
			if (nodeToRemove) {
				nodeToRemove.parentElement?.removeChild(nodeToRemove);
			}
			if (!elementTerm) {
				walkSelectionFocusContainer.accept = true;
				elementTerm = walker[nextNodeMethod]() as HTMLElement;
				if (!elementTerm) {
					return { elementSelected: null, container: null };
				}
			}
		}
		const container = getContainerBlock(elementTerm.parentElement as HTMLElement);
		container.classList.add(EleClass.FOCUS_CONTAINER);
		elementTerm.classList.add(EleClass.FOCUS);
		elementToSelect = Array.from(container.getElementsByTagName("mms-h"))
			.every(thisElement => getContainerBlock(thisElement.parentElement as HTMLElement) === container)
			? container
			: elementTerm;
		if (elementToSelect.tabIndex === -1) {
			elementToSelect.classList.add(EleClass.FOCUS_REVERT);
			elementToSelect.tabIndex = 0;
		}
		this.focusElement(elementToSelect);
		if (document.activeElement !== elementToSelect) {
			const element = document.createElement("div");
			element.tabIndex = 0;
			element.classList.add(EleClass.REMOVE);
			elementToSelect.insertAdjacentElement(reverse ? "afterbegin" : "beforeend", element);
			elementToSelect = element;
			this.focusElement(elementToSelect);
		}
		if (document.activeElement === elementToSelect) {
			return { elementSelected: elementToSelect, container };
		}
		return this.selectNextElement(reverse, walker, walkSelectionFocusContainer, elementToSelect);
	}

	/**
	 * Focuses an element, preventing immediate scroll-into-view and forcing visible focus where supported.
	 * @param element An element.
	 */
	focusElement (element: HTMLElement) {
		element.focus({
			preventScroll: true,
			focusVisible: true, // Very sparse browser compatibility
		} as FocusOptions);
	}

	/**
	 * Scrolls to and focuses the next occurrence of a term in the document, from the current selection position.
	 * @param controlsInfo Details of toolbar controls.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param reversed Indicates whether elements should be tried in reverse, selecting the previous term as opposed to the next.
	 * @param nodeStart __Only supplied in recursion.__ Specifies a node at which to begin scanning.
	 */
	focusOnTermStep (reversed: boolean, nodeStart?: Node): HTMLElement | null {
		elementsPurgeClass(EleClass.FOCUS_CONTAINER);
		elementsPurgeClass(EleClass.FOCUS);
		const selection = getSelection();
		const bar = document.getElementById(EleID.BAR);
		if (!selection || !bar) {
			return null;
		}
		if (document.activeElement && bar.contains(document.activeElement)) {
			(document.activeElement as HTMLElement).blur();
		}
		const nodeBegin = reversed ? getNodeFinal(document.body) : document.body;
		const nodeSelected = reversed ? selection.anchorNode : selection.focusNode;
		const nodeFocused = document.activeElement
			? (document.activeElement === document.body || bar.contains(document.activeElement))
				? null
				: document.activeElement as HTMLElement
			: null;
		const nodeCurrent = nodeStart ?? (nodeSelected
			? nodeSelected
			: nodeFocused ?? nodeBegin);
		if (document.activeElement) {
			(document.activeElement as HTMLElement).blur();
		}
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, (element: HTMLElement) =>
			(element.parentElement as Element).closest("mms-h")
				? NodeFilter.FILTER_REJECT
				: (element.tagName === "MMS-H" && isVisible(element)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
		);
		walker.currentNode = nodeCurrent;
		const element = walker[reversed ? "previousNode" : "nextNode"]() as HTMLElement | null;
		if (!element) {
			if (!nodeStart) {
				return this.focusOnTermStep(reversed, nodeBegin);
			}
			return null;
		}
		this.stepToElement(element);
		return element;
	}

	stepToElement (element: HTMLElement) {
		element = this.getTopLevelHighlight(element);
		const elementFirst = this.getSiblingHighlightFinal(element, element, "previousSibling");
		const elementLast = this.getSiblingHighlightFinal(element, element, "nextSibling");
		(getSelection() as Selection).setBaseAndExtent(elementFirst, 0, elementLast, elementLast.childNodes.length);
		element.scrollIntoView({ block: "center" });
	}

	getTopLevelHighlight (element: HTMLElement): HTMLElement {
		return (element.parentElement as HTMLElement).closest("mms-h")
			? this.getTopLevelHighlight((element.parentElement as HTMLElement).closest("mms-h") as HTMLElement)
			: element;
	}

	getSiblingHighlightFinal (highlight: HTMLElement, node: Node, nextSibling: "nextSibling" | "previousSibling"): HTMLElement {
		if (!node[nextSibling]) {
			return highlight;
		}
		const nodeSibling = node[nextSibling];
		if (nodeSibling instanceof HTMLElement) {
			if (nodeSibling.tagName !== "MMS-H") {
				return highlight;
			}
			return this.getSiblingHighlightFinal(nodeSibling, nodeSibling, nextSibling);
		} else if (nodeSibling instanceof Text) {
			if (nodeSibling.textContent !== "") {
				return highlight;
			}
			return this.getSiblingHighlightFinal(highlight, nodeSibling, nextSibling);
		} else {
			return highlight;
		}
	}
}

export { TermWalker };
