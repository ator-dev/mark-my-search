/**
 * Gets prefix and suffix regex strings for any word.
 * Only yields meaningful results for English words which fit standard word form patterns.
 * @param word A word.
 * @returns A 2-element array containing the prefix and suffix determined to best fit the word and its forms.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getWordPatternStrings = (() => { // TODO maybe rename as inflection finder?
	/**
	 * Reverses the characters in a string.
	 * @param chars A string.
	 * @returns The reverse of the given string.
	 */
	const reverse = (chars: string) => {
		for (let i = 0; i < chars.length; i += 2) {
			chars = chars[i] + chars;
		}
		return chars.substring(0, chars.length / 2);
	};

	/**
	 * Compares a pair of strings. Passed into an Array<string> sort function in order to sort the array into reverse alphabetical order.
	 * @param a The first of the string pair.
	 * @param b The second of the string pair.
	 * @returns -1 (sort a before b) if a is alphabetically greater than b, 1 (sort b before a) otherwise.
	 */
	const sortCompareFnReverse = (a: string, b: string) => a > b ? -1 : 1;

	return (() => {
		const suffixes = [
			"rison",
			"risons",
			"e",
			"es",
			"ely",
			"em",
			"et",
			"ets",
			"etry",
			"etic",
			"etics",
			"ce",
			"ces",
			"a",
			"as",
			"ata",
			"able", "ables", "abled", "abling", "ablings", "abler", "ablers", "ably", "ability", "abilities",
			"ac",
			"acity",
			"ocity",
			"ade",
			"age",
			"aholic",
			"oholic",
			"al", "als", "ally", "alise", "alyse", "ality", "alities", "alness",
			"algia",
			"an",
			"ian",
			"ance",
			"ances",
			"ancing",
			"anced",
			"ancer",
			"ancers",
			"ancy",
			"ant",
			"antly",
			"ar",
			"ars",
			"ard",
			"arian",
			"arium",
			"orium",
			"ary", "aries",
			"atic", "atical", "atically",
			"cide",
			"cracy",
			"crat",
			"cule",
			"cycle",
			"cy",
			"cies",
			"cious",
			"tic", "tics", "tical", "ticals", "tically",
			"dom",
			"dox", "doxes", "doxed", "doxing", "doxings", "doxer", "doxers", "doxic", "doxal", "doxical",
			"", "s", "ed", "ing", "ings", "er", "ee", // e.g. employ
			"ee", "ees", "aw", "eeing", "eeings", "eer", "eers",
			"eer", "eers", "eering",
			"emia",
			"en",
			"encing",
			"encings",
			"ency",
			"", "s", "entual", "entuals", "entuality", "entualities", // e.g. event
			"ed",
			"er",
			"ers",
			"ern",
			"escence",
			"ese",
			"esque", 
			"ess", "esses", "essing",
			"ease", "eases", "eased", "easing", "essation",
			"eed", "eeds", "ess", "essor", "essors",
			"est", "ests", "ested", "esting", "estings", "ester", "esters",
			"etic",
			"ette",
			"fication",
			"ful",
			"fy",
			"gam",
			"gamy",
			"gon",
			"gonic",
			"hood",
			"ial",
			"ian",
			"iasis",
			"iatric",
			"ible",
			"ian",
			"ic", "ics", "ical", "icals", "ically", "icism", "icisms", "icise", "icises", "icised", "icising", "icisings", "iciser", "icisers", "ician", "icians", "istic", "istics",
			"ile", "iled", "iler", "ilers", "iling", "ilings",
			"ily",
			"ion",
			"ious",
			"ish",
			"ism",
			"ist",
			"ists",
			"ite",
			"ites",
			"iteness",
			"itis",
			"ity",
			"ities",
			"ility",
			"ilities",
			"ibility",
			"ibilities",
			"ive", "ives", "iver", "ivers", "iving", "ivation", "ivations",
			"nd", "nds", "nded", "nding", "ndings", "nder", "nders",
			"ent", "ents", "ented", "enting", "entings", "ention", "entions", "entive", "entives", "entative", "entatives", "enter", "enters",
			"ence", "ences", "enced", "encing", "encings", "encer", "encers", "entific", "entifics", "entist", "entists"
			,	"tific", "tifics", "tist", "tists"
			,	"iet", "iety", "ietal", "ietism", "ietific", "ieisfics", "ietist", "ietists",
			"g", "ge", "gs", "ged", "ging", "gings", "ger", "gers",
			"ng", "ngs", "nged", "nging", "ngings", "nger", "ngers", "ngster", "ngsters",
			"re", "res", "ring", "rings", "red", "rer", "rers", "ration", "rations",
			"ate", "ates", "ated", "ater", "aters", "ating", "ation", "ations", "ative",
			"all", "alls", "alled", "alling", "allings", "aller", "allers",
			"ine", "ines", "ined", "ining", "inings", "iner", "iners",
			"ing", "ings", "inged", "inging", "ingings", "inger", "ingers",
			"ize", "izes", "ized", "izing", "izings", "izable", "izables", "ization", "izer", "izers",
			"ise", "ises", "ised", "ising", "isings", "isable", "isables", "isation", "iser", "isers",
			"islate", "islates", "islated", "islating", "islatings", "islation", "islations", "islater", "islaters",
			"ship", "ships", "shipped", "shipping", "shippings", "shipper", "shippers",
			"ded", "deds", "ding", "dings", "der", "ders",
			"n", "ns", "ned", "ning", "nings", "ner", "ners", "nership", "nned", "nning", "nnings", "nner", "nners",
			"in", "ins", "ined", "ining", "inings", "iner", "iners", "inned", "inning", "innings", "inner", "inners", "on",
			"use", "uses", "used", "using", "usings", "usable", "usables", "user", "users",
			"l", "ls", "led", "ling", "lings", "ler", "lers", "lled", "lling", "llings", "ller", "llers",
			"less",
			"let",
			"list",
			"le", "les", "led", "ling", "lings", "lar", "lars", "larisation", "lariser", "larisers", "larization", "larizer", "larizers",
			"el",
			"loger",
			"logist",
			"logy",
			"log",
			"ly",
			"ment",
			"ments",
			"mental",
			"mentals",
			"ness",
			"oid",
			"ology",
			"ologies",
			"oma",
			"onym",
			"opia",
			"opsy",
			"or",
			"ors",
			"ory",
			"oric",
			"orics",
			"orical",
			"oricals",
			"oral",
			"orals",
			"ories",
			"osis",
			"ostomy",
			"otomy",
			"ous",
			"s",
			"path",
			"pathy",
			"phile",
			"phobia",
			"phone",
			"phyte",
			"plegia",
			"plegic",
			"pnea",
			"scopy",
			"scope",
			"scribe", "scriber", "scribers", "scribed", "scribing", "scribings", "script", "scripts", "scription", "scriptions", "scriptive", "scriptives",
			"sect",
			"sion",
			"sions",
			"sioning",
			"sionings",
			"sioned",
			"sioner",
			"sioners",
			"sive",
			"sives",
			"d",
			"some",
			"sophy",
			"sophic",
			"th",
			"thy",
			"tion", "tional", "tionals", "tionally", "tions",
			"tive",
			"tives",
			"te", "tes", "ting", "tings", "ted", "tor", "tors",
			"nt",
			"nts",
			"ted",
			"tome",
			"tomy",
			"trophy",
			"tude",
			"t", "ts", "ting", "tings", "ter", "ters", "tive", "tives",
			"trar", "trars",
			"ty",
			"ties",
			"ular",
			"ularisation",
			"ularization",
			"uous",
			"ure",
			"us", "uses", "i", "a", "um", "ise", "ises", "ize", "izes",
			"i",
			"inal",
			"inals",
			"ward",
			"ware",
			"wise",
			"y",
			"ys",
			"ies",
		].sort(sortCompareFnReverse);
		const replacePatternReverse = new RegExp(
			`\\b(?:${suffixes.map(suffix => reverse(suffix)).sort(sortCompareFnReverse).join("|")})`, "gi");
		const highlightPatternString = `(?:${suffixes.join("|")})`;

		return (word: string): [ string, string ] => {
			const matches = reverse(word.slice(3)).match(replacePatternReverse);
			if (!matches)
				return [ word, highlightPatternString ];
			return [ word.slice(0, word.length - matches[0].length), highlightPatternString ];
		};
	})();
})();
