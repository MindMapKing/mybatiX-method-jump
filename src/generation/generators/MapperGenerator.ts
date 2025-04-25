import * as vscode from 'vscode';
import * as path from 'path';
import { FileUtils } from '../../utils/FileUtils';
import { TypeUtils } from '../../utils/TypeUtils';
import { TableInfo } from '../../database/operations/DatabaseOperations';

export interface MapperGeneratorOptions {
    className: string;
    packageName: string;
    tableName: string;
    baseResultMap?: boolean;
    generateCrud?: boolean;
    tableInfo?: TableInfo;
}

export class MapperGenerator {
    /**
     * Generate Mapper interface and XML
     */
    public static async generateMapper(options: MapperGeneratorOptions): Promise<void> {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
            throw new Error('No workspace found');
        }

        // Generate Java interface
        const javaContent = await this.generateJavaInterface(options);
        const javaPath = path.join(
            workspace.uri.fsPath,
            'src/main/java',
            FileUtils.packageToPath(options.packageName),
            `${options.className}Mapper.java`
        );
        const javaUri = vscode.Uri.file(javaPath);

        // Generate XML file
        const xmlContent = await this.generateXmlFile(options);
        const xmlPath = path.join(
            workspace.uri.fsPath,
            'src/main/resources/mapper',
            `${options.className}Mapper.xml`
        );
        const xmlUri = vscode.Uri.file(xmlPath);

        // Create files
        await vscode.workspace.fs.writeFile(javaUri, Buffer.from(javaContent));
        await vscode.workspace.fs.writeFile(xmlUri, Buffer.from(xmlContent));
    }

    private static async generateJavaInterface(options: MapperGeneratorOptions): Promise<string> {
        let content = `package ${options.packageName};\n\n`;
        content += 'import org.apache.ibatis.annotations.Mapper;\n';
        content += 'import org.apache.ibatis.annotations.Param;\n';
        content += `import ${options.packageName}.${options.className};\n`;
        content += 'import java.util.List;\n\n';

        content += '@Mapper\n';
        content += `public interface ${options.className}Mapper {\n`;

        if (options.generateCrud) {
            content += `    /**
     * Insert a new record
     */
    int insert(${options.className} record);

    /**
     * Insert selectively
     */
    int insertSelective(${options.className} record);

    /**
     * Delete by primary key
     */
    int deleteByPrimaryKey(@Param("id") Long id);

    /**
     * Update by primary key
     */
    int updateByPrimaryKey(${options.className} record);

    /**
     * Update selectively by primary key
     */
    int updateByPrimaryKeySelective(${options.className} record);

    /**
     * Select by primary key
     */
    ${options.className} selectByPrimaryKey(@Param("id") Long id);

    /**
     * Select all records
     */
    List<${options.className}> selectAll();`;
        }

        content += '\n}\n';
        return content;
    }

    private static async generateXmlFile(options: MapperGeneratorOptions): Promise<string> {
        let content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN" "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="${options.packageName}.${options.className}Mapper">\n`;

        if (options.baseResultMap && options.tableInfo) {
            content += this.generateResultMap(options);
        }

        if (options.generateCrud && options.tableInfo) {
            content += this.generateCrudStatements(options);
        }

        content += '</mapper>';
        return content;
    }

    private static generateResultMap(options: MapperGeneratorOptions): string {
        if (!options.tableInfo) return '';

        let content = `    <resultMap id="BaseResultMap" type="${options.packageName}.${options.className}">\n`;
        
        options.tableInfo.columns.forEach(column => {
            const jdbcType = TypeUtils.getJdbcType(column.type);
            const property = TypeUtils.toCamelCase(column.name);
            
            if (column.isPrimaryKey) {
                content += `        <id column="${column.name}" property="${property}" jdbcType="${jdbcType}" />\n`;
            } else {
                content += `        <result column="${column.name}" property="${property}" jdbcType="${jdbcType}" />\n`;
            }
        });

        content += '    </resultMap>\n\n';
        return content;
    }

    private static generateCrudStatements(options: MapperGeneratorOptions): string {
        if (!options.tableInfo) return '';

        const columns = options.tableInfo.columns;
        const tableName = options.tableName;
        let content = '';

        // Base columns list
        const columnsList = columns.map(col => col.name).join(', ');
        const propertiesList = columns.map(col => `#{${TypeUtils.toCamelCase(col.name)}}`).join(', ');

        // Insert
        content += `    <insert id="insert" parameterType="${options.packageName}.${options.className}">
        INSERT INTO ${tableName} (${columnsList})
        VALUES (${propertiesList})
    </insert>\n\n`;

        // Insert selective
        content += `    <insert id="insertSelective" parameterType="${options.packageName}.${options.className}">
        INSERT INTO ${tableName}
        <trim prefix="(" suffix=")" suffixOverrides=",">
${columns.map(col => `            <if test="${TypeUtils.toCamelCase(col.name)} != null">
                ${col.name},
            </if>`).join('\n')}
        </trim>
        <trim prefix="VALUES (" suffix=")" suffixOverrides=",">
${columns.map(col => `            <if test="${TypeUtils.toCamelCase(col.name)} != null">
                #{${TypeUtils.toCamelCase(col.name)}},
            </if>`).join('\n')}
        </trim>
    </insert>\n\n`;

        // Delete by primary key
        const primaryKey = columns.find(col => col.isPrimaryKey);
        if (primaryKey) {
            content += `    <delete id="deleteByPrimaryKey" parameterType="java.lang.Long">
        DELETE FROM ${tableName}
        WHERE ${primaryKey.name} = #{id}
    </delete>\n\n`;
        }

        // Update by primary key
        if (primaryKey) {
            content += `    <update id="updateByPrimaryKey" parameterType="${options.packageName}.${options.className}">
        UPDATE ${tableName}
        SET ${columns.filter(col => !col.isPrimaryKey)
            .map(col => `${col.name} = #{${TypeUtils.toCamelCase(col.name)}}`)
            .join(',\n            ')}
        WHERE ${primaryKey.name} = #{${TypeUtils.toCamelCase(primaryKey.name)}}
    </update>\n\n`;

            // Update selective by primary key
            content += `    <update id="updateByPrimaryKeySelective" parameterType="${options.packageName}.${options.className}">
        UPDATE ${tableName}
        <set>
${columns.filter(col => !col.isPrimaryKey)
    .map(col => `            <if test="${TypeUtils.toCamelCase(col.name)} != null">
                ${col.name} = #{${TypeUtils.toCamelCase(col.name)}},
            </if>`).join('\n')}
        </set>
        WHERE ${primaryKey.name} = #{${TypeUtils.toCamelCase(primaryKey.name)}}
    </update>\n\n`;
        }

        // Select by primary key
        if (primaryKey) {
            content += `    <select id="selectByPrimaryKey" resultMap="BaseResultMap">
        SELECT ${columnsList}
        FROM ${tableName}
        WHERE ${primaryKey.name} = #{id}
    </select>\n\n`;
        }

        // Select all
        content += `    <select id="selectAll" resultMap="BaseResultMap">
        SELECT ${columnsList}
        FROM ${tableName}
    </select>\n`;

        return content;
    }
}