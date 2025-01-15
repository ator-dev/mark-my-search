/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { StorageSyncValues, StorageSync } from "/dist/modules/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

export type MatchTerms = Array<MatchTerm>

/**
 * Gets a JSON-stringified form of the given object for use in logging.
 * @param object An object.
 * @returns A stringified form of the object. The JSON may be collapsed or expanded depending on size.
 */
const getObjectStringLog = (object: Record<string, unknown>): string =>
	JSON.stringify(
		object,
		undefined,
		(Object.keys(object).length > 1
		|| (typeof(Object.values(object)[0]) === "object"
			&& Object.keys(Object.values(object)[0] as Record<string, unknown>).length))
			? 2 : undefined,
	)
;

/**
 * Logs a debug message as part of normal operation.
 * @param operation Description of the process started or completed, or the event encountered.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description (omittable) of the reason for the process or situation.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 */
export const log = (operation: string, reason: string, metadata: Record<string, unknown> = {}) => {
	const operationStatement = `LOG: ${operation[0].toUpperCase() + operation.slice(1)}`;
	const reasonStatement = reason.length ? reason[0].toUpperCase() + reason.slice(1) : "";
	console.log(operationStatement
		+ (reasonStatement.length ? `: ${reasonStatement}.` : ".")
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : "")
	);
};

/**
 * Logs a graceful failure message if the condition is not met.
 * @param condition A value which will be evaluated to `true` or `false`. If falsy, there has been a problem which will be logged.
 * @param problem Description of the operation failure.
 * Single lowercase command with capitalisation where appropriate and no fullstop, subject before verb.
 * @param reason Description of the low-level reason for the failure.
 * Single lowercase statement with capitalisation where appropriate and no fullstop.
 * @param metadata Objects which may help with debugging the problem.
 * @returns `true` if the condition is truthy, `false` otherwise.
 */
export const assert = (condition: unknown, problem: string, reason: string, metadata: Record<string, unknown> = {}): boolean => {
	if (!condition) {
		console.warn(`LOG: ${problem[0].toUpperCase() + problem.slice(1)}: ${reason[0].toUpperCase() + reason.slice(1)}.`
		+ (Object.keys(metadata).length ? (" " + getObjectStringLog(metadata)) : ""));
	}
	return !!condition;
};

export enum WindowVariable {
	CONFIG_HARD = "configHard",
}

export interface MatchMode {
	regex: boolean
	case: boolean
	stem: boolean
	whole: boolean
	diacritics: boolean
}

export const termEquals = (termA: MatchTerm | undefined, termB: MatchTerm | undefined): boolean =>
	(!termA && !termB) ||
	!!(termA && termB &&
	termA.phrase === termB.phrase &&
	Object.entries(termA.matchMode).every(([ key, value ]) => termB.matchMode[key] === value))
;

export type HighlightDetailsRequest = {
	termsFromSelection?: true
	highlightsShown?: true
}

export type HighlightMessage = {
	getDetails?: HighlightDetailsRequest
	commands?: Array<CommandInfo>
	extensionCommands?: Array<chrome.commands.Command>
	terms?: MatchTerms
	termsOnHold?: MatchTerms
	deactivate?: boolean
	useClassicHighlighting?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]
	barLook?: StorageSyncValues[StorageSync.BAR_LOOK]
	highlightMethod?: StorageSyncValues[StorageSync.HIGHLIGHT_METHOD]
	matchMode?: StorageSyncValues[StorageSync.MATCH_MODE_DEFAULTS]
}

export type HighlightMessageResponse = {
	terms?: MatchTerms
	highlightsShown?: boolean
}

export type BackgroundMessage<WithId = false> = {
	highlightCommands?: Array<CommandInfo>
	initializationGet?: boolean
	terms?: MatchTerms
	termsSend?: boolean
	deactivateTabResearch?: boolean
	performSearch?: boolean
	toggle?: {
		highlightsShownOn?: boolean
		barCollapsedOn?: boolean
	}
} & (WithId extends true
	? {
		tabId: number
	} : {
		tabId?: number
	}
)

export type BackgroundMessageResponse = HighlightMessage | null

export enum CommandType {
	NONE,
	OPEN_POPUP,
	OPEN_OPTIONS,
	TOGGLE_IN_TAB,
	TOGGLE_ENABLED,
	TOGGLE_BAR,
	TOGGLE_HIGHLIGHTS,
	TOGGLE_SELECT,
	REPLACE_TERMS,
	ADVANCE_GLOBAL,
	SELECT_TERM,
	STEP_GLOBAL,
	FOCUS_TERM_INPUT,
}

export interface CommandInfo {
	type: CommandType
	termIdx?: number
	reversed?: boolean
}

