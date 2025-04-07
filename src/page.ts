/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

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
	if (!(button instanceof HTMLButtonElement)) return;
	if (button.closest(".setting-element-adder")) {
		settingElementAdderClicked(button);
	}
}, { passive: true });

const settingElementAdderClicked = (button: HTMLButtonElement) => {
	const elementAdder = button.closest<HTMLElement>(".setting-element-adder")!;
	const list = elementAdder.previousElementSibling as HTMLElement;
	const prototype = list.querySelector(".setting-element-prototype") as HTMLElement;
	const element = prototype.cloneNode(true) as HTMLElement;
	element.classList.remove("setting-element-prototype");
	delete element.dataset.template;
	const elementNum = Number.parseInt(list.dataset.counter ?? "0");
	list.dataset.counter = String(elementNum + 1);
	replaceTemplateVariablesRecursive(element, prototype.dataset.template ?? "", String(elementNum));
	list.append(element);
};

const replaceTemplateVariablesRecursive = (root: HTMLElement, variable: string, value: string) => {
	replaceTemplateVariables(root, variable, value);
	for (const element of root.querySelectorAll<HTMLElement>("*")) {
		replaceTemplateVariables(element, variable, value);
		for (const node of element.childNodes) {
			replaceTemplateVariables(node, variable, value);
		}
	}
};

const replaceTemplateVariables = (node: Node, variable: string, value: string) => {
	const variablePattern = new RegExp(`\\{${variable}\\}`, "g");
	if (node instanceof Text && node.textContent !== null) {
		node.textContent = node.textContent.replaceAll(variablePattern, value);
	} else if (node instanceof HTMLElement) {
		for (const attr of node.getAttributeNames()) {
			node.setAttribute(attr, node.getAttribute(attr)!.replaceAll(variablePattern, value));
		}
	}
};

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
