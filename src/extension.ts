import * as vscode from "vscode";
import {
  ExtensionContext,
  StatusBarAlignment,
  window,
  workspace,
} from "vscode";
import { decomposePerfAction } from './decomposePerf';
import { SBTreeNavigationProvider } from "./providers/treeViews/scriptureTreeViewProvider";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import {Proskomma} from "proskomma-core";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import {h32} from "xxhashjs";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import { PipelineHandler } from "proskomma-json-tools";

const decomposePerf = [
  {
    "id": 0,
    "type": "Inputs",
    "inputs": {
      "perf": "json"
    }
  },
  {
    "id": 1,
    "title": "Decompose PERF",
    "name": "decomposePerf",
    "transformName": "decomposePerf",
    "type": "Transform",
    "inputs": [
      {
        "name": "perf",
        "type": "json",
        "source": "Input perf"
      }
    ],
    "outputs": [
      {
        "name": "perf",
        "type": "json"
      },
      {
        "name": "extractedAlignment",
        "type": "json"
      },
      {
        "name": "extractedInlineElements",
        "type": "json"
      },
      {
        "name": "verseTextMap",
        "type": "json"
      }
    ],
    "description": "PERF=>PERF: Decompose text and markup"
  },
  {
    "id": 999,
    "type": "Outputs",
    "outputs": [
      {
        "name": "perf",
        "type": "json",
        "source": "Transform 1 perf"
      },
      {
        "name": "extractedAlignment",
        "type": "json",
        "source": "Transform 1 extractedAlignment"
      },
      {
        "name": "extractedInlineElements",
        "type": "json",
        "source": "Transform 1 extractedInlineElements"
      },
      {
        "name": "verseTextMap",
        "type": "json",
        "source": "Transform 1 verseTextMap"
      }
    ]
  }
];

const pipelineH = new PipelineHandler({
    pipelines: { decomposePerf },
    transforms: { decomposePerf: decomposePerfAction},
    proskomma: new Proskomma(),
    verbose: false
});

const typeToSbType = {
  "x-codex-ws": "cdx",
  "x-usfm-ws": "usfm",
  "x-usj-ws": "usj",
  "x-read-only": "ro"
};

const verbose = false;

const readEntryBookResource = async (
  workspaceFolder: string | undefined,
  resourceName: string
) => {
  try {
    const usePath = vscode.Uri.file(`${workspaceFolder}/${resourceName}`);
    const readData = await workspace.fs.readFile(usePath);
    const res = Buffer.from(readData).toString('utf8');
    return res;
  } catch (error: any) {
    window.showErrorMessage(
      `Failed to read file: ${error.message}`
    );
  }
};

const writeEntryText = async (
  workspaceFolder: string | undefined,
  rawContent: any, 
  resourceName: string
) => {
  try {
    workspace.fs.createDirectory(vscode.Uri.file(`${workspaceFolder}`));
    const usePath = vscode.Uri.file(`${workspaceFolder}/${resourceName}`);
    const encoder = new TextEncoder();
    const uintArrayValue = encoder.encode(rawContent);
    await workspace.fs.writeFile(usePath, uintArrayValue);
  } catch (error: any) {
    window.showErrorMessage(
      `Failed to write file: ${error.message}`
    );
  }
};

const writeEntryJson = async (
  workspaceFolder: string | undefined,
  rawContent: any, 
  resourceName: string
) => {
  try {
    const content = JSON.stringify(rawContent);
    workspace.fs.createDirectory(vscode.Uri.file(`${workspaceFolder}`));
    const usePath = vscode.Uri.file(`${workspaceFolder}/${resourceName}`);
    const encoder = new TextEncoder();
    const uintArrayValue = encoder.encode(content);
    await workspace.fs.writeFile(usePath, uintArrayValue);
  } catch (error: any) {
    window.showErrorMessage(
      `Failed to write file: ${error.message}`
    );
  }
};

const checkFileExists = async (uri: vscode.Uri) => {
  try {
      await vscode.workspace.fs.stat(uri);
      return true;
  } catch {
      return false;
  }
};

const checkFileIsUpToDate = async (
  workspaceFolder: string | undefined,
  basename: string
) => {
  const usePath = `${workspaceFolder}/uwj/${basename}.verses`;
  const useUri = vscode.Uri.file(usePath);
  if (await checkFileExists(useUri)) {
    return true;
  }
  return false;
};

