import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

import { NESTED_GROUP_MAX_DEPTH } from '@/modules/chat-assignment-rule/constants';

interface NestedGroup {
  subGroups?: NestedGroup[];
}

@ValidatorConstraint({ name: 'isValidNestedDepth', async: false })
export class NestedDepthValidator implements ValidatorConstraintInterface {
  private calculateDepth(group: NestedGroup, currentDepth = 0): number {
    if (!group.subGroups || group.subGroups.length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;
    for (const subGroup of group.subGroups) {
      const depth = this.calculateDepth(subGroup, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  validate(value: NestedGroup): boolean {
    if (!value) {
      return true;
    }

    const maxDepth = this.calculateDepth(value, 0);
    return maxDepth <= NESTED_GROUP_MAX_DEPTH;
  }

  defaultMessage(): string {
    return `Maximum nesting depth of ${NESTED_GROUP_MAX_DEPTH} has been exceeded.`;
  }
}

export function IsValidNestedDepth(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidNestedDepth',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: NestedDepthValidator,
    });
  };
}
