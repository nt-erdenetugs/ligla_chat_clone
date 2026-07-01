import { readFileSync, writeFileSync, rmSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { globSync } from 'glob';

const SCHEMA_PATH = join(__dirname, '../drizzle/raw/schema.ts');
const PUBLIC_SCHEMA_PATH = join(__dirname, '../drizzle/public/schema.ts');
const TENANT_SCHEMA_PATH = join(__dirname, '../drizzle/tenant/schema.ts');
const ENUMS_PATH = join(__dirname, '../drizzle/enums.ts');

const PUBLIC_TABLES = new Set([
  'hypervisorUser',
  'organization',
  'organizationMigration',
  'auth',
  'userPasswordResetToken',
]);

// TODO(JIRA-922): after the cleanup release renames *Encrypted -> original,
// these become the original column names — revisit the bytea forcing below.
const ENCRYPTED_COLUMNS = {
  chatMessage: 'contentEncrypted',
  note: 'noteValueEncrypted',
  chatAttributeValue: 'valueEncrypted',
} as const;

const TENANT_TABLES = new Set([
  'organizationSettings',
  'chatUserRead',
  'store',
  'team',
  'teamSetting',
  'teamChatSetting',
  'storeTeam',
  'user',
  'userTeam',
  'pushSubscription',
  'note',
  'attribute',
  'selectOption',
  'chatAttributeValueSelectOption',
  'chatAttributeValue',
  'tags',
  'chatTags',
  'chat',
  'chatFile',
  'endUser',
  'chatMessage',
  'chatTeamAssignment',
  'chatActivity',
  'surveyData',
  'chatReplyMessageTemplate',
  'memberFeedData',
  'chatAssignRule',
  'chatAssignRuleTargetTeam',
  'chatAssignFilterGroupClosure',
  'chatAssignFilterGroup',
  'chatAssignFilterGroupItem',
  'chatAssignFilter',
  'chatAssignConditionGroupClosure',
  'chatAssignConditionGroup',
  'chatAssignCondition',
]);

function cleanupGeneratedFiles() {
  console.log('🧹 Cleaning up generated SQL files and meta directory...');
  const drizzleDir = join(__dirname, '../drizzle');
  const rawDir = join(__dirname, '../drizzle/raw');

  const metaDir = join(drizzleDir, 'meta');
  if (existsSync(metaDir)) {
    rmSync(metaDir, { recursive: true, force: true });
    console.log('  ✏️  Removed meta directory');
  }

  const rawMetaDir = join(rawDir, 'meta');
  if (existsSync(rawMetaDir)) {
    rmSync(rawMetaDir, { recursive: true, force: true });
    console.log('  ✏️  Removed raw meta directory');
  }

  // Remove relations.ts if it exists (no longer needed)
  const relationsPath = join(rawDir, 'relations.ts');
  if (existsSync(relationsPath)) {
    rmSync(relationsPath, { force: true });
    console.log('  ✏️  Removed relations.ts (no longer needed)');
  }

  const sqlFiles = globSync(join(drizzleDir, '*.sql'));
  const rawSqlFiles = globSync(join(rawDir, '*.sql'));
  [...sqlFiles, ...rawSqlFiles].forEach((file) => {
    rmSync(file, { force: true });
    console.log(`  ✏️  Removed ${file}`);
  });

  if (
    sqlFiles.length === 0 &&
    rawSqlFiles.length === 0 &&
    !existsSync(metaDir) &&
    !existsSync(rawMetaDir)
  ) {
    console.log('  ℹ️  No files to clean up');
  } else {
    console.log('✅ Cleanup complete');
  }
}

function fixTimestampModes(): number {
  console.log('🔧 Fixing timestamp modes from string to date...');
  let schema = readFileSync(SCHEMA_PATH, 'utf-8');
  let fixCount = 0;

  // Fix timestamp with timezone: mode: 'string' -> mode: 'date'
  const timestampTzRegex = /timestamp\(\{[^}]*withTimezone:\s*true[^}]*mode:\s*'string'[^}]*\}/g;
  schema = schema.replace(timestampTzRegex, (match) => {
    fixCount++;
    return match.replace(/mode:\s*'string'/, "mode: 'date'");
  });

  // Fix timestamp without timezone: mode: 'string' -> mode: 'date'
  const timestampNoTzRegex = /timestamp\(\{[^}]*(?!withTimezone)[^}]*mode:\s*'string'[^}]*\}/g;
  schema = schema.replace(timestampNoTzRegex, (match) => {
    // Only if it doesn't have withTimezone (already handled above)
    if (!match.includes('withTimezone:')) {
      fixCount++;
      return match.replace(/mode:\s*'string'/, "mode: 'date'");
    }
    return match;
  });

  if (fixCount > 0) {
    writeFileSync(SCHEMA_PATH, schema, 'utf-8');
    console.log(`✅ Fixed ${fixCount} timestamp mode(s) to 'date'`);
  } else {
    console.log('✅ No timestamp modes to fix');
  }

  return fixCount;
}

