import { Scalar } from '@nestjs/graphql';

import { Kind, ValueNode } from 'graphql';

@Scalar('Any')
export class AnyScalar {
  description = 'The `Any` scalar type represents any JSON value';

  parseValue(value: any) {
    return value;
  }

  serialize(value: any) {
    return value;
  }

  parseLiteral(ast: ValueNode): any {
    switch (ast.kind) {
      case Kind.STRING:
        return (ast as any).value;
      case Kind.BOOLEAN:
        return (ast as any).value;
      case Kind.INT:
        return parseInt((ast as any).value, 10);
      case Kind.FLOAT:
        return parseFloat((ast as any).value);
      case Kind.NULL:
        return null;
      case Kind.LIST:
        return (ast as any).values.map((v: ValueNode) => this.parseLiteral(v));
      case Kind.OBJECT: {
        const obj: Record<string, any> = {};
        (ast as any).fields.forEach((field: any) => {
          obj[field.name.value] = this.parseLiteral(field.value);
        });
        return obj;
      }
      default:
        return null;
    }
  }
}
