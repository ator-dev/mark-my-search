self["importScripts"]("/dist/manage-storage.js", "/dist/stem-pattern-find.js", "/dist/shared-content.js");

const createResearchInstance = (args: {
	url?: { stoplist: Stoplist, url: string, engine?: Engine }
	terms?: MatchTerms
}): Promise<ResearchInstance> => getStorageSync(StorageSync.SHOW_HIGHLIGHTS).then(sync => {
	if (args.url) {
		const phraseGroups = args.url.engine ? [] : getSearchQuery(args.url.url).split("\"");
		const termsRaw = args.url.engine
			? args.url.engine.extract(args.url.url ?? "")
			: phraseGroups.flatMap(phraseGroups.length % 2
				? ((phraseGroup, i) => i % 2 ? phraseGroup : phraseGroup.split(" ").filter(phrase => !!phrase))
				: phraseGroup => phraseGroup.split(" "));
		const terms = Array.from(new Set(termsRaw))
			.filter(phrase => args.url ? !args.url.stoplist.includes(phrase) : false)
			.map(phrase => new MatchTerm(phrase));
		return {
			phrases: terms.map(term => term.phrase),
			terms,
			highlightsShown: sync.showHighlights.default,
		};
	}
	args.terms = args.terms ?? [];
	return {
		phrases: args.terms.map(term => term.phrase),
		terms: args.terms,
		highlightsShown: sync.showHighlights.default,
	};
});

const getSearchQuery = (url: string) =>
	new URL(url).searchParams.get([ "q", "query" ].find(param => new URL(url).searchParams.has(param)) ?? "") ?? ""
;

const isTabSearchPage = (engines: Engines, url: string): [ boolean, Engine? ] => {
	if (getSearchQuery(url)) {
		return [ true, undefined ];
	} else {
		const engine = Object.values(engines).find(thisEngine => thisEngine.match(url));
		return [ !!engine, engine ];
	}
};

const isTabResearchPage = (researchInstances: ResearchInstances, tabId: number) =>
	tabId in researchInstances
;

const createResearchMessage = (researchInstance: ResearchInstance, overrideHighlightsShown?: boolean,
	barControlsShown?: StorageSyncValues[StorageSync.BAR_CONTROLS_SHOWN]) => ({
	terms: researchInstance.terms,
	toggleHighlightsOn: overrideHighlightsShown === undefined ? undefined :
		researchInstance.highlightsShown || overrideHighlightsShown,
	barControlsShown: barControlsShown,
} as HighlightMessage);

const updateCachedResearchDetails = (researchInstances: ResearchInstances, terms: MatchTerms, tabId: number) => {
	researchInstances[tabId].terms = terms;
	return { terms } as HighlightMessage;
};

const activateHighlightingInTab = (tabId: number, message?: HighlightMessage) =>
	chrome.commands.getAll().then(commands => chrome.tabs.sendMessage(
		tabId,
		Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message),
		response => {console.log(response);if(!response)
			chrome.scripting.executeScript({ target: { tabId }, files: [ "/dist/stem-pattern-find.js", "/dist/shared-content.js", "/dist/term-highlight.js" ] })
				.then(() => chrome.tabs.sendMessage(tabId,
					Object.assign({ extensionCommands: commands, tabId } as HighlightMessage, message)
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				)).catch(reason =>
					/*console.error(`Injection into tab ${tabId} failed: ${reason}`)*/  false
				)
		;},
	))
;

const manageEnginesCacheOnBookmarkUpdate = (() => {
	const updateEngine = (engines: Engines, id: string, urlPatternString: string) => {
		if (!urlPatternString) return;
		if (!urlPatternString.includes("%s")) {
			delete(engines[id]);
			return;
		}
		const engine = new Engine({ urlPatternString });
		if (Object.values(engines).find(thisEngine => thisEngine.equals(engine))) return;
		engines[id] = engine;
		setStorageLocal({ engines } as StorageLocalValues);
	};

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const setEngines = (engines: Engines, setEngine: (node: chrome.bookmarks.BookmarkTreeNode) => void,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		node: chrome.bookmarks.BookmarkTreeNode) =>
		undefined /*node.type === "bookmark"
			? setEngine(node)
			: node.type === "folder"
				? (node.children ?? []).forEach(child => setEngines(engines, setEngine, child)): undefined*/
	;

	return () => {
		if (!chrome.bookmarks)
			return;
		chrome.bookmarks.getTree().then(nodes => getStorageLocal(StorageLocal.ENGINES).then(local => {
			nodes.forEach(node => setEngines(
				local.engines, node => node.url ? updateEngine(local.engines, node.id, node.url) : undefined, node
			));
			setStorageLocal({ engines: local.engines } as StorageLocalValues);
		}));

		chrome.bookmarks.onRemoved.addListener((id, removeInfo) =>
			getStorageLocal(StorageLocal.ENGINES).then(local => {
				setEngines(
					local.engines, node => delete(local.engines[node.id]), removeInfo.node
				);
				setStorageLocal({ engines: local.engines } as StorageLocalValues);
			})
		);

		chrome.bookmarks.onCreated.addListener((id, createInfo) => createInfo.url ?
			getStorageLocal(StorageLocal.ENGINES).then(local => {
				updateEngine(local.engines, id, createInfo.url ?? "");
				setStorageLocal({ engines: local.engines } as StorageLocalValues);
			}) : undefined
		);

		chrome.bookmarks.onChanged.addListener((id, changeInfo) => changeInfo.url ?
			getStorageLocal(StorageLocal.ENGINES).then(local => {
				updateEngine(local.engines, id, changeInfo.url ?? "");
				setStorageLocal({ engines: local.engines } as StorageLocalValues);
			}) : undefined
		);
	};
})();

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const updateActionIcon = (enabled?: boolean) =>
	undefined /*enabled === undefined
		? getStorageLocal(StorageLocal.ENABLED).then(local => updateActionIcon(local.enabled))
		: chrome.action.setIcon({ path: enabled ? "/icons/mms.svg" : "/icons/mms-off.svg" })*/
