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

const localReconcileAlignmentActions = {
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
          config.extractedAlignment &&
          config.verseTextMap
        ) {
          const verseMarkerElement = {
            ...context.sequences[0].element,
            subtype: context.sequences[0].element.subType,
          };
          delete verseMarkerElement.subType;

          const mutableVerseElements = workspace.outputContentStack[0];

          mutableVerseElements.push(verseMarkerElement);

          reconcileVerseAlignment({
            verseText: config.verseTextMap[chapter][verses],
            verseAlignmentData: config.extractedAlignment[chapter][verses],
            mutableVerseElements,
            onUnalignedWordFound: (word: any) => {
              output.unalignedWords[chapter] ??= {};
              output.unalignedWords[chapter][verses] ??= [];
              output.unalignedWords[chapter][verses].push(word);
            },
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
      action: ({ workspace, config, context, ...other }) => {
        return true;
      },
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const reconcileAlignmentCode = function ({ perf, verseTextMap, extractedAlignment}) {
  const cl = new PerfRenderFromJson({
    srcJson: perf,
    actions: mergeActions([localReconcileAlignmentActions, identityActions]),
  });
  const output = {};
  cl.renderDocument({
    docId: "",
    config: {
      verseTextMap,
      extractedAlignment,
    },
    output,
  });
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
return { perf: output.perf };
};

export const reconcileAlignmentAction = {
  name: "reconcileAlignment",
  type: "Transform",
  description: "PERF=>PERF reconciles alignment markup with verse contents",
  inputs: [
    {
      name: "perf",
      type: "json",
      source: "",
    },
    {
      name: "extactedAlignment",
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
      name: "unalignedWords",
      type: "json",
    },
  ],
  code: reconcileAlignmentCode,
};

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

const processWords = (text: any) => {
  return XRegExp.match(text, re, "all");
};

const endMilestone = {
  type: "end_milestone",
  subtype: "usfm:zaln",
};

/**
 * This function merges USFM alignment markup with the verse contents. And tries to reconciliate the alignment markup with the verse contents even if the alignment markup is lost, or if verse contents and alignment data is out of sync.
 *
 * Rules:
 * - Alignment elements can be nested, meaning a start_milestone element can be placed after another start_milestone element even if the previous one has not been closed by an end_milestone element.
 * - Word wrappers cannot be nested within other word wrappers; they always contain a single word string and the updated occurrences count.
 * - At least one word wrapper should be between every two alignment elements.
 * - If a word wrapper is not between two alignment elements, it is considered unaligned.
 *
 * Types:
 *
 * type StartMilestone<AlignmentData> = {
 *   type: "start_milestone",
 *   subType: "usfm:zaln"
 * } & AlignmentData;
 *
 * type EndMilestone = {
 *   type: "end_milestone",
 *   subType: "usfm:zaln",
 * };
 * type WordWrapper = {
 *   type: "wrapper",
 *   subType: "usfm:w",
 *   content: [string]
 * };
 *
 * Example:
 * [
 *   // Simple alignment case
 *   {
 *     type: "start_milestone",
 *     subType: "usfm:zaln",
 *     ...otherAttributes,
 *   },
 *   {
 *     type: "wrapper",
 *     subType: "usfm:w",
 *     content: ["Hello"],
 *   },
 *   {
 *     type: "end_milestone",
 *     subType: "usfm:zaln",
 *   },
 *   // Complex alignment case
 *   {
 *     type: "start_milestone",
 *     subType: "usfm:zaln",
 *     ...otherAttributes,
 *   },
 *   {
 *     type: "wrapper",
 *     subType: "usfm:w",
 *     content: ["Hello"],
 *   },
 *   {
 *     type: "start_milestone",
 *     subType: "usfm:zaln",
 *   },
 *   {
 *     type: "wrapper",
 *     subType: "usfm:w",
 *     content: ["Beautiful"],
 *   },
 *   {
 *     type: "end_milestone",
 *     subType: "usfm:zaln",
 *   },
 *   {
 *     type: "wrapper",
 *     subType: "usfm:w",
 *     content: ["World"],
 *   },
 *   {
 *     type: "end_milestone",
 *     subType: "usfm:zaln",
 *   },
 * ];
 *
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const reconcileVerseAlignment = function ({verseText,verseAlignmentData,mutableVerseElements,onUnalignedWordFound}) {
  try {
    const words = processWords(verseText);
    const verseWordsOccurrences = countWordOccurrences(words);
    const currentOccurrences = {};
    const alignmentStack: never[] = [];
    let mergeableWords = [];

    for (const word of words) {
      if (!isWordLike(word) || !verseAlignmentData[word]) {
        mergeableWords.push(word);
        continue;
      }

      flushMergeableWords(mergeableWords, mutableVerseElements);
      mergeableWords = [];

      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      currentOccurrences[word] = (currentOccurrences[word] || 0) + 1;
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const wordOccurrence = currentOccurrences[word];

      const alignmentInfo = getAlignmentInfo(
        word,
        wordOccurrence,
        verseAlignmentData,
        verseWordsOccurrences
      );

      handleOpeningAlignments(
        alignmentInfo,
        alignmentStack,
        mutableVerseElements
      );

      if (alignmentInfo.isAligned) {
        addAlignedWord(
          word,
          wordOccurrence,
          alignmentInfo,
          mutableVerseElements
        );
      } else {
        handleUnalignedWord(
          word,
          wordOccurrence,
          alignmentInfo,
          onUnalignedWordFound,
          mutableVerseElements,
          alignmentStack
        );
      }

      handleClosingAlignments(
        alignmentInfo,
        alignmentStack,
        mutableVerseElements
      );
    }

    flushMergeableWords(mergeableWords, mutableVerseElements);

    return false;
  } catch (err) {
    console.error(err);
    throw err;
  }
};

// Helper functions
function isWordLike(word: any) {
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

function flushMergeableWords(mergeableWords: any[], mutableVerseElements: any[]) {
  if (mergeableWords.length) {
    mutableVerseElements.push(mergeableWords.join("").replace(/\s{2,}/g, " "));
  }
}

function getAlignmentInfo(
  word: string | number,
  occurrence: string | number,
  verseAlignmentData: { [x: string]: any; },
  verseWordsOccurrences: { [x: string]: any; }
) {
  const wordAlignmentData = verseAlignmentData[word];
  const wordOccurrencesMatchAlignment =
    verseWordsOccurrences[word] === wordAlignmentData?.occurrencesCount;

  return {
    isAligned:
      wordOccurrencesMatchAlignment &&
      wordAlignmentData.occurrences[occurrence],
    before: wordOccurrencesMatchAlignment
      ? wordAlignmentData.occurrences[occurrence]?.before || []
      : [],
    after: wordOccurrencesMatchAlignment
      ? wordAlignmentData.occurrences[occurrence]?.after || []
      : [],
    occurrencesCount: wordAlignmentData?.occurrencesCount,
  };
}

function handleOpeningAlignments(
  alignmentInfo: { isAligned?: any; before: any; after?: any; occurrencesCount?: any; },
  alignmentStack: any[],
  mutableVerseElements: any[]
) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  alignmentInfo.before.forEach(({ payload }) => {
    if (payload.type === "start_milestone") {
      mutableVerseElements.push(payload);
      alignmentStack.push(payload);
    }
  });
}

function addAlignedWord(word: any, occurrence: any, alignmentInfo: { isAligned?: any; before?: any; after?: any; occurrencesCount: any; }, mutableVerseElements: { type: string; subtype: string; atts: { "x-occurrences": string[]; "x-occurrence": string[]; }; content: any[]; }[]) {
  const wrapper = {
    type: "wrapper",
    subtype: "usfm:w",
    atts: {
      "x-occurrences": [String(alignmentInfo.occurrencesCount)],
      "x-occurrence": [String(occurrence)],
    },
    content: [word],
  };
  mutableVerseElements.push(wrapper);
}

function handleUnalignedWord(
  word: any,
  occurrence: any,
  alignmentInfo: { isAligned?: any; before?: any; after?: any; occurrencesCount: any; },
  onUnalignedWordFound: (arg0: { word: any; occurrence: any; totalOccurrencesInVerse: any; }) => void,
  mutableVerseElements: { type: string; subtype: string; }[],
  alignmentStack: any[]
) {
  // Close all open alignments
  while (alignmentStack.length > 0) {
    mutableVerseElements.push({ ...endMilestone });
    alignmentStack.pop();
  }

  onUnalignedWordFound({
    word,
    occurrence,
    totalOccurrencesInVerse: alignmentInfo.occurrencesCount,
  });

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  addAlignedWord(word, occurrence, alignmentInfo, mutableVerseElements);
}

function handleClosingAlignments(
  alignmentInfo: { isAligned?: any; before?: any; after: any; occurrencesCount?: any; },
  alignmentStack: any[],
  mutableVerseElements: any[]
) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  alignmentInfo.after.forEach(({ payload }) => {
    if (payload.type === "end_milestone") {
      if (alignmentStack.length > 0) {
        mutableVerseElements.push(payload);
        alignmentStack.pop();
      }
    }
  });
}
