import * as vscode from 'vscode';

export interface JavaMapperMethod {
    name: string;
    returnType: string;
    parameters: string[];
    position: vscode.Position;
}

export class JavaParser {
    /**
     * Parse Java mapper interface to get method information
     */
    public static parseMapperInterface(document: vscode.TextDocument): JavaMapperMethod[] {
        const methods: JavaMapperMethod[] = [];
        const text = document.getText();
        
        // Get output channel
        const outputChannel = vscode.window.createOutputChannel('MybatisXX-Parser');
        
        // Debug info
        outputChannel.appendLine(`Parsing Java file: ${document.fileName}`);
        outputChannel.appendLine(`File contains @Mapper: ${text.includes('@Mapper')}`);
        outputChannel.appendLine(`File ends with Mapper.java: ${document.fileName.endsWith('Mapper.java')}`);
        
        // Check if this is a mapper interface
        if (!text.includes('@Mapper') && !document.fileName.endsWith('Mapper.java')) {
            outputChannel.appendLine('Not a Mapper interface, returning empty methods array');
            return methods;
        }

        // More comprehensive regex for method parsing
        // Modified to handle annotations and different visibility modifiers
        const methodRegex = /(?:@[^\n]+\n)*\s*(?:public\s+|protected\s+|private\s+)?(\w+(?:<[^>]+>)?)\s+(\w+)\s*\(([^)]*)\)/g;
        let match;
        
        while ((match = methodRegex.exec(text)) !== null) {
            const returnType = match[1];
            const name = match[2];
            const params = match[3].split(',')
                .map(p => p.trim())
                .filter(p => p);
                
            // 获取方法所在行的位置（方法名位置，而不是上一行）
            const startPos = document.positionAt(match.index);
            // 找到实际的方法定义行
            let methodLineNumber = startPos.line;
            const textBeforeMatch = text.substring(0, match.index);
            const lines = textBeforeMatch.split('\n');
            
            // 方法名的位置一定是在方法定义所在的那一行
            const methodDefLine = lines[lines.length - 1] + text.substring(match.index, match.index + match[0].length).split('\n')[0];
            if (methodDefLine.includes(name)) {
                // 找到方法名所在的行
                const position = new vscode.Position(methodLineNumber, 0);
                
                // Debug info
                outputChannel.appendLine(`Found method: ${name}, returnType: ${returnType}, params: ${params.join(', ')}, at line ${methodLineNumber + 1}`);
                
                // Skip if this is not a mapper method
                if (name === 'equals' || name === 'hashCode' || name === 'toString') {
                    outputChannel.appendLine(`Skipping common method: ${name}`);
                    continue;
                }
                
                methods.push({
                    name,
                    returnType,
                    parameters: params,
                    position
                });
            }
        }
        
        outputChannel.appendLine(`Total methods found: ${methods.length}`);
        
        return methods;
    }
} 