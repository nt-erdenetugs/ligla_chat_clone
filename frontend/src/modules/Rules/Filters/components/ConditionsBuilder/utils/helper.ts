import { LogicalOperator, type ConditionOperator, ValueType } from '~/generated/graphql/types';
import {
  type ICondition,
  type IConditionNode,
  type IConditionGroup,
} from '~/modules/Rules/Filters';

type TreeOperation =
  | {
      kind: 'insertCondition';
      value: ICondition;
    }
  | {
      kind: 'insertGroup';
      value: IConditionGroup;
    }
  | {
      kind: 'updateField';
      field: string;
      value: string;
      valueType: ValueType;
      defaultOperator?: ConditionOperator;
    }
  | {
      kind: 'updateGate';
      value: LogicalOperator;
    }
  | {
      kind: 'delete';
      defaultCondition: ICondition;
    };

export const isConditionGroup = (node: IConditionNode): node is IConditionGroup =>
  (node as IConditionGroup)?.logicalOperator !== undefined;

const getChildNodeAt = (
  parentGroup: IConditionGroup,
  childIndex: number,
): IConditionNode | undefined => {
  const conditionsCount = parentGroup.conditions.length;
  if (childIndex < conditionsCount) {
    return parentGroup.conditions[childIndex];
  }
  return parentGroup.subGroups?.[childIndex - conditionsCount];
};

const replaceChildNodeAt = (
  parentGroup: IConditionGroup,
  childIndex: number,
  updatedChild: IConditionNode,
): IConditionGroup => {
  const conditionsCount = parentGroup.conditions.length;
  const subGroups = parentGroup.subGroups ? [...parentGroup.subGroups] : [];
  const conditions = [...parentGroup.conditions];

  if (childIndex < conditionsCount) {
    conditions[childIndex] = updatedChild as ICondition;
  } else {
    subGroups[childIndex - conditionsCount] = updatedChild as IConditionGroup;
  }

  return { ...parentGroup, conditions, subGroups };
};

function applyTreeOperation(
  currentNode: IConditionNode,
  nodePath: number[],
  operation: TreeOperation,
): IConditionNode | null {
  // Base case: apply operation at current node (path is empty)
  if (nodePath.length === 0) {
    if (!isConditionGroup(currentNode)) {
      switch (operation.kind) {
        case 'insertCondition':
          return {
            logicalOperator: LogicalOperator.And,
            conditions: [currentNode, operation.value],
            subGroups: [],
          };
        case 'insertGroup':
          return {
            logicalOperator: LogicalOperator.And,
            conditions: [currentNode],
            subGroups: [operation.value],
          };
        case 'updateField': {
          const updatedNode = {
            ...currentNode,
            [operation.field]: operation.value,
            valueType: operation.valueType,
          };
          // If valueType changes, clear the value to prevent type mismatch
          if (operation.field === 'operator' && currentNode.valueType !== operation.valueType) {
            return { ...updatedNode, value: '' };
          }
          if (operation.field === 'field' && operation.defaultOperator) {
            return { ...updatedNode, operator: operation.defaultOperator, value: '' };
          }
          return updatedNode;
        }
        case 'delete':
          return null;
        default:
          return currentNode;
      }
    }

    // Handle operations on group nodes
    switch (operation.kind) {
      case 'insertCondition':
        return { ...currentNode, conditions: [...currentNode.conditions, operation.value] };
      case 'insertGroup':
        return {
          ...currentNode,
          subGroups: [...(currentNode.subGroups ?? []), operation.value],
        };
      case 'updateGate':
        return { ...currentNode, logicalOperator: operation.value };
      case 'delete':
        return null;
      default:
        return currentNode;
    }
  }

  if (!isConditionGroup(currentNode)) {
    throw new Error('Invalid path: cannot descend into a condition leaf node');
  }

  const [currentIndex, ...remainingPath] = nodePath;
  const childNode = getChildNodeAt(currentNode, currentIndex);
  if (!childNode) {
    throw new Error(`Invalid path: no child node found at index ${currentIndex}`);
  }

  const updatedChild = applyTreeOperation(childNode, remainingPath, operation);

  // Handle child deletion
  if (updatedChild === null) {
    const conditionsCount = currentNode.conditions.length;
    if (currentIndex < conditionsCount) {
      // Deleting a condition
      const filteredConditions = currentNode.conditions.filter((_, i) => i !== currentIndex);
      return { ...currentNode, conditions: filteredConditions, subGroups: currentNode.subGroups };
    } else {
      // Deleting a subgroup
      const subGroupIndex = currentIndex - conditionsCount;
      const filteredSubGroups = currentNode.subGroups?.filter((_, i) => i !== subGroupIndex);
      const totalItemsRemaining = currentNode.conditions.length + (filteredSubGroups?.length ?? 0);
      const conditions =
        totalItemsRemaining === 1
          ? [
              ...currentNode.conditions,
              (operation as { defaultCondition: ICondition }).defaultCondition,
            ]
          : currentNode.conditions;
      return { ...currentNode, conditions, subGroups: filteredSubGroups };
    }
  }

  return replaceChildNodeAt(currentNode, currentIndex, updatedChild);
}

export const insertCondition = (
  treeRoot: IConditionNode,
  targetPath: number[],
  newCondition: ICondition,
): IConditionNode =>
  applyTreeOperation(treeRoot, targetPath, { kind: 'insertCondition', value: newCondition })!;

export const insertGroup = (
  treeRoot: IConditionNode,
  targetPath: number[],
  newGroup: IConditionGroup,
): IConditionNode =>
  applyTreeOperation(treeRoot, targetPath, { kind: 'insertGroup', value: newGroup })!;

export const updateAtPath = (
  treeRoot: IConditionNode,
  targetPath: number[],
  fieldName: string,
  newValue: string | number,
  newValueType?: ValueType,
  defaultOperator?: ConditionOperator,
): IConditionNode =>
  applyTreeOperation(treeRoot, targetPath, {
    kind: 'updateField',
    field: fieldName,
    value: newValue.toString(),
    valueType: newValueType ?? ValueType.String,
    defaultOperator,
  })!;

export const updateGateAtPath = (
  treeRoot: IConditionNode,
  targetPath: number[],
  newLogicalOperator: LogicalOperator,
): IConditionNode =>
  applyTreeOperation(treeRoot, targetPath, { kind: 'updateGate', value: newLogicalOperator })!;

export const deleteAtPath = (
  treeRoot: IConditionNode,
  targetPath: number[],
  defaultCondition: ICondition,
): IConditionNode | null =>
  applyTreeOperation(treeRoot, targetPath, { kind: 'delete', defaultCondition });
