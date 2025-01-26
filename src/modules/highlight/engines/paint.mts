/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass, EleID, getTermClass, getTermTokenClass, Z_INDEX_MIN } from "/dist/modules/common.mjs";
import { highlightTags } from "/dist/modules/highlight/common/highlight-tags.mjs";
import TermCSS from "/dist/modules/highlight/common/term-css.mjs";
import { ElementProperty, type ElementInfo } from "/dist/modules/highlight/models/tree-cache/element-properties.mjs";
import type { HighlightBox, HighlightFlow } from "/dist/modules/highlight/models/tree-cache/paint.mjs";
import type { MatchTerm, TermPatterns, TermTokens } from "/dist/modules/match-term.mjs";
import { StyleManager } from "/dist/modules/style-manager.mjs";
import { HTMLStylesheet } from "/dist/modules/stylesheets/html.mjs";

type StyleUpdates = { observe: (element: Element) => void, disconnectAll: () => void }
type MutationUpdates = { observe: () => void, disconnect: () => void }

class PaintEngine {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;
	readonly #rejectSelector = Array.from(highlightTags.reject).join(", ");

	readonly #highlightingUpdatedListeners = new Set<() => void>();
	
	// eslint-disable-next-line no-constant-condition
	readonly #method = true ? (CSS["paintWorklet"]?.addModule ? "paint" as const : "element" as const) : "url" as const;
	readonly #styleUpdates: StyleUpdates;
	readonly #mutationUpdates: MutationUpdates;

