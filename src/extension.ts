import * as vscode from 'vscode';
import { MapperNavigator } from './navigation/MapperNavigator';
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
    outputChannel.appendLine('MybatisXX 导航功能已激活!');

    // 获取配置
    const config = vscode.workspace.getConfiguration('mybatisx');
    const enableCodeLens = config.get<boolean>('enableCodeLens', true);
    const enableDecorations = config.get<boolean>('enableDecorations', true);

    outputChannel.appendLine(`配置：启用代码锚点跳转: ${enableCodeLens}, 启用方法前图标: ${enableDecorations}`);

    // 注册图标提供器
    registerIconProvider(context);
    outputChannel.appendLine('图标提供器已注册');

    // 如果启用了代码锚点跳转功能，注册CodeLens提供者
    if (enableCodeLens) {
        // Register code lens provider for both Java and XML files
        const codeLensProvider = new MapperCodeLensProvider();
        outputChannel.appendLine('正在注册Java和XML文件的CodeLens提供器...');
        
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
        outputChannel.appendLine('CodeLens提供器注册成功');
    } else {
        outputChannel.appendLine('CodeLens提供器已被禁用');
    }

    // 初始化装饰器提供程序
    const decorationProvider = MapperDecorationProvider.register(context);
    // 根据配置启用或禁用装饰器
    decorationProvider.setEnabled(enableDecorations);
    context.subscriptions.push(decorationProvider);
    outputChannel.appendLine(`装饰器提供器已注册，启用状态=${enableDecorations}`);
    
    // 为当前打开的所有编辑器应用装饰
    if (enableDecorations) {
        vscode.window.visibleTextEditors.forEach(editor => {
            if (editor.document.fileName.endsWith('Mapper.java') || 
                editor.document.fileName.endsWith('Mapper.xml')) {
                decorationProvider.updateDecorations(editor);
                outputChannel.appendLine(`已为 ${editor.document.fileName} 应用初始装饰`);
            }
        });
    }

    // 为Mapper文件添加文件监听器
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*Mapper.{java,xml}');
    context.subscriptions.push(fileWatcher);
    
    fileWatcher.onDidChange((uri) => {
        outputChannel.appendLine(`Mapper文件已更改: ${uri.fsPath}`);
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

    // 注册导航命令
    context.subscriptions.push(
        vscode.commands.registerCommand('mybatisx.gotoXml', async (xmlUri?: vscode.Uri, position?: vscode.Position) => {
            outputChannel.appendLine('执行gotoXml命令...');
            
            if (xmlUri) {
                // 这是从CodeLens调用的情况
                const doc = await vscode.workspace.openTextDocument(xmlUri);
                const editor = await vscode.window.showTextDocument(doc);
                if (position) {
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                }
                outputChannel.appendLine(`已导航到XML文件: ${xmlUri.fsPath}`);
            } else {
                // 这是从活动编辑器中当前位置调用的情况
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('Mapper.java')) {
                    outputChannel.appendLine('未找到活动的Mapper.java文件');
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

                outputChannel.appendLine(`正在查找Java方法对应的XML: ${method.name}`);
                const xmlInfo = await MapperNavigator.findXmlForJavaMapper(editor.document, method.name);
                if (xmlInfo) {
                    const doc = await vscode.workspace.openTextDocument(xmlInfo);
                    const xmlEditor = await vscode.window.showTextDocument(doc);
                    
                    // 找到XML中对应的方法位置并定位
                    const xmlPosition = MapperNavigator.findXmlMethodForJavaMethod(doc, method.name);
                    if (xmlPosition) {
                        xmlEditor.selection = new vscode.Selection(xmlPosition, xmlPosition);
                        xmlEditor.revealRange(
                            new vscode.Range(xmlPosition, xmlPosition), 
                            vscode.TextEditorRevealType.InCenter
                        );
                    }
                    
                    outputChannel.appendLine(`已找到并打开XML文件: ${xmlInfo.fsPath}`);
                } else {
                    outputChannel.appendLine('未找到对应的XML文件');
                    vscode.window.showWarningMessage('找不到对应的XML文件或方法');
                }
            }
        }),

        vscode.commands.registerCommand('mybatisx.gotoJava', async (javaUri?: vscode.Uri, position?: vscode.Position) => {
            outputChannel.appendLine('执行gotoJava命令...');
            if (javaUri) {
                const doc = await vscode.workspace.openTextDocument(javaUri);
                const editor = await vscode.window.showTextDocument(doc);
                if (position) {
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                }
                outputChannel.appendLine(`已导航到Java文件: ${javaUri.fsPath}`);
            } else {
                const editor = vscode.window.activeTextEditor;
                if (!editor || !editor.document.fileName.endsWith('Mapper.xml')) {
                    outputChannel.appendLine('未找到活动的Mapper.xml文件');
                    return;
                }

                outputChannel.appendLine(`正在查找XML文件对应的Java接口: ${editor.document.fileName}`);
                
                // 获取当前光标位置的XML语句对应的Java方法
                const cursorPosition = editor.selection.active;
                const javaInfo = await MapperNavigator.findJavaMethodForXmlPosition(editor.document, cursorPosition);
                
                if (javaInfo) {
                    const doc = await vscode.workspace.openTextDocument(javaInfo.javaFile);
                    const javaEditor = await vscode.window.showTextDocument(doc);
                    
                    // 将光标定位到方法名位置
                    javaEditor.selection = new vscode.Selection(javaInfo.methodPosition, javaInfo.methodPosition);
                    javaEditor.revealRange(
                        new vscode.Range(javaInfo.methodPosition, javaInfo.methodPosition), 
                        vscode.TextEditorRevealType.InCenter
                    );
                    
                    outputChannel.appendLine(`已找到并打开Java文件: ${javaInfo.javaFile.fsPath} 中的方法 ${javaInfo.methodName}`);
                } else {
                    // 如果找不到具体方法，尝试打开Java接口
                    const uri = await MapperNavigator.findJavaForXmlMapper(editor.document);
                    if (uri) {
                        const doc = await vscode.workspace.openTextDocument(uri);
                        await vscode.window.showTextDocument(doc);
                        outputChannel.appendLine(`已找到并打开Java文件: ${uri.fsPath}`);
                    } else {
                        outputChannel.appendLine('未找到对应的Java接口');
                        vscode.window.showWarningMessage('找不到对应的Java接口');
                    }
                }
            }
        }),

        // 添加文档变更监听器
        vscode.workspace.onDidChangeTextDocument((event) => {
            const doc = event.document;
            if (doc.fileName.endsWith('Mapper.java') || doc.fileName.endsWith('Mapper.xml')) {
                outputChannel.appendLine(`文档已更改: ${doc.fileName}`);
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

    outputChannel.appendLine('MybatisXX 扩展初始化完成');
}

export function deactivate() {
    if (outputChannel) {
        outputChannel.appendLine('MybatisXX 扩展已停用');
        outputChannel.dispose();
    }
} 