function fixMalformedDefaults(): number {
  console.log('🔧 Fixing malformed column defaults...');
  let schema = readFileSync(SCHEMA_PATH, 'utf-8');
  let fixCount = 0;

  // Fix broken default values like varchar().default(').notNull() -> varchar().notNull()
  const brokenDefaultRegex = /\.default\('\)\.notNull\(\)/g;
  if (brokenDefaultRegex.test(schema)) {
    schema = schema.replace(brokenDefaultRegex, '.notNull()');
    fixCount++;
    console.log('  ✓ Fixed broken varchar default in organization.apiKey');
  }

  if (fixCount > 0) {
    writeFileSync(SCHEMA_PATH, schema, 'utf-8');
    console.log(`✅ Fixed ${fixCount} malformed default(s)`);
  } else {
    console.log('✅ No malformed defaults found');
  }

  return fixCount;
}

function ensureImportLine(schema: string, importLine: string): string {
  if (schema.includes(importLine)) {
    return schema;
  }

  const lines = schema.split('\n');
  const firstNonImportLineIndex = lines.findIndex((line) => !line.startsWith('import '));
  const insertIndex = firstNonImportLineIndex === -1 ? lines.length : firstNonImportLineIndex;
  lines.splice(insertIndex, 0, importLine);
  return lines.join('\n');
}

function stripByteaParseTodos(schema: string): string {
  return schema.replace(/\n\s*\/\/ TODO: failed to parse database type 'bytea'/g, '');
}

function ensureTenantByteaImport(schema: string): string {
  return ensureImportLine(schema, 'import { bytea } from "../types"');
}

function fixRawByteaColumns(): number {
  console.log('🔧 Fixing bytea columns in raw schema...');
  let schema = readFileSync(SCHEMA_PATH, 'utf-8');

  schema = ensureImportLine(schema, 'import { bytea } from "../types"');
  schema = stripByteaParseTodos(schema);

  // Only the *Encrypted columns are BYTEA in the expand/contract design.
  // The original plaintext columns (content / noteValue / value) stay as
  // JSONB / TEXT / VARCHAR — old BFF code paths and the introspection both
  // see them at their pre-encryption types. Drizzle introspection emits
  // `unknown(...)` for the new BYTEA columns (it can't introspect bytea on
  // its own), so we replace those lines explicitly.
  const replacements: Array<{ regex: RegExp; replacement: string }> = (
    Object.entries(ENCRYPTED_COLUMNS) as Array<[keyof typeof ENCRYPTED_COLUMNS, string]>
  ).map(([table, column]) => ({
    regex: new RegExp(
      `(export const ${table}InTenant_template = tenant_template\\.table\\("${table}", \\{[\\s\\S]*?\\n\\s*)${column}:\\s*[^\\n]+,`,
    ),
    replacement: `$1${column}: bytea("${column}"),`,
  }));

  let fixCount = 0;
  for (const { regex, replacement } of replacements) {
    const before = schema;
    schema = schema.replace(regex, replacement);
    if (schema !== before) {
      fixCount++;
    }
  }

  writeFileSync(SCHEMA_PATH, schema, 'utf-8');
  console.log(`✅ Fixed ${fixCount} bytea column block(s) in raw schema`);
  return fixCount;
}

function replaceTenantColumnWithBytea(
  schema: string,
  tableVarName: string,
  columnName: string,
  replacementLine: string,
): string {
  const tableStartToken = `const ${tableVarName} = s.table("`;
  const tableStartIndex = schema.indexOf(tableStartToken);
  if (tableStartIndex === -1) {
    return schema;
  }

  const columnsStartIndex = schema.indexOf('{', tableStartIndex);
  const columnsEndIndex = schema.indexOf('}, (table) => [', columnsStartIndex);
  if (columnsStartIndex === -1 || columnsEndIndex === -1) {
    return schema;
  }

  const tableColumnsBlock = schema.slice(columnsStartIndex, columnsEndIndex);
  const columnLineRegex = new RegExp(`(\\n\\s*)${columnName}:\\s*[^\\n]+,`);
  const updatedColumnsBlock = tableColumnsBlock.replace(columnLineRegex, `$1${replacementLine}`);

  return schema.slice(0, columnsStartIndex) + updatedColumnsBlock + schema.slice(columnsEndIndex);
}

function fixTenantByteaColumns(schema: string): string {
  let updated = ensureTenantByteaImport(schema);
  for (const [table, column] of Object.entries(ENCRYPTED_COLUMNS)) {
    updated = replaceTenantColumnWithBytea(
      updated,
      table,
      column,
      `${column}: bytea("${column}"),`,
    );
  }
  return stripByteaParseTodos(updated);
}

function writeEnumsFile(): void {
  console.log('📝 Writing enums file...');
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const enumRegex =
    /export const (\w+) = (pgEnum|tenant_template\.enum)\("([^"]+)", (\[[\s\S]*?\])\)/g;

  const enums = new Map<
    string,
    { varName: string; dbName: string; values: string; source: string }
  >();
  let match: RegExpExecArray | null = null;
  while ((match = enumRegex.exec(schema)) !== null) {
    const [, rawVarName, source, dbName, values] = match;
    const varName = rawVarName.replace(/InTenant_template\b/g, '');
    const existing = enums.get(varName);

    if (!existing || source === 'pgEnum') {
      enums.set(varName, { varName, dbName, values, source });
    }
  }

  if (enums.size === 0) {
    throw new Error('No enums found in schema');
  }

  const lines = [
    'import { pgEnum } from "drizzle-orm/pg-core"',
    '',
    ...Array.from(enums.values()).map(
      ({ varName, dbName, values }) => `export const ${varName} = pgEnum("${dbName}", ${values})`,
    ),
    '',
  ];

  writeFileSync(ENUMS_PATH, lines.join('\n'), 'utf-8');
  console.log(`✅ Wrote ${enums.size} enum(s) to enums.ts`);
}