const getBpkg = async (
    workspaceFolder: string | undefined,
    pk: { 
      importDocuments: (
        arg0: { source: string; project: any; bpkgVersion: string; }, 
        arg1: string, 
        arg2: any[]
      ) => void; 
      gqlQuerySync: (arg0: string) => {
          (): any; new(): any; data: {
            (): any; new(): any; docSets: any[]; 
          }; 
      }; 
      serializeBpkg: (arg0: any) => any; 
    }, 
    metadata: { 
      ingredients: any; 
      title: any; 
      copyright: any; 
      languageCode: any; 
      owner: any; 
      textDirection: any; 
      script: any; 
    }, 
    idStr: any
  ) => {
  const bookResources = [];
  const checkbookResources = Object.keys(metadata.ingredients).filter(r => r.endsWith('.usfm'));
  const bookContent: any[] = [];
  for (const book of checkbookResources) {
    const basename = path.basename(trimExt(book));
    if (await checkFileIsUpToDate(workspaceFolder,basename)) {
      // const bRes = await readEntryBookResource(workspaceFolder,book);
      console.log("found : " +basename);
      // bookContent.push(bRes);
      // bookResources.push(book);
    }
}
  pk.importDocuments(
      {
          source: "codex",
          project: idStr,
          bpkgVersion: "1.0",
      },
      "usfm",
      bookContent,
  );
  const docSet = pk.gqlQuerySync('{docSets { id documents { bookCode: header(id: "bookCode") sequences {type} } } }').data.docSets[0];
  const docSetId = docSet.id;

  let metadataTags = `"title:${metadata.title}" "copyright:${metadata.copyright}" "language:${metadata.languageCode}" """owner:${metadata.owner}"""`;
  if (metadata.textDirection) {
      metadataTags += ` "direction:${metadata.textDirection}"`;
  }
  if (metadata.script) {
      metadataTags += ` "script:${metadata.script}"`;
  }
  pk.gqlQuerySync(`mutation { addDocSetTags(docSetId: "${docSetId}", tags: [${metadataTags}]) }`);
 
  // const bpkg = pk.serializeBpkg(docSetId);
  // writeEntryJson(workspaceFolder,bpkg,`${idStr}.bpkg`);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  console.log("finished writing book package successfully");
};


async function doPerfStripAlignment(
  workspaceFolder: string | undefined,
  bookName: any,
  perf: any
) {

  let output: { 
    verseTextMap: any; 
    perf: any; 
    extractedAlignment: any; 
    extractedInlineElements: any; 
  };
  try {
    output = await pipelineH.runPipeline(
        'decomposePerf', {
            perf
        }
    );
    // const verifyDir = "./test";
    const verifyDir = ".";
    const outputDir = `${verifyDir}/uwj/`;

    const versesPath = path.join(outputDir, `${bookName}.verses`);
    let verseOutput: string = "";
    Object.keys(output.verseTextMap).forEach(chKey => {
      Object.keys(output.verseTextMap[chKey]).forEach(vKey => {
        const curStr = verseOutput;
        verseOutput = `${curStr}${chKey}:${vKey} ${output.verseTextMap[chKey][vKey]}\n`;
      });
    });
    await writeEntryText(workspaceFolder, verseOutput, versesPath);
    const seqPath = path.join(outputDir, `${bookName}.seq`);
    await writeEntryJson(workspaceFolder, output.perf, seqPath);
    const alignPath = path.join(outputDir, `${bookName}.align`);
    await writeEntryJson(workspaceFolder, output.extractedAlignment, alignPath);
    const seqMarkupPath = path.join(outputDir, `${bookName}.uwjmk`);
    await writeEntryJson(workspaceFolder, output.extractedInlineElements, seqMarkupPath);
  } catch (err) {
      console.log(err);
  }
}

