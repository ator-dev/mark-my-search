/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

const getVersion = (): string => chrome.runtime.getManifest().version;

const getName = (): string => {
	const manifest = chrome.runtime.getManifest();
	if (manifest.short_name) {
		return manifest.short_name;
	}
	const nameFull = getNameFull(); // The complete name may take the form e.g. " Name | Classification".
	const nameEndPosition = nameFull.search(/\W\W\W/g);
	return nameEndPosition === -1 ? nameFull : nameFull.slice(0, nameEndPosition);
};

const getNameFull = (): string => chrome.runtime.getManifest().name;

export { getVersion, getName, getNameFull };