function splitSchema(): void {
  console.log('📝 Splitting schema into public and tenant files...');
  mkdirSync(join(__dirname, '../drizzle/public'), { recursive: true });
  mkdirSync(join(__dirname, '../drizzle/tenant'), { recursive: true });
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  const importLines = schema.match(/^import\s+.*$/gm) || [];
  const pgCoreImport = importLines.find((line) => line.includes('drizzle-orm/pg-core'));
  const otherImports = importLines.filter(
    (line) => line !== pgCoreImport && !line.includes('../types'),
  );

  if (!pgCoreImport) {
    throw new Error('Missing drizzle-orm/pg-core import in schema');
  }

  const publicEnumBlocks = schema.match(/export const \w+ = pgEnum\([\s\S]*?\)\n?/g) || [];
  const tenantEnumBlocks =
    schema.match(/export const \w+ = tenant_template\.enum\([\s\S]*?\)\n?/g) || [];

  const publicTableRegex =
    /export const (\w+) = pgTable\("([^"]+)", \{[\s\S]*?\}\s*(?:, \(table\) => \[[\s\S]*?\])?\);/g;
  const tenantTableRegex =
    /export const (\w+) = tenant_template\.table\("([^"]+)", \{[\s\S]*?\}\s*(?:, \(table\) => \[[\s\S]*?\])?\);/g;

  const publicTables: string[] = [];
  const tenantTables: string[] = [];

  let match: RegExpExecArray | null = null;
  while ((match = publicTableRegex.exec(schema)) !== null) {
    const [, _tableVar, tableName] = match;
    const block = match[0];

    if (PUBLIC_TABLES.has(tableName)) {
      publicTables.push(block);
    }
  }

  let tenantMatch: RegExpExecArray | null = null;
  while ((tenantMatch = tenantTableRegex.exec(schema)) !== null) {
    const [, _tableVar, tableName] = tenantMatch;
    const block = tenantMatch[0];

    if (TENANT_TABLES.has(tableName)) {
      tenantTables.push(block);
    }
  }

  if (publicTables.length === 0) {
    throw new Error('No public tables found in schema');
  }

  if (tenantTables.length === 0) {
    throw new Error('No tenant tables found in schema');
  }

  const publicOutput = [
    pgCoreImport,
    ...otherImports,
    '',
    ...publicEnumBlocks,
    '',
    ...publicTables,
    '',
  ].join('\n');

  const pgCoreNamesMatch = pgCoreImport.match(/\{([^}]*)\}/);
  const pgCoreNames = pgCoreNamesMatch
    ? pgCoreNamesMatch[1]
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
    : [];

  const filteredPgCoreNames = pgCoreNames
    .filter((name) => name !== 'pgTable' && name !== 'pgEnum')
    .concat(['pgSchema']);
  const uniquePgCoreNames = Array.from(new Set(filteredPgCoreNames));
  const tenantPgCoreImport = `import { ${uniquePgCoreNames.join(', ')} } from "drizzle-orm/pg-core"`;

  const tenantEnums = tenantEnumBlocks
    .join('\n')
    .replace(/export const /g, 'const ')
    .replace(/tenant_template\./g, 's.')
    .replace(/InTenant_template\b/g, '')
    .replace(/\bpgEnum\b/g, 's.enum');

  const tenantTablesBody = tenantTables
    .join('\n')
    .replace(/export const /g, 'const ')
    .replace(/tenant_template\./g, 's.')
    .replace(/InTenant_template\b/g, '')
    .replace(/\bpgTable\b/g, 's.table');
  const tenantTablesBodyWithoutPublicFks = tenantTablesBody
    .replace(/const \w+ = pgTable\([\s\S]*?\);\n?/g, '')
    .replace(/const \w+ = s\.table\("alembic_version"[\s\S]*?\);\n?/g, '')
    .replace(/const alembic_version = [\s\S]*?\);\n?/g, '');

  const publicTableVars = Array.from(PUBLIC_TABLES);
  const usedPublicTables = publicTableVars.filter((tableVar) =>
    tenantTablesBodyWithoutPublicFks.includes(`${tableVar}.`),
  );

  const tenantPublicImports =
    usedPublicTables.length > 0
      ? `import { ${usedPublicTables.join(', ')} } from "../public/schema"`
      : '';

  const tenantTableMatches = Array.from(
    tenantTablesBodyWithoutPublicFks.matchAll(/const (\w+) = s\.table\(/g),
  );
  const tenantTableNames = tenantTableMatches.map((tableMatch) => tableMatch[1]);

  const tenantBodyLines = [tenantEnums, tenantTablesBodyWithoutPublicFks]
    .filter((block) => block.length > 0)
    .join('\n')
    .split('\n')
    .map((line) => (line.length > 0 ? `  ${line}` : line));

  const tenantReturnLines = tenantTableNames.map((name) => `    ${name},`);

  let tenantOutput = [
    tenantPgCoreImport,
    ...(tenantPublicImports ? [tenantPublicImports] : []),
    ...otherImports,
    '',
    'export function createTenantTables(schemaName: string) {',
    '  const s = pgSchema(schemaName);',
    '',
    ...tenantBodyLines,
    '',
    '  return {',
    ...tenantReturnLines,
    '  };',
    '}',
    '',
    'export type TenantTables = ReturnType<typeof createTenantTables>;',
    '',
  ]
    .join('\n')
    .replace(/\n?\s*const alembic_version = [\s\S]*?\);\n?/g, '\n');

  tenantOutput = fixTenantByteaColumns(tenantOutput);

  writeFileSync(PUBLIC_SCHEMA_PATH, publicOutput, 'utf-8');
  writeFileSync(TENANT_SCHEMA_PATH, tenantOutput, 'utf-8');

  console.log(
    `✅ Wrote ${publicTables.length} public table(s) and ${tenantTables.length} tenant table(s)`,
  );
}

try {
  console.log('🚀 Starting post-introspect processing...\n');

  fixTimestampModes();
  fixMalformedDefaults();
  fixRawByteaColumns();
  writeEnumsFile();
  splitSchema();
  cleanupGeneratedFiles();

  console.log('\n✅ Post-introspect processing completed successfully');
} catch (error) {
  console.error('❌ Error in post-introspect script:', error);
  process.exit(1);
}
