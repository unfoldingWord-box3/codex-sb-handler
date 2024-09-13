import * as vscode from "vscode";
import {
  ExtensionContext,
  StatusBarAlignment,
  window,
  workspace,
} from "vscode";
import { SBTreeNavigationProvider } from "./providers/treeViews/scriptureTreeViewProvider";
import * as path from "path";


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

	let statusTypeText = "Scripture Burrito Workspace";
	const relList = sbMetadata?.relationships;
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
			}
		}
	}

  status.text = "$(book)";
  status.tooltip = statusTypeText;
  status.color = "lightgrey";
  status.show();
}
