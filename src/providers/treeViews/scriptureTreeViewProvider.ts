import * as vscode from "vscode";
// import { vrefData } from "../../utils/verseRefUtils/verseData";

export class SBTreeNavigationProvider implements vscode.TreeDataProvider<TreeItem> {
    onDidChangeTreeData?: vscode.Event<TreeItem|null|undefined>|undefined;
  
    data: TreeItem[];
  
    constructor(private metadata: any, private versification: any) {
        const ingredientsObj = this?.metadata?.ingredients;
        const vObj = this.versification;
        this.data = [];
        for (const key of Object.keys(ingredientsObj)) {
          if (ingredientsObj[key]?.mimeType === "text/x-usfm") {
            const scope = ingredientsObj[key]?.scope;
            const tmpArr = Object.keys(scope);
            const curId = tmpArr[0];
            const chList = [];
            let cnt = 1;
            if (vObj?.maxVerses[curId]) {
              for (const maxV of vObj.maxVerses[curId]) {
                const vList = [];
                for (let verse = 1; verse <= maxV; verse++) {
                  vList.push(new TreeItem(`${verse}`));
                }
                chList.push(new TreeItem(`${cnt}`,vList));
                cnt+=1;
              }
            }
            const curNode = new TreeItem(curId,chList);
            this.data.push(curNode);
          }
        }
    }
  
    getTreeItem(element: TreeItem): vscode.TreeItem|Thenable<vscode.TreeItem> {
      return element;
    }
  
    getChildren(element?: TreeItem|undefined): vscode.ProviderResult<TreeItem[]> {
      if (element === undefined) {
        return this.data;
      }
      return element.children;
    }
  }
  
  class TreeItem extends vscode.TreeItem {
    children: TreeItem[]|undefined;
  
    constructor(label: string, children?: TreeItem[]) {
      super(
          label,
          children === undefined ? vscode.TreeItemCollapsibleState.None :
                                   vscode.TreeItemCollapsibleState.Collapsed);
      this.children = children;
    }
  }