	readonly #highlightingIds = (function* () {
		let id = 0;
		while (true) {
			yield String(id++);
		}
	})();

	readonly #elementStyleRuleMap = new Map<HTMLElement, string>();

	readonly #elementsVisible = new Set<Element>();

	readonly #styleManager = new StyleManager(new HTMLStylesheet(document.head));
	readonly #element_drawContainersParent: HTMLElement | null = null;
	readonly #element_styleManager: StyleManager<Record<never, never>> | null = null;
	readonly #element_termStyleManagerMap = new Map<MatchTerm, StyleManager<Record<never, never>>>();

	readonly terms: { current: ReadonlyArray<MatchTerm> } = { current: [] };
	readonly hues: { current: ReadonlyArray<number> } = { current: [] };

	constructor (termTokens: TermTokens, termPatterns: TermPatterns) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
		this.#styleUpdates = this.getStyleUpdates();
		this.#mutationUpdates = this.getMutationUpdates();
		if (this.#method === "element") {
			this.#element_drawContainersParent = document.createElement("div");
			this.#element_drawContainersParent.id = EleID.DRAW_CONTAINER;
			document.body.insertAdjacentElement("afterend", this.#element_drawContainersParent);
			this.#element_styleManager = new StyleManager(new HTMLStylesheet(document.head));
			this.#element_styleManager.setStyle(`
#${ EleID.DRAW_CONTAINER } {
	& {
		position: fixed !important;
		width: 100% !important;
		height: 100% !important;
		top: 100% !important;
		z-index: ${ Z_INDEX_MIN } !important;
	}
	& > * {
		position: fixed !important;
		width: 100% !important;
		height: 100% !important;
	}
}

#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ #${ EleID.DRAW_CONTAINER } .${ EleClass.TERM } {
	outline: 2px solid hsl(0 0% 0% / 0.1) !important;
	outline-offset: -2px !important;
	border-radius: 2px !important;
}
`
			);
		}
	}

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number) {
		if (cycle === 0) {
			return colorA;
		}
		return `linear-gradient(${Array(Math.floor(cycle/2 + 1.5) * 2).fill("").map((v, i) =>
			(Math.floor(i / 2) % 2 == cycle % 2 ? colorB : colorA) + ` ${Math.floor((i + 1) / 2)/(Math.floor((cycle + 1) / 2) + 1) * 100}%`
		).join(", ")})`;
	}

	startHighlighting (
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) {
		const termsToPurge = this.terms.current.filter(a => terms.every(b => JSON.stringify(a) !== JSON.stringify(b)));
		this.extendCache(document.body);
		this.removeBoxesInfoForTerms(termsToPurge);
		this.terms.current = terms;
		this.hues.current = hues;
		if (this.#method === "element") {
			for (const styleManager of this.#element_termStyleManagerMap.values()) {
				styleManager.deactivate();
			}
			this.#element_termStyleManagerMap.clear();
			const getTermCSS = (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>, termIndex: number): string => {
				const term = terms[termIndex];
				const hue = hues[termIndex % hues.length];
				const cycle = Math.floor(termIndex / hues.length);
				const selector = `#${ EleID.BAR }.${ EleClass.HIGHLIGHTS_SHOWN } ~ #${ EleID.DRAW_CONTAINER } .${
					getTermClass(term, this.#termTokens)
				}`;
				const backgroundStyle = TermCSS.getHorizontalStyle(
					`hsl(${ hue } 100% 60% / 0.4)`,
					`hsl(${ hue } 100% 88% / 0.4)`,
					cycle,
				);
				return`${ selector } { background: ${ backgroundStyle } !important; }`;
			};
			for (let i = 0; i < terms.length; i++) {
				const styleManager = new StyleManager(new HTMLStylesheet(document.head));
				styleManager.setStyle(getTermCSS(terms, hues, i));
				this.#element_termStyleManagerMap.set(terms[i], styleManager);
			}
		}
		this.calculateBoxesInfo(terms, document.body);
		this.#mutationUpdates.observe();
		for (const ancestor of new Set(
			Array.from(this.#elementsVisible).map(element => this.getAncestorHighlightable(element.firstChild as Node))
		)) {
			this.cacheStyleRulesFor(ancestor, false, terms, hues);
		}
		this.applyStyleRules();
		for (const listener of this.#highlightingUpdatedListeners) {
			listener();
		}
	}

	endHighlighting () {
		this.extendCache(document.body);
		this.removeBoxesInfoForTerms();
		if (this.#method === "element") {
			for (const styleManager of this.#element_termStyleManagerMap.values()) {
				styleManager.deactivate();
			}
			this.#element_termStyleManagerMap.clear();
		}
		this.terms.current = [];
		this.hues.current = [];
	}

	deactivate () {
		this.endHighlighting();
		// NOTE: This may not clean up everything (yet).
		this.#styleManager.deactivate();
		this.#element_drawContainersParent?.remove();
		this.#element_styleManager?.deactivate();
	}

	getStyleUpdates (): StyleUpdates {
		const shiftObserver = new ResizeObserver(entries => {
			for (const entry of entries) {
				this.cacheStyleRulesFor(this.getAncestorHighlightable(entry.target.firstChild as Node), true, this.terms.current, this.hues.current);
			}
			this.applyStyleRules();
		});
		const visibilityObserver = new IntersectionObserver(entries => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					//console.log(entry.target, "intersecting");
					if (entry.target[ElementProperty.INFO]) {
						this.#elementsVisible.add(entry.target);
						shiftObserver.observe(entry.target);
						this.cacheStyleRulesFor(this.getAncestorHighlightable(entry.target.firstChild as Node), false, this.terms.current, this.hues.current);
					}
				} else {
					//console.log(entry.target, "not intersecting");
					if (this.#method === "element" && entry.target[ElementProperty.INFO]) {
						document.getElementById(EleID.DRAW_ELEMENT + (entry.target[ElementProperty.INFO] as ElementInfo).id)?.remove();
					}
					this.#elementsVisible.delete(entry.target);
					shiftObserver.unobserve(entry.target);
				}
			}
			this.applyStyleRules();
		}, { rootMargin: "400px" });
		return {
			observe: element => visibilityObserver.observe(element),
			disconnectAll: () => {
				this.#elementsVisible.clear();
				shiftObserver.disconnect();
				visibilityObserver.disconnect();
			},
		};
	}
	
	applyStyleRules () {
		this.#styleManager.setStyle(Array.from(this.#elementStyleRuleMap.values()).join("\n"));
	};

	cacheStyleRulesFor: (root: HTMLElement, recurse: boolean, terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) => void = (() => {
		const calculateBoxes = (owner: Element, element: Element, range: Range): Array<HighlightBox> => {
			const elementInfo = element[ElementProperty.INFO] as ElementInfo;
			if (!elementInfo || elementInfo.flows.every(flow => flow.boxesInfo.length === 0)) {
				return [];
			}
			let ownerRects = Array.from(owner.getClientRects());
			if (!ownerRects.length) {
				ownerRects = [ owner.getBoundingClientRect() ];
			}
			for (const flow of elementInfo.flows) {
				for (const boxInfo of flow.boxesInfo) {
					boxInfo.boxes.splice(0, boxInfo.boxes.length);
					range.setStart(boxInfo.node, boxInfo.start);
					range.setEnd(boxInfo.node, boxInfo.end);
					const textRects = range.getClientRects();
					for (let i = 0; i < textRects.length; i++) {
						const textRect = textRects.item(i) as DOMRect;
						if (i !== 0
							&& textRect.x === (textRects.item(i - 1) as DOMRect).x
							&& textRect.y === (textRects.item(i - 1) as DOMRect).y) {
							continue;
						}
						let x = 0;
						let y = 0;
						for (const ownerRect of ownerRects) {
							if (ownerRect.bottom > textRect.top) {
								x += textRect.x - ownerRect.x;
								y = textRect.y - ownerRect.y;
								break;
							} else {
								x += ownerRect.width;
							}
						}
						boxInfo.boxes.push({
							selector: this.#termTokens.get(boxInfo.term),
							x: Math.round(x),
							y: Math.round(y),
							width: Math.round(textRect.width),
							height: Math.round(textRect.height),
						});
					}
				}
			}
			return elementInfo.flows.flatMap(flow => flow.boxesInfo.flatMap(boxInfo => boxInfo.boxes));
		};
	
		const getBoxesOwned = (owner: Element, element: Element, range: Range): Array<HighlightBox> =>
			calculateBoxes(owner, element, range).concat(Array.from(element.children).flatMap(child =>
				(child[ElementProperty.INFO] ? !(child[ElementProperty.INFO] as ElementInfo).isPaintable : false)
					? getBoxesOwned(owner, child, range) : []
			))
		;
	
		const cacheStyleRulesFor = (element: HTMLElement, recurse: boolean,
			range: Range, terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) => {
			const elementInfo = element[ElementProperty.INFO] as ElementInfo;
			const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
			if (boxes.length) {
				this.#elementStyleRuleMap.set(element, this.constructHighlightStyleRule(elementInfo.id, boxes, terms, hues));
			}
			if (recurse) {
				for (const child of element.children) {
					if (child instanceof HTMLElement && child[ElementProperty.INFO]) {
						cacheStyleRulesFor(child, recurse, range, terms, hues);
					}
				}
			}
		};
	
		const collectElements = (element: Element, recurse: boolean, range: Range, containers: Array<Element>) => {
			const elementInfo = element[ElementProperty.INFO] as ElementInfo;
			const boxes: Array<HighlightBox> = getBoxesOwned(element, element, range);
			if (boxes.length) {
				const container = document.createElement("div");
				container.id = EleID.DRAW_ELEMENT + elementInfo.id;
				boxes.forEach(box => {
					const element = document.createElement("div");
					element.style.position = "absolute";
					element.style.left = box.x.toString() + "px";
					element.style.top = box.y.toString() + "px";
					element.style.width = box.width.toString() + "px";
					element.style.height = box.height.toString() + "px";
					element.classList.add(EleClass.TERM, getTermTokenClass(box.selector));
					container.appendChild(element);
				});
				const boxRightmost = boxes.reduce((box, boxCurrent) => box && (box.x + box.width > boxCurrent.x + boxCurrent.width) ? box : boxCurrent);
				const boxDownmost = boxes.reduce((box, boxCurrent) => box && (box.y + box.height > boxCurrent.y + boxCurrent.height) ? box : boxCurrent);
				container.style.width = (boxRightmost.x + boxRightmost.width).toString() + "px";
				container.style.height = (boxDownmost.y + boxDownmost.height).toString() + "px";
				containers.push(container);
			}
			(recurse ? Array.from(element.children) as Array<HTMLElement> : []).forEach(child => {
				if (child[ElementProperty.INFO]) {
					collectElements(child, recurse, range, containers);
				}
			});
		};
	
		return this.#method === "element"
			? (root, recurse, terms, hues) => {
				const containers: Array<Element> = [];
				collectElements(root, recurse, document.createRange(), containers);
				containers.forEach(container => {
					const containerExisting = document.getElementById(container.id);
					if (containerExisting) {
						containerExisting.remove();
					}
					this.#element_drawContainersParent!.appendChild(container);
				});
				// 'root' must have [elementInfo].
				cacheStyleRulesFor(root, recurse, document.createRange(), terms, hues);
			}
			: (root, recurse, terms, hues) => {
				// 'root' must have [elementInfo].
				cacheStyleRulesFor(root, recurse, document.createRange(), terms, hues);
			};
	})();

	/**
	 * Gets a CSS rule to style all elements as per the enabled PAINT variant.
	 * @param highlightId The unique highlighting identifier of the element on which highlights should be painted.
	 * @param boxes Details of the highlight boxes to be painted. May not be required depending on the PAINT variant in use.
	 * @param terms Terms currently being highlighted. Some PAINT variants use this information at this point.
	 */
	constructHighlightStyleRule: (
		highlightId: string,
		boxes: ReadonlyArray<HighlightBox>,
		terms: ReadonlyArray<MatchTerm>,
		hues: ReadonlyArray<number>,
	) => string = (() => {
			switch (this.#method) {
			case "element": return highlightId =>
				`body [markmysearch-h_id="${highlightId}"] { background: -moz-element(#${
					EleID.DRAW_ELEMENT + highlightId
				}) no-repeat !important; }`;
			case "paint": return (highlightId, boxes) =>
				`body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${
					JSON.stringify(boxes)
				}; }`;
			case "url": return (highlightId, boxes, terms, hues) =>
				`#${
					EleID.BAR
				}.${
					EleClass.HIGHLIGHTS_SHOWN
				} ~ body [markmysearch-h_id="${
					highlightId
				}"] { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E${
					boxes.map(box =>
						`%3Crect width='${box.width}' height='${box.height}' x='${box.x}' y='${box.y}' fill='hsl(${
							hues[terms.findIndex(term => this.#termTokens.get(term) === box.selector)]
						} 100% 50% / 0.4)'/%3E`
					).join("")
				}%3C/svg%3E") !important; }`;
			}
		})();

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
		const observer = new MutationObserver(mutations => {
			// TODO optimise as for ELEMENT
			const elements: Set<HTMLElement> = new Set;
			for (const mutation of mutations) {
				for (const node of Array.from(mutation.addedNodes)) {
					if (node.nodeType === Node.ELEMENT_NODE && this.canHighlightElement(node as Element)) {
						this.extendCache(node as Element);
					}
				}
				if (mutation.type === "characterData"
					&& mutation.target.parentElement && this.canHighlightElement(mutation.target.parentElement)) {
					elements.add(mutation.target.parentElement);
				}
				for (const node of Array.from(mutation.addedNodes)) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						if (this.canHighlightElement(node as Element)) {
							elements.add(node as HTMLElement);
						}
					} else if (node.nodeType === Node.TEXT_NODE
						&& this.canHighlightElement(node.parentElement as Element)) {
						// Previously used `boxesInfoCalculateForFlowOwners()` on `node`.
						elements.add(node.parentElement as HTMLElement);
					}
				}
			}
			for (const element of elements) {
				this.calculateBoxesInfoForFlowOwnersFromContent(this.terms.current, element);
			}
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		});
		return mutationUpdates;
	};

	extendCache (element: Element, modifyCache = (element: Element) => {
		if (!element[ElementProperty.INFO]) {
			element[ElementProperty.INFO] = {
				id: "",
				isPaintable: this.#method === "paint" ? !element.closest("a") : true,
				flows: [],
			} as ElementInfo;
		}
	}) {
		if (!highlightTags.reject.has(element.tagName)) {
			modifyCache(element);
			for (const child of element.children) {
				this.extendCache(child);
			}
		}
	}

	calculateBoxesInfo (terms: ReadonlyArray<MatchTerm>, flowOwner: Element) {
		if (!flowOwner.firstChild) {
			return;
		}
		const breaksFlow = !highlightTags.flow.has(flowOwner.tagName);
		const textFlows = this.getTextFlows(flowOwner.firstChild);
		this.removeFlows(flowOwner);
		textFlows // The first flow is always before the first break, and the last after the last. Either may be empty.
			.slice((breaksFlow && textFlows[0].length) ? 0 : 1, (breaksFlow && textFlows[textFlows.length - 1].length) ? undefined : -1)
			.forEach(textFlow => this.cacheFlowWithBoxesInfo(terms, textFlow));
	}
	
	calculateBoxesInfoForFlowOwners (terms: ReadonlyArray<MatchTerm>, node: Node) {
		// Text flows may have been disrupted at `node`, so flows which include it must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		const parent = node.parentElement;
		if (!parent) {
			return;
		}
		if (highlightTags.flow.has(parent.tagName)) {
			// The parent may include non self-contained flows.
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
			walker.currentNode = node;
			let breakFirst: Element | null = walker.previousNode() as Element;
			while (breakFirst && highlightTags.flow.has(breakFirst.tagName)) {
				breakFirst = breakFirst !== parent ? walker.previousNode() as Element : null;
			}
			walker.currentNode = node.nextSibling ?? node;
			let breakLast: Element | null = node.nextSibling ? walker.nextNode() as Element : null;
			while (breakLast && highlightTags.flow.has(breakLast.tagName)) {
				breakLast = parent.contains(breakLast) ? walker.nextNode() as Element : null;
			}
			if (breakFirst && breakLast) {
				// The flow containing the node starts and ends within the parent, so flows need only be recalculated below the parent.
				// ALL flows of descendants are recalculated. See below.
				this.calculateBoxesInfo(terms, parent);
			} else {
				// The flow containing the node may leave the parent, which we assume disrupted the text flows of an ancestor.
				this.calculateBoxesInfoForFlowOwners(terms, parent);
			}
		} else {
			// The parent can only include self-contained flows, so flows need only be recalculated below the parent.
			// ALL flows of descendants are recalculated, but this is only necessary for direct ancestors and descendants of the origin;
			// example can be seen when loading DuckDuckGo results dynamically. Could be fixed by discarding text flows which start
			// or end inside elements which do not contain and are not contained by a given element. Will not implement.
			this.calculateBoxesInfo(terms, parent);
		}
	}
	
	calculateBoxesInfoForFlowOwnersFromContent (terms: ReadonlyArray<MatchTerm>, element: Element) {
		// Text flows have been disrupted inside `element`, so flows which include its content must be recalculated and possibly split.
		// For safety we assume that ALL existing flows of affected ancestors are incorrect, so each of these must be recalculated.
		if (highlightTags.flow.has(element.tagName)) {
			// The element may include non self-contained flows.
			this.calculateBoxesInfoForFlowOwners(terms, element);
		} else {
			// The element can only include self-contained flows, so flows need only be recalculated below the element.
			this.calculateBoxesInfo(terms, element);
		}
	}
	
	/** TODO update documentation
	 * FIXME this is a cut-down and adapted legacy function which may not function efficiently or fully correctly.
	 * Remove highlights for matches of terms.
	 * @param terms Terms for which to remove highlights. If left empty, all highlights are removed.
	 * @param root A root node under which to remove highlights.
	 */
	removeBoxesInfoForTerms (terms: ReadonlyArray<MatchTerm> = [], root: HTMLElement | DocumentFragment = document.body) {
		for (const element of Array.from(root.querySelectorAll("[markmysearch-h_id]"))) {
			const filterBoxesInfo = (element: Element) => {
				const elementInfo = element[ElementProperty.INFO] as ElementInfo;
				if (!elementInfo) {
					return;
				}
				elementInfo.flows.forEach(flow => {
					flow.boxesInfo = flow.boxesInfo.filter(boxInfo =>
						terms.every(term => this.#termTokens.get(term) !== this.#termTokens.get(boxInfo.term))
					);
				});
				Array.from(element.children).forEach(child => filterBoxesInfo(child));
			};
			filterBoxesInfo(element);
		}
		for (const listener of this.#highlightingUpdatedListeners) {
			listener();
		}
	}

	/**
	 * TODO document
	 * @param terms Terms to find and highlight.
	 * @param textFlow Consecutive text nodes to highlight inside.
	 */
	cacheFlowWithBoxesInfo (terms: ReadonlyArray<MatchTerm>, textFlow: ReadonlyArray<Text>) {
		const flow: HighlightFlow = {
			text: textFlow.map(node => node.textContent).join(""),
			nodeStart: textFlow[0],
			nodeEnd: textFlow[textFlow.length - 1],
			boxesInfo: [],
		};
		const getAncestorCommon = (ancestor: Element, node: Node): Element =>
			ancestor.contains(node) ? ancestor : getAncestorCommon(ancestor.parentElement as Element, node);
		const ancestor = getAncestorCommon(flow.nodeStart.parentElement as Element, flow.nodeEnd);
		if (ancestor[ElementProperty.INFO]) {
			(ancestor[ElementProperty.INFO] as ElementInfo).flows.push(flow);
		} else {
			// This condition should be impossible, but since in rare cases (typically when running before "document_idle")
			// mutation observers may not always fire, it must be accounted for.
			console.warn("Aborting highlight box-info caching: Element has no cache.", ancestor);
			return;
		}
		for (const term of terms) {
			let i = 0;
			let node = textFlow[0];
			let textStart = 0;
			let textEnd = node.length;
			const matches = flow.text.matchAll(this.#termPatterns.get(term));
			for (const match of matches) {
				const highlightStart = match.index as number;
				const highlightEnd = highlightStart + match[0].length;
				while (textEnd <= highlightStart) {
					node = textFlow[++i];
					textStart = textEnd;
					textEnd += node.length;
				}
				(node.parentElement as Element).setAttribute("markmysearch-h_beneath", ""); // TODO optimise?
				if ((node.parentElement as Element)["markmysearch-h_id"]
					&& !(node.parentElement as Element).hasAttribute("markmysearch-h_id")
				) {
					(node.parentElement as Element).setAttribute("markmysearch-h_id",
						(node.parentElement as Element)["markmysearch-h_id"]);
				}
				while (true) {
					flow.boxesInfo.push({
						term,
						node,
						start: Math.max(0, highlightStart - textStart),
						end: Math.min(highlightEnd - textStart, node.length),
						boxes: [],
					});
					if (highlightEnd <= textEnd) {
						break;
					}
					node = textFlow[++i];
					textStart = textEnd;
					textEnd += node.length;
				}
			}
		}
		if (flow.boxesInfo.length) {
			const ancestorHighlightable = this.getAncestorHighlightable(ancestor.firstChild as Node);
			this.#styleUpdates.observe(ancestorHighlightable);
			if ((ancestorHighlightable[ElementProperty.INFO] as ElementInfo).id === "") {
				const highlighting = ancestorHighlightable[ElementProperty.INFO] as ElementInfo;
				highlighting.id = this.#highlightingIds.next().value;
				ancestorHighlightable.setAttribute("markmysearch-h_id", highlighting.id);
				ancestorHighlightable["markmysearch-h_id"] = highlighting.id;
			}
			this.markElementsUpToHighlightable(ancestor);
		}
	}

	/**
	 * Removes the flows cache from all descendant elements.
	 * @param element The ancestor below which to forget flows.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 */
	removeFlows (element: Element) {
		if (highlightTags.reject.has(element.tagName)) {
			return;
		}
		if (element[ElementProperty.INFO]) {
			(element[ElementProperty.INFO] as ElementInfo).flows = [];
		}
		Array.from(element.children).forEach(child => this.removeFlows(child));
	};

	/**
	 * From the element specified (included) to its highest ancestor element (not included),
	 * mark each as _an element beneath a highlightable one_ (which could e.g. have a background that obscures highlights).
	 * This allows them to be selected in CSS.
	 * @param element The lowest descendant to be marked of the highlightable element.
	 */
	markElementsUpToHighlightable: (element: Element) => void = (this.#method === "paint"
		? element => {
			if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
				element.setAttribute("markmysearch-h_beneath", "");
				this.markElementsUpToHighlightable(element.parentElement as Element);
			}
		}
		: () => undefined
	);

	/**
	 * Reverts all DOM changes made by the PAINT algorithm, under a given root.
	 * @param root The root element under which changes are reverted, __not included__.
	 */
	cleanupHighlightingAttributes (root: Element) {
		root.querySelectorAll("[markmysearch-h_id]").forEach(element => {
			element.removeAttribute("markmysearch-h_id");
			delete element["markmysearch-h_id"];
		});
		root.querySelectorAll("[markmysearch-h_beneath]").forEach(element => {
			element.removeAttribute("markmysearch-h_beneath");
		});
	}

	/**
	 * Gets an array of all flows from the node provided to its last OR first sibling,
	 * where a 'flow' is an array of text nodes considered to flow into each other in the document.
	 * For example, a paragraph will _ideally_ be considered a flow, but in fact may not be heuristically detected as such.
	 * @param node The node from which flows are collected, up to the last descendant of its last sibling.
	 * @param highlightTags Element tags which are rejected from highlighting OR allow flows of text nodes to leave.
	 * @param textFlows __Only supplied in recursion.__ Holds the flows gathered so far.
	 * @param textFlow __Only supplied in recursion.__ Points to the last flow in `textFlows`.
	 */
	getTextFlows (
		node: Node,
		textFlows: Array<Array<Text>> = [ [] ],
		textFlow: Array<Text> = textFlows[0],
	): Array<Array<Text>> {
		do {
			if (node.nodeType === Node.TEXT_NODE) {
				textFlow.push(node as Text);
			} else if ((node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE)
				&& !highlightTags.reject.has((node as Element).tagName)) {
				const breaksFlow = !highlightTags.flow.has((node as Element).tagName);
				if (breaksFlow && (textFlow.length || textFlows.length === 1)) { // Ensure the first flow is always the one before a break.
					textFlow = [];
					textFlows.push(textFlow);
				}
				if (node.firstChild) {
					this.getTextFlows(node.firstChild, textFlows, textFlow);
					textFlow = textFlows[textFlows.length - 1];
					if (breaksFlow && textFlow.length) {
						textFlow = [];
						textFlows.push(textFlow);
					}
				}
			}
			node = node.nextSibling as ChildNode; // May be null (checked by loop condition).
		} while (node);
		return textFlows;
	}

	getAncestorHighlightable: (node: Node) => HTMLElement = (this.#method === "paint"
		? node => {
			let ancestor = node.parentElement as HTMLElement;
			while (true) {
				const ancestorUnhighlightable = (ancestor as HTMLElement).closest("a");
				if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
					ancestor = ancestorUnhighlightable.parentElement;
				} else {
					break;
				}
			}
			return ancestor;
		}
		: node => node.parentElement as HTMLElement
	);

	/**
	 * Determines whether or not the highlighting algorithm should be run on an element.
	 * @param element An element to test for highlighting viability.
	 * @returns `true` if determined highlightable, `false` otherwise.
	 */
	canHighlightElement (element: Element): boolean {
		return !element.closest(this.#rejectSelector);
	}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export { PaintEngine };
