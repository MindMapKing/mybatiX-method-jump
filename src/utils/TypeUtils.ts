export class TypeUtils {
    /**
     * Convert database type to Java type
     */
    public static toJavaType(dbType: string): string {
        dbType = dbType.toLowerCase();
        
        // Number types
        if (dbType.includes('int') || dbType === 'serial') {
            return 'Integer';
        }
        if (dbType.includes('bigint') || dbType === 'bigserial') {
            return 'Long';
        }
        if (dbType.includes('decimal') || dbType.includes('numeric')) {
            return 'BigDecimal';
        }
        if (dbType.includes('float') || dbType.includes('real')) {
            return 'Float';
        }
        if (dbType.includes('double')) {
            return 'Double';
        }
        if (dbType.includes('bool')) {
            return 'Boolean';
        }

        // Date/Time types
        if (dbType.includes('timestamp')) {
            return 'LocalDateTime';
        }
        if (dbType.includes('date')) {
            return 'LocalDate';
        }
        if (dbType.includes('time')) {
            return 'LocalTime';
        }

        // Binary types
        if (dbType.includes('blob') || dbType.includes('binary') || dbType.includes('bytea')) {
            return 'byte[]';
        }

        // Default to String
        return 'String';
    }

    /**
     * Get Java imports for type
     */
    public static getImportsForType(javaType: string): string[] {
        const imports: string[] = [];
        
        switch (javaType) {
            case 'BigDecimal':
                imports.push('java.math.BigDecimal');
                break;
            case 'LocalDate':
            case 'LocalTime':
            case 'LocalDateTime':
                imports.push(`java.time.${javaType}`);
                break;
        }

        return imports;
    }

    /**
     * Convert database column name to Java property name
     */
    public static toCamelCase(columnName: string): string {
        return columnName.toLowerCase()
            .split(/[_\s]+/)
            .map((word, index) => 
                index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join('');
    }

    /**
     * Convert to Pascal case (for class names)
     */
    public static toPascalCase(name: string): string {
        const camelCase = this.toCamelCase(name);
        return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
    }

    /**
     * Get JDBC type for database type
     */
    public static getJdbcType(dbType: string): string {
        dbType = dbType.toLowerCase();
        
        if (dbType.includes('char') || dbType.includes('text')) {
            return 'VARCHAR';
        }
        if (dbType.includes('int')) {
            return 'INTEGER';
        }
        if (dbType.includes('bigint')) {
            return 'BIGINT';
        }
        if (dbType.includes('decimal') || dbType.includes('numeric')) {
            return 'DECIMAL';
        }
        if (dbType.includes('float')) {
            return 'FLOAT';
        }
        if (dbType.includes('double')) {
            return 'DOUBLE';
        }
        if (dbType.includes('bool')) {
            return 'BOOLEAN';
        }
        if (dbType.includes('timestamp')) {
            return 'TIMESTAMP';
        }
        if (dbType.includes('date')) {
            return 'DATE';
        }
        if (dbType.includes('time')) {
            return 'TIME';
        }
        if (dbType.includes('blob') || dbType.includes('binary')) {
            return 'BLOB';
        }

        return 'VARCHAR';
    }
} 