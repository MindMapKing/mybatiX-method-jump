import * as vscode from 'vscode';
import { MapperNavigator } from './navigation/MapperNavigator';
import { SqlCompletionProvider } from './completion/sql/SqlCompletionProvider';
import { MapperCodeLensProvider } from './providers/MapperCodeLensProvider';
import { MapperDecorationProvider } from './providers/MapperDecorationProvider';
import { JavaLanguageService, JavaMethodInfo } from './language/java/JavaLanguageService';
import { registerIconProvider } from './providers/IconProvider';

// Create output channel
let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    // Initialize output channel
    outputChannel = vscode.window.createOutputChannel('MybatisXX');
    outputChannel.show();
    outputChannel.appendLine('MybatisXX is now active!');

    // 获取配置
    const config = vscode.workspace.getConfiguration('mybatisx');
    const enableCodeLens = config.get<boolean>('enableCodeLens', true);
    const enableDecorations = config.get<boolean>('enableDecorations', true);

    outputChannel.appendLine(`配置：启用代码锚点跳转: ${enableCodeLens}, 启用方法前图标: ${enableDecorations}`);

    // 注册图标提供器
    registerIconProvider(context);
    outputChannel.appendLine('Icon provider registered');

    // 禁用图标主题功能，避免与装饰器冲突
    // 如果用户启用了图标主题，则显示警告并建议禁用
    const workbenchConfig = vscode.workspace.getConfiguration('workbench');
    const iconTheme = workbenchConfig.get('iconTheme');
    if (iconTheme === 'mybatisxx-icons') {
        outputChannel.appendLine('警告：图标主题功能已启用，可能会与锚点导航功能冲突');
        vscode.window.showWarningMessage('MybatisXX 不建议启用图标主题功能，这可能会导致锚点导航失效。请转到设置并将 "workbench.iconTheme" 设置为其他主题。');
    }

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

    // 如果启用了代码锚点跳转功能，注册CodeLens提供者
    if (enableCodeLens) {
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
    } else {
        outputChannel.appendLine('CodeLens provider is disabled by configuration');
    }

    // 初始化装饰器提供程序
    const decorationProvider = MapperDecorationProvider.register(context);
    // 根据配置启用或禁用装饰器
    decorationProvider.setEnabled(enableDecorations);
    context.subscriptions.push(decorationProvider);
    outputChannel.appendLine(`Decoration provider registered with enabled=${enableDecorations}`);
    
    // 为当前打开的所有编辑器应用装饰
    if (enableDecorations) {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document.fileName.endsWith('Mapper.java') || 
                editor.document.fileName.endsWith('Mapper.xml')) {
                decorationProvider.updateDecorations(editor);
                outputChannel.appendLine(`Applied initial decorations to ${editor.document.fileName}`);
            }
        });
    }

    // Add file watcher for Mapper files
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*Mapper.{java,xml}');
    context.subscriptions.push(fileWatcher);
    
    fileWatcher.onDidChange((uri) => {
        outputChannel.appendLine(`Mapper file changed: ${uri.fsPath}`);
        if (enableCodeLens) {
            vscode.commands.executeCommand('vscode.executeCodeLensProvider', uri);
        }
        
        // 当文件变化时，如果启用了装饰器，也更新装饰器
        if (enableDecorations) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.uri.toString() === uri.toString()) {
                decorationProvider.updateDecorations(activeEditor);
            }
        }
    });

    // 监听配置变更
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(event => {
            if (event.affectsConfiguration('mybatisx.enableCodeLens') || 
                event.affectsConfiguration('mybatisx.enableDecorations')) {
                // 重新读取配置
                const updatedConfig = vscode.workspace.getConfiguration('mybatisx');
                const newEnableCodeLens = updatedConfig.get<boolean>('enableCodeLens', true);
                const newEnableDecorations = updatedConfig.get<boolean>('enableDecorations', true);
                
                outputChannel.appendLine(`配置已更改：启用代码锚点跳转: ${newEnableCodeLens}, 启用方法前图标: ${newEnableDecorations}`);
                
                // 更新装饰器状态
                decorationProvider.setEnabled(newEnableDecorations);
                
                // 如果启用了代码锚点，刷新活动编辑器的CodeLens
                if (newEnableCodeLens && vscode.window.activeTextEditor) {
                    vscode.commands.executeCommand('vscode.executeCodeLensProvider', vscode.window.activeTextEditor.document.uri);
                }
                
                // 如果配置变更，提示用户需要重新加载窗口以应用所有更改
                vscode.window.showInformationMessage(
                    'MybatisXX配置已更改，部分功能可能需要重新加载窗口才能生效。',
                    '重新加载窗口'
                ).then(selection => {
                    if (selection === '重新加载窗口') {
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }
                });
            }
        })
    );

    // Register commands for navigation
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisx.gotoXml', async (xmlUri?: vscode.Uri, position?: vscode.Position) => {
            outputChannel.appendLine('Executing gotoXml command...');
            
            if (xmlUri) {
                // 这是从CodeLens调用的情况
                const doc = await vscode.workspace.openTextDocument(xmlUri);
                const editor = await vscode.window.showTextDocument(doc);
                if (position) {
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                }
                outputChannel.appendLine(`Navigated to XML file: ${xmlUri.fsPath}`);
            } else {
                // 这是从活动编辑器中当前位置调用的情况
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('Mapper.java')) {
                    outputChannel.appendLine('No active Mapper.java file found');
                    return;
                }

                // 获取当前光标位置的Java方法
                const position = editor.selection.active;
                const methods = await JavaLanguageService.getMethodsInFile(editor.document);
                const method = methods.find((m: JavaMethodInfo) => 
                    position.line >= m.position.line && 
                    position.line <= m.range.end.line
                );

                if (!method) {
                    vscode.window.showInformationMessage('请将光标放在Mapper接口方法上');
                    return;
                }

                outputChannel.appendLine(`Searching XML for Java method: ${method.name}`);
                const uri = await MapperNavigator.findXmlForJavaMapper(editor.document, method.name);
                if (uri) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    await vscode.window.showTextDocument(doc);
                    outputChannel.appendLine(`Found and opened XML file: ${uri.fsPath}`);
                } else {
                    outputChannel.appendLine('Corresponding XML file not found');
                    vscode.window.showWarningMessage('找不到对应的XML文件或方法');
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
                
                // 更新装饰器
                const activeEditor = vscode.window.activeTextEditor;
                if (activeEditor && activeEditor.document.uri.toString() === doc.uri.toString()) {
                    decorationProvider.updateDecorations(activeEditor);
                }
            }
        })
    );

    // 监听编辑器切换
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                decorationProvider.updateDecorations(editor);
            }
        })
    );

    // 注册Mapper文件导航命令
    MapperNavigator.registerCommands(context);

    outputChannel.appendLine('MybatisXX extension initialization completed');
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('MybatisXX extension is now deactivated');
        outputChannel.dispose();
    }
} 