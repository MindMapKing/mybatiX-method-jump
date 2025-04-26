import * as vscode from 'vscode';
import { JavaLanguageService, JavaMethodInfo } from '../language/java/JavaLanguageService';
import { XmlParser, XmlMapperStatement } from '../language/xml/XmlParser';
import { MapperUtils } from '../utils/MapperUtils';
import { MapperNavigator } from '../navigation/MapperNavigator';

export class MapperCodeLensProvider implements vscode.CodeLensProvider {
    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        this.codeLenses = [];

        try {
            if (document.fileName.endsWith('.java')) {
                if (await JavaLanguageService.isMapperInterface(document)) {
                    const methods = await JavaLanguageService.getMethodsInFile(document);
                    
                    for (const method of methods) {
                        const range = new vscode.Range(
                            method.position,
                            method.position
                        );

                        // 查找对应的XML文件
                        const xmlUri = await MapperNavigator.findXmlForJavaMapper(document, method.name);
                        if (xmlUri) {
                            this.codeLenses.push(new vscode.CodeLens(range, {
                                title: '跳转到XML',
                                command: 'mybatisx.gotoXml',
                                arguments: [xmlUri]
                            }));
                        }
                    }
                }
            } else if (document.fileName.endsWith('.xml')) {
                // 检查是否是有效的MyBatis XML文件
                if (document.getText().includes('<mapper') && document.getText().includes('namespace=')) {
                    const statements = XmlParser.parseMapperXml(document);
                    
                    if (statements && statements.length > 0) {
                        for (const statement of statements) {
                            try {
                                const javaFile = await MapperUtils.findJavaFile(document);
                                if (javaFile) {
                                    const javaDoc = await vscode.workspace.openTextDocument(javaFile);
                                    const methods = await JavaLanguageService.getMethodsInFile(javaDoc);
                                    const method = methods.find((m: JavaMethodInfo) => m.name === statement.id);
                                    if (method) {
                                        const range = new vscode.Range(statement.position, statement.position);
                                        this.codeLenses.push(new vscode.CodeLens(range, {
                                            title: '跳转到Java方法',
                                            command: 'mybatisx.gotoJava',
                                            arguments: [javaFile, method.position]
                                        }));
                                    }
                                }
                            } catch (error) {
                                console.error(`Error processing statement ${statement.id}:`, error);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error providing CodeLenses:', error);
        }

        return this.codeLenses;
    }
} 