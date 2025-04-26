import * as vscode from 'vscode';
import * as path from 'path';
import { JavaLanguageService, JavaMethodInfo } from '../language/java/JavaLanguageService';
import { XmlParser, XmlMapperStatement } from '../language/xml/XmlParser';
import { MapperNavigator } from '../navigation/MapperNavigator';

// 存储装饰位置与方法映射关系的接口
interface DecoratorMapping {
    type: 'java' | 'xml';
    methodName: string;
    range: vscode.Range;
    document: vscode.TextDocument;
}

export class MapperDecorationProvider {
    private decorationType: vscode.TextEditorDecorationType;
    private disposables: vscode.Disposable[] = [];
    // 添加标志控制装饰器功能
    private decorationsEnabled: boolean = true; // 默认启用
    // 存储当前编辑器中的装饰位置和方法名映射
    private decorationMappings: DecoratorMapping[] = [];

    constructor() {
        // 创建装饰器类型
        this.decorationType = this.createDecorationType('mapper_method.svg');
        
        // 默认启用装饰器
        this.decorationsEnabled = true;
    }

    /**
     * 创建装饰器类型
     */
    private createDecorationType(iconName: string): vscode.TextEditorDecorationType {
        return vscode.window.createTextEditorDecorationType({
            before: {
                width: '14px',
                height: '14px',
                contentIconPath: this.getIconPath(iconName),
                margin: '0'
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    /**
     * 获取图标路径
     */
    private getIconPath(iconName: string): vscode.Uri {
        return vscode.Uri.file(
            path.join(__dirname, '..', '..', 'resources', 'icons', iconName)
        );
    }

    /**
     * 更新装饰器类型
     */
    private updateDecorationType(iconName: string) {
        if (this.decorationType) {
            this.decorationType.dispose();
        }
        this.decorationType = this.createDecorationType(iconName);
    }

    /**
     * 注册装饰器提供者
     */
    public static register(context: vscode.ExtensionContext): MapperDecorationProvider {
        const provider = new MapperDecorationProvider();
        provider.registerCommands(context);
        return provider;
    }

    /**
     * 注册相关命令
     */
    private registerCommands(context: vscode.ExtensionContext) {
        // 注册更新装饰器的事件处理
        const disposable = vscode.window.onDidChangeActiveTextEditor(async editor => {
            if (editor && this.decorationsEnabled) {
                await this.updateDecorations(editor);
            }
        });

        // 注册文档变化的事件处理
        const changeDisposable = vscode.workspace.onDidChangeTextDocument(async event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document && this.decorationsEnabled) {
                await this.updateDecorations(editor);
            }
        });

        // 注册鼠标点击事件处理
        const clickDisposable = vscode.window.onDidChangeTextEditorSelection(async (e) => {
            if (!this.decorationsEnabled || !e.textEditor || e.selections.length === 0) {
                return;
            }

            const clicked = e.selections[0].start;
            const document = e.textEditor.document;
            
            // 检查点击位置是否在我们的装饰范围内
            for (const mapping of this.decorationMappings) {
                if (document.uri.toString() === mapping.document.uri.toString() &&
                    mapping.range.contains(clicked)) {
                    
                    // 用户点击了装饰器，执行跳转
                    await this.handleDecorationClick(mapping.type, mapping.methodName, mapping.document);
                    break;
                }
            }
        });

        // 立即更新当前编辑器的装饰器
        if (vscode.window.activeTextEditor && this.decorationsEnabled) {
            this.updateDecorations(vscode.window.activeTextEditor);
        }

        this.disposables.push(disposable, changeDisposable, clickDisposable, this.decorationType);
        context.subscriptions.push(...this.disposables);
    }

    /**
     * 处理装饰器点击事件
     */
    private async handleDecorationClick(fileType: 'java' | 'xml', methodName: string, document: vscode.TextDocument): Promise<void> {
        if (fileType === 'java') {
            // 从Java跳转到XML
            const xmlUri = await MapperNavigator.findXmlForJavaMapper(document, methodName);
            if (xmlUri) {
                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                await vscode.window.showTextDocument(xmlDoc);
                // 可以添加定位到特定XML节点的逻辑
            } else {
                vscode.window.showInformationMessage(`未找到对应的XML声明: ${methodName}`);
            }
        } else if (fileType === 'xml') {
            // 从XML跳转到Java
            const javaUri = await MapperNavigator.findJavaForXmlMapper(document);
            if (javaUri) {
                const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                await vscode.window.showTextDocument(javaDoc);
                // 定位到特定方法
                const methodPosition = await MapperNavigator.findMethodInJavaFile(javaDoc, methodName);
                if (methodPosition) {
                    const editor = vscode.window.activeTextEditor;
                    if (editor) {
                        editor.selection = new vscode.Selection(methodPosition, methodPosition);
                        editor.revealRange(new vscode.Range(methodPosition, methodPosition));
                    }
                }
            } else {
                vscode.window.showInformationMessage(`未找到对应的Java接口: ${methodName}`);
            }
        }
    }

    /**
     * 更新装饰器
     */
    public async updateDecorations(editor: vscode.TextEditor) {
        // 如果装饰器被禁用，清除所有装饰并返回
        if (!this.decorationsEnabled) {
            editor.setDecorations(this.decorationType, []);
            this.decorationMappings = []; // 清空映射
            return;
        }

        const document = editor.document;
        const decorations: vscode.DecorationOptions[] = [];
        this.decorationMappings = []; // 重置映射

        try {
            if (document.fileName.endsWith('.java')) {
                // 为Java方法使用Java图标
                this.updateDecorationType('mybatis-java.svg');

                // 处理Java文件
                const methods = await JavaLanguageService.getMethodsInFile(document);
                for (const method of methods) {
                    const decoration = this.createJavaMethodDecoration(method, document);
                    if (decoration) {
                        decorations.push(decoration);
                        
                        // 存储装饰位置与方法的映射
                        const line = document.lineAt(method.iconPosition.line);
                        const range = new vscode.Range(
                            new vscode.Position(line.lineNumber, 0),
                            new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex)
                        );
                        this.decorationMappings.push({
                            type: 'java',
                            methodName: method.name,
                            range,
                            document
                        });
                    }
                }
            } else if (document.fileName.endsWith('.xml')) {
                // 为XML语句使用XML图标
                this.updateDecorationType('mybatis-xml.svg');

                // 处理XML文件
                const statements = XmlParser.parseMapperXml(document);
                for (const statement of statements) {
                    const decoration = this.createXmlStatementDecoration(statement, document);
                    if (decoration) {
                        decorations.push(decoration);
                        
                        // 存储XML语句位置与方法的映射
                        const range = new vscode.Range(
                            new vscode.Position(statement.position.line, 0),
                            statement.position
                        );
                        this.decorationMappings.push({
                            type: 'xml',
                            methodName: statement.id,
                            range,
                            document
                        });
                    }
                }
            }

            // 应用装饰器
            editor.setDecorations(this.decorationType, decorations);
        } catch (error) {
            console.error('Error updating decorations:', error);
        }
    }

    /**
     * 创建Java方法的装饰器
     */
    private createJavaMethodDecoration(method: JavaMethodInfo, document: vscode.TextDocument): vscode.DecorationOptions {
        const line = document.lineAt(method.iconPosition.line);
        const firstNonWhitespaceCharacterIndex = line.firstNonWhitespaceCharacterIndex;
        
        // 创建一个只包含行号前的范围
        const range = new vscode.Range(
            new vscode.Position(line.lineNumber, 0),
            new vscode.Position(line.lineNumber, firstNonWhitespaceCharacterIndex)
        );

        return {
            range,
            hoverMessage: new vscode.MarkdownString()
                .appendText(`${method.returnType} ${method.name}(`)
                .appendText(method.parameters.map(p => `${p.type} ${p.name}`).join(', '))
                .appendText(')'),
            renderOptions: {
                before: {
                    backgroundColor: new vscode.ThemeColor('editor.background'),
                    contentText: '',
                    width: '14px',
                    height: '14px'
                }
            }
            // DecorationOptions不支持command属性，需要以其他方式处理点击事件
        };
    }

    /**
     * 创建XML语句的装饰器
     */
    private createXmlStatementDecoration(statement: XmlMapperStatement, document: vscode.TextDocument): vscode.DecorationOptions {
        // 创建一个只包含行号前的范围
        const range = new vscode.Range(
            new vscode.Position(statement.position.line, 0),
            statement.position
        );

        return {
            range,
            hoverMessage: new vscode.MarkdownString()
                .appendText(`${statement.type} ${statement.id}`)
                .appendText(statement.parameterType ? `\nParameter Type: ${statement.parameterType}` : '')
                .appendText(statement.resultType ? `\nResult Type: ${statement.resultType}` : ''),
            renderOptions: {
                before: {
                    backgroundColor: new vscode.ThemeColor('editor.background'),
                    contentText: '',
                    width: '14px',
                    height: '14px'
                }
            }
            // DecorationOptions不支持command属性，需要以其他方式处理点击事件
        };
    }

    /**
     * 启用或禁用装饰器
     */
    public setEnabled(enabled: boolean): void {
        this.decorationsEnabled = enabled;
        // 如果禁用，清除当前编辑器的所有装饰
        if (!enabled && vscode.window.activeTextEditor) {
            vscode.window.activeTextEditor.setDecorations(this.decorationType, []);
        } else if (enabled && vscode.window.activeTextEditor) {
            // 如果启用，立即更新装饰
            this.updateDecorations(vscode.window.activeTextEditor);
        }
    }

    /**
     * 销毁装饰器
     */
    public dispose() {
        this.disposables.forEach(d => d.dispose());
    }
} 