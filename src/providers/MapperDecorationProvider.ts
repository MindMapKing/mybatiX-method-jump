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
                if (document.fileName.endsWith('Mapper.java')) {
                    // 处理Java文件中图标点击
                    const methods = JavaParser.parseMapperInterface(document);
                    for (const method of methods) {
                        if (position.line === method.position.line) {
                            const xmlUri = await MapperNavigator.findXmlForJavaMapper(document);
                            if (xmlUri) {
                                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                                const statements = XmlParser.parseMapperXml(xmlDoc);
                                const statement = statements.find(s => s.id === method.name);
                                if (statement) {
                                    const xmlEditor = await vscode.window.showTextDocument(xmlDoc);
                                    xmlEditor.selection = new vscode.Selection(statement.position, statement.position);
                                    xmlEditor.revealRange(new vscode.Range(statement.position, statement.position));
                                    return true;
                                }
                            }
                            break;
                        }
                    }
                } else if (document.fileName.endsWith('Mapper.xml')) {
                    // 处理XML文件中图标点击
                    const statements = XmlParser.parseMapperXml(document);
                    for (const statement of statements) {
                        if (position.line === statement.position.line) {
                            const javaUri = await MapperNavigator.findJavaForXmlMapper(document);
                            if (javaUri) {
                                const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                                const methods = JavaParser.parseMapperInterface(javaDoc);
                                const method = methods.find(m => m.name === statement.id);
                                if (method) {
                                    const javaEditor = await vscode.window.showTextDocument(javaDoc);
                                    javaEditor.selection = new vscode.Selection(method.position, method.position);
                                    javaEditor.revealRange(new vscode.Range(method.position, method.position));
                                    return true;
                                }
                            }
                            break;
                        }
                    }
                }
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
                    
                    // 判断是否点击了装饰器图标（行号区域附近）
                    if (position.character <= 1) {
                        vscode.commands.executeCommand('mybatisx.handleIconClick', editor, position)
                            .then((result: any) => {
                                if (result !== true) {
                                    // 如果没有处理图标点击，则检查是否应该触发常规的CodeLens
                                    if (editor.document.fileName.endsWith('Mapper.java')) {
                                        vscode.commands.executeCommand('mybatisx.gotoXml');
                                    } else if (editor.document.fileName.endsWith('Mapper.xml')) {
                                        vscode.commands.executeCommand('mybatisx.gotoJava');
                                    }
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

    private async updateDecorations(editor: vscode.TextEditor): Promise<void> {
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