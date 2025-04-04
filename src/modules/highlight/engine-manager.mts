/*
 * This file is part of Mark My Search.
 * Copyright © 2021-present ‘ator-dev’, Mark My Search contributors.
 * Licensed under the EUPL-1.2-or-later.
 */

import type { AbstractEngineManager } from "/dist/modules/highlight/engine-manager.d.mjs";
import type { AbstractTermCounter } from "/dist/modules/highlight/tools/term-counter.d.mjs";
import type { AbstractTermWalker } from "/dist/modules/highlight/tools/term-walker.d.mjs";
import type { AbstractTermMarker } from "/dist/modules/highlight/tools/term-marker.d.mjs";
import { ElementEngine } from "/dist/modules/highlight/engines/element.mjs";
import { PaintEngine } from "/dist/modules/highlight/engines/paint.mjs";
import { getContainerBlock } from "/dist/modules/highlight/common/container-blocks.mjs";
import type { Engine } from "/dist/modules/common.mjs";
import type { MatchTerm, TermTokens, TermPatterns } from "/dist/modules/match-term.mjs";
import { requestCallFn } from "/dist/modules/call-requester.mjs";
import { compatibility } from "/dist/modules/common.mjs";

type EngineData = Readonly<{
	engine: ElementEngine | PaintEngine
	termCounter?: AbstractTermCounter
	termWalker?: AbstractTermWalker
	termMarker?: AbstractTermMarker
}>

class EngineManager implements AbstractEngineManager {
	readonly #termTokens: TermTokens;
	readonly #termPatterns: TermPatterns;

	readonly #highlightingUpdatedListeners = new Set<() => void>();

	#highlighting: {
		terms: ReadonlyArray<MatchTerm>
		hues: ReadonlyArray<number>
	} | null = null;

	#engineData: EngineData | null = null;

	constructor (
		termTokens: TermTokens,
		termPatterns: TermPatterns,
	) {
		this.#termTokens = termTokens;
		this.#termPatterns = termPatterns;
	}

	getTermBackgroundStyle (colorA: string, colorB: string, cycle: number): string {
		return this.#engineData?.engine.getTermBackgroundStyle(colorA, colorB, cycle) ?? "";
	}

	startHighlighting (terms: ReadonlyArray<MatchTerm>, hues: ReadonlyArray<number>) {
		this.#highlighting = { terms, hues };
		this.#engineData?.engine.startHighlighting(terms, hues);
	}

	endHighlighting () {
		this.#highlighting = null;
		if (this.#engineData) {
			const engineData = this.#engineData;
			engineData.engine.endHighlighting();
			engineData.termWalker?.cleanup();
		}
	}

	readonly termCounter = {
		countBetter: (term: MatchTerm): number => (
			this.#engineData?.termCounter?.countBetter(term) ?? 0
		),
		countFaster: (term: MatchTerm): number => (
			this.#engineData?.termCounter?.countFaster(term) ?? 0
		),
		exists: (term: MatchTerm): boolean => (
			this.#engineData?.termCounter?.exists(term) ?? false
		),
	};
	
	stepToNextOccurrence (reverse: boolean, stepNotJump: boolean, term: MatchTerm | null): HTMLElement | null {
		const focus = this.#engineData?.termWalker?.step(reverse, stepNotJump, term);
		if (focus) {
			this.#engineData?.termMarker?.raise(term, getContainerBlock(focus));
		}
		return focus ?? null;
	}

	async setEngine (preference: Engine) {
		this.deactivateEngine();
		this.#engineData = await this.constructAndLinkEngineData(compatibility.highlighting.engineToUse(preference));
	}

	applyEngine () {
		const highlighting = this.#highlighting;
		if (highlighting && this.#engineData) {
			this.#engineData.engine.startHighlighting(highlighting.terms, highlighting.hues);
		}
	}

	async constructAndLinkEngineData (engineClass: Engine): Promise<EngineData> {
		const engineData = await this.constructEngineData(engineClass);
		const engine = engineData.engine;
		const terms = engine.terms;
		const hues = engine.hues;
		if (engineData.termMarker) {
			const termMarker = engineData.termMarker;
			if (engine instanceof ElementEngine) {
				engine.addHighlightingUpdatedListener(requestCallFn(
					() => {
						// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
						const termsAllowed = terms.current.slice(0, hues.current.length);
						termMarker.insert(termsAllowed, hues.current, []);
					},
					50, 500,
				));
			} else if (engine instanceof PaintEngine) {
				engine.addHighlightingUpdatedListener(requestCallFn(
					() => {
						// Markers are indistinct after the hue limit, and introduce unacceptable lag by ~10 terms.
						const termsAllowed = terms.current.slice(0, hues.current.length);
						termMarker.insert(termsAllowed, hues.current, []);
					},
					200, 2000,
				));
			}
		}
		engine.addHighlightingUpdatedListener(() => {
			for (const listener of this.#highlightingUpdatedListeners) {
				listener();
			}
		});
		return engineData;
	}

	async constructEngineData (engineClass: Engine): Promise<EngineData> {
		switch (engineClass) {
		case "ELEMENT": {
			const [ { ElementEngine }, { TermCounter }, { TermWalker }, { TermMarker } ] = await Promise.all([
				import("/dist/modules/highlight/engines/element.mjs"),
				import("/dist/modules/highlight/tools/term-counters/element.mjs"),
				import("/dist/modules/highlight/tools/term-walkers/element.mjs"),
				import("/dist/modules/highlight/tools/term-markers/element.mjs"),
			]);
			const engine = new ElementEngine(this.#termTokens, this.#termPatterns);
			return {
				engine,
				termCounter: new TermCounter(this.#termTokens),
				termWalker: new TermWalker(this.#termTokens),
				termMarker: new TermMarker(this.#termTokens),
			};
		} case "HIGHLIGHT": case "PAINT": {
			const [ { PaintEngine }, { TermCounter }, { TermWalker }, { TermMarker } ] = await Promise.all([
				import("/dist/modules/highlight/engines/paint.mjs"),
				import("/dist/modules/highlight/tools/term-counters/paint.mjs"),
				import("/dist/modules/highlight/tools/term-walkers/paint.mjs"),
				import("/dist/modules/highlight/tools/term-markers/paint.mjs"),
			]);
			const engine = new PaintEngine(this.#termTokens, this.#termPatterns);
			return {
				engine,
				termCounter: new TermCounter(),
				termWalker: new TermWalker(this.#termTokens),
				termMarker: new TermMarker(this.#termTokens),
			};
		}}
	}

	removeEngine () {
		this.deactivateEngine();
		this.#engineData = null;
	}

	deactivateEngine () {
		const engineData = this.#engineData;
		if (!engineData) {
			return;
		}
		engineData.termWalker?.deactivate();
		engineData.termMarker?.deactivate();
		engineData.engine.deactivate();
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	signalPaintEngineMethod () {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async applyPaintEngineMethod () {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async setSpecialEngine () {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	async constructSpecialEngine () {}

	// eslint-disable-next-line @typescript-eslint/no-empty-function
	removeSpecialEngine () {}

	addHighlightingUpdatedListener (listener: () => void) {
		this.#highlightingUpdatedListeners.add(listener);
	}
}

export type { AbstractEngineManager };

export { EngineManager };