async function doScriptureHandling(
  workspaceFolder: string | undefined,
  metadata: any,
  idStr: string,
  sbType: string
) {
    let pk;
    let docSetId;
    try {
        const stats = {
            nOT: 0,
            nNT: 0,
            nDC: 0,
            nChapters: 0,
            nVerses: 0,
            nIntroductions: 0,
            nHeadings: 0,
            nFootnotes: 0,
            nXrefs: 0,
            nStrong: 0,
            nLemma: 0,
            nGloss: 0,
            nContent: 0,
            nMorph: 0,
            nOccurrences: 0,
            documents: {}
        };
        try {
            pk = new Proskomma([
                {
                    name: "source",
                    type: "string",
                    regex: "^[^\\s]+$"
                },
                {
                    name: "project",
                    type: "string",
                    regex: "^[^\\s]+$"
                },
                {
                    name: "bpkgVersion",
                    type: "string",
                    regex: "^[^\\s]+$"
                },
            ]);

            const bpkg = await getBpkg(workspaceFolder, pk, metadata, idStr);

            // check data.bpkg or create one, if read only, else no need for data.bpkg (strip and keep on merging instead)
            // use uwj and codex to ingest, if exist, else create from usfm
            // keep uwj and codex in sync with usfm, if "x-usfm-ws" type
            // - in future -> keep uwj (version 2, based on usj) and codex in sync with usj, if "x-usj-ws" type
            
            // const rawBpkg = await readEntryBookResource(workspaceFolder, "f848bc5.bpkg");
            // const bpkg = JSON.parse(rawBpkg || "");
            // pk.loadSuccinctDocSet(bpkg);
            const docSetTags = pk.gqlQuerySync('{docSets { tagsKv {key value} } }').data.docSets[0].tagsKv;
            for (const kv of docSetTags) {
                if (["nOT", "nNT", "nDC"].includes(kv.key)) {
                    console.log(kv);
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-expect-error
                    stats[kv.key] = kv.value;
                }
            }
    
            const docSet = pk.gqlQuerySync('{docSets { id documents { bookCode: header(id: "bookCode") sequences {type} } } }').data.docSets[0];
            docSetId = docSet.id;
        } catch (err) {
            const bpkgError = {
                generatedBy: 'sbHandlerWorker',
                context: {
                    making: "populatePk",
                },
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                message: err.message
            };
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            console.log(bpkgError);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            throw new Error(`Bpkg could not be generated: ${err.message}`);
        }
        // Iterate over documents
        const documents = pk.gqlQuerySync(`{docSet(id: """${docSetId}""") {documents { id bookCode: header(id:"bookCode")} } }`).data.docSet.documents.map((d: { id: any; bookCode: any; }) => ({
            id: d.id,
            book: d.bookCode
        }));
        for (const doc of documents) {
            try {
                const res = pk.gqlQuerySync(`{ document(id: """${doc.id}""") { bookCode: header(id:"bookCode") perf } }`);
                const curDoc = res?.data?.document;
                console.log("Iterating perf from " + curDoc.bookCode);
                const curPerf = JSON.parse(res?.data?.document?.perf);
                try {
                    await doPerfStripAlignment(workspaceFolder, doc.book,curPerf);
                } catch (err) {
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  throw new Error(`Error from doPerfStripAlignment: ${err.message}`);
                }
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                console.log({
                    generatedBy: 'doScriptureHandling',
                    context: {
                        docSetId,
                        doc: doc.id,
                        book: doc.book,
                        making: "perf"
                    },
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    message: err.message,
                });
            }
          }
          // The end!
        } catch (err) {
          const bpkgError = {
            generatedBy: 'doScriptureHandling',
            context: {
              docSetId,
              making: "perf/alignment"
            },
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            message: err.message
        };
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        console.log(bpkgError);
    }
}


async function getSbVersification(
  workspaceFolder: string | undefined,
  metadata: any
): Promise<any> {
  const retObj = undefined;
  const ingredientsObj = metadata?.ingredients;

  if (!ingredientsObj || !ingredientsObj["ingredients/versification.json"]) {
    return retObj;
  }

  const projectVersificationPath = vscode.Uri.file(
    `${workspaceFolder}/ingredients/versification.json`
  );

  const projectVersification = await workspace.fs
    .readFile(projectVersificationPath)
    .then(
      (projectVersification) => {
        try {
          return JSON.parse(Buffer.from(projectVersification).toString());
        } catch (error: any) {
          window.showErrorMessage(
            `Failed to parse versification file: ${error.message}`
          );
        }
      },
      (err) => {
        window.showErrorMessage(
          `Failed to read versification file: ${err.message}`
        );
      }
    );

  if (!projectVersification) {
    return Promise.reject("No versification file found");
  }
  return projectVersification;
}

