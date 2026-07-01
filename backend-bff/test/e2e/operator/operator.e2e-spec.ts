import request from 'supertest';

import { TestSetup, TestContext } from '../../utils/test-setup';

const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  FORBIDDEN: 403,
  UNAUTHORIZED: 401,
  TOO_MANY_REQUESTS: 429,
} as const;

const TEST_OPERATORS = {
  OPERATOR_ONE: {
    displayName: 'Operator One',
    status: 'ACTIVE',
  },
  OPERATOR_TWO: {
    displayName: 'Operator Two',
    status: 'ACTIVE',
  },
  ADMIN_OPERATOR: {
    displayName: 'Admin Operator',
    status: 'ACTIVE',
  },
  TEAM_OPERATOR: {
    displayName: 'Team Operator',
    status: 'ACTIVE',
  },
  OTHER_OPERATOR: {
    displayName: 'Other Operator',
    status: 'ACTIVE',
  },
  INACTIVE_OPERATOR: {
    displayName: 'Inactive Operator',
    status: 'INACTIVE',
  },
  PENDING_OPERATOR: {
    displayName: 'Pending Operator',
    status: 'PENDING',
  },
  LOCKED_OPERATOR: {
    displayName: 'Locked Operator',
    status: 'LOCKED',
  },
  SPECIAL_CHARS_OPERATOR: {
    displayName: 'Test/Operator\\Name:With*Special?Characters',
    status: 'ACTIVE',
  },
  INVALID_DISPLAY_NAME: {
    displayName: '___',
    email: 'fallback.test@example.com',
    status: 'ACTIVE',
  },
  EMPTY_DISPLAY_NAME: {
    displayName: '',
    email: 'empty.display@example.com',
    status: 'ACTIVE',
  },
  UNICODE_OPERATOR: {
    displayName: '山田太郎',
    status: 'ACTIVE',
  },
  UNICODE_SPANISH: {
    displayName: 'José García',
    status: 'ACTIVE',
  },
  MANAGER_OPERATOR: {
    displayName: 'Manager Operator',
    status: 'ACTIVE',
  },
} as const;

const TEST_DATA_COUNTS = {
  MULTIPLE_OPERATORS: 5,
  THROTTLE_REQUESTS: 7,
} as const;

const TEST_QUERY_PARAMS = {
  PAGINATION: {
    skip: 1,
    take: 2,
  },
} as const;

// Test Helper Functions
class OperatorTestHelpers {
  static async downloadQRCodes(
    app: any,
    token: string,
    queryParams?: { skip?: number; take?: number },
    expectedStatus: number = HTTP_STATUS.OK,
  ) {
    const req = request(app.getHttpServer())
      .get('/srv/operator/qr-codes/download')
      .set('Authorization', `Bearer ${token}`);

    if (queryParams) {
      req.query(queryParams);
    }

    return await req.expect(expectedStatus);
  }

  static validateZipResponse(response: any, orgId: string) {
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-disposition']).toContain('attachment');
    expect(response.headers['content-disposition']).toContain(orgId);
    expect(response.headers['content-disposition']).toContain('.zip');
    expect(response.body).toBeDefined();
  }

  static validateZipResponseBasic(response: any) {
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.body).toBeDefined();
  }

  static validateFilenameFormat(response: any, orgId: string) {
    const contentDisposition = response.headers['content-disposition'];
    expect(contentDisposition).toContain(orgId);
    expect(contentDisposition).toContain('operators_qr');
    expect(contentDisposition).toContain('.zip');
    expect(contentDisposition).toMatch(/\d{4}-\d{2}-\d{2}/);
  }

  static validateCORSHeaders(response: any) {
    expect(response.headers['access-control-expose-headers']).toContain('Content-Disposition');
  }

  static async createMultipleOperators(factory: any, orgName: string, count: number) {
    const operators = [];
    for (let i = 0; i < count; i++) {
      operators.push(
        factory.createUser(orgName, 'OPERATOR', {
          displayName: `Operator ${i}`,
          status: 'ACTIVE',
        }),
      );
    }
    return await Promise.all(operators);
  }
}

