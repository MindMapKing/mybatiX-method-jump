export const Icons = {
    MAPPER_METHOD_SVG: '../resources/images/mapper_method.svg',
    STATEMENT_SVG: '../resources/images/statement.svg'
} as const;

export type IconType = typeof Icons[keyof typeof Icons]; 