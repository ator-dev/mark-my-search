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

for (const checkbox of document.querySelectorAll<HTMLInputElement>("input[name='theme']")) {
	checkbox.addEventListener("change", () => {
		if (checkbox.checked) {
			if (checkbox.id === "theme") {
				chrome.storage.local.remove("theme_temporary");
			} else {
				chrome.storage.local.set({
					theme_temporary: checkbox.id.slice(checkbox.id.indexOf("-") + 1),
				});
			}
		}
	});
}

const activateCurrentTab = (currentUrl: URL) => {
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

addEventListener("hashchange", event => {
	activateCurrentTab(new URL(event.newURL));
});

activateCurrentTab(new URL(location.href));
