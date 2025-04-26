import * as vscode from 'vscode';

export interface XmlMapperStatement {
    // 命名空间（完整的Mapper接口名）
    namespace: string;
    // 方法ID
    id: string;
    // 语句类型
    type: 'select' | 'insert' | 'update' | 'delete';
    // 参数类型（可选）
    parameterType?: string;
    // 返回类型（可选，仅用于select语句）
    resultType?: string;
    // SQL语句
    sql: string;
    // 在文件中的位置
    position: vscode.Position;
    // 参数个数（通过计算 #{} 和 ${} 的数量得出）
    parameterCount: number;
}

export class XmlParser {
    /**
     * 从SQL语句中提取参数个数
     * 计算 #{} 和 ${} 的出现次数
     */
    private static countParameters(sql: string): number {
        const paramPattern = /[#$]{([^}]+)}/g;
        const matches = sql.match(paramPattern);
        return matches ? matches.length : 0;
    }

    /**
     * 解析Mapper XML文件
     */
    public static parseMapperXml(document: vscode.TextDocument): XmlMapperStatement[] {
        const statements: XmlMapperStatement[] = [];
        const text = document.getText();
        let namespace = '';
        
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
            namespace = namespaceMatch[1];
            outputChannel.appendLine(`Found namespace: ${namespace}`);
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
                
                // 计算参数个数
                const parameterCount = this.countParameters(sql);
                
                outputChannel.appendLine(`Found ${type} statement: id=${id}, position=line ${position.line + 1}, parameterCount=${parameterCount}`);
                
                statements.push({
                    namespace,
                    id,
                    type: type as 'select' | 'insert' | 'update' | 'delete',
                    parameterType,
                    resultType,
                    sql,
                    position,
                    parameterCount
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