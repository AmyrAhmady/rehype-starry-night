import { createStarryNight, all } from "@wooorm/starry-night";
import { visit } from "unist-util-visit";
import { toString } from "hast-util-to-string";
import fenceparser from "@microflash/fenceparser";
import starryNightHeader from "./hast-util-starry-night-header.js";
import starryNightHeaderLanguageExtension from "./hast-util-starry-night-header-language-extension.js";
import starryNightHeaderCaptionExtension from "./hast-util-starry-night-header-caption-extension.js";
import starryNightGutter, { search } from "./hast-util-starry-night-gutter.js";

const prefix = "language-";

function extractMetadata(node) {
	let metadata;

	try {
		const { meta } = node.data || {};
		metadata = fenceparser(meta).metadata;
	} catch (e) { }

	return metadata || {};
}

export default function rehypeStarryNight(userOptions = {}) {
	const { aliases = {}, grammars = all, showLines, showHeader, headerExtensions = [starryNightHeaderLanguageExtension, starryNightHeaderCaptionExtension] } = userOptions;
	const starryNightPromise = createStarryNight(grammars);

	return async function (tree) {
		const starryNight = await starryNightPromise;

		visit(tree, "element", (node, index, parent) => {
			if (!parent || index === null || node.tagName !== "pre") {
				return;
			}

			const head = node.children[0];

			if (!head || head.type !== "element" || head.tagName !== "code" || !head.properties) {
				return;
			}

			const classes = head.properties.className;

			if (!Array.isArray(classes)) return;

			const language = classes.find((d) => typeof d === "string" && d.startsWith(prefix));

			if (typeof language !== "string") return;

			const metadata = extractMetadata(head);

			const languageFragment = language.slice(prefix.length);
			const languageId = aliases[languageFragment] || languageFragment || "txt";
			const scope = starryNight.flagToScope(languageId);
			const code = toString(head);

			let children;

			if (scope) {
				const fragment = starryNight.highlight(code, scope);
				children = fragment.children;
			} else {
				console.warn(`Grammar not found for ${languageId}; rendering the code without syntax highlighting`);
				children = head.children;
			}

			const headerOptions = {
				id: btoa(Math.random()).replace(/=/g, "").substring(0, 12),
				language: languageFragment,
				metadata: metadata,
				extensions: headerExtensions
			};

			const headerElements = showHeader ? starryNightHeader(headerOptions) : {}

			parent.children.splice(index, 1, {
				type: "element",
				tagName: "div",
				properties: {
					className: ["highlight", "highlight-" + languageId]
				},
				children: [
					headerElements,
					{
						type: "element",
						tagName: "pre",
						properties: {
							id: headerOptions.id
						},
						children: [
							{
								type: "element",
								tagName: "code",
								properties: { tabIndex: 0 },
								children: starryNightGutter(children, code.match(search).length, metadata, showLines)
							}
						]
					}
				]
			});
		});
	};
}
