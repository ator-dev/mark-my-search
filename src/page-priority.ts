/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

const searchParams = new URLSearchParams(location.search);

if (searchParams.has("frame")) {
	document.documentElement.classList.add("frame");
}
if (searchParams.has("popup")) {
	document.documentElement.classList.add("popup");
}
