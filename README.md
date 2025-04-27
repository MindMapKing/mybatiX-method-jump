# VSCode-MybatisX

A Visual Studio Code extension that aims to provide similar functionality as the IntelliJ IDEA MybatisX plugin for MyBatis development.

## Features

- Navigation between Mapper interfaces and XML files
- Generate Mapper XML files from Java interfaces
- Generate SQL statements for CRUD operations
- Generate ResultMap based on Java POJOs
- SQL syntax highlighting
- Code completion for MyBatis parameters
- Database integration

## Requirements

- Visual Studio Code ^1.60.0
- Java Development Kit (JDK)
- Maven or Gradle project with MyBatis

## Extension Settings

This extension contributes the following settings:

* `mybatisx.mapperLocations`: Specify the location pattern for MyBatis mapper XML files
* `mybatisx.javaMapperLocations`: Specify the location pattern for Java mapper interfaces

## Known Issues

This extension is under active development.

## Release Notes

### 0.0.1

Initial release with basic functionality.

## Development

1. Clone the repository
2. Run `npm install`
3. Open in VS Code
4. Press F5 to start debugging
# Plain
0.1.0
    1.支持锚点跳转，xml和java的相互跳转
0.1.1
    1.解决每次都需要重新解析的问题，添加配置项
0.1.2
    1.调整指定需要解析mapper接口和xml接口文件范围的标志(支持直接解析@MapperScan注解和mybatis-config.xml文件)
    2、支持该项添加可配置项
0.2.0
    1.支持图标的锚点跳转，xml和java的相互跳转
0.2.1
    1.支持图标和锚点跳转转为settings配置开关
1.0.0
    1.实现逻辑重构，将图标和锚点跳转重构为两个模块
    2、支持向后前兼容，升级后检测存在老版本则关闭新功能
1.1.0
    1.支持mapper接口直接生成xml中的方法
1.2.0
    1.支持检测列举java接口和xml接口无对应关系的方法并添加控制台警告中
1.3.0
    1.支持离线检测持久类和xml中表字段是否一致
1.3.0
    1.支持连接数据库后，手动检测配置持久类和数据库是否一致（mybatisx-db）
    2.支持手动检测xml中表字段是否和持久类/数据库一致（resultMap）
1.3.1
    1.支持自动检测修改为自动检测
1.3.2
    1.支持多表关联时字段的自动检测
1.3.2
    1.支持扫描mybatis可能的运行时错误
2.0.0
    1.自动列举出复杂较高的代码或sql(借助chart导出图标)
2.1.0
    1.借助AI对复杂sql进行优化
    2.借助AI对频繁调用的sql方法进行辩证优化
## License
mybatisx-extension-pack
mybatisx-jumper(方法间切换)
mybatisx-analysis(分析sql)
0.1.0
    1.支持分析出复杂度高的sql
    2.支持分析出频繁调用的方法
1.0.0
    1.代码优化
1.1.0
    1.支持支持导出表格和排行
2.0.0
    1、支持基于现有xml和持久类生产表关联图
    2、支持表关联图的导出
mybatisx-generator(生成代码和sql)
0.1.0
    1.支持连接数据库
    2.支持单次对话框设置
    3.支持生成myabtis相关代码
1.0.0
    1.代码优化
1.1.0
    1.支持提前设置好要表及范围

mybatisx-chart(生成er,md等各种图)
0.1.0
    1.支持根据json生成er图的md文件
1.0.0
    1.代码优化
mybatisx-ai(接入ai)
0.1.0
    1.支持优化sql
    2.支持优化代码
0.2.0
    1.支持生产本地mybatis相关代码的langgpt提示词
    2、支持提供对话框基于mybatis相关代码沟通

MIT 