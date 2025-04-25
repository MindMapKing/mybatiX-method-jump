import * as vscode from 'vscode';
import { MapperNavigator } from './navigation/MapperNavigator';
import { SqlCompletionProvider } from './completion/sql/SqlCompletionProvider';
import { MapperCodeLensProvider } from './providers/MapperCodeLensProvider';
import { MapperDecorationProvider } from './providers/MapperDecorationProvider';

// Create output channel
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('MybatisXX');
    outputChannel.show();
    outputChannel.appendLine('MybatisXX is now active!');

    // Register SQL completion provider
    const sqlCompletionProvider = new SqlCompletionProvider();
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { scheme: 'file', language: 'xml' },
            sqlCompletionProvider,
            '#', // Trigger character for parameter completion
            ' '  // Trigger character for SQL keyword completion
        )
    );

    // Register code lens provider for both Java and XML files
    const codeLensProvider = new MapperCodeLensProvider();
    outputChannel.appendLine('Registering CodeLens provider for Java and XML files...');
    
    context.subscriptions.push(
        vscode.languages.registerCodeLensProvider(
            [
                { scheme: 'file', pattern: '**/*Mapper.java' },
                { scheme: 'file', pattern: '**/mapper/**/*Mapper.java' },
                { scheme: 'file', pattern: '**/mappers/**/*Mapper.java' }
            ],
            codeLensProvider
        ),
        vscode.languages.registerCodeLensProvider(
            [
                { scheme: 'file', pattern: '**/*Mapper.xml' },
                { scheme: 'file', pattern: '**/mapper/**/*Mapper.xml' },
                { scheme: 'file', pattern: '**/mappers/**/*Mapper.xml' }
            ],
            codeLensProvider
        )
    );
    outputChannel.appendLine('CodeLens providers registered successfully');

    // 初始化装饰器提供程序
    const decorationProvider = new MapperDecorationProvider(context);
    context.subscriptions.push(decorationProvider);
    outputChannel.appendLine('Decoration provider registered successfully');

    // Add file watcher for Mapper files
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*Mapper.{java,xml}');
    context.subscriptions.push(fileWatcher);
    
    fileWatcher.onDidChange((uri) => {
        outputChannel.appendLine(`Mapper file changed: ${uri.fsPath}`);
        vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
    });

    // Register commands for navigation
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisx.gotoXml', async (xmlUri?: vscode.Uri, position?: vscode.Position) => {
            outputChannel.appendLine('Executing gotoXml command...');
            if (xmlUri) {
                const doc = await vscode.workspace.openTextDocument(xmlUri);
                const editor = await vscode.window.showTextDocument(doc);
                if (position) {
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                }
                outputChannel.appendLine(`Navigated to XML file: ${xmlUri.fsPath}`);
            } else {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('Mapper.java')) {
                    outputChannel.appendLine('No active Mapper.java file found');
                    return;
                }

                outputChannel.appendLine(`Searching XML for Java file: ${editor.document.fileName}`);
                const uri = await MapperNavigator.findXmlForJavaMapper(editor.document);
                if (uri) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc);
                    outputChannel.appendLine(`Found and opened XML file: ${uri.fsPath}`);
                } else {
                    outputChannel.appendLine('Corresponding XML file not found');
                    vscode.window.showWarningMessage('Corresponding XML file not found');
                }
            }
        }),

        vscode.commands.registerCommand('mybatisx.gotoJava', async (javaUri?: vscode.Uri, position?: vscode.Position) => {
            outputChannel.appendLine('Executing gotoJava command...');
            if (javaUri) {
                const doc = await vscode.workspace.openTextDocument(javaUri);
                const editor = await vscode.window.showTextDocument(doc);
                if (position) {
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                }
                outputChannel.appendLine(`Navigated to Java file: ${javaUri.fsPath}`);
            } else {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('Mapper.xml')) {
                    outputChannel.appendLine('No active Mapper.xml file found');
                    return;
                }

                outputChannel.appendLine(`Searching Java interface for XML file: ${editor.document.fileName}`);
                const uri = await MapperNavigator.findJavaForXmlMapper(editor.document);
                if (uri) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc);
                    outputChannel.appendLine(`Found and opened Java file: ${uri.fsPath}`);
                } else {
                    outputChannel.appendLine('Corresponding Java interface not found');
                    vscode.window.showWarningMessage('Corresponding Java interface not found');
                }
            }
        })
    );

    // Add document change listener
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            const doc = event.document;
            if (doc.fileName.endsWith('Mapper.java') || doc.fileName.endsWith('Mapper.xml')) {
                outputChannel.appendLine(`Document changed: ${doc.fileName}`);
                vscode.commands.executeCommand('vscode.executeCodeLensProvider', doc.uri);
            }
        })
    );

    outputChannel.appendLine('MybatisXX extension initialization completed');
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('MybatisXX extension is now deactivated');
        outputChannel.dispose();
    }
} 