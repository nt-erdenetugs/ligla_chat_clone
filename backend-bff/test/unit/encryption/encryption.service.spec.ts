import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';

import { DRIZZLE_DB } from '@/drizzle/drizzle.provider';
import { EncryptionService } from '@/modules/encryption/encryption.service';
import { createTenantTables } from '@@/drizzle/tenant/schema';

const VALID_MASTER_KEY = Buffer.from('test-encryption-master-key!!32by').toString('base64');
const ORG_ID = '00000000-0000-0000-0000-000000000001';
const dialect = new PgDialect();
const tenant = createTenantTables('test_org');

function renderSql(query: SQL<unknown>) {
  return dialect.sqlToQuery(query).sql;
}

function buildMockConfig(key: string | undefined) {
  return {
    get: jest
      .fn()
      .mockImplementation((configKey: string) =>
        configKey === 'ENCRYPTION_MASTER_KEY' ? key : undefined,
      ),
  };
}

function buildMockDb() {
  const execute = jest.fn().mockResolvedValue(undefined);
  const tx = { execute };
  const transaction = jest.fn().mockImplementation(async (callback) => await callback(tx));

  const thenFn = jest.fn().mockImplementation(async () => null);
  const whereFn = jest.fn().mockReturnValue({ then: thenFn });
  const fromFn = jest.fn().mockReturnValue({ where: whereFn });
  const selectFn = jest.fn().mockReturnValue({ from: fromFn });

  return {
    select: selectFn,
    transaction,
    __mocks: { execute, tx, transaction, selectFn, fromFn, whereFn, thenFn },
  };
}

async function createService(masterKey: string | undefined = VALID_MASTER_KEY) {
  const mockConfig = buildMockConfig(masterKey);
  const mockDb = buildMockDb();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EncryptionService,
      { provide: ConfigService, useValue: mockConfig },
      { provide: DRIZZLE_DB, useValue: mockDb },
    ],
  }).compile();

  return {
    service: module.get<EncryptionService>(EncryptionService),
    config: mockConfig as jest.Mocked<Pick<ConfigService, 'get'>>,
    db: mockDb,
  };
}

describe('EncryptionService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('initializes with a valid 32-byte base64 master key', async () => {
      const { service, config } = await createService();

      expect(service).toBeDefined();
      expect(config.get).toHaveBeenCalledWith('ENCRYPTION_MASTER_KEY');
    });

    it('throws when ENCRYPTION_MASTER_KEY is missing', () => {
      const mockConfig = buildMockConfig(undefined);
      const mockDb = buildMockDb();

      expect(() => new EncryptionService(mockConfig as any, mockDb as any)).toThrow(
        'ENCRYPTION_MASTER_KEY not configured in settings',
      );
    });

    it('throws when the decoded key length is not 32 bytes', () => {
      const shortKey = Buffer.from('too-short').toString('base64');
      const mockConfig = buildMockConfig(shortKey);
      const mockDb = buildMockDb();

      expect(() => new EncryptionService(mockConfig as any, mockDb as any)).toThrow(
        'Invalid master key format: Master key must be exactly 32 bytes (256 bits)',
      );
    });
  });

  describe('decrypt SQL helpers', () => {
    it('builds pgcrypto bytea decrypt SQL', async () => {
      const { service } = await createService();

      const query = renderSql(service.decryptColumn(tenant.chatMessage.content));

      expect(query).toContain('pgp_sym_decrypt_bytea');
      expect(query).toContain('current_setting');
      expect(query).toContain('app.organizationKey');
    });

    it('builds dual-column CASE decrypt SQL (encrypted column with plaintext fallback)', async () => {
      const { service } = await createService();

      const query = renderSql(
        service.decryptColumnStr(
          tenant.chatMessage.content,
          tenant.chatMessage.contentEncrypted,
          tenant.chatMessage.isEncrypted,
        ),
      );

      // All three columns referenced in rendered SQL
      expect(query).toContain('"content"');
      expect(query).toContain('"contentEncrypted"');
      expect(query).toContain('"isEncrypted"');

      // Structural ordering pins nesting: a swapped-branch regression must fail.
      // Outer NULL guard on contentEncrypted, then inner isEncrypted branch
      // calling pgp_sym_decrypt on the encrypted column (NOT on plaintext).
      const flat = query.replace(/\s+/g, ' ');
      expect(flat).toMatch(
        /CASE\s+WHEN\s+[^?]*"contentEncrypted"[^?]*\s+IS\s+NOT\s+NULL\s+THEN\s+CASE\s+WHEN\s+[^?]*"isEncrypted"[^?]*=\s*true\s+THEN\s+pgp_sym_decrypt/i,
      );
      // Plaintext fallback inside inner CASE: convert_from on the encrypted bytea column
      expect(flat).toMatch(/ELSE\s+convert_from\([^)]*"contentEncrypted"/i);
      // Outer ELSE casts the legacy plaintext column to text
      expect(flat).toMatch(/ELSE\s+[^?]*"content"::text/i);
    });

    it('builds pgcrypto encrypt SQL', async () => {
      const { service } = await createService();

      const query = renderSql(service.encryptValue('hello world'));

      expect(query).toContain('pgp_sym_encrypt');
      expect(query).toContain('current_setting');
      expect(query).toContain('app.organizationKey');
      expect(query).toContain('s2k-mode=0');
    });
  });

  describe('txWithOrgKey', () => {
    it('sets the derived organization key before invoking the callback', async () => {
      const { service, db } = await createService();
      const callback = jest.fn().mockResolvedValue('done');

      const result = await service.txWithOrgKey(ORG_ID, callback);

      expect(result).toBe('done');
      expect(db.__mocks.selectFn).not.toHaveBeenCalled();
      expect(db.__mocks.transaction).toHaveBeenCalledTimes(1);
      expect(db.__mocks.execute).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(db.__mocks.tx);

      const sqlText = renderSql(db.__mocks.execute.mock.calls[0][0]);
      expect(sqlText).toContain("set_config('app.organizationKey'");
    });

    it('reuses the same org id without organization lookups', async () => {
      const { service, db } = await createService();

      await service.txWithOrgKey(ORG_ID, async () => 'first');
      await service.txWithOrgKey(ORG_ID, async () => 'second');

      expect(db.__mocks.selectFn).not.toHaveBeenCalled();
      expect(db.__mocks.transaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('deriveOrgKey', () => {
    it('returns the same key for the same organization id', async () => {
      const { service } = await createService();

      const keyA = service['deriveOrgKey'](ORG_ID);
      const keyB = service['deriveOrgKey'](ORG_ID);

      expect(keyA).toBe(keyB);
    });

    it('returns different keys for different organizations', async () => {
      const { service } = await createService();

      const keyA = service['deriveOrgKey']('org-alpha');
      const keyB = service['deriveOrgKey']('org-beta');

      expect(keyA).not.toBe(keyB);
    });

    it('accepts any non-null organization identifier string', async () => {
      const { service } = await createService();

      expect(service['deriveOrgKey']('   ')).toBeDefined();
    });
  });
});
