/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface HighlightFlow {
	text: string
	nodeStart: Text
	nodeEnd: Text
	boxesInfo: Array<HighlightBoxInfo>
}

interface HighlightBoxInfo {
	term: MatchTerm
	node: Text
	start: number
	end: number
	boxes: Array<HighlightBox>
}

interface HighlightBox {
	selector: string
	x: number
	y: number
	width: number
	height: number
}

export { HighlightFlow, HighlightBoxInfo, HighlightBox };
