/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { EleClass } from "/dist/modules/common.mjs";

/**
 * Reverts the focusability of elements made temporarily focusable and marked as such using a class name.
 * Sets their `tabIndex` to -1.
 * @param root If supplied, an element to revert focusability under in the DOM tree (inclusive).
 */
const elementsRemakeUnfocusable = (root: HTMLElement | DocumentFragment = document.body) => {
	if (!root.parentNode) {
		return;
	}
	root.parentNode.querySelectorAll(`.${EleClass.FOCUS_REVERT}`)
		.forEach((element: HTMLElement) => {
			element.tabIndex = -1;
			element.classList.remove(EleClass.FOCUS_REVERT);
		});
};

export { elementsRemakeUnfocusable };
