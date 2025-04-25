export interface DatabaseConfig {
    name: string;
    type: 'mysql' | 'postgresql' | 'oracle' | 'sqlserver';
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    schema?: string;
}

export class ConnectionConfig {
    private static readonly CONFIG_KEY = 'mybatisx.connections';
    private static readonly ENCRYPTION_KEY = 'mybatisx-connection-key';

    /**
     * Encrypt sensitive data
     */
    public static encryptPassword(password: string): string {
        // TODO: Implement proper encryption
        return Buffer.from(password).toString('base64');
    }

    /**
     * Decrypt sensitive data
     */
    public static decryptPassword(encrypted: string): string {
        // TODO: Implement proper decryption
        return Buffer.from(encrypted, 'base64').toString();
    }

    /**
     * Validate database configuration
     */
    public static validateConfig(config: DatabaseConfig): string[] {
        const errors: string[] = [];

        if (!config.name) {
            errors.push('Connection name is required');
        }
        if (!config.host) {
            errors.push('Host is required');
        }
        if (!config.port || config.port <= 0) {
            errors.push('Valid port number is required');
        }
        if (!config.database) {
            errors.push('Database name is required');
        }
        if (!config.username) {
            errors.push('Username is required');
        }
        if (!config.password) {
            errors.push('Password is required');
        }

        return errors;
    }
} 