const vscode = require('vscode');
const JsonFormatter = require('./json-formatter');

class JsonDiffProvider {
    constructor(context) {
        this.context = context;
        this._panel = null;
    }

    /**
     * Compare two JSON objects and find differences
     * @param {object} obj1 
     * @param {object} obj2 
     * @returns {Array} differences
     */
    compareObjects(obj1, obj2, path = []) {
        const differences = [];
        
        // Compare properties of both objects
        const allKeys = new Set([...Object.keys(obj1), ...Object.keys(obj2)]);
        
        for (const key of allKeys) {
            const currentPath = [...path, key];
            const val1 = obj1[key];
            const val2 = obj2[key];
            
            // Property exists in both objects
            if (key in obj1 && key in obj2) {
                if (typeof val1 !== typeof val2) {
                    differences.push({
                        path: currentPath.join('.'),
                        type: 'type_change',
                        from: val1,
                        to: val2
                    });
                } else if (typeof val1 === 'object' && val1 !== null && val2 !== null) {
                    // Recursively compare objects
                    differences.push(...this.compareObjects(val1, val2, currentPath));
                } else if (val1 !== val2) {
                    differences.push({
                        path: currentPath.join('.'),
                        type: 'value_change',
                        from: val1,
                        to: val2
                    });
                }
            }
            // Property only in first object
            else if (key in obj1) {
                differences.push({
                    path: currentPath.join('.'),
                    type: 'removed',
                    from: val1,
                    to: undefined
                });
            }
            // Property only in second object
            else {
                differences.push({
                    path: currentPath.join('.'),
                    type: 'added',
                    from: undefined,
                    to: val2
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
            () => {
                this._panel = null;
            },
            null,
            this.context.subscriptions
        );
    }

    _setupWebviewMessageListener() {
        this._panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'compare') {
                    try {
                        const json1 = JSON.parse(message.json1);
                        const json2 = JSON.parse(message.json2);
                        
                        const differences = this.compareObjects(json1, json2);
                        
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

    _getWebviewContent() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>JSON Diff Pro</title>
            <style>
                :root {
                    --added-color: var(--vscode-diffEditor-insertedTextBackground);
                    --removed-color: var(--vscode-diffEditor-removedTextBackground);
                    --modified-color: var(--vscode-diffEditor-modifiedTextBackground);
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
                    font-family: var(--vscode-editor-font-family);
                    font-size: var(--vscode-editor-font-size);
                    background: var(--vscode-input-background);
                    border: 1px solid var(--vscode-input-border);
                    color: var(--vscode-input-foreground);
                    padding: 10px;
                    resize: none;
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
                    border-radius: 2px;
                }

                button:hover {
                    background: var(--vscode-button-hoverBackground);
                }

                .diff-container {
                    padding: 20px;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .diff-item {
                    margin-bottom: 10px;
                    padding: 10px;
                    border-radius: 3px;
                }

                .diff-item.added {
                    background: var(--added-color);
                }

                .diff-item.removed {
                    background: var(--removed-color);
                }

                .diff-item.modified {
                    background: var(--modified-color);
                }

                .diff-header {
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .error {
                    background: var(--vscode-inputValidation-errorBackground);
                    color: var(--vscode-inputValidation-errorForeground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    padding: 10px;
                    margin: 20px;
                    border-radius: 3px;
                }

                .format-button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    margin-left: 10px;
                }

                .format-button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="editor-container">
                    <div class="editor-header">
                        <span>Original JSON</span>
                        <button class="format-button" onclick="formatEditor('json1')">Format</button>
                    </div>
                    <textarea id="json1" class="editor" spellcheck="false" placeholder="Paste original JSON here..."></textarea>
                </div>
                <div class="editor-container">
                    <div class="editor-header">
                        <span>Modified JSON</span>
                        <button class="format-button" onclick="formatEditor('json2')">Format</button>
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
                        JSON.parse(json1);
                        JSON.parse(json2);
                    } catch (error) {
                        showError('Invalid JSON: ' + error.message);
                        return;
                    }

                    vscode.postMessage({
                        command: 'compare',
                        json1,
                        json2
                    });
                }

                function showError(message) {
                    const container = document.getElementById('diff-container');
                    container.innerHTML = \`<div class="error">\${message}</div>\`;
                }

                window.addEventListener('message', event => {
                    const message = event.data;
                    const container = document.getElementById('diff-container');
                    
                    if (message.command === 'showDiff') {
                        container.innerHTML = '';
                        
                        if (message.diffs.length === 0) {
                            container.innerHTML = '<div class="diff-item">No differences found</div>';
                            return;
                        }

                        message.diffs.forEach(diff => {
                            const diffElement = document.createElement('div');
                            diffElement.className = \`diff-item \${diff.type}\`;
                            
                            const header = document.createElement('div');
                            header.className = 'diff-header';
                            header.textContent = \`Path: \${diff.path}\`;
                            
                            const content = document.createElement('div');
                            content.innerHTML = \`
                                <div>From: \${JSON.stringify(diff.from, null, 2)}</div>
                                <div>To: \${JSON.stringify(diff.to, null, 2)}</div>
                            \`;
                            
                            diffElement.appendChild(header);
                            diffElement.appendChild(content);
                            container.appendChild(diffElement);
                        });
                    } else if (message.command === 'showError') {
                        showError(message.error);
                    }
                });
            </script>
        </body>
        </html>`;
    }
}

module.exports = { JsonDiffProvider };