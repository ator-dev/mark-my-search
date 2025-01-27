/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { ControlButtonName } from "/dist/modules/interface/toolbar.d.mjs";
import { type UserCommand, parseUserCommand } from "/dist/modules/commands.mjs";
import type { MatchMode } from "/dist/modules/match-term.mjs";
import type { ControlsInfo } from "/dist/content.mjs";

type BarLook = ControlsInfo["barLook"]

type BrowserCommands = ReadonlyArray<chrome.commands.Command>

type ControlFocusArea = (
	| "none"
	| "input"
	| "options_menu"
)

enum EleID {
	BAR = "bar",
	BAR_LEFT = "bar-left",
	BAR_TERMS = "bar-terms",
	BAR_RIGHT = "bar-right",
}

enum EleClass {
	BAR_HIDDEN = "bar-hidden",
	BAR_NO_AUTOFOCUS = "bar-no-autofocus",
	CONTROL = "control",
	CONTROL_PAD = "control-pad",
	CONTROL_INPUT = "control-input",
	CONTROL_CONTENT = "control-content",
	CONTROL_BUTTON = "control-button",
	CONTROL_REVEAL = "control-reveal",
	CONTROL_EDIT = "control-edit",
	OPTION_LIST = "options",
	OPTION = "option",
	OPTION_LIST_PULLDOWN = "options-pulldown",
	DISABLED = "disabled",
	LAST_FOCUSED = "last-focused",
	MENU_OPEN = "menu-open",
	COLLAPSED = "collapsed",
	UNCOLLAPSIBLE = "collapsed-impossible",
	MATCH_REGEX = "match-regex",
	MATCH_CASE = "match-case",
	MATCH_STEM = "match-stem",
	MATCH_WHOLE = "match-whole",
	MATCH_DIACRITICS = "match-diacritics",
	PRIMARY = "primary",
	SECONDARY = "secondary",
	BAR_CONTROLS = "bar-controls",
}

/**
 * Extracts assigned shortcut strings from browser commands.
 * @param commands Commands as returned by the browser.
 * @returns An object containing the extracted command shortcut strings.
 */
const getTermCommands = (commands: BrowserCommands): Array<Readonly<{ forwards: string, backwards: string }>> => {
	const commandsDetail = commands.map((command): { userCommand: UserCommand | null, shortcut: string } => ({
		userCommand: command.name ? parseUserCommand(command.name) : null,
		shortcut: command.shortcut ?? "",
	}));
	const commandsForwards = commandsDetail.filter(({ userCommand }) =>
		userCommand?.type === "tab_selectTerm" && userCommand.forwards
	);
	const commandsBackwards = commandsDetail.filter(({ userCommand }) =>
		userCommand?.type === "tab_selectTerm" && !userCommand.forwards
	);
	return commandsForwards.map(({ shortcut }, i) => ({
		forwards: shortcut,
		backwards: commandsBackwards[i].shortcut,
	}));
};

const getMatchModeOptionClass = (matchType: keyof MatchMode) => EleClass.OPTION + "-" + matchType;

const getMatchModeFromClassList = (
	classListContains: (token: typeof EleClass[keyof typeof EleClass]) => boolean,
): MatchMode => ({
	regex: classListContains(EleClass.MATCH_REGEX),
	case: classListContains(EleClass.MATCH_CASE),
	stem: classListContains(EleClass.MATCH_STEM),
	whole: classListContains(EleClass.MATCH_WHOLE),
	diacritics: classListContains(EleClass.MATCH_DIACRITICS),
});

const applyMatchModeToClassList = (
	matchMode: Readonly<MatchMode>,
	classListToggle: (token: typeof EleClass[keyof typeof EleClass], force: boolean) => void,
) => {
	classListToggle(EleClass.MATCH_REGEX, matchMode.regex);
	classListToggle(EleClass.MATCH_CASE, matchMode.case);
	classListToggle(EleClass.MATCH_STEM, matchMode.stem);
	classListToggle(EleClass.MATCH_WHOLE, matchMode.whole);
	classListToggle(EleClass.MATCH_DIACRITICS, matchMode.diacritics);
};

class InputIDGenerator {
	#count = 0;

	next (): string {
		return `input-${this.#count++}`;
	}
}

const getControlClass = (controlName: ControlButtonName) => EleClass.CONTROL + "-" + controlName;

const getControlPadClass = (index: number) => EleClass.CONTROL_PAD + "-" + index.toString();

const passKeyEvent = (event: KeyboardEvent) => event.ctrlKey || event.metaKey || event.altKey;

export {
	type BarLook,
	type BrowserCommands,
	type ControlFocusArea,
	EleID, EleClass,
	getTermCommands,
	getMatchModeOptionClass, getMatchModeFromClassList, applyMatchModeToClassList,
	InputIDGenerator,
	getControlClass, getControlPadClass,
	passKeyEvent,
};
