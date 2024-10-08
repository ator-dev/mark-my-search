/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

/**
 * Creates a regex corresponding to an array of regex OR character groups, using a single capture group for each one.
 * @param characterGroups An array of regex OR groups.
 * @returns The corresponding regex.
 */
const getCharacterGroupsPattern = (characterGroups: Array<string>): RegExp =>
	new RegExp(characterGroups.map((patternString) => `(${patternString})`).join("|"), "g")
;

/**
* Gets the groups of characters to be considered equal (including diacritic forms) in regex notation.
* @returns An array of regex OR groups, each corresponding to an alphanumeric character's lowercase and uppercase forms.
*/
const getCharacterGroups = (): Array<string> => [
	"[AÀ-ÆĀĂĄ]", "[aà-æāăą]",
	"B", "b",
	"[CÇĆĈĊČ]", "[cçćĉċč]",
	"[DĎĐ]", "[dďđ]",
	"[EÆÈ-ËĒĔĖĘĚ]", "[eæè-ëēĕėęě]",
	"F", "f",
	"[GĜĞĠĢ]", "[gĝğġģ]",
	"[HĤĦ]", "[hĥħ]",
	"[IÌ-ÏĨĪĬĮİĲ]", "[iì-ïĩīĭįıĳ]",
	"[JĲĴ]", "[jĳĵ]",
	"[KĶ]", "[kķĸ]",
	"[LĹĻĽĿŁ]", "[lĺļľŀł]",
	"M", "m",
	"[NÑŃŅŇ]", "[nñńņň]",
	"[OÒ-ÖØŌŎŐŒ]", "[oò-öøōŏőœ]",
	"P", "p",
	"Q", "q",
	"[RŔŖŘ]", "[rŕŗř]",
	"[SŚŜŞŠ]", "[sśŝşš]",
	"[TŢŤŦ]", "[tţťŧ]",
	"[UÙ-ÜŨŪŮŰŲ]", "[uù-üũūŭůűų]",
	"V", "v",
	"[WŴ]", "[wŵ]",
	"X", "x",
	"[YÝŸŶ]", "[yýÿŷ]",
	"[ZŹŻŽ]", "[zźżž]",
	"Þ", "þ",
	"ẞ", "ß",
	"Ð", "ð",
	"Ŋ", "ŋ",
	"", "ſ",
];

/**
 * Given any string containing common variants of alphanumeric characters,
 * creates a regex string which will match the same series of letters in any of their diacritic forms, leaving unrecognised characters.
 * @param chars A sequence of characters.
 * @returns A regex string which matches accented forms of the letters.
 */
const getDiacriticsMatchingPatternString = (chars: string) => {
	let patternString = "";
	const characterGroups = getCharacterGroups();
	Array.from(chars.matchAll(getCharacterGroupsPattern(characterGroups))).slice(0, -1).forEach((matchArray, i) => {
		// Adds the current character's matching regex OR group, or the original character if none exists.
		patternString += characterGroups[matchArray.slice(1).findIndex(match => match)] ?? chars[i];
	});
	return patternString;
};

export { getDiacriticsMatchingPatternString };
