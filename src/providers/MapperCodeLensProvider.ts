import * as vscode from 'vscode';
import { JavaParser } from '../language/java/JavaParser';
import { XmlParser } from '../language/xml/XmlParser';
import { MapperNavigator } from '../navigation/MapperNavigator';
import { Icons } from '../utils/Icons';

export class MapperCodeLensProvider implements vscode.CodeLensProvider {
    onDidChangeCodeLenses?: vscode.Event<void>;

    async provideCodeLenses(
        document: vscode.TextDocument,
        _token: vscode.CancellationToken
    ): Promise<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];

        if (document.fileName.endsWith('.java')) {
            // For Java mapper interface
            const methods = JavaParser.parseMapperInterface(document);
            const xmlUri = await MapperNavigator.findXmlForJavaMapper(document);

            if (xmlUri) {
                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                const statements = XmlParser.parseMapperXml(xmlDoc);

                for (const method of methods) {
                    const statement = statements.find(s => s.id === method.name);
                    if (statement) {
                        const range = document.lineAt(method.position.line).range;
                        codeLenses.push(new vscode.CodeLens(range, {
                            title: '$(zap) Go to XML',
                            command: 'mybatisx.gotoXml',
                            arguments: [xmlUri, statement.position],
                            tooltip: 'Navigate to the corresponding XML statement'
                        }));
                    }
                }
            }
        } else if (document.fileName.endsWith('.xml')) {
            // For MyBatis XML file
            const statements = XmlParser.parseMapperXml(document);
            const javaUri = await MapperNavigator.findJavaForXmlMapper(document);

            if (javaUri) {
                const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                const methods = JavaParser.parseMapperInterface(javaDoc);

                for (const statement of statements) {
                    const method = methods.find(m => m.name === statement.id);
                    if (method) {
                        const range = document.lineAt(statement.position.line).range;
                        codeLenses.push(new vscode.CodeLens(range, {
                            title: '$(symbol-method) Go to Java',
                            command: 'mybatisx.gotoJava',
                            arguments: [javaUri, method.position],
                            tooltip: 'Navigate to the corresponding Java method'
                        }));
                    }
                }
            }
        }

        return codeLenses;
    }
} 