import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JavaParser, JavaMapperMethod } from '../language/java/JavaParser';
import { XmlParser, XmlMapperStatement } from '../language/xml/XmlParser';

// Get output channel
const outputChannel = vscode.window.createOutputChannel('MybatisXX-Navigator');

export class MapperNavigator {
    /**
     * Find corresponding XML file for a Java mapper interface
     */
    public static async findXmlForJavaMapper(document: vscode.TextDocument): Promise<vscode.Uri | undefined> {
        const javaPath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        outputChannel.appendLine(`Finding XML for Java file: ${javaPath}`);
        
        if (!workspaceFolder) {
            outputChannel.appendLine('No workspace folder found');
            return undefined;
        }

        // Check if it's a mapper interface
        const text = document.getText();
        if (!text.includes('@Mapper') && !document.fileName.endsWith('Mapper.java')) {
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
        for (const xmlPath of possibleXmlPaths) {
            outputChannel.appendLine(`- ${xmlPath}`);
            
            const xmlUri = vscode.Uri.file(xmlPath);
            try {
                await vscode.workspace.fs.stat(xmlUri);
                outputChannel.appendLine(`Found XML file at: ${xmlPath}`);
                return xmlUri;
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
            for (const xmlUri of xmlFiles) {
                try {
                    const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                    const xmlContent = xmlDoc.getText();
                    
                    // Check if it's a valid MyBatis mapper XML
                    if (xmlContent.includes('<mapper') && xmlContent.includes('namespace=')) {
                        outputChannel.appendLine(`Selected XML file: ${xmlUri.fsPath}`);
                        return xmlUri;
                    }
                } catch (e) {
                    // Skip if file cannot be opened
                }
            }
        }

        outputChannel.appendLine('No corresponding XML file found');
        return undefined;
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
                        outputChannel.appendLine(`Found Java file at: ${javaPath}`);
                        return javaUri;
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
                        const javaContent = javaDoc.getText();
                        
                        // Check if it's the correct interface 
                        if (javaContent.includes(`interface ${interfaceName}`) || javaContent.includes(`class ${interfaceName}`)) {
                            // Verify package if available
                            if (!packageName || javaContent.includes(`package ${packageName}`)) {
                                outputChannel.appendLine(`Selected Java file: ${javaUri.fsPath}`);
                                return javaUri;
                            }
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
                    outputChannel.appendLine(`Found Java file at: ${javaPath}`);
                    return javaUri;
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
                return javaFiles[0]; // Just return the first one as a best guess
            }
        }

        outputChannel.appendLine('No corresponding Java interface found');
        return undefined;
    }

    /**
     * Find XML statement corresponding to Java method
     */
    public static findXmlStatementForMethod(
        method: JavaMapperMethod,
        xmlDocument: vscode.TextDocument
    ): XmlMapperStatement | undefined {
        outputChannel.appendLine(`Finding XML statement for method: ${method.name}`);
        const statements = XmlParser.parseMapperXml(xmlDocument);
        const statement = statements.find(stmt => stmt.id === method.name);
        if (statement) {
            outputChannel.appendLine(`Found XML statement at line ${statement.position.line + 1}`);
        } else {
            outputChannel.appendLine(`No XML statement found for method ${method.name}`);
        }
        return statement;
    }

    /**
     * Find Java method corresponding to XML statement
     */
    public static findJavaMethodForStatement(
        statement: XmlMapperStatement,
        javaDocument: vscode.TextDocument
    ): JavaMapperMethod | undefined {
        outputChannel.appendLine(`Finding Java method for statement: ${statement.id}`);
        const methods = JavaParser.parseMapperInterface(javaDocument);
        const method = methods.find(method => method.name === statement.id);
        if (method) {
            outputChannel.appendLine(`Found Java method at line ${method.position.line + 1}`);
        } else {
            outputChannel.appendLine(`No Java method found for statement ${statement.id}`);
        }
        return method;
    }
} 