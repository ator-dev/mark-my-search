/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { HighlightFlow } from "/dist/modules/highlight/models/tree-cache/paint.mjs";

type ElementInfo = {
	id: string
	isPaintable: boolean
	flows: Array<HighlightFlow>
}

enum ElementProperty {
	INFO = "markmysearchCache",
}

export { type ElementInfo, ElementProperty };
