import * as vscode from 'vscode';

export class ConfigUtils {
    private static readonly CONFIG_SECTION = 'mybatisx';

    /**
     * Get mapper XML file pattern
     */
    public static getMapperLocations(): string {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('mapperLocations', 'src/main/resources/mapper/**/*.xml');
    }

    /**
     * Get Java mapper interface pattern
     */
    public static getJavaMapperLocations(): string {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get('javaMapperLocations', 'src/main/java/**/*Mapper.java');
    }

    /**
     * Get configuration value by key
     */
    public static getConfig<T>(key: string, defaultValue?: T): T {
        return vscode.workspace.getConfiguration(this.CONFIG_SECTION).get<T>(key, defaultValue as T);
    }

    /**
     * Update configuration value
     */
    public static async updateConfig(key: string, value: any, global: boolean = false): Promise<void> {
        await vscode.workspace.getConfiguration(this.CONFIG_SECTION).update(key, value, global);
    }
} 