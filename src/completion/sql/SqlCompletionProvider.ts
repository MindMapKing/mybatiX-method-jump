import * as vscode from 'vscode';

export class SqlCompletionProvider implements vscode.CompletionItemProvider {
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): Promise<vscode.CompletionItem[]> {
        const linePrefix = document.lineAt(position).text.substr(0, position.character);
        
        // Provide SQL keywords
        if (this.isSqlContext(document, position)) {
            return this.getSqlKeywords().map(keyword => {
                const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
                item.detail = 'SQL Keyword';
                return item;
            });
        }

        // Provide MyBatis parameters
        if (linePrefix.endsWith('#{')) {
            return this.getParameterCompletions(document);
        }

        return [];
    }

    private isSqlContext(document: vscode.TextDocument, position: vscode.Position): boolean {
        const text = document.getText();
        const offset = document.offsetAt(position);
        
        // Simple check if we're inside a MyBatis SQL statement
        const beforeCursor = text.substring(0, offset);
        return /<(select|insert|update|delete)[^>]*>[^<]*$/.test(beforeCursor);
    }

    private getSqlKeywords(): string[] {
        return [
            'SELECT', 'FROM', 'WHERE', 'AND', 'OR',
            'INSERT', 'INTO', 'VALUES',
            'UPDATE', 'SET',
            'DELETE',
            'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
            'GROUP BY', 'HAVING', 'ORDER BY',
            'LIKE', 'IN', 'NOT', 'IS NULL', 'IS NOT NULL'
        ];
    }

    private getParameterCompletions(document: vscode.TextDocument): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];
        
        // Add common parameter types
        ['id', 'name', 'value', 'type', 'status'].forEach(param => {
            const item = new vscode.CompletionItem(param, vscode.CompletionItemKind.Property);
            item.detail = 'Parameter';
            item.insertText = `${param}}`;
            items.push(item);
        });

        return items;
    }
} 