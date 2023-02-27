
import { JSDOM } from 'jsdom'
import * as fs from 'fs';
import * as url from 'url'

const IGNORE_TAGS = ['SCRIPT', 'STYLE']


/**
 * Download html for urlToTranslate, translate page, and then save in file.
 * @param {String} urlToTranslate Url of page to translate
 */
async function translatePage(urlToTranslate) {
    const r = await (await fetch(urlToTranslate)).text()

    // Load document into parser
    const dom = new JSDOM(r)
    const tags = dom.window.document.body.getElementsByTagName('*')

    // Iterate over every element in document
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];

        if (IGNORE_TAGS.includes(tag.tagName)) continue;

        const nodes = tag.childNodes
        for (const node of nodes) {
            // Define Node type, it's not available by default
            const Node = node

            // We really only want text nodes, that's where actual text lives.
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                // Break up string into parts before and after text content. This allows us to keep 
                // formatting or non-word characters after translation
                const { before, content, after } = getStringParts(node.textContent)

                // Replace node's text with translated content. 
                // NOTE: We can get away with sending translation request in this loop and unbatched only
                // because translation service is running locally, so overhead is low and bottleneck is translation.
                node.textContent = `${before}${await translateText(content)}${after}`
            }
        }
    }


    const saveLocation = new URL(url.parse(urlToTranslate).host.replaceAll('.', '-') + ".html", import.meta.url);
    fs.writeFileSync(saveLocation.pathname, dom.serialize(), { flag: 'w' })
}

/**
 * Takes text, calls translation API, returns translated text
 * @param {string} text 
 * @returns {string} translated text
 */
async function translateText(text) {
    if (!text.trim()) {
        return ""
    }
    console.log(`translating ${text}`);
    const res = await fetch("http://localhost:5000/translate", {
        method: "POST",
        body: JSON.stringify({
            q: text,
            source: "en",
            target: "es"
        }),
        headers: { "Content-Type": "application/json" }
    });
    const json = await res.json()
    return json.translatedText
}


/**
 * Splits a string into everything before it's first word character, content, and everything after last word character.
 * @param {String} text 
 * @returns {{before: String, content: String, after: String}}
 */
function getStringParts(text) {
    let before = ""
    let after = ""
    let content = text
    // This regex matches text and numbers, but not whitespace or icons
    const r = /\w/

    // Find first word character, save everything before
    for (let j = 0; j < content.length; j++) {
        const char = content[j];
        if (r.test(char)) {
            before = content.slice(0, j)
            content = content.slice(j)
            break
        }
    }

    // Find last word character, save everything after
    for (let j = content.length - 1; j > -1; j--) {
        const char = content[j];
        if (r.test(char)) {
            after = content.slice(j + 1)
            content = content.slice(0, j + 1)
            break
        }
    }

    return { before, content, after }
}

translatePage("https://en.wikipedia.org/wiki/Main_Page")
