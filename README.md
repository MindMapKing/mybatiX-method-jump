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

## License

MIT 