const vscode = require('vscode');
const diff = require('diff');

class JsonDiffProvider {
    constructor(context) {
        this.context = context;
        this._panel = null;
    }

    compareObjects(obj1, obj2, path = []) {
        const differences = [];
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);

        for (const key of allKeys) {
            const currentPath = [...path, key];
            const val1 = obj1[key];
            const val2 = obj2[key];

            if (key in obj1 && key in obj2) {
                if (typeof val1 !== typeof val2) {
                    differences.push({
                        path: currentPath.join('.'),
                        type: 'modified',
                        oldValue: val1,
                        newValue: val2,
                        changeType: 'type_change'
                    });
                } else if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
                    differences.push(...this.compareObjects(val1, val2, currentPath));
                } else if (val1 !== val2) {
                    const textDiff = diff.diffWords(
                        JSON.stringify(val1, null, 2),
                        JSON.stringify(val2, null, 2)
                    );

                    differences.push({
                        path: currentPath.join('.'),
                        type: 'modified',
                        oldValue: val1,
                        newValue: val2,
                        diff: textDiff,
                        changeType: 'value_change'
                    });
                }
            } else if (key in obj1) {
                differences.push({
                    path: currentPath.join('.'),
                    type: 'removed',
                    oldValue: val1,
                    newValue: undefined
                });
            } else {
                differences.push({
                    path: currentPath.join('.'),
                    type: 'added',
                    oldValue: undefined,
                    newValue: val2
                });
            }
        }

        return differences;
    }

    async showDiffPanel() {
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            'jsonDiff',
            'JSON Diff Pro',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this._getWebviewContent();
        this._setupWebviewMessageListener();

        this._panel.onDidDispose(
            () => { this._panel = null; },
            null,
            this.context.subscriptions
        );
    }

    _getWebviewContent() {
        return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>JSON Diff Pro</title>
        <style>
            :root {
                --added-color: #e6ffed;
                --added-border: #34d058;
                --removed-color: #ffeef0;
                --removed-border: #ff4444;
            }

            body {
                padding: 0;
                margin: 0;
                font-family: var(--vscode-font-family);
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }

            .container {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                padding: 20px;
                height: calc(100vh - 140px);
            }

            .editor-container {
                display: flex;
                flex-direction: column;
                height: 100%;
            }

            .editor-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }

            .editor {
                flex-grow: 1;
                font-family: monospace;
                font-size: 14px;
                background: var(--vscode-input-background);
                border: 1px solid var(--vscode-input-border);
                color: var(--vscode-input-foreground);
                padding: 10px;
                resize: none;
                width: 100%;
                height: 100%;
                box-sizing: border-box;
            }

            .actions {
                padding: 20px;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            button {
                background: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 13px;
            }

            button:hover {
                background: var(--vscode-button-hoverBackground);
            }

            .diff-container {
                padding: 20px;
                font-family: monospace;
                font-size: 14px;
                overflow-y: auto;
                max-height: calc(100vh - 500px);
            }

            .diff-line {
                display: flex;
                padding: 2px 0;
                white-space: pre;
            }

            .diff-line-content {
                padding: 0 8px;
                flex-grow: 1;
                color: black;
            }

            .diff-line.added {
                background-color: var(--added-color);
                border-left: 4px solid var(--added-border);
            }

            .diff-line.removed {
                background-color: var(--removed-color);
                border-left: 4px solid var(--removed-border);
            }

            .diff-line.added:before {
                content: '+';
                color: var(--added-border);
                width: 20px;
                display: inline-block;
                text-align: center;
            }

            .diff-line.removed:before {
                content: '-';
                color: var(--removed-border);
                width: 20px;
                display: inline-block;
                text-align: center;
            }

            .diff-path {
                padding: 8px;
                margin-top: 16px;
                font-weight: bold;
                border-bottom: 1px solid var(--vscode-input-border);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="editor-container">
                <div class="editor-header">
                    <span>Original JSON</span>
                    <button onclick="formatEditor('json1')">Format</button>
                </div>
                <textarea id="json1" class="editor" spellcheck="false" placeholder="Paste original JSON here..."></textarea>
            </div>
            <div class="editor-container">
                <div class="editor-header">
                    <span>Modified JSON</span>
                    <button onclick="formatEditor('json2')">Format</button>
                </div>
                <textarea id="json2" class="editor" spellcheck="false" placeholder="Paste modified JSON here..."></textarea>
            </div>
        </div>
        
        <div class="actions">
            <button onclick="compareJSON()">Compare JSON</button>
        </div>

        <div id="diff-container" class="diff-container"></div>

        <script>
            const vscode = acquireVsCodeApi();

            function formatEditor(editorId) {
                const editor = document.getElementById(editorId);
                try {
                    const formatted = JSON.stringify(JSON.parse(editor.value), null, 2);
                    editor.value = formatted;
                } catch (error) {
                    showError('Invalid JSON: ' + error.message);
                }
            }

            function compareJSON() {
                const json1 = document.getElementById('json1').value;
                const json2 = document.getElementById('json2').value;

                if (!json1 || !json2) {
                    showError('Please provide both JSON objects for comparison');
                    return;
                }

                try {
                    const parsed1 = JSON.parse(json1);
                    const parsed2 = JSON.parse(json2);

                    vscode.postMessage({
                        command: 'compare',
                        json1: parsed1,
                        json2: parsed2
                    });
                } catch (error) {
                    showError('Invalid JSON: ' + error.message);
                }
            }

            function showError(message) {
                const container = document.getElementById('diff-container');
                container.innerHTML = \`<div class="diff-line removed">\${message}</div>\`;
            }

            function stringifyValue(value) {
                if (typeof value === 'string') return \`"\${value}"\`;
                return JSON.stringify(value);
            }

            window.addEventListener('message', event => {
                const message = event.data;
                const container = document.getElementById('diff-container');
                
                if (message.command === 'showDiff') {
                    container.innerHTML = '';
                    
                    if (message.diffs.length === 0) {
                        container.innerHTML = '<div class="diff-line">No differences found</div>';
                        return;
                    }

                    const groupedDiffs = message.diffs.reduce((acc, diff) => {
                        const pathParts = diff.path.split('.');
                        const parentPath = pathParts.slice(0, -1).join('.');
                        if (!acc[parentPath]) acc[parentPath] = [];
                        acc[parentPath].push(diff);
                        return acc;
                    }, {});

                    Object.entries(groupedDiffs).forEach(([path, diffs]) => {
                        if (path) {
                            const pathElement = document.createElement('div');
                            pathElement.className = 'diff-path';
                            pathElement.textContent = path;
                            container.appendChild(pathElement);
                        }

                        diffs.forEach(diff => {
                            const key = diff.path.split('.').pop();
                            
                            if (diff.type === 'modified') {
                                const removedLine = document.createElement('div');
                                removedLine.className = 'diff-line removed';
                                removedLine.innerHTML = \`<div class="diff-line-content">\${key}: \${stringifyValue(diff.oldValue)}</div>\`;
                                
                                const addedLine = document.createElement('div');
                                addedLine.className = 'diff-line added';
                                addedLine.innerHTML = \`<div class="diff-line-content">\${key}: \${stringifyValue(diff.newValue)}</div>\`;
                                
                                container.appendChild(removedLine);
                                container.appendChild(addedLine);
                            } else if (diff.type === 'added') {
                                const addedLine = document.createElement('div');
                                addedLine.className = 'diff-line added';
                                addedLine.innerHTML = \`<div class="diff-line-content">\${key}: \${stringifyValue(diff.newValue)}</div>\`;
                                container.appendChild(addedLine);
                            } else if (diff.type === 'removed') {
                                const removedLine = document.createElement('div');
                                removedLine.className = 'diff-line removed';
                                removedLine.innerHTML = \`<div class="diff-line-content">\${key}: \${stringifyValue(diff.oldValue)}</div>\`;
                                container.appendChild(removedLine);
                            }
                        });
                    });
                }
            });
        </script>
    </body>
    </html>`;
    }

    _setupWebviewMessageListener() {
        this._panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'compare') {
                    try {
                        const differences = this.compareObjects(message.json1, message.json2);
                        await this._panel.webview.postMessage({
                            command: 'showDiff',
                            diffs: differences
                        });
                    } catch (error) {
                        await this._panel.webview.postMessage({
                            command: 'showError',
                            error: `Error comparing JSON: ${error.message}`
                        });
                    }
                }
            },
            null,
            this.context.subscriptions
        );
    }
}

module.exports = { JsonDiffProvider };