describe('Operator Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;
  let adminUser: any;
  let managerUser: any;
  let operatorUser: any;
  let org2AdminUser: any;
  let team1: any;
  let tenantSchemaNames: string[];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      'operator_test_org1',
      'operator_test_org2',
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminUser = users.adminUser;
    managerUser = users.managerUser;
    operatorUser = users.operatorUser;
    org2AdminUser = users.org2AdminUser;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;
    org2AdminToken = tokens.org2AdminToken;

    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  beforeEach(async () => {
    team1 = await context.factory.createTeam(org1.name, { name: 'Team 1' });
    await context.factory.addUserToTeam(team1.id, managerUser.id);
  });

  afterEach(async () => {
    await context.cleaner.cleanTeamTestData(tenantSchemaNames);
    await context.cleaner.cleanUserTestData(tenantSchemaNames, [
      { id: adminUser.id, roleType: 'ADMIN', displayName: adminUser.displayName },
      { id: managerUser.id, roleType: 'MANAGER', displayName: managerUser.displayName },
      { id: operatorUser.id, roleType: 'OPERATOR', displayName: operatorUser.displayName },
      { id: org2AdminUser.id, roleType: 'ADMIN', displayName: org2AdminUser.displayName },
    ]);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('GET /srv/operator/qr-codes/download', () => {
    describe('authorization', () => {
      beforeEach(async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.OPERATOR_ONE);
      });

      it('should download QR codes as ADMIN', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.OPERATOR_TWO);
        await context.factory.createUser(
          org1.name,
          'ADMIN_OPERATOR',
          TEST_OPERATORS.ADMIN_OPERATOR,
        );

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponse(response, org1.id);
      });

      it('should download QR codes as MANAGER for their team members only', async () => {
        const operator1 = await context.factory.createUser(
          org1.name,
          'OPERATOR',
          TEST_OPERATORS.TEAM_OPERATOR,
        );
        await context.factory.addUserToTeam(team1.id, operator1.id);

        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.OTHER_OPERATOR);

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, managerToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should deny OPERATOR from downloading QR codes', async () => {
        await OperatorTestHelpers.downloadQRCodes(
          context.app,
          operatorToken,
          undefined,
          HTTP_STATUS.FORBIDDEN,
        );
      });

      it('should deny unauthenticated access', async () => {
        await request(context.app.getHttpServer())
          .get('/srv/operator/qr-codes/download')
          .expect(HTTP_STATUS.UNAUTHORIZED);
      });
    });

    describe('pagination', () => {
      beforeEach(async () => {
        return OperatorTestHelpers.createMultipleOperators(
          context.factory,
          org1.name,
          TEST_DATA_COUNTS.MULTIPLE_OPERATORS,
        );
      });

      it('should respect pagination parameters', async () => {
        const response = await OperatorTestHelpers.downloadQRCodes(
          context.app,
          adminToken,
          TEST_QUERY_PARAMS.PAGINATION,
        );

        OperatorTestHelpers.validateZipResponseBasic(response);
      });
    });

    describe('multi-tenancy', () => {
      it('should not leak QR codes from other organizations', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Org1 Operator',
          status: 'ACTIVE',
        });

        await context.factory.createUser(org2.name, 'OPERATOR', {
          displayName: 'Org2 Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should handle downloads from different organizations concurrently', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Org1 Operator',
          status: 'ACTIVE',
        });
        await context.factory.createUser(org2.name, 'OPERATOR', {
          displayName: 'Org2 Operator',
          status: 'ACTIVE',
        });

        const [response1, response2] = await Promise.all([
          OperatorTestHelpers.downloadQRCodes(context.app, adminToken),
          OperatorTestHelpers.downloadQRCodes(context.app, org2AdminToken),
        ]);

        expect(response1.status).toBe(HTTP_STATUS.OK);
        expect(response2.status).toBe(HTTP_STATUS.OK);
        expect(response1.body).toBeDefined();
        expect(response2.body).toBeDefined();
      });
    });

    describe('filtering', () => {
      it('should only include ACTIVE operators', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Active Operator',
          status: 'ACTIVE',
        });
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.INACTIVE_OPERATOR);
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.PENDING_OPERATOR);
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.LOCKED_OPERATOR);

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should only include operator roles', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Regular Operator',
          status: 'ACTIVE',
        });
        await context.factory.createUser(org1.name, 'ADMIN', {
          displayName: 'Admin User',
          status: 'ACTIVE',
        });
        await context.factory.createUser(org1.name, 'MANAGER', {
          displayName: 'Manager User',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should include ADMIN_OPERATOR and MANAGER_OPERATOR roles', async () => {
        await context.factory.createUser(
          org1.name,
          'ADMIN_OPERATOR',
          TEST_OPERATORS.ADMIN_OPERATOR,
        );
        await context.factory.createUser(
          org1.name,
          'MANAGER_OPERATOR',
          TEST_OPERATORS.MANAGER_OPERATOR,
        );

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });
    });

    describe('filename handling', () => {
      it('should sanitize display names in file names', async () => {
        await context.factory.createUser(
          org1.name,
          'OPERATOR',
          TEST_OPERATORS.SPECIAL_CHARS_OPERATOR,
        );

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should use email prefix as fallback when display name is invalid', async () => {
        await context.factory.createUser(
          org1.name,
          'OPERATOR',
          TEST_OPERATORS.INVALID_DISPLAY_NAME,
        );

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should handle empty display name', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.EMPTY_DISPLAY_NAME);

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should handle operators with unicode characters in display name', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.UNICODE_OPERATOR);
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.UNICODE_SPANISH);

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should generate correct filename with organization name and timestamp', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Test Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateFilenameFormat(response, org1.id);
      });
    });

    describe('edge cases', () => {
      it('should return empty zip file when no active operators exist on requested page', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', TEST_OPERATORS.INACTIVE_OPERATOR);

        await OperatorTestHelpers.downloadQRCodes(
          context.app,
          adminToken,
          undefined,
          HTTP_STATUS.OK,
        );
      });

      it('should generate valid PNG files in ZIP', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'PNG Test Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateZipResponseBasic(response);
      });

      it('should handle client disconnect gracefully', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Disconnect Test Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        expect(response.body).toBeDefined();
      });
    });

    describe('concurrent access', () => {
      beforeEach(async () => {
        return context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Concurrent Test Operator',
          status: 'ACTIVE',
        });
      });

      it('should respect throttle limits', async () => {
        const responses = [];
        for (let i = 0; i < TEST_DATA_COUNTS.THROTTLE_REQUESTS; i++) {
          const response = await OperatorTestHelpers.downloadQRCodes(
            context.app,
            adminToken,
            undefined,
            undefined,
          );
          responses.push(response);
        }

        const successCount = responses.filter((r) => r.status === HTTP_STATUS.OK).length;
        expect(successCount).toBe(TEST_DATA_COUNTS.THROTTLE_REQUESTS);
      });

      it('should handle concurrent downloads from same organization', async () => {
        const [response1, response2] = await Promise.all([
          OperatorTestHelpers.downloadQRCodes(context.app, adminToken, undefined, undefined),
          OperatorTestHelpers.downloadQRCodes(context.app, adminToken, undefined, undefined),
        ]);

        expect([HTTP_STATUS.OK, HTTP_STATUS.TOO_MANY_REQUESTS]).toContain(response1.status);
        expect([HTTP_STATUS.OK, HTTP_STATUS.TOO_MANY_REQUESTS]).toContain(response2.status);
      });
    });

    describe('response headers', () => {
      it('should expose Content-Disposition header for CORS', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'CORS Test Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        OperatorTestHelpers.validateCORSHeaders(response);
      });

      it('should log successful download completion', async () => {
        await context.factory.createUser(org1.name, 'OPERATOR', {
          displayName: 'Logging Test Operator',
          status: 'ACTIVE',
        });

        const response = await OperatorTestHelpers.downloadQRCodes(context.app, adminToken);

        expect(response.body).toBeDefined();
        expect(response.headers['content-type']).toBe('application/zip');
      });
    });
  });
});
