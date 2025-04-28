import * as vscode from 'vscode';

export interface JavaParameterInfo {
    name: string;
    type: string;
    // 完整类型，包含泛型信息，如：java.util.List<java.lang.String>
    fullType: string;
}

export interface JavaMethodInfo {
    // 方法所在的完整类名（命名空间）
    namespace: string;
    // 方法名
    name: string;
    // 方法在文件中的位置（包含注释）
    position: vscode.Position;
    // 方法图标应该显示的位置（实际方法声明的位置）
    iconPosition: vscode.Position;
    // 方法的完整范围（包括开始和结束位置）
    range: vscode.Range;
    // 返回类型（简单类型名）
    returnType: string;
    // 完整返回类型，包含泛型信息
    fullReturnType: string;
    // 参数信息
    parameters: JavaParameterInfo[];
    // 参数个数
    parameterCount: number;
    // 原始detail信息
    detail: string;
}

export class JavaLanguageService {
    private static outputChannel: vscode.OutputChannel;

    private static getOutputChannel(): vscode.OutputChannel {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('MybatisXX Java Service');
        }
        return this.outputChannel;
    }

    /**
     * 检查Java Language Server是否可用
     */
    private static async checkJavaExtension(): Promise<boolean> {
        const javaExtension = vscode.extensions.getExtension('redhat.java');
        if (!javaExtension) {
            this.getOutputChannel().appendLine('Java Language Server extension not found');
            return false;
        }

        if (!javaExtension.isActive) {
            this.getOutputChannel().appendLine('Activating Java Language Server extension...');
            await javaExtension.activate();
        }

        return true;
    }

    /**
     * 从Java文件中提取完整的类名（命名空间）
     */
    public static async getFullClassName(document: vscode.TextDocument): Promise<string> {
        const outputChannel = this.getOutputChannel();
        try {
            const text = document.getText();
            let namespace = '';

            // 提取包名
            const packageMatch = text.match(/package\s+([\w.]+);/);
            if (packageMatch) {
                namespace = packageMatch[1];
                outputChannel.appendLine(`Found package: ${namespace}`);
            }

            // 获取类名
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (symbols) {
                const classSymbol = symbols.find(s => 
                    s.kind === vscode.SymbolKind.Class || 
                    s.kind === vscode.SymbolKind.Interface
                );
                if (classSymbol) {
                    const className = classSymbol.name;
                    namespace = namespace ? `${namespace}.${className}` : className;
                    outputChannel.appendLine(`Full class name: ${namespace}`);
                }
            }

            return namespace;
        } catch (error) {
            outputChannel.appendLine(`Error getting full class name: ${error}`);
            return '';
        }
    }

    /**
     * 从方法的detail字符串中解析出返回类型和参数信息
     */
    private static parseMethodDetail(detail: string, methodName: string): { 
        returnType: string; 
        parameters: { name: string; type: string; }[];
    } {
        const outputChannel = this.getOutputChannel();
        outputChannel.appendLine(`Parsing method detail: ${detail} for method: ${methodName}`);

        let returnType = 'void';
        const parameters: { name: string; type: string; }[] = [];

        try {
            // 移除修饰符（public, private, protected, static等）
            let cleanDetail = detail.replace(/\b(public|private|protected|static|final|abstract|synchronized|native)\b\s*/g, '');
            outputChannel.appendLine(`Cleaned detail: ${cleanDetail}`);

            // 移除可能存在的冒号前缀
            cleanDetail = cleanDetail.replace(/^:\s*/, '');
            
            // 提取返回类型
            const methodSignature = cleanDetail.split(methodName)[0].trim();
            if (methodSignature) {
                // 移除返回类型中可能的冒号
                returnType = methodSignature.replace(/^:\s*/, '').trim();
                outputChannel.appendLine(`Found return type: ${returnType}`);
            }

            // 提取参数，只保留类型和名称
            const paramsMatch = detail.match(/\((.*?)\)/);
            if (paramsMatch && paramsMatch[1]) {
                const params = paramsMatch[1].split(',');
                outputChannel.appendLine(`Found parameters: ${params.join(', ')}`);
                for (const param of params) {
                    if (param.trim()) {
                        // 处理泛型参数，例如: List<String> names
                        const parts = param.trim().split(/\s+/);
                        if (parts.length >= 2) {
                            // 移除参数类型中可能的冒号
                            const paramType = parts.slice(0, -1).join(' ').replace(/^:\s*/, '');
                            const paramName = parts[parts.length - 1];
                            parameters.push({
                                type: paramType,
                                name: paramName
                            });
                            outputChannel.appendLine(`Parsed parameter: type=${paramType}, name=${paramName}`);
                        }
                    }
                }
            }
        } catch (error) {
            outputChannel.appendLine(`Error parsing method detail: ${error}`);
            console.error('Error parsing method detail:', error);
        }

        return { returnType, parameters };
    }

    /**
     * 解析完整类型（处理泛型和数组）
     */
    private static parseFullType(type: string): string {
        const outputChannel = this.getOutputChannel();
        try {
            // 移除前后空格和可能的冒号前缀
            type = type.trim().replace(/^:\s*/, '');
            
            // 处理数组类型
            if (type.endsWith('[]')) {
                const baseType = this.parseFullType(type.slice(0, -2));
                return `${baseType}[]`;
            }

            // 处理泛型类型
            if (type.includes('<')) {
                const mainType = type.substring(0, type.indexOf('<'));
                const genericPart = type.substring(type.indexOf('<') + 1, type.lastIndexOf('>'));
                const genericTypes = genericPart.split(',').map(t => this.parseFullType(t.trim()));
                return `${mainType}<${genericTypes.join(', ')}>`;
            }

            // 处理基本类型和其他类型
            const typeMap: { [key: string]: string } = {
                'void': 'void',
                'boolean': 'boolean',
                'byte': 'byte',
                'short': 'short',
                'int': 'int',
                'long': 'long',
                'float': 'float',
                'double': 'double',
                'char': 'char',
                'String': 'java.lang.String',
                'Object': 'java.lang.Object',
                'Integer': 'java.lang.Integer',
                'Long': 'java.lang.Long',
                'Boolean': 'java.lang.Boolean',
                'Float': 'java.lang.Float',
                'Double': 'java.lang.Double',
                'List': 'java.util.List',
                'Map': 'java.util.Map',
                'Set': 'java.util.Set',
                'Collection': 'java.util.Collection'
            };

            // 移除类型中可能的冒号
            const cleanType = type.replace(/^:\s*/, '');
            return typeMap[cleanType] || cleanType;
        } catch (error) {
            outputChannel.appendLine(`Error parsing full type: ${error}`);
            return type;
        }
    }

    /**
     * 清理方法名（移除参数部分）
     */
    private static cleanMethodName(methodName: string): string {
        // 如果方法名包含参数部分，只保留方法名
        const parenIndex = methodName.indexOf('(');
        if (parenIndex !== -1) {
            return methodName.substring(0, parenIndex).trim();
        }
        return methodName.trim();
    }

    /**
     * 使用Java Language Server获取Java文件中的方法信息
     */
    public static async getMethodsInFile(document: vscode.TextDocument): Promise<JavaMethodInfo[]> {
        const outputChannel = this.getOutputChannel();
        try {
            // 检查Java Language Server
            if (!await this.checkJavaExtension()) {
                outputChannel.appendLine('Java Language Server not available');
                return [];
            }

            outputChannel.appendLine(`Getting methods from file: ${document.uri.fsPath}`);

            // 获取完整类名（命名空间）
            const namespace = await this.getFullClassName(document);
            outputChannel.appendLine(`Namespace: ${namespace}`);

            // 获取文档中的所有符号
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols) {
                outputChannel.appendLine('No symbols found');
                return [];
            }

            const methods: JavaMethodInfo[] = [];

            // 递归处理所有符号
            const processSymbols = (symbols: vscode.DocumentSymbol[]) => {
                for (const symbol of symbols) {
                    if (symbol.kind === vscode.SymbolKind.Method) {
                        outputChannel.appendLine(`Processing method: ${symbol.name}, detail: ${symbol.detail}`);
                        
                        // 清理方法名（移除参数部分）
                        const cleanName = this.cleanMethodName(symbol.name);
                        
                        // 从detail中解析方法信息
                        const methodInfo = this.parseMethodDetail(symbol.detail || '', cleanName);

                        // 查找实际方法声明的位置
                        const methodPosition = this.findMethodDeclarationPosition(document, symbol.range, cleanName);
                        
                        methods.push({
                            namespace,
                            name: cleanName,
                            position: symbol.range.start,
                            iconPosition: methodPosition || symbol.range.start, // 如果找不到具体位置，使用范围起始位置
                            range: symbol.range,
                            returnType: methodInfo.returnType,
                            fullReturnType: this.parseFullType(methodInfo.returnType),
                            parameters: methodInfo.parameters.map(p => ({
                                ...p,
                                fullType: this.parseFullType(p.type)
                            })),
                            parameterCount: methodInfo.parameters.length,
                            detail: symbol.detail || ''
                        });
                    }
                    
                    // 递归处理子符号
                    if (symbol.children && symbol.children.length > 0) {
                        processSymbols(symbol.children);
                    }
                }
            };

            processSymbols(symbols);
            outputChannel.appendLine(`Found ${methods.length} methods`);
            methods.forEach(method => {
                outputChannel.appendLine(`Method: ${method.namespace}.${method.name}`);
                outputChannel.appendLine(`  Return type: ${method.returnType} (${method.fullReturnType})`);
                outputChannel.appendLine(`  Parameters (${method.parameterCount}):`);
                method.parameters.forEach(param => {
                    outputChannel.appendLine(`    ${param.name}: ${param.type} (${param.fullType})`);
                });
            });

            return methods;
        } catch (error) {
            outputChannel.appendLine(`Error getting methods from Java file: ${error}`);
            console.error('Error getting methods from Java file:', error);
            return [];
        }
    }

    /**
     * 检查Java文件是否为Mapper接口
     */
    public static async isMapperInterface(document: vscode.TextDocument): Promise<boolean> {
        const outputChannel = this.getOutputChannel();
        try {
            // 检查Java Language Server
            if (!await this.checkJavaExtension()) {
                outputChannel.appendLine('Java Language Server not available');
                return false;
            }

            outputChannel.appendLine(`Checking if file is Mapper interface: ${document.uri.fsPath}`);

            // 获取文档中的所有符号
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols) {
                outputChannel.appendLine('No symbols found');
                return false;
            }

            outputChannel.appendLine(`Found ${symbols.length} top-level symbols`);

            // 查找类/接口声明
            const interfaceSymbol = symbols.find(s => 
                s.kind === vscode.SymbolKind.Interface || 
                s.kind === vscode.SymbolKind.Class
            );

            if (!interfaceSymbol) {
                outputChannel.appendLine('No interface/class symbol found');
                return false;
            }

            outputChannel.appendLine(`Found interface/class: ${interfaceSymbol.name}, kind: ${interfaceSymbol.kind}, detail: ${interfaceSymbol.detail}`);

            // 检查文件内容是否包含@Mapper注解
            const text = document.getText();
            const hasMapperAnnotation = text.includes('@Mapper');
            outputChannel.appendLine(`Has @Mapper annotation: ${hasMapperAnnotation}`);

            // 检查是否以Mapper结尾
            const isMapperNamed = interfaceSymbol.name.endsWith('Mapper');
            outputChannel.appendLine(`Name ends with Mapper: ${isMapperNamed}`);

            // 检查是否有@Repository注解
            const hasRepositoryAnnotation = text.includes('@Repository');
            outputChannel.appendLine(`Has @Repository annotation: ${hasRepositoryAnnotation}`);

            // 检查是否有mybatis相关的导入
            const hasMybatisImport = text.includes('org.apache.ibatis') || 
                                   text.includes('mybatis');
            outputChannel.appendLine(`Has MyBatis import: ${hasMybatisImport}`);

            // 综合判断
            const isMapper = hasMapperAnnotation || 
                           (isMapperNamed && (hasRepositoryAnnotation || hasMybatisImport));
            outputChannel.appendLine(`Is Mapper interface: ${isMapper}`);

            return isMapper;
        } catch (error) {
            outputChannel.appendLine(`Error checking if file is Mapper interface: ${error}`);
            console.error('Error checking if file is Mapper interface:', error);
            return false;
        }
    }

    /**
     * 查找方法声明的实际位置
     * 这个方法会尝试找到方法声明的行，跳过注释和空行
     */
    private static findMethodDeclarationPosition(
        document: vscode.TextDocument,
        range: vscode.Range,
        methodName: string
    ): vscode.Position | undefined {
        try {
            // 获取方法范围内的所有文本
            const text = document.getText(range);
            const lines = text.split('\n');
            
            // 从范围开始查找方法声明
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // 跳过空行和注释行
                if (line === '' || line.startsWith('/*') || line.startsWith('*') || line.startsWith('//')) {
                    continue;
                }
                
                // 检查这行是否包含方法声明（包含方法名和左括号）
                if (line.includes(methodName) && line.includes('(')) {
                    return new vscode.Position(range.start.line + i, 0);
                }
            }
            
            return undefined;
        } catch (error) {
            console.error('Error finding method declaration position:', error);
            return undefined;
        }
    }
} 