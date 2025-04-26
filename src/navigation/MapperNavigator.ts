import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JavaLanguageService, JavaMethodInfo } from '../language/java/JavaLanguageService';
import { XmlParser, XmlMapperStatement } from '../language/xml/XmlParser';
import { MapperUtils } from '../utils/MapperUtils';

// Get output channel
const outputChannel = vscode.window.createOutputChannel('MybatisXX-Navigator');

export class MapperNavigator {
    /**
     * Find corresponding XML file for a Java mapper interface
     */
    public static async findXmlForJavaMapper(document: vscode.TextDocument, methodName?: string): Promise<vscode.Uri | undefined> {
        const javaPath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        outputChannel.appendLine(`Finding XML for Java file: ${javaPath}`);
        
        if (!workspaceFolder) {
            outputChannel.appendLine('No workspace folder found');
            return undefined;
        }

        // Check if it's a mapper interface
        if (!await JavaLanguageService.isMapperInterface(document)) {
            outputChannel.appendLine('Not a Mapper interface, skipping XML search');
            return undefined;
        }

        // Extract class name from file path
        const fileName = path.basename(javaPath, '.java');
        outputChannel.appendLine(`Extracted class name: ${fileName}`);

        // Try different possible locations for the XML file
        const possibleXmlPaths = [
            // Standard Maven/Gradle structure
            path.join(workspaceFolder.uri.fsPath, 'src', 'main', 'resources', 'mapper', `${fileName}.xml`),
            path.join(workspaceFolder.uri.fsPath, 'src', 'main', 'resources', 'mappers', `${fileName}.xml`),
            path.join(workspaceFolder.uri.fsPath, 'src', 'main', 'resources', 'mybatis', 'mapper', `${fileName}.xml`),
            path.join(workspaceFolder.uri.fsPath, 'src', 'main', 'resources', 'mybatis', 'mappers', `${fileName}.xml`),
            
            // Direct mapping (same path structure)
            javaPath.replace(/src\/main\/java/, 'src/main/resources').replace(/\.java$/, '.xml'),
            
            // Simple projects
            path.join(workspaceFolder.uri.fsPath, 'resources', 'mapper', `${fileName}.xml`),
            path.join(workspaceFolder.uri.fsPath, 'resources', 'mappers', `${fileName}.xml`),
            path.join(workspaceFolder.uri.fsPath, 'resources', `${fileName}.xml`)
        ];

        outputChannel.appendLine('Searching for XML file in the following locations:');
        let xmlUri: vscode.Uri | undefined = undefined;
        for (const xmlPath of possibleXmlPaths) {
            outputChannel.appendLine(`- ${xmlPath}`);
            
            const xmlUriCandidate = vscode.Uri.file(xmlPath);
            try {
                await vscode.workspace.fs.stat(xmlUriCandidate);
                outputChannel.appendLine(`Found XML file at: ${xmlPath}`);
                xmlUri = xmlUriCandidate;
                break;
            } catch (e) {
                // File not found, continue searching
            }
        }
        
        // If no XML file found in the predefined locations, try to find it with glob pattern
        outputChannel.appendLine('Searching workspace for XML files matching the Mapper name...');
        const xmlFiles = await vscode.workspace.findFiles(
            `**/${fileName}.xml`,
            '**/node_modules/**'
        );
        
        if (xmlFiles.length > 0) {
            outputChannel.appendLine(`Found ${xmlFiles.length} potential XML files via workspace search`);
            for (const xmlUriCandidate of xmlFiles) {
                try {
                    const xmlDoc = await vscode.workspace.openTextDocument(xmlUriCandidate);
                    const xmlContent = xmlDoc.getText();
                    
                    // Check if it's a valid MyBatis mapper XML
                    if (xmlContent.includes('<mapper') && xmlContent.includes('namespace=')) {
                        outputChannel.appendLine(`Selected XML file: ${xmlUriCandidate.fsPath}`);
                        xmlUri = xmlUriCandidate;
                        break;
                    }
                } catch (e) {
                    // Skip if file cannot be opened
                }
            }
        }

        // 如果提供了方法名，则尝试定位到特定方法
        if (methodName && xmlUri) {
            try {
                const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                const statements = XmlParser.parseMapperXml(xmlDoc);
                const targetStatement = statements.find(s => s.id === methodName);
                
                if (targetStatement) {
                    // 返回URI，并附加位置信息
                    return xmlUri;
                }
            } catch (error) {
                console.error('Error finding XML statement:', error);
            }
        }
        
        outputChannel.appendLine('No corresponding XML file found');
        return xmlUri;
    }

