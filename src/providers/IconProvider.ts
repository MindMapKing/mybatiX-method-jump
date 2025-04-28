import * as vscode from 'vscode';
import * as path from 'path';
import { Icons } from '../utils/Icons';

export class MybatisIconProvider {
    private static readonly XML_MAPPER_PATTERN = /.*Mapper\.xml$/;
    private static readonly JAVA_MAPPER_PATTERN = /.*Mapper\.java$/;

    constructor(private context: vscode.ExtensionContext) {}

    public registerFileIcons() {
        const iconPath = {
            light: {
                javaMapper: this.context.asAbsolutePath(path.join('resources', 'icons', Icons.MYBATIS_JAVA_SVG)),
                xmlMapper: this.context.asAbsolutePath(path.join('resources', 'icons', Icons.MYBATIS_XML_SVG))
            },
            dark: {
                javaMapper: this.context.asAbsolutePath(path.join('resources', 'icons', Icons.MYBATIS_JAVA_SVG)),
                xmlMapper: this.context.asAbsolutePath(path.join('resources', 'icons', Icons.MYBATIS_XML_SVG))
            }
        };
        
        // 注册自定义编辑器图标
        this.context.subscriptions.push(
            vscode.window.registerFileDecorationProvider({
                provideFileDecoration: (uri: vscode.Uri): vscode.FileDecoration | undefined => {
                    const fileName = path.basename(uri.fsPath);
                    
                    if (MybatisIconProvider.JAVA_MAPPER_PATTERN.test(fileName)) {
                        return {
                            badge: 'M',
                            tooltip: 'MyBatis Mapper Interface'
                        };
                    }
                    
                    if (MybatisIconProvider.XML_MAPPER_PATTERN.test(fileName)) {
                        return {
                            badge: 'X',
                            tooltip: 'MyBatis Mapper XML'
                        };
                    }
                    
                    return undefined;
                }
            })
        );
    }
}

export function registerIconProvider(context: vscode.ExtensionContext) {
    const iconProvider = new MybatisIconProvider(context);
    iconProvider.registerFileIcons();
} 