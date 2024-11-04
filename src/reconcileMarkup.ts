// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { PerfRenderFromJson, render, mergeActions } from 'proskomma-json-tools';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import XRegExp = require('xregexp');

/**
 * @typedef {Object} PerfJson
 * @property {string} main_sequence_id - The ID of the main sequence.
 * @property {Object.<string, Sequence>} sequences - A map of sequence IDs to Sequence objects.
 */

/**
 * @typedef {Object} Sequence
 * @property {string} type - The type of the sequence (e.g., "main").
 * @property {Block[]} blocks - An array of Block objects in the sequence.
 */

/**
 * @typedef {Object} Block
 * @property {string} type - The type of the block (e.g., "paragraph", "graft").
 * @property {string} subtype - The subtype of the block.
 * @property {(string|Object)[]} content - The content of the block, which can be strings or nested objects.
 * @property {number} blockN - The block number.
 */

/**
 * @typedef {Object} Element
 * @property {string} type - The type of the element (e.g., "wrapper", "milestone").
 * @property {string} subType - The subtype of the element.
 * @property {Object.<string, string>} atts - Attributes of the element.
 */

/**
 * @typedef {Object} ActionContext
 * @property {Object} context - The current context of the rendering process.
 * @property {Object} workspace - The workspace object for storing temporary data.
 * @property {Object} output - The output object for storing results.
 * @property {PerfJson} output.perf - The output PERF JSON object.
 */

/**
 * @typedef {Object} ActionObject
 * @property {string} description - Description of the action.
 * @property {function(ActionContext): boolean} test - Function to test if the action should be executed.
 * @property {function(ActionContext): boolean} action - Function to execute the action.
 */

/**
 * @typedef {Object} RenderActions
 * @property {ActionObject[]} startDocument - Actions for the start of the document.
 * @property {ActionObject[]} endDocument - Actions for the end of the document.
 * @property {ActionObject[]} startSequence - Actions for the start of a sequence.
 * @property {ActionObject[]} endSequence - Actions for the end of a sequence.
 * @property {ActionObject[]} startTable - Actions for the start of a table.
 * @property {ActionObject[]} endTable - Actions for the end of a table.
 * @property {ActionObject[]} unresolvedBlockGraft - Actions for unresolved block grafts.
 * @property {ActionObject[]} blockGraft - Actions for block grafts.
 * @property {ActionObject[]} startParagraph - Actions for the start of a paragraph.
 * @property {ActionObject[]} endParagraph - Actions for the end of a paragraph.
 * @property {ActionObject[]} startRow - Actions for the start of a table row.
 * @property {ActionObject[]} endRow - Actions for the end of a table row.
 * @property {ActionObject[]} startCell - Actions for the start of a table cell.
 * @property {ActionObject[]} endCell - Actions for the end of a table cell.
 * @property {ActionObject[]} metaContent - Actions for meta content.
 * @property {ActionObject[]} mark - Actions for marks (e.g., chapter, verse).
 * @property {ActionObject[]} unresolvedInlineGraft - Actions for unresolved inline grafts.
 * @property {ActionObject[]} inlineGraft - Actions for inline grafts.
 * @property {ActionObject[]} startWrapper - Actions for the start of a wrapper.
 * @property {ActionObject[]} endWrapper - Actions for the end of a wrapper.
 * @property {ActionObject[]} startMilestone - Actions for the start of a milestone.
 * @property {ActionObject[]} endMilestone - Actions for the end of a milestone.
 * @property {ActionObject[]} text - Actions for text content.
 */

/**
 * @typedef {Object} PerfRenderFromJsonOptions
 * @property {PerfJson} srcJson - The source JSON object to render from.
 * @property {RenderActions} actions - The render actions to use.
 */

/**
 * @typedef {Object} RenderDocumentOptions
 * @property {string} docId - The document ID.
 * @property {Object} output - The output object to store results.
 */

/**
 * @function
 * @description Merges two sets of render actions.
 * @param {RenderActions} actions1 - The first set of render actions.
 * @param {RenderActions} actions2 - The second set of render actions.
 * @returns {RenderActions} The merged render actions.
 */

const { identityActions } = render.perfToPerf.renderActions;

