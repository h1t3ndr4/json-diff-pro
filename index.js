const vscode = require('vscode');
const { JsonDiffProvider } = require('./src/json-diff');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const jsonDiffProvider = new JsonDiffProvider(context);

    let disposable = vscode.commands.registerCommand('json-diff-pro.compare', async () => {
        try {
            await jsonDiffProvider.showDiffPanel();
        } catch (error) {
            vscode.window.showErrorMessage(`JSON Diff Error: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};