// TODO document
export const messageSendHighlight = (tabId: number, message: HighlightMessage): Promise<HighlightMessageResponse> =>
	chrome.tabs.sendMessage(tabId, message).catch(() => {
		log("messaging fail", "scripts may not be injected");
	})
;

// TODO document
export const messageSendBackground = (message: BackgroundMessage): Promise<BackgroundMessageResponse> =>
	chrome.runtime.sendMessage(message)
;

/**
 * Transforms a command string into a command object understood by the extension.
 * @param commandString The string identifying a user command in `manifest.json`.
 * @returns The corresponding command object.
 */
export const parseCommand = (commandString: string): CommandInfo => {
	const parts = commandString.split("-");
	switch (parts[0]) {
	case "open": {
		switch (parts[1]) {
		case "popup": {
			return { type: CommandType.OPEN_POPUP };
		} case "options": {
			return { type: CommandType.OPEN_OPTIONS };
		}}
		break;
	} case "toggle": {
		switch (parts[1]) {
		case "research": {
			switch (parts[2]) {
			case "global": {
				return { type: CommandType.TOGGLE_ENABLED };
			} case "tab": {
				return { type: CommandType.TOGGLE_IN_TAB };
			}}
			break;
		} case "bar": {
			return { type: CommandType.TOGGLE_BAR };
		} case "highlights": {
			return { type: CommandType.TOGGLE_HIGHLIGHTS };
		} case "select": {
			return { type: CommandType.TOGGLE_SELECT };
		}}
		break;
	} case "terms": {
		switch (parts[1]) {
		case "replace": {
			return { type: CommandType.REPLACE_TERMS };
		}}
		break;
	} case "step": {
		switch (parts[1]) {
		case "global": {
			return { type: CommandType.STEP_GLOBAL, reversed: parts[2] === "reverse" };
		}}
		break;
	} case "advance": {
		switch (parts[1]) {
		case "global": {
			return { type: CommandType.ADVANCE_GLOBAL, reversed: parts[2] === "reverse" };
		}}
		break;
	} case "focus": {
		switch (parts[1]) {
		case "term": {
			switch (parts[2]) {
			case "append": {
				return { type: CommandType.FOCUS_TERM_INPUT };
			}}
		}}
		break;
	} case "select": {
		switch (parts[1]) {
		case "term": {
			return { type: CommandType.SELECT_TERM, termIdx: Number(parts[2]), reversed: parts[3] === "reverse" };
		}}
	}}
	return { type: CommandType.NONE };
};

/**
 * Sanitizes a string for regex use by escaping all potential regex control characters.
 * @param word A string.
 * @param replacement The character pattern with which the sanitizer regex will replace potential control characters.
 * Defaults to a pattern which evaluates to the backslash character plus the control character, hence escaping it.
 * @returns The transformed string to be matched in exact form as a regex pattern.
 */
export const sanitizeForRegex = (word: string, replacement = "\\$&") =>
	word.replace(/[/\\^$*+?.()|[\]{}]/g, replacement)
;

/**
 * Compares two arrays using an item comparison function.
 * @param as An array of items of a single type.
 * @param bs An array of items of the same type.
 * @param compare A function comparing a corresponding pair of items from the arrays.
 * If unspecified, the items are compared with strict equality.
 * @returns `true` if each item pair matches and arrays are of equal cardinality, `false` otherwise.
 */
export const itemsMatch = <T,> (as: ReadonlyArray<T>, bs: ReadonlyArray<T>, compare = (a: T, b: T) => a === b) =>
	as.length === bs.length && as.every((a, i) => compare(a, bs[i]))
;

export const { objectSetValue, objectGetValue } = (() => {
	const objectSetGetValue = (object: Record<string, unknown>, key: string, value: unknown, set = true) => {
		if (key.includes(".")) {
			return objectSetValue(
				object[key.slice(0, key.indexOf("."))] as Record<string, unknown>,
				key.slice(key.indexOf(".") + 1),
				value,
			);
		} else {
			if (set) {
				object[key] = value;
			}
			return object[key];
		}
	};

	return {
		objectSetValue: (object: Record<string, unknown>, key: string, value: unknown) =>
			objectSetGetValue(object, key, value),
		objectGetValue: (object: Record<string, unknown>, key: string) =>
			objectSetGetValue(object, key, undefined, false),
	};
})();

export const getIdSequential = (function* () {
	let id = 0;
	while (true) {
		yield id++;
	}
})();

export const getNameFull = (): string =>
	chrome.runtime.getManifest().name
;

export const getName = (): string => {
	const manifest = chrome.runtime.getManifest();
	if (manifest.short_name) {
		return manifest.short_name;
	}
	const nameFull = getNameFull(); // The complete name may take the form e.g. " Name | Classification".
	const nameEndPosition = nameFull.search(/\W\W\W/g);
	return nameEndPosition === -1 ? nameFull : nameFull.slice(0, nameEndPosition);
};
