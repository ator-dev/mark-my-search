/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import { storageGet, StorageSession } from "/dist/modules/storage.mjs";

/**
 * Gets whether or not a tab has active highlighting information stored, so is considered highlighted.
 * @param tabId The ID of a tab.
 * @returns `true` if the tab is considered highlighted, `false` otherwise.
 */
const isTabResearchPage = async (tabId: number): Promise<boolean> => {
	const { researchRecords } = await storageGet("session", [
		StorageSession.RESEARCH_RECORDS,
	]);
	return (tabId in researchRecords) && researchRecords[tabId].active;
};

export { isTabResearchPage };
