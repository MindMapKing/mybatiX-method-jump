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
            outputChannel.appendLine(`Finding method ${methodName} in Java file`);
            
            const text = javaDocument.getText();
            // 尝试找到准确的方法声明
            const methodPattern = new RegExp(
                // 匹配方法声明，支持各种修饰符和返回类型
                `(public|protected|private)?\\s*(static)?\\s*[\\w<>\\[\\],\\s]+\\s+${methodName}\\s*\\([^)]*\\)`,
                'g'
            );
            
            let match: RegExpExecArray | null;
            
            while ((match = methodPattern.exec(text)) !== null) {
                // 找到方法声明位置
                let position = javaDocument.positionAt(match.index);
                
                // 在匹配的行中查找方法名，定位到方法名开始位置
                const line = javaDocument.lineAt(position.line).text;
                const methodNameIndex = line.indexOf(methodName);
                if (methodNameIndex >= 0) {
                    position = new vscode.Position(position.line, methodNameIndex);
                }
                
                outputChannel.appendLine(`Found method at line ${position.line + 1}, column ${position.character}`);
                return position;
            }
            
            // 如果没有找到精确匹配，尝试不区分大小写匹配
            const methodPatternCaseInsensitive = new RegExp(
                `(public|protected|private)?\\s*(static)?\\s*[\\w<>\\[\\],\\s]+\\s+${methodName.toLowerCase()}\\s*\\([^)]*\\)`,
                'i'
            );
            
            while ((match = methodPatternCaseInsensitive.exec(text)) !== null) {
                // 找到方法声明位置
                let position = javaDocument.positionAt(match.index);
                
                // 在匹配的行中查找方法名，尝试定位到方法名开始位置
                const line = javaDocument.lineAt(position.line).text;
                const methodNameRegex = new RegExp(`\\b${methodName}\\b`, 'i');
                const methodMatch = methodNameRegex.exec(line);
                if (methodMatch) {
                    position = new vscode.Position(position.line, methodMatch.index);
                }
                
                outputChannel.appendLine(`Found method with case-insensitive match at line ${position.line + 1}, column ${position.character}`);
                return position;
            }
            
            // 尝试查找部分匹配的方法名
            // 例如，XML中的"selectUser"可能在Java中是"selectUserById"
            const javaLines = text.split('\n');
            for (let i = 0; i < javaLines.length; i++) {
                const line = javaLines[i];
                
                // 检查这行是否包含方法名
                if (line.includes(methodName) || 
                    line.toLowerCase().includes(methodName.toLowerCase())) {
                    
                    // 确保这是一个方法声明而不是变量或注释
                    if (line.match(/\s*\w+\s+\w+\s*\([^)]*\)/) && !line.trim().startsWith("//") && !line.trim().startsWith("*")) {
                        // 尝试定位到方法名的位置
                        const methodNameIndex = line.indexOf(methodName);
                        let column = 0;
                        if (methodNameIndex >= 0) {
                            column = methodNameIndex;
                        } else {
                            // 如果找不到精确匹配，尝试不区分大小写
                            const methodNameRegex = new RegExp(`\\b${methodName}\\b`, 'i');
                            const methodMatch = methodNameRegex.exec(line);
                            if (methodMatch) {
                                column = methodMatch.index;
                            }
                        }
                        
                        outputChannel.appendLine(`Found potential method match at line ${i + 1}, column ${column}`);
                        return new vscode.Position(i, column);
                    }
                }
            }
            
            outputChannel.appendLine(`Method ${methodName} not found in Java file`);
            return undefined;
            
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

    /**
     * Find corresponding Java file for an XML file
     */
    public static async findJavaFileForXmlFile(document: vscode.TextDocument): Promise<vscode.Uri | undefined> {
        const xmlParser = new XmlParser();
        try {
            const namespaceInfo = await xmlParser.getNamespaceFromDocument(document);
            if (!namespaceInfo) {
                outputChannel.appendLine('No namespace found in XML file');
                return undefined;
            }

            outputChannel.appendLine(`XML namespace: ${namespaceInfo.namespace}`);
            
            // 搜索对应的Java接口文件
            const javaFiles = await vscode.workspace.findFiles('**/*.java', '**/node_modules/**');
            
            // 首先尝试完全匹配命名空间
            for (const javaFile of javaFiles) {
                try {
                    const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                    const isMapper = await JavaLanguageService.isMapperInterface(javaDocument);
                    
                    if (isMapper) {
                        const className = await JavaLanguageService.getFullClassName(javaDocument);
                        
                        if (className && className === namespaceInfo.namespace) {
                            outputChannel.appendLine(`Found exact match Java file: ${javaFile.fsPath}`);
                            return javaFile;
                        }
                    }
                } catch (error) {
                    console.error(`Error checking Java file ${javaFile.fsPath}:`, error);
                }
            }
            
            // 如果没有找到完全匹配，尝试通过简单类名匹配
            const simpleNameMatch = namespaceInfo.namespace.split('.').pop();
            if (simpleNameMatch) {
                for (const javaFile of javaFiles) {
                    try {
                        const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                        const isMapper = await JavaLanguageService.isMapperInterface(javaDocument);
                        
                        if (isMapper) {
                            const className = await JavaLanguageService.getFullClassName(javaDocument);
                            
                            if (className && className.endsWith('.' + simpleNameMatch)) {
                                outputChannel.appendLine(`Found Java file by simple name: ${javaFile.fsPath}`);
                                return javaFile;
                            }
                        }
                    } catch (error) {
                        console.error(`Error checking Java file ${javaFile.fsPath}:`, error);
                    }
                }
            }
            
            // 尝试通过文件名匹配（XML文件名通常与接口名相似）
            const xmlFileName = path.basename(document.fileName, '.xml');
            for (const javaFile of javaFiles) {
                const javaFileName = path.basename(javaFile.fsPath, '.java');
                
                // 检查文件名是否相似（忽略大小写和Mapper后缀）
                if (xmlFileName.toLowerCase() === javaFileName.toLowerCase() ||
                    xmlFileName.toLowerCase() === javaFileName.toLowerCase().replace('mapper', '')) {
                    
                    try {
                        const javaDocument = await vscode.workspace.openTextDocument(javaFile);
                        const isMapper = await JavaLanguageService.isMapperInterface(javaDocument);
                        
                        if (isMapper) {
                            outputChannel.appendLine(`Found Java file by filename: ${javaFile.fsPath}`);
                            return javaFile;
                        }
                    } catch (error) {
                        console.error(`Error checking Java file ${javaFile.fsPath}:`, error);
                    }
                }
            }

            outputChannel.appendLine(`No matching Java file found for namespace: ${namespaceInfo.namespace}`);
            return undefined;
        } catch (error) {
            console.error('Error finding Java file for XML:', error);
            return undefined;
        }
    }

    /**
     * Find method in XML file by current position and navigate to corresponding Java method
     */
    public static async findJavaMethodForXmlPosition(
        xmlDocument: vscode.TextDocument,
        position: vscode.Position
    ): Promise<{javaFile: vscode.Uri, methodName: string, methodPosition: vscode.Position} | undefined> {
        outputChannel.appendLine('Finding Java method for XML position');
        
        try {
            // 先找到对应的Java文件
            const javaFile = await this.findJavaFileForXmlFile(xmlDocument);
            if (!javaFile) {
                outputChannel.appendLine('Could not find corresponding Java file');
                return undefined;
            }
            
            // 使用XML解析器找到光标所在的XML语句
            const statements = XmlParser.parseMapperXml(xmlDocument);
            
            // 查找光标在哪个语句内
            let targetStatement: XmlMapperStatement | undefined;
            
            for (const statement of statements) {
                // 获取语句的整个区域
                const text = xmlDocument.getText();
                const statementMatch = new RegExp(`<${statement.type}[^>]+id="${statement.id}"[^>]*>[\\s\\S]*?</${statement.type}>`, 'g');
                let match;
                
                while ((match = statementMatch.exec(text)) !== null) {
                    const startPos = xmlDocument.positionAt(match.index);
                    const endPos = xmlDocument.positionAt(match.index + match[0].length);
                    
                    const statementRange = new vscode.Range(startPos, endPos);
                    
                    // 检查当前位置是否在这个语句内
                    if (statementRange.contains(position)) {
                        targetStatement = statement;
                        break;
                    }
                }
                
                if (targetStatement) {
                    break;
                }
            }
            
            if (!targetStatement) {
                // 如果找不到语句，尝试通过行号查找最接近的语句
                outputChannel.appendLine('Could not find statement by range, trying by position');
                
                let closestStatement: XmlMapperStatement | undefined;
                let minDistance = Number.MAX_SAFE_INTEGER;
                
                for (const statement of statements) {
                    const distance = Math.abs(statement.position.line - position.line);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestStatement = statement;
                    }
                }
                
                // 只在距离相对较近的情况下使用最近的语句
                if (minDistance < 10) {
                    targetStatement = closestStatement;
                }
            }
            
            if (!targetStatement) {
                outputChannel.appendLine('Could not identify SQL statement at current position');
                return undefined;
            }
            
            outputChannel.appendLine(`Found XML statement: ${targetStatement.id}`);
            
            // 打开Java文件并找到对应的方法
            const javaDocument = await vscode.workspace.openTextDocument(javaFile);
            const methodPosition = await this.findMethodInJavaFile(javaDocument, targetStatement.id);
            
            if (!methodPosition) {
                outputChannel.appendLine(`Could not find method ${targetStatement.id} in Java file`);
                return undefined;
            }
            
            // 注意：findMethodInJavaFile方法已经被修改为定位到方法名而不是注释行
            outputChannel.appendLine(`Found Java method at line ${methodPosition.line + 1}, column ${methodPosition.character}`);
            
            return {
                javaFile,
                methodName: targetStatement.id,
                methodPosition
            };
            
        } catch (error) {
            console.error('Error while finding Java method:', error);
            return undefined;
        }
    }
    
    /**
     * Find XML statement in XML file by method name
     */
    public static findXmlMethodForJavaMethod(
        xmlDocument: vscode.TextDocument,
        methodName: string
    ): vscode.Position | undefined {
        outputChannel.appendLine(`Finding XML statement for method: ${methodName}`);
        
        try {
            const statements = XmlParser.parseMapperXml(xmlDocument);
            const statement = statements.find(stmt => stmt.id === methodName);
            
            if (statement) {
                outputChannel.appendLine(`Found XML statement at line ${statement.position.line + 1}`);
                return statement.position;
            } else {
                // 尝试不区分大小写的匹配
                const statementCaseInsensitive = statements.find(
                    stmt => stmt.id.toLowerCase() === methodName.toLowerCase()
                );
                
                if (statementCaseInsensitive) {
                    outputChannel.appendLine(`Found XML statement with case-insensitive match at line ${statementCaseInsensitive.position.line + 1}`);
                    return statementCaseInsensitive.position;
                }
                
                // 尝试部分匹配（方法名可能包含参数信息）
                const partialMatchStatement = statements.find(
                    stmt => methodName.includes(stmt.id) || stmt.id.includes(methodName)
                );
                
                if (partialMatchStatement) {
                    outputChannel.appendLine(`Found XML statement with partial match at line ${partialMatchStatement.position.line + 1}`);
                    return partialMatchStatement.position;
                }
                
                outputChannel.appendLine(`No XML statement found for method ${methodName}`);
                return undefined;
            }
        } catch (error) {
            console.error('Error finding XML statement:', error);
            return undefined;
        }
    }
} 