import * as vscode from 'vscode';

export interface XmlMapperStatement {
    id: string;
    type: 'select' | 'insert' | 'update' | 'delete';
    parameterType?: string;
    resultType?: string;
    sql: string;
    position: vscode.Position;
}

export class XmlParser {
    /**
     * Parse MyBatis mapper XML file to get statement information
     */
    public static parseMapperXml(document: vscode.TextDocument): XmlMapperStatement[] {
        const statements: XmlMapperStatement[] = [];
        const text = document.getText();
        
        // Get output channel
        const outputChannel = vscode.window.createOutputChannel('MybatisXX-XML-Parser');
        
        // Debug info
        outputChannel.appendLine(`Parsing XML file: ${document.fileName}`);
        
        // Check if this is a mapper XML file
        if (!document.fileName.endsWith('Mapper.xml') && !text.includes('<mapper')) {
            outputChannel.appendLine('Not a Mapper XML file, returning empty statements array');
            return statements;
        }
        
        // Extract namespace
        const namespaceMatch = text.match(/<mapper[^>]+namespace="([^"]+)"/);
        if (namespaceMatch) {
            outputChannel.appendLine(`Found namespace: ${namespaceMatch[1]}`);
        } else {
            outputChannel.appendLine('No namespace found in the mapper XML');
        }
        
        // Parse select, insert, update, delete statements
        const statementTypes = ['select', 'insert', 'update', 'delete'];
        
        for (const type of statementTypes) {
            outputChannel.appendLine(`Searching for ${type} statements...`);
            const regex = new RegExp(`<${type}[^>]+id="([^"]+)"[^>]*>([\\s\\S]*?)</${type}>`, 'g');
            let match;
            
            while ((match = regex.exec(text)) !== null) {
                const id = match[1];
                const sql = match[2].trim();
                
                // Calculate position based on line number
                const startPos = document.positionAt(match.index);
                const line = document.lineAt(startPos.line);
                const position = new vscode.Position(startPos.line, line.firstNonWhitespaceCharacterIndex);
                
                // Extract parameterType and resultType if present
                const parameterType = this.extractAttribute(match[0], 'parameterType');
                const resultType = type === 'select' ? this.extractAttribute(match[0], 'resultType') : undefined;
                
                outputChannel.appendLine(`Found ${type} statement: id=${id}, position=line ${position.line + 1}`);
                
                statements.push({
                    id,
                    type: type as 'select' | 'insert' | 'update' | 'delete',
                    parameterType,
                    resultType,
                    sql,
                    position
                });
            }
        }
        
        outputChannel.appendLine(`Total statements found: ${statements.length}`);
        
        return statements;
    }
    
    private static extractAttribute(statement: string, attributeName: string): string | undefined {
        const match = statement.match(new RegExp(`${attributeName}="([^"]+)"`));
        return match ? match[1] : undefined;
    }
} 