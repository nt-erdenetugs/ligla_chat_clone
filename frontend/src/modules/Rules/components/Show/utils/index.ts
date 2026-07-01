import { type LogicalOperator } from '~/generated/graphql/types';
import { type IFilter, type IFilterGroup, isGroup } from '~/modules/Rules';

export type QueryTokens = (string | IFilter)[];

export const convertItemsToQueryTokens = (
  items: IFilterGroup['items'],
  parentOp: LogicalOperator,
) => {
  const flattenGroupItems = (items: IFilterGroup['items'], op: LogicalOperator) => {
    const tokens: QueryTokens = [];

    items.forEach((item, index) => {
      const isLast = index === items.length - 1;

      if (isGroup(item)) {
        tokens.push('(');
        tokens.push(...flattenGroupItems(item.items, item.logicalOperator));
        tokens.push(')');
      } else {
        tokens.push(item);
      }

      if (!isLast) tokens.push(op);
    });

    return tokens;
  };

  return flattenGroupItems(items, parentOp);
};
