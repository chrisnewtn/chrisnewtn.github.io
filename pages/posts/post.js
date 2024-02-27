const languageToFile = new Map([
  ['js', 'javascript']
]);

const languageMatcher = /^language-(?<language>.*)$/;

function toLanguageElementMap(memo, el) {
  for (const cssClass of el.classList) {
    if (languageMatcher.test(cssClass)) {
      const {groups: {language}} = languageMatcher.exec(cssClass);

      if (memo.has(language)) {
        memo.get(language).push(el);
      } else {
        memo.set(language, [el]);
      }

      break;
    }
  }
  return memo;
}


async function onload() {
  const codeElements = Array.from(document.querySelectorAll('article > pre > code'));

  if (codeElements.length === 0) {
    return;
  }

  const {default: hljs} = await import("../static/libs/highlight.js/11.9.0/core.min.js");

  const languages = codeElements.reduce(toLanguageElementMap, new Map());

  for (const [language, elements] of languages.entries()) {
    const hljsLang = languageToFile.get(language);
    const {default: highlighter} = await import(`../static/libs/highlight.js/11.9.0/languages/${hljsLang}.min.js`);

    hljs.registerLanguage(hljsLang, highlighter);

    for (const element of elements) {
      hljs.highlightElement(element);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  onload().catch(console.error);
});