    /**
     * Find corresponding Java interface for a MyBatis XML file
     */
    public static async findJavaForXmlMapper(document: vscode.TextDocument): Promise<vscode.Uri | undefined> {
        const xmlPath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        outputChannel.appendLine(`Finding Java interface for XML file: ${xmlPath}`);
        
        if (!workspaceFolder) {
            outputChannel.appendLine('No workspace folder found');
            return undefined;
        }

        // Extract the namespace from the XML file to find the full-qualified name of the Java interface
        const text = document.getText();
        const namespaceMatch = text.match(/<mapper[^>]+namespace="([^"]+)"/);
        
        if (namespaceMatch) {
            const namespace = namespaceMatch[1];
            outputChannel.appendLine(`Found namespace: ${namespace}`);
            
            // Extract the interface name and package
            const lastDot = namespace.lastIndexOf('.');
            const packageName = lastDot > 0 ? namespace.substring(0, lastDot) : '';
            const interfaceName = lastDot > 0 ? namespace.substring(lastDot + 1) : namespace;
            
            outputChannel.appendLine(`Package name: ${packageName}, Interface name: ${interfaceName}`);
            
            // Try to find the Java file based on the namespace
            if (packageName) {
                const packagePath = packageName.replace(/\./g, path.sep);
                const possibleJavaPaths = [
                    // Standard Maven/Gradle structure
                    path.join(workspaceFolder.uri.fsPath, 'src', 'main', 'java', packagePath, `${interfaceName}.java`),
                    
                    // Direct mapping (same path structure)
                    xmlPath.replace(/src\/main\/resources/, 'src/main/java').replace(/\.xml$/, '.java'),
                    
                    // Simple projects
                    path.join(workspaceFolder.uri.fsPath, 'src', packagePath, `${interfaceName}.java`)
                ];
                
                outputChannel.appendLine('Searching for Java file in the following locations:');
                for (const javaPath of possibleJavaPaths) {
                    outputChannel.appendLine(`- ${javaPath}`);
                    
                    const javaUri = vscode.Uri.file(javaPath);
                    try {
                        await vscode.workspace.fs.stat(javaUri);
                        const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                        if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                            outputChannel.appendLine(`Found Java file at: ${javaPath}`);
                            return javaUri;
                        }
                    } catch (e) {
                        // File not found, continue searching
                    }
                }
            }
            
            // If no Java file found in the predefined locations, try to find it with glob pattern
            outputChannel.appendLine('Searching workspace for Java files matching the interface name...');
            const javaFiles = await vscode.workspace.findFiles(
                `**/${interfaceName}.java`, 
                '**/node_modules/**'
            );
            
