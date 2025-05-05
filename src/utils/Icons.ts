export const Icons = {
    MAPPER_METHOD_SVG: 'mapper_method.svg',
    STATEMENT_SVG: 'statement.svg',
    MYBATIS_JAVA_PNG: 'mybatis-java.png',
    MYBATIS_XML_PNG: 'mybatis-xml.png'
} as const;

export type IconType = typeof Icons[keyof typeof Icons]; 