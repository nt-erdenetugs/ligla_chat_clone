export function uuidToSchemaName(uuid: string): string {
  return `org_${uuid.replace(/-/g, '').toLowerCase()}`;
}
