export interface TableColumn {
    name: string;
    type: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    comment?: string;
}

export interface TableInfo {
    name: string;
    columns: TableColumn[];
    schema?: string;
}

export interface DatabaseOperations {
    getTables(): Promise<string[]>;
    getTableInfo(tableName: string): Promise<TableInfo>;
    executeQuery(sql: string): Promise<any>;
} 