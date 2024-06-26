import type { CommandInfo } from "/dist/modules/commands.mjs";
import type { ConfigValues } from "/dist/modules/privileged/storage.mjs";
import type { MatchTerm } from "/dist/modules/match-term.mjs";

interface Tab {
	getDetails?: TabDetailsRequest
	commands?: ReadonlyArray<CommandInfo>
	extensionCommands?: ReadonlyArray<chrome.commands.Command>
	terms?: ReadonlyArray<MatchTerm>
	termsOnHold?: ReadonlyArray<MatchTerm>
	deactivate?: boolean
	enablePageModify?: boolean
	toggleHighlightsOn?: boolean
	toggleBarCollapsedOn?: boolean
	barControlsShown?: ConfigValues["barControlsShown"]
	barLook?: ConfigValues["barLook"]
	highlightLook?: ConfigValues["highlightLook"]
	highlighter?: ConfigValues["highlighter"]
	matchMode?: ConfigValues["matchModeDefaults"]
}

interface TabDetailsRequest {
	termsFromSelection?: true
	highlightsShown?: true
}

interface TabResponse {
	terms?: ReadonlyArray<MatchTerm>
	highlightsShown?: boolean
}

type Background<WithId = false> = {
	highlightCommands?: ReadonlyArray<CommandInfo>
	initializationGet?: boolean
	terms?: ReadonlyArray<MatchTerm>
	termsSend?: boolean
	deactivateTabResearch?: boolean
	performSearch?: boolean
	toggle?: {
		highlightsShownOn?: boolean
		barCollapsedOn?: boolean
	}
} & (
	(WithId extends true ? never : Record<never, never>) | {
		tabId: number
	}
)

type BackgroundResponse = Tab | null

export type {
	Tab, TabDetailsRequest, TabResponse,
	Background, BackgroundResponse,
};
