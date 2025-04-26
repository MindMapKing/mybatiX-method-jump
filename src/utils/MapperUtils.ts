import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { JavaLanguageService } from '../language/java/JavaLanguageService';

export class MapperUtils {
    /**
     * Find corresponding Java file for a MyBatis XML file
     */
    public static async findJavaFile(document: vscode.TextDocument): Promise<vscode.Uri | undefined> {
        const xmlPath = document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
        
        if (!workspaceFolder) {
            return undefined;
        }

        // Extract the namespace from the XML file
        const text = document.getText();
        const namespaceMatch = text.match(/<mapper[^>]+namespace="([^"]+)"/);
        
        if (namespaceMatch) {
            const namespace = namespaceMatch[1];
            const lastDot = namespace.lastIndexOf('.');
            const packageName = lastDot > 0 ? namespace.substring(0, lastDot) : '';
            const interfaceName = lastDot > 0 ? namespace.substring(lastDot + 1) : namespace;
            
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
                
                for (const javaPath of possibleJavaPaths) {
                    const javaUri = vscode.Uri.file(javaPath);
                    try {
                        await vscode.workspace.fs.stat(javaUri);
                        const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                        if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                            return javaUri;
                        }
                    } catch (e) {
                        // File not found, continue searching
                    }
                }
            }
            
            // If no Java file found in the predefined locations, try to find it with glob pattern
            const javaFiles = await vscode.workspace.findFiles(
                `**/${interfaceName}.java`, 
                '**/node_modules/**'
            );
            
            if (javaFiles.length > 0) {
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
        } else {
            // Try to find the Java file based on file name convention
            const fileName = path.basename(xmlPath, '.xml');
            const possibleJavaPaths = [
                // Standard Maven/Gradle structure
                xmlPath.replace(/src\/main\/resources/, 'src/main/java').replace(/\.xml$/, '.java')
            ];
            
            for (const javaPath of possibleJavaPaths) {
                const javaUri = vscode.Uri.file(javaPath);
                try {
                    await vscode.workspace.fs.stat(javaUri);
                    const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                    if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                        return javaUri;
                    }
                } catch (e) {
                    // File not found, continue searching
                }
            }
            
            // If no Java file found in the predefined locations, try to find it with glob pattern
            const javaFiles = await vscode.workspace.findFiles(
                `**/${fileName}.java`, 
                '**/node_modules/**'
            );
            
            if (javaFiles.length > 0) {
                return javaFiles[0]; // Just return the first one as a best guess
            }
        }

        return undefined;
    }

    /**
     * 根据Java文件查找对应的XML文件
     * @param javaFile Java文件的URI
     * @returns 对应XML文件的URI，如果未找到则返回undefined
     */
    public static async findXmlFileForJava(javaFile: vscode.Uri): Promise<vscode.Uri | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(javaFile);
        if (!workspaceFolder) {
            return undefined;
        }

        const javaPath = javaFile.fsPath;
        const fileName = path.basename(javaPath, '.java');
        
        // 在resources目录下搜索对应的XML文件
        const xmlFiles = await vscode.workspace.findFiles(
            `**/${fileName}.xml`,
            '**/node_modules/**'
        );

        if (xmlFiles.length > 0) {
            for (const xmlUri of xmlFiles) {
                try {
                    const xmlDoc = await vscode.workspace.openTextDocument(xmlUri);
                    if (this.isMapperXml(xmlUri.fsPath)) {
                        return xmlUri;
                    }
                } catch (e) {
                    // Skip if file cannot be opened
                }
            }
        }

        return undefined;
    }

    /**
     * 根据XML文件查找对应的Java接口文件
     * @param xmlFile XML文件的URI
     * @returns 对应Java文件的URI，如果未找到则返回undefined
     */
    public static async findJavaFileForXml(xmlFile: vscode.Uri): Promise<vscode.Uri | undefined> {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(xmlFile);
        if (!workspaceFolder) {
            return undefined;
        }

        const xmlPath = xmlFile.fsPath;
        const fileName = path.basename(xmlPath, '.xml');
        
        // 在src目录下搜索对应的Java文件
        const javaFiles = await vscode.workspace.findFiles(
            `**/${fileName}.java`,
            '**/node_modules/**'
        );

        if (javaFiles.length > 0) {
            for (const javaUri of javaFiles) {
                try {
                    const javaDoc = await vscode.workspace.openTextDocument(javaUri);
                    if (await JavaLanguageService.isMapperInterface(javaDoc)) {
                        return javaUri;
                    }
                } catch (e) {
                    // Skip if file cannot be opened
                    console.error('Error opening Java file:', e);
                }
            }
        }

        return undefined;
    }

    /**
     * 检查文件是否为Mapper接口文件
     * @param filePath 文件路径
     * @returns 是否为Mapper接口文件
     */
    public static async isMapperInterface(filePath: string): Promise<boolean> {
        if (!filePath.endsWith('.java')) {
            return false;
        }

        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            return await JavaLanguageService.isMapperInterface(document);
        } catch (error) {
            console.error('Error checking if file is Mapper interface:', error);
            return false;
        }
    }

    /**
     * 检查文件是否为Mapper XML文件
     * @param filePath 文件路径
     * @returns 是否为Mapper XML文件
     */
    public static isMapperXml(filePath: string): boolean {
        if (!filePath.endsWith('.xml')) {
            return false;
        }

        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            // 检查是否包含mapper元素和namespace属性
            return content.includes('<mapper') && content.includes('namespace=');
        } catch (error) {
            console.error('Error reading file:', error);
            return false;
        }
    }
} 