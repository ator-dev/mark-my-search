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
	}
});

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
