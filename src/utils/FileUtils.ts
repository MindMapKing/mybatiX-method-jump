import * as vscode from 'vscode';
import * as path from 'path';

export class FileUtils {
    /**
     * Get workspace relative path
     */
    public static getWorkspaceRelativePath(uri: vscode.Uri): string | undefined {
        const workspace = vscode.workspace.getWorkspaceFolder(uri);
        if (!workspace) {
            return undefined;
        }
        return path.relative(workspace.uri.fsPath, uri.fsPath);
    }

    /**
     * Convert Java package path to directory path
     */
    public static packageToPath(packageName: string): string {
        return packageName.replace(/\./g, path.sep);
    }

    /**
     * Get Java package name from file path
     */
    public static pathToPackage(filePath: string): string {
        const relativePath = filePath.replace(/[\/\\]src[\/\\]main[\/\\]java[\/\\]/, '');
        return relativePath.replace(/[\/\\]/g, '.').replace(/\.java$/, '');
    }

    /**
     * Check if file exists
     */
    public static async fileExists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
} 