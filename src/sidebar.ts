import * as vscode from "vscode";
import { EvidencePacket } from "./evidence/packet";

export interface SidebarCallbacks {
  capture: (symptom: string, commandLine: string) => Promise<EvidencePacket | undefined>;
  generate: () => Promise<void>;
}

export class DoubtCatchViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "doubtcatch.sidebar";

  private view?: vscode.WebviewView;
  private packet?: EvidencePacket;

  public constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly callbacks: SidebarCallbacks,
  ) {}

  public resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = { enableScripts: true };
    view.webview.html = this.getHtml(view.webview);
    view.webview.onDidReceiveMessage(async (message: { type: string; symptom?: string; command?: string }) => {
      if (message.type === "capture") {
        await this.capture(message.symptom?.trim() ?? "", message.command?.trim() ?? "");
      } else if (message.type === "generate") {
        await this.callbacks.generate();
      }
    });

    if (this.packet) {
      this.postPacket(this.packet);
    }
  }

  public setPacket(packet: EvidencePacket): void {
    this.packet = packet;
    this.postPacket(packet);
  }

  private async capture(symptom: string, commandLine: string): Promise<void> {
    if (!symptom) {
      this.postMessage({ type: "error", message: "Describe the problem before capturing evidence." });
      return;
    }

    this.postMessage({ type: "busy", busy: true });
    try {
      const packet = await this.callbacks.capture(symptom, commandLine);
      if (packet) {
        this.setPacket(packet);
      }
    } finally {
      this.postMessage({ type: "busy", busy: false });
    }
  }

  private postPacket(packet: EvidencePacket): void {
    this.postMessage({
      type: "packet",
      counts: {
        diagnostics: packet.diagnostics.length,
        changes: packet.gitChanges.length,
        files: packet.fileContexts.length,
        terminal: packet.terminal ? packet.terminal.exitCode : undefined,
      },
      symptom: packet.userSymptom,
    });
  }

  private postMessage(message: unknown): void {
    void this.view?.webview.postMessage(message);
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
    header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
    header img { width: 28px; height: 28px; border-radius: 6px; }
    h1 { font-size: 16px; margin: 0; }
    .muted { color: var(--vscode-descriptionForeground); line-height: 1.45; }
    label { display: block; font-weight: 600; margin: 16px 0 6px; }
    textarea, input { width: 100%; color: var(--vscode-input-foreground); background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border, transparent); padding: 8px; font: inherit; resize: vertical; }
    textarea:focus, input:focus { outline: 1px solid var(--vscode-focusBorder); outline-offset: -1px; }
    button { width: 100%; margin-top: 14px; padding: 8px 12px; color: var(--vscode-button-foreground); background: var(--vscode-button-background); border: 1px solid transparent; cursor: pointer; font: inherit; font-weight: 600; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    #status { min-height: 20px; margin-top: 12px; color: var(--vscode-descriptionForeground); }
    #status.error { color: var(--vscode-errorForeground); }
    .evidence { display: none; margin-top: 22px; border-top: 1px solid var(--vscode-panel-border); padding-top: 16px; }
    .evidence.visible { display: block; }
    .counts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
    .count { padding: 10px; background: var(--vscode-textBlockQuote-background); border-left: 2px solid var(--vscode-textLink-foreground); }
    .count strong { display: block; font-size: 18px; }
    .count span { color: var(--vscode-descriptionForeground); font-size: 11px; }
    .symptom { margin-top: 14px; padding: 10px; background: var(--vscode-textCodeBlock-background); line-height: 1.4; }
  </style>
</head>
<body>
  <header><img src="${iconUri}" alt=""><h1>DoubtCatch</h1></header>
  <div class="muted">Catch the problem. Prove the fix.</div>
  <label for="symptom">What is going wrong?</label>
  <textarea id="symptom" rows="4" placeholder="Describe the behavior you expected and what happened..."></textarea>
  <label for="command">Optional verification command</label>
  <input id="command" placeholder="npm test">
  <button id="capture">Capture evidence</button>
  <div id="status" role="status"></div>
  <section id="evidence" class="evidence" aria-live="polite">
    <strong>Latest capture</strong>
    <div class="counts">
      <div class="count"><strong id="diagnostics">0</strong><span>diagnostics</span></div>
      <div class="count"><strong id="changes">0</strong><span>Git changes</span></div>
      <div class="count"><strong id="files">0</strong><span>relevant files</span></div>
      <div class="count"><strong id="terminal">--</strong><span>terminal exit</span></div>
    </div>
    <div id="latestSymptom" class="symptom"></div>
    <button id="generate" class="secondary">Copy agent prompt</button>
  </section>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const status = document.getElementById('status');
    document.getElementById('capture').addEventListener('click', () => {
      vscode.postMessage({ type: 'capture', symptom: document.getElementById('symptom').value, command: document.getElementById('command').value });
    });
    document.getElementById('generate').addEventListener('click', () => vscode.postMessage({ type: 'generate' }));
    window.addEventListener('message', ({ data }) => {
      if (data.type === 'busy') { status.textContent = data.busy ? 'Collecting diagnostics, Git, files and terminal output...' : ''; }
      if (data.type === 'error') { status.textContent = data.message; status.className = 'error'; }
      if (data.type === 'packet') {
        status.className = ''; status.textContent = 'Evidence captured and available in the output panel.';
        document.getElementById('evidence').className = 'evidence visible';
        document.getElementById('diagnostics').textContent = data.counts.diagnostics;
        document.getElementById('changes').textContent = data.counts.changes;
        document.getElementById('files').textContent = data.counts.files;
        document.getElementById('terminal').textContent = data.counts.terminal ?? '--';
        document.getElementById('latestSymptom').textContent = data.symptom || '(no symptom provided)';
      }
    });
  </script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}