import * as vscode from 'vscode';
import * as path from 'path';
import { TableInfo, TableColumn } from '../../database/operations/DatabaseOperations';
import { TypeUtils } from '../../utils/TypeUtils';
import { FileUtils } from '../../utils/FileUtils';

export interface EntityGeneratorOptions {
    packageName: string;
    tableName: string;
    className?: string;
    lombok?: boolean;
    swagger?: boolean;
    serializable?: boolean;
    tableInfo: TableInfo;
}

export class EntityGenerator {
    /**
     * Generate entity class from table info
     */
    public static async generateEntity(options: EntityGeneratorOptions): Promise<void> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            throw new Error('No workspace found');
        }

        const className = options.className || TypeUtils.toPascalCase(options.tableName);
        const javaPath = path.join(
            workspace.uri.fsPath,
            'src/main/java',
            FileUtils.packageToPath(options.packageName),
            `${className}.java`
        );

        const content = await this.generateEntityContent(options);
        const javaUri = vscode.Uri.file(javaPath);
        await vscode.workspace.fs.writeFile(javaUri, Buffer.from(content));
    }

    private static async generateEntityContent(options: EntityGeneratorOptions): Promise<string> {
        const className = options.className || TypeUtils.toPascalCase(options.tableName);
        const imports = new Set<string>();

        // Add required imports
        if (options.lombok) {
            imports.add('lombok.Data');
            imports.add('lombok.NoArgsConstructor');
            imports.add('lombok.AllArgsConstructor');
        }
        if (options.swagger) {
            imports.add('io.swagger.annotations.ApiModel');
            imports.add('io.swagger.annotations.ApiModelProperty');
        }
        if (options.serializable) {
            imports.add('java.io.Serializable');
        }

        // Add imports for field types
        options.tableInfo.columns.forEach(column => {
            const javaType = TypeUtils.toJavaType(column.type);
            TypeUtils.getImportsForType(javaType).forEach(imp => imports.add(imp));
        });

        // Generate class content
        let content = `package ${options.packageName};\n\n`;

        // Add imports
        [...imports].sort().forEach(imp => {
            content += `import ${imp};\n`;
        });
        content += '\n';

        // Add class annotations
        if (options.lombok) {
            content += '@Data\n';
            content += '@NoArgsConstructor\n';
            content += '@AllArgsConstructor\n';
        }
        if (options.swagger) {
            content += `@ApiModel(value = "${className}", description = "Entity for table ${options.tableName}")\n`;
        }

        // Class declaration
        content += `public class ${className}`;
        if (options.serializable) {
            content += ' implements Serializable';
        }
        content += ' {\n';

        // Add serialVersionUID if serializable
        if (options.serializable) {
            content += '    private static final long serialVersionUID = 1L;\n\n';
        }

        // Add fields
        options.tableInfo.columns.forEach(column => {
            content += this.generateField(column, options.swagger);
        });

        // Add getters and setters if not using lombok
        if (!options.lombok) {
            content += '\n';
            options.tableInfo.columns.forEach(column => {
                content += this.generateGetterSetter(column);
            });
        }

        content += '}\n';
        return content;
    }

    private static generateField(column: TableColumn, useSwagger: boolean = false): string {
        let field = '';
        const javaType = TypeUtils.toJavaType(column.type);
        const fieldName = TypeUtils.toCamelCase(column.name);

        if (useSwagger) {
            field += `    @ApiModelProperty(value = "${column.comment || column.name}"`;
            if (!column.nullable) {
                field += ', required = true';
            }
            field += ')\n';
        }

        field += `    private ${javaType} ${fieldName};\n`;
        return field;
    }

    private static generateGetterSetter(column: TableColumn): string {
        const javaType = TypeUtils.toJavaType(column.type);
        const fieldName = TypeUtils.toCamelCase(column.name);
        const pascalFieldName = TypeUtils.toPascalCase(column.name);

        return `
    public ${javaType} get${pascalFieldName}() {
        return ${fieldName};
    }

    public void set${pascalFieldName}(${javaType} ${fieldName}) {
        this.${fieldName} = ${fieldName};
    }
`;
    }
} 