async function getWorkSpaceFolder(): Promise<string | undefined> {
  // Returns first workspace folder
  // Note: This means it does not handle multiple ws folders!
  let retStr = "";
  const wsFolderList = workspace?.workspaceFolders;
  if (wsFolderList?.length) {
    retStr = wsFolderList[0].uri.fsPath;
    retStr = path.normalize(retStr);
  }
  if (!retStr) {
    console.error("No workspace found");
  }
  return retStr;
}

async function getProjectMetadata(): Promise<any> {
  const workspaceFolder = await getWorkSpaceFolder();
  if (!workspaceFolder) {
    return Promise.reject("No workspace found");
  }

  const projectMetadataPath = vscode.Uri.file(
    `${workspaceFolder}/metadata.json`
  );

  const projectMetadata = await workspace.fs
    .readFile(projectMetadataPath)
    .then(
      (projectMetadata) => {
        try {
          return JSON.parse(Buffer.from(projectMetadata).toString());
        } catch (error: any) {
          window.showErrorMessage(
            `Failed to parse project metadata: ${error.message}`
          );
        }
      },
      (err) => {
        window.showErrorMessage(
          `Failed to read project metadata: ${err.message}`
        );
      }
    );

  if (!projectMetadata) {
    return Promise.reject("No project metadata found");
  }
  return projectMetadata;
}
const trimExt = (fileName: string) => {
  return (fileName.indexOf('.') === -1)
    ? fileName 
    : fileName.split('.').slice(0, -1).join('.');
};

const verifyChangedFile = (uri: vscode.Uri) => {
  const uriString = uri.fsPath ?? "";
  const re = /(?:\.([^.]+))?$/;
  const ext = re.exec(uriString)![1];
  if (["verses", "seq", "align", "uwjmk"].includes(ext)) {
    const basename = path.basename(trimExt(uriString));
    console.log("change to " + basename + " - " + ext);
  }
};

export async function activate(context: ExtensionContext) {
  // Create a status bar item
  const status = window.createStatusBarItem(StatusBarAlignment.Left, 1000000);
  context.subscriptions.push(status);

  // const disposable = vscode.commands.registerCommand(
  //   "extension.sbHandler",
  //   () => {
  //     // The code you place here will be executed every time your command is executed

  //     // Display a message box to the user
  //     window.showInformationMessage("Scripture Burrito command!");
  //   }
  // );

  // context.subscriptions.push(disposable);

  const sbMetadata = await getProjectMetadata();
  const ROOT_PATH = await getWorkSpaceFolder();
  const sbVersification = await getSbVersification(ROOT_PATH, sbMetadata);
  const scriptureTreeViewProvider = new SBTreeNavigationProvider(
    sbMetadata,
    sbVersification
  );

  window.registerTreeDataProvider(
    "sb-explorer",
    scriptureTreeViewProvider
  );

// vscode.workspace.createFileSystemWatcher
  const watcher = workspace.createFileSystemWatcher("**/*.*");
  watcher.onDidChange(uri => verifyChangedFile(uri));

	let statusTypeText = "Scripture Burrito Workspace";
	const relList = sbMetadata?.relationships;
  let sbType = "ro";
	for (const relation of relList) {
		const relType = relation?.relationType;
		console.log(relType);
		if (relType) {
			if (relType==="x-codex-ws") {
				statusTypeText = "SB Codex Workspace";
			}	else if (relType==="x-usfm-ws") {
				statusTypeText = "SB USFM Workspace";
			}	else if (relType==="x-usj-ws") {
				statusTypeText = "SB USJ Workspace";
			}	else if (relType==="x-read-only") {
				statusTypeText = "SB Read Only - Scripture Book Package";
			}
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      sbType = typeToSbType[relType];      
		}
	}
  const curHash = h32(JSON.stringify(sbMetadata.identification), 0xEDCBA987).toString(16);
  status.text = "$(loading~spin) Scripture Burrito - verifying";
  status.tooltip = `Verifying and converting -> ${statusTypeText}`;
  status.show();
  await doScriptureHandling(ROOT_PATH,sbMetadata,curHash,sbType);

  status.text = "$(book) ";
  status.tooltip = statusTypeText;
  status.show();
  console.log("finished successfully");
}