;

(() => {
	const createContextMenuItems = () => {
		const getMenuSwitchId = () =>
			"activate-research-mode"
		;
	
		chrome.contextMenus.onClicked.addListener((info, tab) => !tab || tab.id === undefined ? undefined :
			activateHighlightingInTab(tab.id, { termsFromSelection: true } as HighlightMessage)
		);
	
		return (() => {
			chrome.contextMenus.removeAll();
			chrome.contextMenus.create({
				title: "Researc&h Selection",
				id: getMenuSwitchId(),
				contexts: [ "selection", "page" ],
			});
		})();
	};

	const setUp = () => {
		if (chrome.commands["update"]) {
			chrome.commands["update"]({ name: "toggle-select", shortcut: "Ctrl+Shift+U" });
			for (let i = 0; i < 10; i++) {
				chrome.commands["update"]({ name: `select-term-${i}`, shortcut: `Alt+Shift+${(i + 1) % 10}` });
				chrome.commands["update"]({ name: `select-term-${i}-reverse`, shortcut: `Ctrl+Shift+${(i + 1) % 10}` });
			}
		} else {
			// TODO: instruct user how to assign the appropriate shortcuts
		}
	};

	const initialize = () => {
		manageEnginesCacheOnBookmarkUpdate();
		createContextMenuItems();
		initStorageLocal();
		updateActionIcon();
	};

	chrome.runtime.onInstalled.addListener(() => {
		getStorageSync(StorageSync.IS_SET_UP).then(items =>
			items.isSetUp ? undefined : setUp()
		);
		repairOptions();
		initialize();
	});

	chrome.runtime.onStartup.addListener(initialize);
})();

(() => {
	const pageModifyRemote = (url: string, tabId: number) => getStorageSync([
		StorageSync.STOPLIST,
		StorageSync.SHOW_HIGHLIGHTS,
		StorageSync.BAR_CONTROLS_SHOWN,
	]).then(sync =>
		getStorageLocal([
			StorageLocal.ENABLED,
			StorageLocal.RESEARCH_INSTANCES,
			StorageLocal.ENGINES,
		]).then(async local => {
			const [ isSearchPage, engine ] = local.enabled ? isTabSearchPage(local.engines, url) : [ false, undefined ];
			const isResearchPage = isTabResearchPage(local.researchInstances, tabId);
			const overrideHighlightsShown = (isSearchPage && sync.showHighlights.overrideSearchPages)
				|| (isResearchPage && sync.showHighlights.overrideResearchPages);
			if (isSearchPage) {
				await createResearchInstance({ url: { stoplist: sync.stoplist, url, engine } }).then(researchInstance => {
					if (!isResearchPage || !itemsMatchLoosely(local.researchInstances[tabId].phrases, researchInstance.phrases)) {
						local.researchInstances[tabId] = researchInstance;
						setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
						activateHighlightingInTab(tabId,
							createResearchMessage(local.researchInstances[tabId], overrideHighlightsShown, sync.barControlsShown));
					}
				});
			}
			if (isResearchPage) {
				activateHighlightingInTab(tabId,
					createResearchMessage(local.researchInstances[tabId], overrideHighlightsShown, sync.barControlsShown));
			}
		})
	);

	const forgetTab = (tabId: number) => getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(sync => {
		if (sync.researchInstances[tabId]) {
			delete(sync.researchInstances[tabId]);
			setStorageLocal({ researchInstances: sync.researchInstances } as StorageLocalValues);
		}
	});
	
	chrome.tabs.onCreated.addListener(tab => getStorageSync(StorageSync.LINK_RESEARCH_TABS).then(sync =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
			if (tab && tab.id !== undefined && tab.openerTabId !== undefined
				&& isTabResearchPage(local.researchInstances, tab.openerTabId)) {
				local.researchInstances[tab.id] = sync.linkResearchTabs
					? local.researchInstances[tab.openerTabId]
					: { ...local.researchInstances[tab.openerTabId] };
				setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
			}
		})
	));

	chrome.tabs.onUpdated.addListener((tabId, changeInfo) => !changeInfo.url ? undefined :
		changeInfo.url === "chrome://newtab/" ? forgetTab(tabId) : pageModifyRemote(changeInfo.url, tabId)
	);

	// chrome.tabs.onUpdated does not cover page reloads, so this is needed in addition.
	// Uses .onCompleted over .onCommitted to allow time for previously injected scripts to prepare to respond.
	chrome.webNavigation.onCompleted.addListener(details => details.frameId !== 0 ? undefined :
		pageModifyRemote(details.url, details.tabId)
	);
})();

