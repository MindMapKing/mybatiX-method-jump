export const Icons = {
    MAPPER_METHOD_SVG: 'mapper_method.svg',
    STATEMENT_SVG: 'statement.svg',
    MYBATIS_JAVA_SVG: 'mybatis-java.svg',
    MYBATIS_XML_SVG: 'mybatis-xml.svg'
} as const;

export type IconType = typeof Icons[keyof typeof Icons]; 