import * as vscode from 'vscode';
import { JavaParser } from '../language/java/JavaParser';
import { XmlParser } from '../language/xml/XmlParser';
import { MapperNavigator } from '../navigation/MapperNavigator';

export class MapperDecorationProvider {
    private javaDecorationType: vscode.TextEditorDecorationType;
    private xmlDecorationType: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        // 创建Java装饰类型
        this.javaDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: context.asAbsolutePath('resources/icons/mybatis-java.svg'),
            gutterIconSize: '16px'
        });

        // 创建XML装饰类型
        this.xmlDecorationType = vscode.window.createTextEditorDecorationType({
            gutterIconPath: context.asAbsolutePath('resources/icons/mybatis-xml.svg'),
            gutterIconSize: '16px'
        });

        // 注册点击事件
        context.subscriptions.push(
            vscode.commands.registerCommand('mybatisx.handleIconClick', async (editor: vscode.TextEditor, position: vscode.Position) => {
                const document = editor.document;
                const outputChannel = vscode.window.createOutputChannel('MybatisXX-IconClick');
                outputChannel.appendLine(`处理图标点击事件：文件=${document.fileName}, 行=${position.line+1}, 列=${position.character}`);
                
                if (document.fileName.endsWith('Mapper.java')) {
                    // 处理Java文件中图标点击
                    const methods = JavaParser.parseMapperInterface(document);
                    outputChannel.appendLine(`Java文件中找到 ${methods.length} 个方法`);
                    
                    for (const method of methods) {
                        outputChannel.appendLine(`检查方法: ${method.name} 位于行 ${method.position.line+1}`);
                        if (position.line === method.position.line) {
                            outputChannel.appendLine(`找到匹配的Java方法: ${method.name}`);
                            const xmlUri = await MapperNavigator.findXmlForJavaMapper(document);
                            if (xmlUri) {
                                outputChannel.appendLine(`找到对应的XML文件: ${xmlUri.fsPath}`);
                                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                                const statements = XmlParser.parseMapperXml(xmlDoc);
                                const statement = statements.find(s => s.id === method.name);
                                if (statement) {
                                    outputChannel.appendLine(`在XML中找到对应的语句，位于行 ${statement.position.line+1}`);
                                    const xmlEditor = await vscode.window.showTextDocument(xmlDoc);
                                    xmlEditor.selection = new vscode.Selection(statement.position, statement.position);
                                    xmlEditor.revealRange(new vscode.Range(statement.position, statement.position));
                                    return true;
                                } else {
                                    outputChannel.appendLine(`未找到方法 ${method.name} 对应的XML语句`);
                                }
                            } else {
                                outputChannel.appendLine(`未找到对应的XML文件`);
                            }
                            break;
                        }
                    }
                } else if (document.fileName.endsWith('Mapper.xml')) {
                    // 处理XML文件中图标点击
                    const statements = XmlParser.parseMapperXml(document);
                    outputChannel.appendLine(`XML文件中找到 ${statements.length} 个语句`);
                    
                    for (const statement of statements) {
                        outputChannel.appendLine(`检查语句: ${statement.id} 位于行 ${statement.position.line+1}`);
                        if (position.line === statement.position.line) {
                            outputChannel.appendLine(`找到匹配的XML语句: ${statement.id}`);
                            const javaUri = await MapperNavigator.findJavaForXmlMapper(document);
                            if (javaUri) {
                                outputChannel.appendLine(`找到对应的Java文件: ${javaUri.fsPath}`);
                                const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                                const methods = JavaParser.parseMapperInterface(javaDoc);
                                const method = methods.find(m => m.name === statement.id);
                                if (method) {
                                    outputChannel.appendLine(`在Java中找到对应的方法，位于行 ${method.position.line+1}`);
                                    const javaEditor = await vscode.window.showTextDocument(javaDoc);
                                    javaEditor.selection = new vscode.Selection(method.position, method.position);
                                    javaEditor.revealRange(new vscode.Range(method.position, method.position));
                                    return true;
                                } else {
                                    outputChannel.appendLine(`未找到语句 ${statement.id} 对应的Java方法`);
                                }
                            } else {
                                outputChannel.appendLine(`未找到对应的Java文件`);
                            }
                            break;
                        }
                    }
                }
                outputChannel.appendLine(`未能处理该点击事件`);
                return false;
            })
        );

        // 监听编辑器变化
        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor) {
                    this.updateDecorations(editor);
                }
            }),
            
            vscode.workspace.onDidChangeTextDocument(event => {
                if (vscode.window.activeTextEditor && event.document === vscode.window.activeTextEditor.document) {
                    this.updateDecorations(vscode.window.activeTextEditor);
                }
            }),

            // 为行号区域的点击添加监听
            vscode.window.onDidChangeTextEditorSelection(event => {
                // 检测点击事件
                const editor = event.textEditor;
                if (event.kind === vscode.TextEditorSelectionChangeKind.Mouse && 
                    event.selections.length === 1 && 
                    event.selections[0].isEmpty) {
                    // 用户进行了单击
                    const position = event.selections[0].active;
                    const outputChannel = vscode.window.createOutputChannel('MybatisXX-Click');
                    
                    // 判断是否点击了装饰器图标（行号区域附近）
                    outputChannel.appendLine(`检测到点击: 行=${position.line+1}, 列=${position.character}`);
                    
                    // 修改检测逻辑，VSCode的图标区域通常在较小的character范围内
                    if (position.character <= 2) {
                        outputChannel.appendLine(`可能点击了图标区域，尝试处理导航`);
                        vscode.commands.executeCommand('mybatisx.handleIconClick', editor, position)
                            .then((result: any) => {
                                if (result !== true) {
                                    outputChannel.appendLine(`图标点击处理返回: ${result}, 尝试执行常规跳转命令`);
                                    // 如果没有处理图标点击，则检查是否应该触发常规的导航命令
                                    if (editor.document.fileName.endsWith('Mapper.java')) {
                                        outputChannel.appendLine(`执行 Java -> XML 跳转命令`);
                                        vscode.commands.executeCommand('mybatisx.gotoXml');
                                    } else if (editor.document.fileName.endsWith('Mapper.xml')) {
                                        outputChannel.appendLine(`执行 XML -> Java 跳转命令`);
                                        vscode.commands.executeCommand('mybatisx.gotoJava');
                                    }
                                } else {
                                    outputChannel.appendLine(`图标点击处理成功`);
                                }
                            });
                    }
                }
            })
        );

        // 初始更新
        if (vscode.window.activeTextEditor) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    public dispose(): void {
        this.javaDecorationType.dispose();
        this.xmlDecorationType.dispose();
        this.disposables.forEach(d => d.dispose());
    }

    public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
        const document = editor.document;
        
        if (document.fileName.endsWith('Mapper.java')) {
            const methods = JavaParser.parseMapperInterface(document);
            const javaDecorations: vscode.DecorationOptions[] = [];

            for (const method of methods) {
                const range = document.lineAt(method.position.line).range;
                javaDecorations.push({ range });
            }

            editor.setDecorations(this.javaDecorationType, javaDecorations);
            editor.setDecorations(this.xmlDecorationType, []);
        } 
        else if (document.fileName.endsWith('Mapper.xml')) {
            const statements = XmlParser.parseMapperXml(document);
            const xmlDecorations: vscode.DecorationOptions[] = [];

            for (const statement of statements) {
                const range = document.lineAt(statement.position.line).range;
                xmlDecorations.push({ range });
            }

            editor.setDecorations(this.xmlDecorationType, xmlDecorations);
            editor.setDecorations(this.javaDecorationType, []);
        }
        else {
            // 清除装饰
            editor.setDecorations(this.javaDecorationType, []);
            editor.setDecorations(this.xmlDecorationType, []);
        }
    }
} 