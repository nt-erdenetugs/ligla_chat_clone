import { registerEnumType } from '@nestjs/graphql';

export enum ChatTeamAssignActionsType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
}

registerEnumType(ChatTeamAssignActionsType, {
  name: 'ChatTeamAssignActionsType',
});