const toggleHighlightsInTab = (tabId: number, toggleHighlightsOn?: boolean) => getStorageSync(StorageSync.BAR_CONTROLS_SHOWN).then(sync =>
	getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local => {
		if (isTabResearchPage(local.researchInstances, tabId)) {
			const researchInstance = local.researchInstances[tabId];
			researchInstance.highlightsShown = toggleHighlightsOn ?? !researchInstance.highlightsShown;
			chrome.tabs.sendMessage(tabId, {
				toggleHighlightsOn: researchInstance.highlightsShown,
				barControlsShown: sync.barControlsShown,
			} as HighlightMessage);
			setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
		}
	})
);

chrome.commands.onCommand.addListener(commandString =>
	chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(async ([ tab ]) => {
		const commandInfo = parseCommand(commandString);
		switch (commandInfo.type) {
		case CommandType.TOGGLE_ENABLED: {
			getStorageLocal(StorageLocal.ENABLED).then(local => {
				setStorageLocal({ enabled: !local.enabled } as StorageLocalValues);
				updateActionIcon(!local.enabled);
			});
			return;
		} case CommandType.ENABLE_IN_TAB: {
			if (tab.id !== undefined) {
				getStorageSync(StorageSync.BAR_CONTROLS_SHOWN).then(sync =>
					getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(local =>
						createResearchInstance({ terms: [] }).then(researchInstance => {
							researchInstance.highlightsShown = true;
							local.researchInstances[tab.id as number] = researchInstance;
							setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
							activateHighlightingInTab(tab.id as number,
								createResearchMessage(researchInstance, false, sync.barControlsShown));
						})
					)
				);
			}
			return;
		} case CommandType.TOGGLE_HIGHLIGHTS: {
			if (tab.id !== undefined) {
				toggleHighlightsInTab(tab.id);
			}
			return;
		}}
		chrome.tabs.sendMessage(tab.id as number, { command: commandInfo } as HighlightMessage);
	})
);

(() => {
	const handleMessage = (message: BackgroundMessage, senderTabId: number) =>
		getStorageLocal(StorageLocal.RESEARCH_INSTANCES).then(async local => {
			if (message.toggleResearchOn !== undefined) {
				setStorageLocal({ enabled: message.toggleResearchOn } as StorageLocalValues)
					.then(() => updateActionIcon(local.enabled));
			} else if (message.disableTabResearch) {
				delete(local.researchInstances[senderTabId]);
				chrome.tabs.sendMessage(senderTabId, { disable: true } as HighlightMessage);
			} else if (message.performSearch) {
				chrome.search.query({
					text: local.researchInstances[senderTabId].terms.map(term => term.phrase).join(" ")
				}, () => undefined);
			} else {
				if (!isTabResearchPage(local.researchInstances, senderTabId)) {
					await createResearchInstance({ terms: message.terms }).then(researchInstance => {
						local.researchInstances[senderTabId] = researchInstance;
					});
				}
				if (message.makeUnique) { // 'message.termChangedIdx' assumed false.
					await getStorageSync(StorageSync.BAR_CONTROLS_SHOWN).then(sync =>
						createResearchInstance({ terms: message.terms }).then(researchInstance => {
							if (message.toggleHighlightsOn !== undefined) {
								researchInstance.highlightsShown = message.toggleHighlightsOn;
							}
							local.researchInstances[senderTabId] = researchInstance;
							activateHighlightingInTab(senderTabId,
								createResearchMessage(researchInstance, false, sync.barControlsShown));
						})
					);
				} else if (message.terms !== undefined) {
					const highlightMessage = updateCachedResearchDetails(local.researchInstances, message.terms, senderTabId);
					highlightMessage.termUpdate = message.termChanged;
					highlightMessage.termToUpdateIdx = message.termChangedIdx;
					Object.keys(local.researchInstances).forEach(tabId =>
						local.researchInstances[tabId] === local.researchInstances[senderTabId]
							? chrome.tabs.sendMessage(Number(tabId), highlightMessage) : undefined
					);
				}
			}
			setStorageLocal({ researchInstances: local.researchInstances } as StorageLocalValues);
		})
	;

	chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
		if (sender.tab && sender.tab.id !== undefined) {
			handleMessage(message, sender.tab.id);
		} else {
			chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([ tab ]) =>
				handleMessage(message, tab.id as number)
			);
		}
		sendResponse(); // Manifest V3 bug.
	});
})();

chrome.action.onClicked.addListener(() =>
	chrome.permissions.request({ permissions: [ "bookmarks" ] })
);

chrome.permissions.onAdded.addListener(permissions =>
	permissions && permissions.permissions && permissions.permissions.includes("bookmarks")
		? manageEnginesCacheOnBookmarkUpdate() : undefined
);
