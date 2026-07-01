import { NotFoundException, ForbiddenException } from '@nestjs/common';

import { I18nService } from 'nestjs-i18n';

interface EntityWithOrg {
  organizationName: string;
}

export const validateEntityByOrganization = <T extends EntityWithOrg>(
  entity: Nullish<T>,
  options: {
    entityId: string;
    entityName: string;
    organizationName: string;
  },
  i18n: I18nService,
): T => {
  const { entityId, entityName, organizationName } = options;

  if (!entity) {
    throw new NotFoundException(
      i18n.t('errors.exception.entityNotFound', { args: { entityName, entityId } }),
    );
  }

  if (entity.organizationName !== organizationName) {
    throw new ForbiddenException(
      i18n.t('errors.exception.forbiddenEntityAccess', { args: { entityName } }),
    );
  }

  return entity;
};