            if (javaFiles.length > 0) {
                outputChannel.appendLine(`Found ${javaFiles.length} potential Java files via workspace search`);
                for (const javaUri of javaFiles) {
                    try {
                        const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                        if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                            outputChannel.appendLine(`Selected Java file: ${javaUri.fsPath}`);
                            return javaUri;
                        }
                    } catch (e) {
                        // Skip if file cannot be opened
                    }
                }
            }
        } else {
            outputChannel.appendLine('No namespace found in the XML file');
            
            // Try to find the Java file based on file name convention
            const fileName = path.basename(xmlPath, '.xml');
            const possibleJavaPaths = [
                // Standard Maven/Gradle structure
                xmlPath.replace(/src\/main\/resources/, 'src/main/java').replace(/\.xml$/, '.java')
            ];
            
            outputChannel.appendLine('Searching for Java file based on filename in the following locations:');
            for (const javaPath of possibleJavaPaths) {
                outputChannel.appendLine(`- ${javaPath}`);
                
                const javaUri = vscode.Uri.file(javaPath);
                try {
                    await vscode.workspace.fs.stat(javaUri);
                    const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                    if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                        outputChannel.appendLine(`Found Java file at: ${javaPath}`);
                        return javaUri;
                    }
                } catch (e) {
                    // File not found, continue searching
                }
            }
            
            // If no Java file found in the predefined locations, try to find it with glob pattern
            outputChannel.appendLine('Searching workspace for Java files matching the XML filename...');
            const javaFiles = await vscode.workspace.findFiles(
                `**/${fileName}.java`, 
                '**/node_modules/**'
            );
            
            if (javaFiles.length > 0) {
                outputChannel.appendLine(`Found ${javaFiles.length} potential Java files via workspace search`);
                for (const javaUri of javaFiles) {
                    try {
                        const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                        if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                            return javaUri;
                        }
                    } catch (e) {
                        // Skip if file cannot be opened
                    }
                }
            }
        }

        outputChannel.appendLine('No corresponding Java interface found');
        return undefined;
    }

    /**
     * Find XML statement corresponding to Java method
     */
    public static async findXmlStatementForMethod(
        javaDocument: vscode.TextDocument,
        methodName: string,
        xmlDocument: vscode.TextDocument
    ): Promise<XmlMapperStatement | undefined> {
        outputChannel.appendLine(`Finding XML statement for method: ${methodName}`);
        const statements = XmlParser.parseMapperXml(xmlDocument);
        const statement = statements.find(stmt => stmt.id === methodName);
        if (statement) {
            outputChannel.appendLine(`Found XML statement at line ${statement.position.line + 1}`);
        } else {
            outputChannel.appendLine(`No XML statement found for method ${methodName}`);
        }
        return statement;
    }

    /**
     * Find Java method corresponding to XML statement
     */
    public static async findJavaMethodForStatement(
        statement: XmlMapperStatement,
        javaDocument: vscode.TextDocument
    ): Promise<JavaMethodInfo | undefined> {
        outputChannel.appendLine(`Finding Java method for statement: ${statement.id}`);
        try {
            const methods = await JavaLanguageService.getMethodsInFile(javaDocument);
            const method = methods.find(m => m.name === statement.id);
            if (method) {
                outputChannel.appendLine(`Found Java method at line ${method.position.line + 1}`);
            } else {
                outputChannel.appendLine(`No Java method found for statement ${statement.id}`);
            }
            return method;
        } catch (error) {
            console.error('Error finding Java method for statement:', error);
            return undefined;
        }
    }

    /**
     * Find method in Java file by name
     */
    public static async findMethodInJavaFile(
        javaDocument: vscode.TextDocument,
        methodName: string
    ): Promise<vscode.Position | undefined> {
        try {
            const methods = await JavaLanguageService.getMethodsInFile(javaDocument);
            const method = methods.find(m => m.name === methodName);
            return method?.position;
        } catch (error) {
            console.error('Error finding method in Java file:', error);
            return undefined;
        }
    }

    /**
     * 注册导航命令
     */
    public static registerCommands(context: vscode.ExtensionContext) {
        // 注册跳转到对应文件的命令
        context.subscriptions.push(
            vscode.commands.registerCommand('mybatisX.gotoMapperFile', async () => {
                const activeEditor = vscode.window.activeTextEditor;
                if (!activeEditor) {
                    return;
                }

                const currentFile = activeEditor.document.uri;
                const currentPath = currentFile.fsPath;

                try {
                    let targetFile: vscode.Uri | undefined;

                    if (await JavaLanguageService.isMapperInterface(activeEditor.document)) {
                        // 如果当前是Java文件，查找对应的XML
                        targetFile = await MapperUtils.findXmlFileForJava(currentFile);
                    } else if (MapperUtils.isMapperXml(currentPath)) {
                        // 如果当前是XML文件，查找对应的Java接口
                        targetFile = await MapperUtils.findJavaFileForXml(currentFile);
                    }

                    if (targetFile) {
                        // 打开目标文件
                        const document = await vscode.workspace.openTextDocument(targetFile);
                        await vscode.window.showTextDocument(document);
                    } else {
                        vscode.window.showInformationMessage('找不到对应的Mapper文件');
                    }
                } catch (error) {
                    console.error('Error navigating to mapper file:', error);
                    vscode.window.showErrorMessage('导航到Mapper文件时发生错误');
                }
            })
        );
    }
} 