/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

if (new URL(location.href).searchParams.get("frame") !== null) {
	document.body.classList.add("frame");
}

const loadTheme = (theme: string) => {
	const checkbox = document.getElementById("theme-" + theme) as HTMLInputElement | null;
	if (checkbox) {
		checkbox.checked = true;
	}
};

chrome.storage.local.get("theme_temporary").then(local => {
	if ("theme_temporary" in local) {
		loadTheme(local.theme_temporary);
	}
});

addEventListener("input", event => {
	const input = event.target;
	if (input instanceof HTMLInputElement && input.getAttribute("name") === "theme") {
		if (input.checked) {
			if (input.id === "theme") {
				chrome.storage.local.remove("theme_temporary");
			} else {
				chrome.storage.local.set({
					theme_temporary: input.id.slice(input.id.indexOf("-") + 1),
				});
			}
		}
	} else if (input instanceof HTMLElement && input.closest(".setting-color-range-container")) {
		const container = input.closest<HTMLElement>(".setting-color-range-container")!;
		const numberInput = container.querySelector("input[type='number']") as HTMLInputElement;
		const rangeInput = container.querySelector("input[type='range']") as HTMLInputElement;
		if (input === numberInput) {
			rangeInput.value = numberInput.value;
		} else if (input === rangeInput) {
			numberInput.value = rangeInput.value;
		}
		const hue = parseInt(numberInput.value);
		if (isNaN(hue)) {
			container.style.removeProperty("--hue");
		} else {
			container.style.setProperty("--hue", String(hue));
		}
	}
}, { passive: true });

addEventListener("click", event => {
	const button = event.target;
	if (!(button instanceof HTMLButtonElement)) {
		return;
	}
	if (button.closest(".setting-element-adder")) {
		const elementAdder = button.closest<HTMLElement>(".setting-element-adder")!;
		const list = elementAdder.previousElementSibling as HTMLElement;
		const prototype = list.querySelector(".setting-element-prototype") as HTMLElement;
		const element = prototype.cloneNode(true) as HTMLElement;
		element.classList.remove("setting-element-prototype");
		list.append(element);
	}
}, { passive: true });

for (const input of document.querySelectorAll(".setting-color-range-container input")) {
	input.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

const activateCurrentTab = (currentUrl: Location) => {
	const id = currentUrl.hash.slice(1);
	for (const activeTab of document.querySelectorAll(".tab-list .active")) {
		activeTab.classList.remove("active");
	}
	if (id.length === 0) {
		return;
	}
	const heading = document.getElementById(id)?.closest(".section")?.querySelector("h2");
	if (!heading) {
		return;
	}
	const tab = document.querySelector(`.tab-list a[href="#${heading.id}"]`);
	if (!tab) {
		return;
	}
	tab.classList.add("active");
};

addEventListener("hashchange", () => {
	activateCurrentTab(location);
});

activateCurrentTab(location);
