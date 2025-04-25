import * as mysql from 'mysql2/promise';
import * as pg from 'pg';
import * as mssql from 'mssql';
import * as oracledb from 'oracledb';
import { DatabaseConfig, ConnectionConfig } from './ConnectionConfig';
import { ConfigUtils } from '../../utils/ConfigUtils';

export class ConnectionManager {
    private static instance: ConnectionManager;
    private connections: Map<string, any>;

    private constructor() {
        this.connections = new Map();
    }

    public static getInstance(): ConnectionManager {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    /**
     * Get all connection configs
     */
    public async getConfigs(): Promise<DatabaseConfig[]> {
        const configs = ConfigUtils.getConfig<DatabaseConfig[]>('connections', []);
        return configs.map(config => ({
            ...config,
            password: ConnectionConfig.decryptPassword(config.password)
        }));
    }

    /**
     * Create database connection
     */
    public async createConnection(config: DatabaseConfig): Promise<void> {
        const errors = ConnectionConfig.validateConfig(config);
        if (errors.length > 0) {
            throw new Error(`Invalid configuration: ${errors.join(', ')}`);
        }

        try {
            let connection;
            switch (config.type) {
                case 'mysql':
                    connection = await this.createMySQLConnection(config);
                    break;
                case 'postgresql':
                    connection = await this.createPostgreSQLConnection(config);
                    break;
                case 'sqlserver':
                    connection = await this.createSQLServerConnection(config);
                    break;
                case 'oracle':
                    connection = await this.createOracleConnection(config);
                    break;
                default:
                    throw new Error(`Unsupported database type: ${config.type}`);
            }

            this.connections.set(config.name, connection);

            // Save connection config
            const connections = await this.getConfigs();
            const configToSave = { ...config };
            configToSave.password = ConnectionConfig.encryptPassword(config.password);
            
            if (!connections.find(c => c.name === config.name)) {
                connections.push(configToSave);
                await ConfigUtils.updateConfig('connections', connections, true);
            }
        } catch (error: any) {
            throw new Error(`Failed to create connection: ${error.message}`);
        }
    }

    /**
     * Get existing connection
     */
    public getConnection(name: string): any {
        const connection = this.connections.get(name);
        if (!connection) {
            throw new Error(`Connection not found: ${name}`);
        }
        return connection;
    }

    /**
     * Close connection
     */
    public async closeConnection(name: string): Promise<void> {
        const connection = this.connections.get(name);
        if (connection) {
            try {
                switch (typeof connection.end) {
                    case 'function':
                        await connection.end();
                        break;
                    case 'undefined':
                        if (typeof connection.close === 'function') {
                            await connection.close();
                        }
                        break;
                }
                this.connections.delete(name);
            } catch (error: any) {
                throw new Error(`Failed to close connection: ${error.message}`);
            }
        }
    }

    /**
     * Remove connection config
     */
    public async removeConfig(name: string): Promise<void> {
        await this.closeConnection(name);
        const configs = await this.getConfigs();
        const updatedConfigs = configs.filter(c => c.name !== name);
        await ConfigUtils.updateConfig('connections', updatedConfigs, true);
    }

    private async createMySQLConnection(config: DatabaseConfig): Promise<mysql.Connection> {
        return mysql.createConnection({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database
        });
    }

    private async createPostgreSQLConnection(config: DatabaseConfig): Promise<pg.Client> {
        const client = new pg.Client({
            host: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database
        });
        await client.connect();
        return client;
    }

    private async createSQLServerConnection(config: DatabaseConfig): Promise<mssql.ConnectionPool> {
        const pool = new mssql.ConnectionPool({
            server: config.host,
            port: config.port,
            user: config.username,
            password: config.password,
            database: config.database
        });
        await pool.connect();
        return pool;
    }

    private async createOracleConnection(config: DatabaseConfig): Promise<oracledb.Connection> {
        return oracledb.getConnection({
            user: config.username,
            password: config.password,
            connectString: `${config.host}:${config.port}/${config.database}`
        });
    }
} 