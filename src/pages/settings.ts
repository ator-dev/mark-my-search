/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

{
	const input = document.getElementById("setting--highlighting-hues") as HTMLInputElement;
	const row = input.closest(".setting-list > *") as HTMLElement;
	const addPreviewElement = () => {
		const container = document.createElement("div");
		container.classList.add("highlight-colors");
		for (const hue of (input.value ?? "").split(",").map(hueString => parseInt(hueString))) {
			const colorElement = document.createElement("div");
			colorElement.style.setProperty("--hue", hue.toString());
			container.appendChild(colorElement);
		}
		row.append(container);
		return container;
	};
	let previewElement = addPreviewElement();
	input.addEventListener("input", () => {
		previewElement.remove();
		previewElement = addPreviewElement();
	});
}
