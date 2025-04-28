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
            gutterIconPath: this.getIconPath(iconName),
            gutterIconSize: '80%',
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.findMatchForeground'),
            // 增加背景颜色，更容易辨识
            backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
            // 增加边框，使装饰区域更加明显
            border: '1px solid rgba(127, 127, 127, 0.3)',
            // 增加光标样式，提示用户可以点击
            cursor: 'pointer'
        });
    }

    /**
     * 获取图标路径
     */
    private getIconPath(iconName: string): vscode.Uri {
        // 使用当前文件路径来确定正确的图标相对路径
        const extensionPath = path.join(__dirname, '..', '..');
        return vscode.Uri.file(path.join(extensionPath, 'resources', 'icons', iconName));
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

        // 注册鼠标点击事件，用于点击装饰器图标
        const clickDisposable = vscode.window.onDidChangeTextEditorSelection(async (e) => {
            if (!this.decorationsEnabled || !e.textEditor) {
                return;
            }
            
            // 只处理鼠标点击事件
            if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse || e.selections.length === 0) {
                return;
            }
            
            const clicked = e.selections[0].active; // 获取点击位置
            const line = clicked.line;
            
            console.log(`点击位置: 行 ${line + 1}, 列 ${clicked.character}`);
            
            // 查找点击行是否有装饰器
            const mapping = this.decorationMappings.find(m => {
                return m.range.start.line === line && 
                       m.document.uri.toString() === e.textEditor.document.uri.toString();
            });
            
            if (mapping) {
                console.log(`找到装饰器映射: ${mapping.type} ${mapping.methodName}`);
                // 检查点击位置是否在装饰器区域，扩大检测范围到前10个字符
                if (clicked.character < 10) { 
                    console.log(`点击在装饰器区域，准备处理点击事件`);
                    // 直接调用handleDecorationClick方法，而不是通过命令
                    await this.handleDecorationClick(mapping.type, mapping.methodName, mapping.document);
                }
            }
        });

        this.disposables.push(disposable, changeDisposable, clickDisposable, this.decorationType);
        context.subscriptions.push(...this.disposables);
    }

    /**
     * 处理装饰器点击事件
     */
    private async handleDecorationClick(fileType: 'java' | 'xml', methodName: string, document: vscode.TextDocument): Promise<void> {
        console.log(`处理装饰器点击: 类型=${fileType}, 方法=${methodName}`);
        
        if (fileType === 'java') {
            // 从Java跳转到XML
            console.log(`尝试从Java跳转到XML: ${methodName}`);
            const xmlUri = await MapperNavigator.findXmlForJavaMapper(document, methodName);
            if (xmlUri) {
                console.log(`找到对应的XML文件: ${xmlUri.fsPath}`);
                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                const editor = await vscode.window.showTextDocument(xmlDoc);
                
                // 尝试定位到特定XML节点
                const position = MapperNavigator.findXmlMethodForJavaMethod(xmlDoc, methodName);
                if (position) {
                    console.log(`定位到XML语句: 行 ${position.line + 1}`);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
                }
            } else {
                console.log(`未找到对应的XML声明: ${methodName}`);
                vscode.window.showInformationMessage(`未找到对应的XML声明: ${methodName}`);
            }
        } else if (fileType === 'xml') {
            // 从XML跳转到Java
            console.log(`尝试从XML跳转到Java: ${methodName}`);
            const javaUri = await MapperNavigator.findJavaForXmlMapper(document);
            if (javaUri) {
                console.log(`找到对应的Java文件: ${javaUri.fsPath}`);
                const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                const editor = await vscode.window.showTextDocument(javaDoc);
                
                // 定位到特定方法
                const methodPosition = await MapperNavigator.findMethodInJavaFile(javaDoc, methodName);
                if (methodPosition) {
                    console.log(`找到方法位置: 行 ${methodPosition.line + 1}, 列 ${methodPosition.character}`);
                    editor.selection = new vscode.Selection(methodPosition, methodPosition);
                    editor.revealRange(new vscode.Range(methodPosition, methodPosition), vscode.TextEditorRevealType.InCenter);
                }
            } else {
                console.log(`未找到对应的Java接口: ${methodName}`);
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
        console.log(`更新装饰器: ${document.fileName}`);
        
        // 检查文件是否为Mapper文件
        if (!document.fileName.endsWith('Mapper.java') && !document.fileName.endsWith('Mapper.xml')) {
            editor.setDecorations(this.decorationType, []);
            this.decorationMappings = []; // 清空映射
            return;
        }

        // 验证是否为有效的MyBatis Mapper文件
        let isValidMapper = false;
        if (document.fileName.endsWith('Mapper.java')) {
            // 检查Java文件是否包含@Mapper注解或继承了特定接口
            const text = document.getText();
            isValidMapper = /@Mapper\b/.test(text) || 
                            /interface\s+\w+Mapper\b/.test(text) ||
                            /extends\s+.*Mapper\b/.test(text);
            console.log(`Java文件验证: ${isValidMapper}`);
        } else if (document.fileName.endsWith('Mapper.xml')) {
            // 检查XML文件是否包含mapper标签
            const text = document.getText();
            isValidMapper = /<mapper\b/.test(text) && 
                           (/<select\b/.test(text) || 
                            /<insert\b/.test(text) || 
                            /<update\b/.test(text) || 
                            /<delete\b/.test(text));
            console.log(`XML文件验证: ${isValidMapper}`);
        }

        if (!isValidMapper) {
            editor.setDecorations(this.decorationType, []);
            this.decorationMappings = []; // 清空映射
            return;
        }

        const decorations: vscode.DecorationOptions[] = [];
        this.decorationMappings = []; // 重置映射

        try {
            if (document.fileName.endsWith('Mapper.java')) {
                console.log(`处理Java Mapper文件: ${document.fileName}`);
                // 为Java方法使用Java图标
                this.updateDecorationType('mybatis-java.svg');

                // 处理Java文件
                const methods = await JavaLanguageService.getMethodsInFile(document);
                console.log(`找到Java方法: ${methods.length}个`);
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
                        
                        console.log(`添加Java方法装饰: ${method.name}, 行 ${line.lineNumber + 1}`);
                    }
                }
            } else if (document.fileName.endsWith('Mapper.xml')) {
                console.log(`处理XML Mapper文件: ${document.fileName}`);
                // 为XML语句使用XML图标
                this.updateDecorationType('mybatis-xml.svg');

                // 处理XML文件
                const statements = XmlParser.parseMapperXml(document);
                console.log(`找到XML语句: ${statements.length}个`);
                for (const statement of statements) {
                    const decoration = this.createXmlStatementDecoration(statement, document);
                    if (decoration) {
                        decorations.push(decoration);
                        
                        // 存储XML语句位置与方法的映射
                        const line = document.lineAt(statement.position.line);
                        const range = new vscode.Range(
                            new vscode.Position(line.lineNumber, 0),
                            new vscode.Position(line.lineNumber, line.firstNonWhitespaceCharacterIndex)
                        );
                        this.decorationMappings.push({
                            type: 'xml',
                            methodName: statement.id,
                            range,
                            document
                        });
                        
                        console.log(`添加XML语句装饰: ${statement.id}, 行 ${line.lineNumber + 1}`);
                    }
                }
            }

            // 应用装饰器
            console.log(`应用装饰器: ${decorations.length}个`);
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
        
        // 创建一个包含整个行前空白区域的范围
        const range = new vscode.Range(
            new vscode.Position(line.lineNumber, 0),
            new vscode.Position(line.lineNumber, firstNonWhitespaceCharacterIndex)
        );

        return {
            range,
            hoverMessage: new vscode.MarkdownString()
                .appendText(`${method.returnType} ${method.name}(`)
                .appendText(method.parameters.map(p => `${p.type} ${p.name}`).join(', '))
                .appendText(')')
                .appendText('\n\n点击图标跳转到对应的XML')
        };
    }

    /**
     * 创建XML语句的装饰器
     */
    private createXmlStatementDecoration(statement: XmlMapperStatement, document: vscode.TextDocument): vscode.DecorationOptions {
        // 获取行信息
        const line = document.lineAt(statement.position.line);
        const firstNonWhitespaceCharacterIndex = line.firstNonWhitespaceCharacterIndex;
        
        // 创建一个包含整个行前空白区域的范围
        const range = new vscode.Range(
            new vscode.Position(line.lineNumber, 0),
            new vscode.Position(line.lineNumber, firstNonWhitespaceCharacterIndex)
        );

        return {
            range,
            hoverMessage: new vscode.MarkdownString()
                .appendText(`${statement.type} ${statement.id}`)
                .appendText(statement.parameterType ? `\nParameter Type: ${statement.parameterType}` : '')
                .appendText(statement.resultType ? `\nResult Type: ${statement.resultType}` : '')
                .appendText('\n\n点击图标跳转到对应的Java接口')
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