const localReconcileVerseElementsActions = {
  startDocument: [
    {
      description: "setup",
      test: () => true,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      action: ({ workspace, output }) => {
        workspace.chapter = null;
        workspace.verses = null;
        workspace.currentOccurrences = {};
        workspace.verseWordsOccurrences = {};
        output.unalignedWords = {};
        return true;
      },
    },
  ],
  mark: [
    {
      description: "mark-chapters-and-verses",
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      test: ({ context }) =>
        ["chapter", "verses"].includes(context.sequences[0].element.subType),
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      action: ({ context, workspace, config, output }) => {
        const {
          subType,
          atts: { number },
        } = context.sequences[0].element;

        if (subType === "chapter") {
          workspace.chapter = number;
          workspace.verses = 0;
        } else if (subType === "verses") {
          workspace.verses = number;
        }

        const { chapter, verses } = workspace;
        if (
          subType === "verses" &&
          config.extractedInlineElements &&
          config.verseTextMap
        ) {
          const verseMarkerElement = {
            ...context.sequences[0].element,
            subtype: context.sequences[0].element.subType,
          };
          delete verseMarkerElement.subType;

          const mutableVerseElements = workspace.outputContentStack[0];

          mutableVerseElements.push(verseMarkerElement);

          reconcileVerseMarkup({
            verseText: config.verseTextMap[chapter][verses],
            verseInlineElementsData:
              config.extractedInlineElements[chapter][verses],
            mutableVerseElements,
          });

          return false;
        }

        return true;
      },
    },
  ],
  endDocument: [
    {
      description: "setup",
      test: () => true,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      action: ({ workspace, config, context, output }) => {
        output.perf.sequences = {
          ...output.perf.sequences,
          ...config.sequences,
        };
        return true;
      },
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const reconcileVerseElementsCode = function ({perf,verseTextMap,extractedInlineElements}) {
  const cl = new PerfRenderFromJson({
    srcJson: perf,
    actions: mergeActions([
      localReconcileVerseElementsActions,
      identityActions,
    ]),
  });
  const output = {};
  const sequences = { ...perf.sequences };
  delete sequences[perf.main_sequence_id];
  cl.renderDocument({
    docId: "",
    config: {
      verseTextMap,
      extractedInlineElements,
      sequences,
    },
    output,
  });
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return { perf: output.perf };
};

export const reconcileVerseElements = {
  name: "reconcileVerseElements",
  type: "Transform",
  description:
    "PERF=>PERF reconciles verse perf inline elements with verse contents",
  inputs: [
    {
      name: "perf",
      type: "json",
      source: "",
    },
    {
      name: "extactedInlineElements",
      type: "json",
      source: "",
    },
    {
      name: "verseTextMap",
      type: "json",
      source: "",
    },
  ],
  outputs: [
    {
      name: "perf",
      type: "json",
    },
    {
      name: "unreconciledMarkup",
      type: "json",
    },
  ],
  code: reconcileVerseElementsCode,
};
export default reconcileVerseElements;

const lexingRegexes = [
  [
    "printable",
    "wordLike",
    XRegExp("([\\p{Letter}\\p{Number}\\p{Mark}\\u2060]{1,127})"),
  ],
  ["printable", "lineSpace", XRegExp("([\\p{Separator}\t]{1,127})")],
  [
    "printable",
    "punctuation",
    XRegExp(
      "([\\p{Punctuation}\\p{Math_Symbol}\\p{Currency_Symbol}\\p{Modifier_Symbol}\\p{Other_Symbol}])"
    ),
  ],
  ["bad", "unknown", XRegExp("(.)")],
];
const re = XRegExp.union(lexingRegexes.map((x) => x[2]));

const processWords = (text: string) => {
  return XRegExp.match(text, re, "all");
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const reconcileVerseMarkup = function ({verseText,verseInlineElementsData,mutableVerseElements}) {
  try {
    reconcileInlineElements({
      verseText,
      verseInlineElementsData,
      mutableVerseElements,
    });

    return false;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const reconcileInlineElements = function ({verseText,verseInlineElementsData,mutableVerseElements}) {
  try {
    const words = processWords(verseText);
    const verseWordsOccurrences = countWordOccurrences(words);
    const currentOccurrences = {};
    const wrapperStack: any[] = [];
    let mergeableWords = [];
    const unreconciledElements: never[] = [];

    for (const word of words) {
      if (!isWordLike(word) || !verseInlineElementsData[word]) {
        mergeableWords.push(word);
        continue;
      }

      flushMergeableWords(mergeableWords, mutableVerseElements, wrapperStack);
      mergeableWords = [];

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      currentOccurrences[word] = (currentOccurrences[word] || 0) + 1;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const wordOccurrence = currentOccurrences[word];

      const inlineElementInfo = getInlineElementInfo(
        word,
        wordOccurrence,
        verseInlineElementsData,
        verseWordsOccurrences
      );

      handleOpeningElements(
        inlineElementInfo,
        wrapperStack,
        mutableVerseElements,
        unreconciledElements
      );

      addWord(word, mutableVerseElements, wrapperStack);

      handleClosingElements(
        inlineElementInfo,
        wrapperStack,
        mutableVerseElements,
        unreconciledElements
      );
    }

    flushMergeableWords(mergeableWords, mutableVerseElements, wrapperStack);

    // Close any remaining wrappers
    while (wrapperStack.length > 0) {
      mutableVerseElements.push(wrapperStack.pop());
    }

    // Add unreconciled elements to the end of the verse
    mutableVerseElements.push(...unreconciledElements);

    return false;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

function isWordLike(word: string) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return XRegExp.match(word, lexingRegexes[0][2], "all").length > 0;
}

function countWordOccurrences(words: any[]) {
  return words.reduce((acc: { [x: string]: any; }, word: string | number) => {
    acc[word] = (acc[word] || 0) + 1;
    return acc;
  }, {});
}

function flushMergeableWords(
  mergeableWords: any[],
  mutableVerseElements: any,
  wrapperStack: string | any[]
) {
  if (mergeableWords.length) {
    const text = mergeableWords.join("").replace(/\s{2,}/g, " ");
    const target =
      wrapperStack.length > 0
        ? wrapperStack[wrapperStack.length - 1].content
        : mutableVerseElements;

    mergeContiguousText(target, text);
  }
}

function getInlineElementInfo(
  word: string,
  occurrence: string | number,
  verseInlineElementsData: { [x: string]: any; },
  verseWordsOccurrences: { [x: string]: any; }
) {
  const wordInlineElementsData = verseInlineElementsData[word];
  const wordOccurrencesMatchInlineElements =
    verseWordsOccurrences[word] === wordInlineElementsData?.occurrencesCount;

  return {
    before: wordOccurrencesMatchInlineElements
      ? wordInlineElementsData.occurrences[occurrence]?.before || []
      : [],
    after: wordOccurrencesMatchInlineElements
      ? wordInlineElementsData.occurrences[occurrence]?.after || []
      : [],
    occurrencesCount: wordInlineElementsData?.occurrencesCount,
  };
}

function removeFalseyAndEmpty(obj: { [s: string]: unknown; } | ArrayLike<unknown> | null) {
  if (typeof obj !== "object" || obj === null) return obj;

  return Object.entries(obj).reduce(
    (acc, [key, value]) => {
      if (
        value &&
        (typeof value !== "object" ||
          (Array.isArray(value)
            ? value.length > 0
            : Object.keys(value).length > 0))
      ) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        acc[key] = value;
      }
      return acc;
    },
    Array.isArray(obj) ? [] : {}
  );
}

function handleOpeningElements(
  inlineElementInfo: { before: any; after?: any; occurrencesCount?: any; },
  wrapperStack: any[],
  mutableVerseElements: any[],
  unreconciledElements: any[]
) {
  console.log("Processing opening elements:", inlineElementInfo.before);

  inlineElementInfo.before.forEach((element: { payload: any; }, index: any) => {
    const cleanPayload = removeFalseyAndEmpty(element.payload);
    console.log(`Processing element ${index}:`, cleanPayload);

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (cleanPayload.type === "wrapper") {
      const wrapper = {
        ...cleanPayload,
        content: [],
      };
      if (wrapperStack.length > 0) {
        wrapperStack[wrapperStack.length - 1].content.push(wrapper);
      } else {
        mutableVerseElements.push(wrapper);
      }
      wrapperStack.push(wrapper);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
    } else if (cleanPayload.type === "graft") {
      console.error("unexpected graft statement");
      addGraftElement(cleanPayload, wrapperStack, mutableVerseElements);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    } else if (cleanPayload.type) {
      // Handle other element types if necessary
      unreconciledElements.push(cleanPayload);
    }
  });
}

function handleClosingElements(
  inlineElementInfo: { before?: any; after: any; occurrencesCount?: any; },
  wrapperStack: any[],
  mutableVerseElements: any,
  unreconciledElements: any[]
) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  inlineElementInfo.after.forEach(({ payload }) => {
    const cleanPayload = removeFalseyAndEmpty(payload);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (cleanPayload.type === "wrapper") {
      if (wrapperStack.length > 0) {
        wrapperStack.pop();
      } else {
        unreconciledElements.push(cleanPayload);
      }
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    } else if (cleanPayload.type === "graft") {
      addGraftElement(cleanPayload, wrapperStack, mutableVerseElements);
    } else {
      unreconciledElements.push(cleanPayload);
    }
  });
}

function addGraftElement(graft: any, wrapperStack: string | any[], mutableVerseElements: any) {
  console.log("Adding graft element:", graft);

  const target =
    wrapperStack.length > 0
      ? wrapperStack[wrapperStack.length - 1].content
      : mutableVerseElements;

  target.push(graft);
}

function addWord(word: string, mutableVerseElements: any, wrapperStack: string | any[]) {
  const target =
    wrapperStack.length > 0
      ? wrapperStack[wrapperStack.length - 1].content
      : mutableVerseElements;

  mergeContiguousText(target, word);
}

function mergeContiguousText(array: any[], newText: any) {
  if (
    array.length > 0 &&
    typeof array[array.length - 1] === "string" &&
    typeof newText === "string"
  ) {
    array[array.length - 1] += newText;
  } else {
    array.push(newText);
  }
}
