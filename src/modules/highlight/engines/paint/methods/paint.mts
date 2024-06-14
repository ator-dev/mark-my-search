import type { AbstractMethod } from "/dist/modules/highlight/engines/paint/method.mjs";
import type { Box } from "/dist/modules/highlight/engines/paint.mjs";
import type { Highlightables } from "/dist/modules/highlight/engines/paint/highlightables.mjs";
import type { EngineCSS } from "/dist/modules/highlight/engine.mjs";
import type { MatchTerm, TermTokens } from "/dist/modules/match-term.mjs";
import { EleID, EleClass } from "/dist/modules/common.mjs";

type TermSelectorStyles = Record<string, {
	hue: number
	cycle: number
}>

const markElementsUpTo = (element: Element) => {
	if (!element.hasAttribute("markmysearch-h_id") && !element.hasAttribute("markmysearch-h_beneath")) {
		element.setAttribute("markmysearch-h_beneath", "");
		markElementsUpTo(element.parentElement as Element);
	}
};

class PaintMethod implements AbstractMethod {
	readonly termTokens: TermTokens;

	static paintModuleAdded = false;

	constructor (termTokens: TermTokens) {
		this.termTokens = termTokens;
		if (!PaintMethod.paintModuleAdded) {
			CSS.paintWorklet?.addModule(chrome.runtime.getURL("/dist/paint.js"));
			PaintMethod.paintModuleAdded = true;
		}
	}

	readonly highlightables: Highlightables = {
		checkElement: (element: Element) => !element.closest("a"),
		findAncestor: <T extends Element> (element: T) => {
			let ancestor = element;
			// eslint-disable-next-line no-constant-condition
			while (true) {
				// Anchors cannot (yet) be highlighted directly inside, due to security concerns with CSS Paint.
				const ancestorUnhighlightable = ancestor.closest("a") as T | null;
				if (ancestorUnhighlightable && ancestorUnhighlightable.parentElement) {
					ancestor = ancestorUnhighlightable.parentElement as unknown as T;
				} else {
					break;
				}
			}
			return ancestor;
		},
		markElementsUpTo,
	};

	readonly getCSS: EngineCSS = {
		misc: () => "",
		termHighlights: () => "",
		termHighlight: (terms: Array<MatchTerm>, hues: number[]) => {
			const styles: TermSelectorStyles = {};
			terms.forEach((term, i) => {
				styles[this.termTokens.get(term)] = {
					hue: hues[i % hues.length],
					cycle: Math.floor(i / hues.length),
				};
			});
			return (`
#${EleID.BAR}.${EleClass.HIGHLIGHTS_SHOWN} ~ body [markmysearch-h_id] {
& [markmysearch-h_beneath] {
	background-color: transparent;
}
& {
	background-image: paint(markmysearch-highlights);
	--markmysearch-styles: ${JSON.stringify(styles)};
}
& > :not([markmysearch-h_id]) {
	--markmysearch-styles: unset;
	--markmysearch-boxes: unset;
}
}`
			);
		},
	};

	endHighlighting () {
		document.body.querySelectorAll("[markmysearch-h_beneath]").forEach(element => {
			element.removeAttribute("markmysearch-h_beneath");
		});
	}

	getHighlightedElements () {
		return document.body.querySelectorAll("[markmysearch-h_id], [markmysearch-h_beneath]") as NodeListOf<HTMLElement>;
	}

	constructHighlightStyleRule (highlightId: string, boxes: Array<Box>) {
		return `body [markmysearch-h_id="${highlightId}"] { --markmysearch-boxes: ${JSON.stringify(boxes)}; }`;
	}
	
	tempReplaceContainers () {}

	tempRemoveDrawElement () {}
}

export { type TermSelectorStyles, PaintMethod };