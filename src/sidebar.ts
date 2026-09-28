import * as vscode from "vscode";
export interface SidebarCallbacks {
  capture: () => Promise<boolean>;
  generate: () => Promise<boolean>;
}

export class DoubtCatchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "doubtcatch.sidebar";

  private view?: vscode.WebviewView;
  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage(async (message: { type: string }) => {
      if (message.type === "capture") {
        this.postStatus("Capturing evidence...");
        const captured = await this.callbacks.capture();
        this.postStatus(captured ? "Evidence captured. Review it in the DoubtCatch output." : "Capture cancelled.");
      } else if (message.type === "generate") {
        const generated = await this.callbacks.generate();
        this.postStatus(generated ? "Agent prompt copied to the clipboard." : "Capture evidence first.");
      }
    });
  }

  private postStatus(message: string): void {
    void this.view?.webview.postMessage({ type: "status", message });
  }

  private getHtml(webview: vscode.Webview): string {
    const nonce = getNonce();
    const iconUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "assets", "icon.png"));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; }
    body { padding: 16px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); }
    header { display: flex; align-items: center; gap: 9px; margin-bottom: 7px; }
    header img { width: 24px; height: 24px; border-radius: 4px; }
    h1 { margin: 0; font-size: 15px; font-weight: 600; }
    .tagline { color: var(--vscode-descriptionForeground); line-height: 1.45; margin-bottom: 18px; }
    .rule { border: 0; border-top: 1px solid var(--vscode-panel-border); margin: 0 0 18px; }
    h2 { margin: 0 0 10px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    button { width: 100%; min-height: 32px; margin-top: 8px; padding: 6px 10px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid transparent; cursor: pointer; font: inherit; text-align: left; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    #status { min-height: 34px; margin-top: 12px; color: var(--vscode-descriptionForeground); line-height: 1.4; }
  </style>
</head>
<body>
  <header><img src="${iconUri}" alt=""><h1>DoubtCatch</h1></header>
  <div class="tagline">Catch the problem. Prove the fix.</div>
  <hr class="rule">
  <h2>Evidence</h2>
  <button id="capture">Capture Evidence</button>
  <button id="generate" class="secondary">Generate AI Prompt</button>
  <div id="status" role="status"></div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('capture').addEventListener('click', () => vscode.postMessage({ type: 'capture' }));
    document.getElementById('generate').addEventListener('click', () => vscode.postMessage({ type: 'generate' }));
    window.addEventListener('message', ({ data }) => { if (data.type === 'status') document.getElementById('status').textContent = data.message; });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}