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
