import { ORGANIZATION_QUERIES } from '../../fixtures/graphql/organization.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  ALREADY_EXISTS: 'already exists',
  NOT_FOUND: 'not found',
  VALIDATION_FAILED: 'Validation failed for organization',
  NAME_TOO_SHORT: 'name must be longer than or equal to 1 characters',
  INVALID_MAX_OPERATOR: 'maxOperator must not be less than 1',
  INVALID_FILTER_FIELD: 'invalidFilterField',
  NON_ADMIN_USERS: 'not assigned the admin privileges',
  MAX_OPERATOR_LESS_THAN_CURRENT: 'current operator count',
  USERS_BELONG_TO_OTHER_ORG: 'belong',
  MAX_OPERATOR_LIMIT_EXCEEDED: 'exceed',
} as const;

const TEST_ORGANIZATIONS = {
  BASIC: {
    name: 'test_org_new',
    displayName: 'Test Organization',
    description: 'Test description',
    maxOperator: 10,
    loginLiffId: 'test-liff-id',
    fileUploadLiffId: 'upload-liff-id',
    apiKey: 'test-api-key-12345',
  },
  WITH_OPTIONAL: {
    name: 'test_org_optional',
    displayName: 'Optional Test',
    maxOperator: 5,
    loginLiffId: 'test-liff-id-2',
    fileUploadLiffId: 'upload-liff-id-2',
    apiKey: 'test-api-key-67890',
    emails: ['test1@example.com', 'test2@example.com'],
  },
  FILTER_ALPHA: {
    name: 'org_filter_alpha',
    displayName: 'Alpha Organization',
    description: 'This is for alpha testing',
  },
  FILTER_BETA: {
    name: 'org_filter_beta',
    displayName: 'Beta Organization',
    description: 'This is for beta testing',
  },
  FILTER_GAMMA: {
    name: 'org_filter_gamma',
    displayName: 'Gamma Organization',
    description: 'Production ready organization',
    loginLiffId: 'unique-liff-gamma',
  },
} as const;

// Test Helper Functions
class OrganizationTestHelpers {
  static createOrganizationInput(overrides: any = {}) {
    return {
      name: 'test_org_helper',
      displayName: 'Helper Test Org',
      description: 'Helper description',
      maxOperator: 10,
      loginLiffId: 'helper-liff-id',
      fileUploadLiffId: '1234567890-upload',
      apiKey: 'helper-api-key',
      ...overrides,
    };
  }

  static updateOrganizationInput(name: string, overrides: any = {}) {
    return {
      name,
      displayName: 'Updated Organization',
      description: 'Updated description',
      ...overrides,
    };
  }

  static validateOrganizationList(response: any, expectedMinCount: number = 0) {
    expect(response.organizations.items).toBeInstanceOf(Array);
    expect(typeof response.organizations.count).toBe('number');
    expect(response.organizations.count).toBeGreaterThanOrEqual(expectedMinCount);
    expect(response.organizations.items.length).toBeLessThanOrEqual(response.organizations.count);
  }
}

describe('Organization Module (E2E)', () => {
  let context: TestContext;
  let hypervisorToken: string;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org1: any;
  let runId: string;
  let baselineUsers: { id: string; roleType: string; displayName: string }[] = [];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();

    runId = Date.now().toString(36);

    await context.factory.createHypervisorUser({ email: `hypervisor@org-${runId}.test` });
    hypervisorToken = await context.authHelper.getHypervisorToken();

    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      `org_test_1_${runId}`,
      `org_test_2_${runId}`,
    );

    org1 = organizations.org1;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;

    baselineUsers = [
      {
        id: users.adminUser.id,
        roleType: 'ADMIN',
        displayName: users.adminUser.displayName,
      },
      {
        id: users.managerUser.id,
        roleType: 'MANAGER',
        displayName: users.managerUser.displayName,
      },
      {
        id: users.operatorUser.id,
        roleType: 'OPERATOR',
        displayName: users.operatorUser.displayName,
      },
      {
        id: users.org2AdminUser.id,
        roleType: 'ADMIN',
        displayName: users.org2AdminUser.displayName,
      },
    ];
  });

  beforeEach(async () => {
    await context.cleaner.cleanOrganizationTestData(baselineUsers);
    await context.cleaner.cleanOrganizationsExcept([org1.name, `org_test_2_${runId}`]);
  });

  afterEach(async () => {
    await context.cleaner.cleanOrganizationTestData(baselineUsers);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('createOrganization', () => {
    describe('authorization', () => {
      it('should allow HYPERVISOR to create organization', async () => {
        const createdOrgName = `${TEST_ORGANIZATIONS.BASIC.name}_${runId}`;
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          {
            createOrganizationInput: {
              ...TEST_ORGANIZATIONS.BASIC,
              name: createdOrgName,
            },
          },
          hypervisorToken,
        );

        // Validate organization structure and fields
        TestValidators.validateOrganization(response.createOrganization, {
          name: createdOrgName,
          displayName: TEST_ORGANIZATIONS.BASIC.displayName,
          description: TEST_ORGANIZATIONS.BASIC.description,
          maxOperator: TEST_ORGANIZATIONS.BASIC.maxOperator,
          isActive: true,
          loginLiffId: TEST_ORGANIZATIONS.BASIC.loginLiffId,
        });

        // Validate specific field values
        expect(response.createOrganization.apiKey).toBe(TEST_ORGANIZATIONS.BASIC.apiKey);
        expect(response.createOrganization.operatorCount).toBe(0);

        const schemaName = await context.factory.getTenantSchemaNameForOrganization(createdOrgName);
        expect(await context.factory.schemaExists(schemaName)).toBe(true);
        expect(await context.factory.tableExistsInSchema(schemaName, 'chat')).toBe(true);
      });

      it('should deny ADMIN from creating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { createOrganizationInput: TEST_ORGANIZATIONS.BASIC },
          adminToken,
        );
      });

      it('should deny MANAGER from creating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { createOrganizationInput: TEST_ORGANIZATIONS.BASIC },
          managerToken,
        );
      });

      it('should deny OPERATOR from creating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { createOrganizationInput: TEST_ORGANIZATIONS.BASIC },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.UNAUTHORIZED,
          { createOrganizationInput: TEST_ORGANIZATIONS.BASIC },
        );
      });
    });

    describe('validation', () => {
      it('should create organization with optional fields', async () => {
        const optionalOrgName = `${TEST_ORGANIZATIONS.WITH_OPTIONAL.name}_${runId}`;
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          {
            createOrganizationInput: {
              ...TEST_ORGANIZATIONS.WITH_OPTIONAL,
              name: optionalOrgName,
            },
          },
          hypervisorToken,
        );

        TestValidators.validateOrganization(response.createOrganization, {
          name: optionalOrgName,
          displayName: TEST_ORGANIZATIONS.WITH_OPTIONAL.displayName,
          maxOperator: TEST_ORGANIZATIONS.WITH_OPTIONAL.maxOperator,
          isActive: true,
        });
      });

      it('should reject duplicate organization name', async () => {
        const duplicateName = `${TEST_ORGANIZATIONS.BASIC.name}_${runId}_dup`;
        await context.factory.createOrganization({ name: duplicateName });

        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.ALREADY_EXISTS,
          {
            createOrganizationInput: {
              ...TEST_ORGANIZATIONS.BASIC,
              name: duplicateName,
            },
          },
          hypervisorToken,
        );
      });

      it('should validate required fields', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.NAME_TOO_SHORT,
          {
            createOrganizationInput: {
              ...TEST_ORGANIZATIONS.BASIC,
              name: '',
            },
          },
          hypervisorToken,
        );
      });

      it('should validate maxOperator minimum value', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
          ERROR_MESSAGES.INVALID_MAX_OPERATOR,
          {
            createOrganizationInput: {
              ...TEST_ORGANIZATIONS.BASIC,
              maxOperator: 0,
            },
          },
          hypervisorToken,
        );
      });
    });
  });

  describe('organizations (list)', () => {
    beforeEach(async () => {
      await context.factory.createOrganization({ name: `org_list_1_${runId}` });
      await context.factory.createOrganization({ name: `org_list_2_${runId}` });
      await context.factory.createOrganization({ name: `org_list_3_${runId}` });
    });

    describe('basic listing', () => {
      it('should list all organizations as HYPERVISOR', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          {},
          hypervisorToken,
        );

        // Validate list structure
        OrganizationTestHelpers.validateOrganizationList(response, 3);

        // Verify we have the expected organizations
        expect(response.organizations.items.length).toBeGreaterThanOrEqual(3);

        // Validate each organization has all required fields
        response.organizations.items.forEach((org: any) => {
          TestValidators.validateOrganization(org);
        });
      });
    });

    describe('authorization', () => {
      it('should deny ADMIN from listing organizations', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          adminToken,
        );
      });

      it('should deny MANAGER from listing organizations', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          managerToken,
        );
      });

      it('should deny OPERATOR from listing organizations', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          ERROR_MESSAGES.FORBIDDEN,
          {},
          operatorToken,
        );
      });
    });

    describe('pagination', () => {
      it('should respect skip and take', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          { skip: 1, take: 2 },
          hypervisorToken,
        );

        // Validate list structure
        OrganizationTestHelpers.validateOrganizationList(response);

        // Should return at most 2 items
        expect(response.organizations.items.length).toBeLessThanOrEqual(2);

        // Count should be total, not limited by take
        expect(response.organizations.count).toBeGreaterThanOrEqual(3);
      });

      it('should handle skip only', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          { skip: 1 },
          hypervisorToken,
        );

        OrganizationTestHelpers.validateOrganizationList(response);
        expect(response.organizations.count).toBeGreaterThanOrEqual(3);
      });

      it('should handle take only', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
          { take: 2 },
          hypervisorToken,
        );

        OrganizationTestHelpers.validateOrganizationList(response);
        expect(response.organizations.items.length).toBeLessThanOrEqual(2);
        expect(response.organizations.count).toBeGreaterThanOrEqual(3);
      });
    });

    describe('filtering', () => {
      beforeEach(async () => {
        await context.factory.createOrganization({
          ...TEST_ORGANIZATIONS.FILTER_ALPHA,
          name: `${TEST_ORGANIZATIONS.FILTER_ALPHA.name}_${runId}`,
        });
        await context.factory.createOrganization({
          ...TEST_ORGANIZATIONS.FILTER_BETA,
          name: `${TEST_ORGANIZATIONS.FILTER_BETA.name}_${runId}`,
        });
        await context.factory.createOrganization({
          ...TEST_ORGANIZATIONS.FILTER_GAMMA,
          name: `${TEST_ORGANIZATIONS.FILTER_GAMMA.name}_${runId}`,
        });
      });

      describe('searchValue', () => {
        it('should filter organizations by searchValue matching name (case-insensitive)', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'alpha',
              },
            },
            hypervisorToken,
          );

          // Validate list structure
          OrganizationTestHelpers.validateOrganizationList(response, 1);

          // Find and validate the filtered organization
          const filterAlphaName = `${TEST_ORGANIZATIONS.FILTER_ALPHA.name}_${runId}`;
          const foundOrg = response.organizations.items.find(
            (org: any) => org.name === filterAlphaName,
          );
          expect(foundOrg).toBeDefined();

          // Validate organization structure
          TestValidators.validateOrganization(foundOrg, {
            name: filterAlphaName,
            displayName: TEST_ORGANIZATIONS.FILTER_ALPHA.displayName,
          });

          // Ensure name contains search term (case-insensitive)
          expect(
            response.organizations.items.every(
              (org: any) =>
                org.name.toLowerCase().includes('alpha') ||
                org.displayName.toLowerCase().includes('alpha') ||
                org.description?.toLowerCase().includes('alpha'),
            ),
          ).toBe(true);
        });

        it('should filter organizations by searchValue matching displayName', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'Beta',
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response, 1);

          const foundOrg = response.organizations.items.find(
            (org: any) => org.displayName === TEST_ORGANIZATIONS.FILTER_BETA.displayName,
          );
          expect(foundOrg).toBeDefined();

          const filterBetaName = `${TEST_ORGANIZATIONS.FILTER_BETA.name}_${runId}`;
          TestValidators.validateOrganization(foundOrg, {
            name: filterBetaName,
            displayName: TEST_ORGANIZATIONS.FILTER_BETA.displayName,
          });
        });

        it('should filter organizations by searchValue matching description', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'Production',
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response, 1);

          const filterGammaName = `${TEST_ORGANIZATIONS.FILTER_GAMMA.name}_${runId}`;
          const foundOrg = response.organizations.items.find(
            (org: any) => org.name === filterGammaName,
          );
          expect(foundOrg).toBeDefined();

          TestValidators.validateOrganization(foundOrg, {
            name: filterGammaName,
          });

          expect(foundOrg.description.toLowerCase()).toContain('production');
        });

        it('should filter organizations by searchValue matching loginLiffId', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'unique-liff-gamma',
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response, 1);

          const filterGammaName = `${TEST_ORGANIZATIONS.FILTER_GAMMA.name}_${runId}`;
          const foundOrg = response.organizations.items.find(
            (org: any) => org.name === filterGammaName,
          );
          expect(foundOrg).toBeDefined();

          TestValidators.validateOrganization(foundOrg, {
            name: filterGammaName,
            loginLiffId: TEST_ORGANIZATIONS.FILTER_GAMMA.loginLiffId,
          });
        });

        it('should return empty array when searchValue matches nothing', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'nonexistent_search_term_xyz',
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response, 0);
          expect(response.organizations.items.length).toBe(0);
          expect(response.organizations.count).toBe(0);
        });
      });

      describe('combined filtering', () => {
        it('should combine filtering with pagination', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              skip: 0,
              take: 1,
              filter: {
                searchValue: 'Organization',
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response);
          expect(response.organizations.items.length).toBeLessThanOrEqual(1);

          // Validate each returned organization
          response.organizations.items.forEach((org: any) => {
            TestValidators.validateOrganization(org);
          });
        });

        describe('refineConditions', () => {
          it('should filter using refineConditions for exact name match', async () => {
            const response = await context.client.queryExpectSuccess(
              ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
              {
                filter: {
                  refineConditions: [
                    {
                      searchItem: 'name',
                      condition: 'equals',
                      value: `${TEST_ORGANIZATIONS.FILTER_BETA.name}_${runId}`,
                    },
                  ],
                },
              },
              hypervisorToken,
            );

            OrganizationTestHelpers.validateOrganizationList(response, 1);

            const filterBetaName = `${TEST_ORGANIZATIONS.FILTER_BETA.name}_${runId}`;
            const foundOrg = response.organizations.items.find(
              (org: any) => org.name === filterBetaName,
            );
            expect(foundOrg).toBeDefined();

            TestValidators.validateOrganization(foundOrg, {
              name: filterBetaName,
              displayName: TEST_ORGANIZATIONS.FILTER_BETA.displayName,
            });
          });

          it('should filter using refineConditions with contains condition', async () => {
            const response = await context.client.queryExpectSuccess(
              ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
              {
                filter: {
                  refineConditions: [
                    {
                      searchItem: 'displayName',
                      condition: 'contains',
                      value: 'Gamma',
                    },
                  ],
                },
              },
              hypervisorToken,
            );

            OrganizationTestHelpers.validateOrganizationList(response, 1);

            const foundOrg = response.organizations.items.find(
              (org: any) => org.displayName === TEST_ORGANIZATIONS.FILTER_GAMMA.displayName,
            );
            expect(foundOrg).toBeDefined();

            const filterGammaName = `${TEST_ORGANIZATIONS.FILTER_GAMMA.name}_${runId}`;
            TestValidators.validateOrganization(foundOrg, {
              name: filterGammaName,
              displayName: TEST_ORGANIZATIONS.FILTER_GAMMA.displayName,
            });
          });

          it('should handle multiple refineConditions (AND logic)', async () => {
            const response = await context.client.queryExpectSuccess(
              ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
              {
                filter: {
                  refineConditions: [
                    {
                      searchItem: 'displayName',
                      condition: 'contains',
                      value: 'Alpha',
                    },
                    {
                      searchItem: 'description',
                      condition: 'contains',
                      value: 'alpha',
                    },
                  ],
                },
              },
              hypervisorToken,
            );

            OrganizationTestHelpers.validateOrganizationList(response, 1);

            const filterAlphaName = `${TEST_ORGANIZATIONS.FILTER_ALPHA.name}_${runId}`;
            const foundOrg = response.organizations.items.find(
              (org: any) => org.name === filterAlphaName,
            );
            expect(foundOrg).toBeDefined();

            TestValidators.validateOrganization(foundOrg, {
              name: filterAlphaName,
              displayName: TEST_ORGANIZATIONS.FILTER_ALPHA.displayName,
            });

            // Verify both conditions are satisfied
            expect(foundOrg.displayName).toContain('Alpha');
            expect(foundOrg.description.toLowerCase()).toContain('alpha');
          });

          it('should reject invalid filter field', async () => {
            await context.client.queryExpectError(
              ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
              ERROR_MESSAGES.INVALID_FILTER_FIELD,
              {
                filter: {
                  refineConditions: [
                    {
                      searchItem: 'invalidField',
                      condition: 'equals',
                      value: 'test',
                    },
                  ],
                },
              },
              hypervisorToken,
            );
          });
        });

        it('should combine searchValue and refineConditions (AND logic)', async () => {
          const response = await context.client.queryExpectSuccess(
            ORGANIZATION_QUERIES.GET_ORGANIZATIONS,
            {
              filter: {
                searchValue: 'Organization',
                refineConditions: [
                  {
                    searchItem: 'name',
                    condition: 'contains',
                    value: 'alpha',
                  },
                ],
              },
            },
            hypervisorToken,
          );

          OrganizationTestHelpers.validateOrganizationList(response, 1);

          const filterAlphaName = `${TEST_ORGANIZATIONS.FILTER_ALPHA.name}_${runId}`;
          const foundOrg = response.organizations.items.find(
            (org: any) => org.name === filterAlphaName,
          );
          expect(foundOrg).toBeDefined();

          TestValidators.validateOrganization(foundOrg, {
            name: filterAlphaName,
            displayName: TEST_ORGANIZATIONS.FILTER_ALPHA.displayName,
          });

          // Verify both search value and refine condition are satisfied
          expect(foundOrg.displayName).toContain('Organization');
          expect(foundOrg.name).toContain('alpha');
        });
      });
    });
  });

  describe('organization (single)', () => {
    let testOrg: any;

    beforeEach(async () => {
      testOrg = await context.factory.createOrganization({
        name: `org_single_test_${runId}`,
        displayName: 'Single Test Org',
      });
    });

    describe('successful retrieval', () => {
      it('should get single organization as HYPERVISOR', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_ORGANIZATION,
          { name: testOrg.name },
          hypervisorToken,
        );

        // Validate organization structure and all fields
        TestValidators.validateOrganization(response.organization, {
          name: testOrg.name,
          displayName: 'Single Test Org',
        });

        // Verify exact match
        expect(response.organization.name).toBe(testOrg.name);
      });
    });

    describe('error cases', () => {
      it('should return error for non-existent organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATION,
          ERROR_MESSAGES.NOT_FOUND,
          { name: 'non_existent_org' },
          hypervisorToken,
        );
      });
    });

    describe('authorization', () => {
      it('should deny ADMIN from getting organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          adminToken,
        );
      });

      it('should deny MANAGER from getting organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          managerToken,
        );
      });

      it('should deny OPERATOR from getting organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          operatorToken,
        );
      });
    });
  });

  describe('updateOrganization', () => {
    let testOrg: any;

    beforeEach(async () => {
      testOrg = await context.factory.createOrganization({
        name: `org_update_test_${runId}`,
        displayName: 'Original Name',
        description: 'Original description',
      });
    });

    describe('successful updates', () => {
      it('should update organization fields as HYPERVISOR', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: OrganizationTestHelpers.updateOrganizationInput(testOrg.name, {
              displayName: 'Updated Display Name',
              description: 'Updated description',
            }),
          },
          hypervisorToken,
        );

        // Validate updated fields and structure
        TestValidators.validateOrganization(response.updateOrganization, {
          name: testOrg.name,
          displayName: 'Updated Display Name',
          description: 'Updated description',
        });

        // Verify name cannot be changed
        expect(response.updateOrganization.name).toBe(testOrg.name);
      });

      it('should update maxOperator value', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: OrganizationTestHelpers.updateOrganizationInput(testOrg.name, {
              maxOperator: 20,
            }),
          },
          hypervisorToken,
        );

        TestValidators.validateOrganization(response.updateOrganization, {
          name: testOrg.name,
          maxOperator: 20,
        });
      });

      it('should update isActive status', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: OrganizationTestHelpers.updateOrganizationInput(testOrg.name, {
              isActive: false,
            }),
          },
          hypervisorToken,
        );

        TestValidators.validateOrganization(response.updateOrganization, {
          name: testOrg.name,
          isActive: false,
        });

        expect(response.updateOrganization.isActive).toBe(false);
      });

      it('should update loginLiffId', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: OrganizationTestHelpers.updateOrganizationInput(testOrg.name, {
              loginLiffId: 'updated-liff-id-12345',
            }),
          },
          hypervisorToken,
        );

        expect(response.updateOrganization.loginLiffId).toBe('updated-liff-id-12345');
      });

      it('should update apiKey', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: OrganizationTestHelpers.updateOrganizationInput(testOrg.name, {
              apiKey: 'updated-api-key-67890',
            }),
          },
          hypervisorToken,
        );

        expect(response.updateOrganization.apiKey).toBe('updated-api-key-67890');
      });
    });

    describe('error cases', () => {
      it('should reject updating non-existent organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.VALIDATION_FAILED,
          {
            updateOrganizationInput: {
              name: 'non_existent_org',
              displayName: 'Updated',
            },
          },
          hypervisorToken,
        );
      });
    });

    describe('authorization', () => {
      it('should deny ADMIN from updating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateOrganizationInput: {
              name: org1.name,
              displayName: 'Not Allowed',
            },
          },
          adminToken,
        );
      });

      it('should deny MANAGER from updating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateOrganizationInput: {
              name: org1.name,
              displayName: 'Not Allowed',
            },
          },
          managerToken,
        );
      });

      it('should deny OPERATOR from updating organization', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateOrganizationInput: {
              name: org1.name,
              displayName: 'Not Allowed',
            },
          },
          operatorToken,
        );
      });
    });
  });

  describe('toggleOrganizationStatus', () => {
    let activeOrg: any;
    let inactiveOrg: any;

    beforeEach(async () => {
      activeOrg = await context.factory.createOrganization({
        name: `org_toggle_active_${runId}`,
        displayName: 'Active Toggle Org',
        isActive: true,
      });
      inactiveOrg = await context.factory.createOrganization({
        name: `org_toggle_inactive_${runId}`,
        displayName: 'Inactive Toggle Org',
        isActive: false,
      });
      await context.factory.createUser(inactiveOrg.name, 'ADMIN');
    });

    describe('successful toggles', () => {
      it('should toggle from active to inactive as HYPERVISOR', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.TOGGLE_ORGANIZATION_STATUS,
          { name: activeOrg.name },
          hypervisorToken,
        );

        // Validate organization structure and toggled status
        TestValidators.validateOrganization(response.toggleOrganizationStatus, {
          name: activeOrg.name,
          displayName: activeOrg.displayName,
          isActive: false,
        });

        // Verify status was toggled
        expect(response.toggleOrganizationStatus.isActive).toBe(false);
      });

      it('should toggle from inactive to active as HYPERVISOR', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.TOGGLE_ORGANIZATION_STATUS,
          { name: inactiveOrg.name },
          hypervisorToken,
        );

        // Validate organization structure and toggled status
        TestValidators.validateOrganization(response.toggleOrganizationStatus, {
          name: inactiveOrg.name,
          displayName: inactiveOrg.displayName,
          isActive: true,
        });

        // Verify status was toggled
        expect(response.toggleOrganizationStatus.isActive).toBe(true);
      });
    });

    describe('authorization', () => {
      it('should deny ADMIN from toggling status', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.TOGGLE_ORGANIZATION_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          adminToken,
        );
      });

      it('should deny MANAGER from toggling status', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.TOGGLE_ORGANIZATION_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          managerToken,
        );
      });

      it('should deny OPERATOR from toggling status', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.TOGGLE_ORGANIZATION_STATUS,
          ERROR_MESSAGES.FORBIDDEN,
          { name: org1.name },
          operatorToken,
        );
      });
    });
  });

  describe('maxOperatorCount', () => {
    describe('successful retrieval', () => {
      it('should return maxOperatorCount for ADMIN', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_MAX_OPERATOR_COUNT,
          {},
          adminToken,
        );

        // Validate response type and value
        expect(typeof response.maxOperatorCount).toBe('number');
        expect(response.maxOperatorCount).toBeGreaterThanOrEqual(0);

        // Should return the organization's maxOperator value
        expect(response.maxOperatorCount).toBe(org1.maxOperator || 0);
      });

      it('should return 0 for MANAGER (restricted access)', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_MAX_OPERATOR_COUNT,
          {},
          managerToken,
        );

        // Manager role returns 0 as they don't have access to this information
        expect(response.maxOperatorCount).toBe(0);
        expect(typeof response.maxOperatorCount).toBe('number');
      });
    });

    describe('authorization', () => {
      it('should return 0 for OPERATOR (restricted access)', async () => {
        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.GET_MAX_OPERATOR_COUNT,
          {},
          operatorToken,
        );

        expect(response.maxOperatorCount).toBe(0);
        expect(typeof response.maxOperatorCount).toBe('number');
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.GET_MAX_OPERATOR_COUNT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {},
        );
      });
    });
  });

  describe('updateOrganization with email management', () => {
    let testOrg: any;

    beforeEach(async () => {
      testOrg = await context.factory.createOrganization({
        name: `org_email_test_${runId}`,
        displayName: 'Email Test Org',
        maxOperator: 10,
      });
    });

    describe('adding admin users via email', () => {
      it('should add new admin users to organization', async () => {
        const newAdminEmail = 'newadmin@test.com';

        const response = await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [newAdminEmail],
            },
          },
          hypervisorToken,
        );

        TestValidators.validateOrganization(response.updateOrganization, {
          name: testOrg.name,
        });

        // Verify user was created as PENDING
        const createdUser = await context.factory.findUserByEmail(newAdminEmail);
        expect(createdUser).toBeDefined();
        expect(createdUser.status).toBe('PENDING');
        expect(createdUser.roleType).toBe('ADMIN');
      });

      it('should add multiple new admin users', async () => {
        const emails = ['admin1@test.com', 'admin2@test.com', 'admin3@test.com'];

        await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails,
            },
          },
          hypervisorToken,
        );

        // Verify all users were created
        for (const email of emails) {
          const user = await context.factory.findUserByEmail(email);
          expect(user).toBeDefined();
          expect(user.status).toBe('PENDING');
          expect(user.roleType).toBe('ADMIN');
        }
      });

      it('should keep existing active admin users and add new ones', async () => {
        // Create an existing admin user
        const existingAdmin = await context.factory.createUser(testOrg.name, 'ADMIN');

        const newAdminEmail = 'newadmin2@test.com';

        await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [existingAdmin.email, newAdminEmail],
            },
          },
          hypervisorToken,
        );

        // Verify existing admin is still active
        const updatedExisting = await context.factory.findUserByEmail(existingAdmin.email);
        expect(updatedExisting.status).toBe('ACTIVE');

        // Verify new admin was created
        const newUser = await context.factory.findUserByEmail(newAdminEmail);
        expect(newUser).toBeDefined();
        expect(newUser.status).toBe('PENDING');
      });

      it('should inactivate admin users not in email list', async () => {
        // Create active admin users
        const admin1 = await context.factory.createUser(testOrg.name, 'ADMIN');
        const admin2 = await context.factory.createUser(testOrg.name, 'ADMIN');

        // Update with only admin1 in the list
        await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [admin1.email],
            },
          },
          hypervisorToken,
        );

        // Verify admin1 is still active
        const updatedAdmin1 = await context.factory.findUserByEmail(admin1.email);
        expect(updatedAdmin1.status).toBe('ACTIVE');

        // Verify admin2 was inactivated
        const updatedAdmin2 = await context.factory.findUserByEmail(admin2.email);
        expect(updatedAdmin2.status).toBe('INACTIVE');
      });

      it('should delete pending users not in email list', async () => {
        // Create a pending admin user
        const pendingAdmin = await context.factory.createUser(testOrg.name, 'ADMIN', {
          status: 'PENDING',
        });

        // Update with empty email list
        await context.client.queryExpectSuccess(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [],
            },
          },
          hypervisorToken,
        );

        // Verify pending user was deleted
        const deletedUser = await context.factory.findUserByEmail(pendingAdmin.email);
        expect(deletedUser).toBeNull();
      });
    });

    describe('validation errors', () => {
      it('should reject update when users belong to other organizations', async () => {
        // Create another organization with an admin
        const otherOrg = await context.factory.createOrganization({ name: `org_other_${runId}` });
        const otherOrgAdmin = await context.factory.createUser(otherOrg.name, 'ADMIN');

        // Try to add the other org's admin to testOrg
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.USERS_BELONG_TO_OTHER_ORG,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [otherOrgAdmin.email],
            },
          },
          hypervisorToken,
        );
      });

      it('should reject update when trying to add non-admin users as admins', async () => {
        // Create an operator user in the same org
        const operatorUser = await context.factory.createUser(testOrg.name, 'OPERATOR');

        // Try to add operator as admin via email update
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.NON_ADMIN_USERS,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              emails: [operatorUser.email],
            },
          },
          hypervisorToken,
        );
      });

      it('should reject update when maxOperator is less than current operator count', async () => {
        // Create multiple operators
        await context.factory.createUser(testOrg.name, 'OPERATOR');
        await context.factory.createUser(testOrg.name, 'OPERATOR');
        await context.factory.createUser(testOrg.name, 'OPERATOR');

        // Try to set maxOperator to less than current count
        await context.client.queryExpectError(
          ORGANIZATION_QUERIES.UPDATE_ORGANIZATION,
          ERROR_MESSAGES.MAX_OPERATOR_LESS_THAN_CURRENT,
          {
            updateOrganizationInput: {
              name: testOrg.name,
              displayName: testOrg.displayName,
              maxOperator: 1,
            },
          },
          hypervisorToken,
        );
      });
    });
  });

  describe('createOrganization edge cases', () => {
    it('should enforce maxOperator upper limit', async () => {
      await context.client.queryExpectError(
        ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
        ERROR_MESSAGES.MAX_OPERATOR_LIMIT_EXCEEDED,
        {
          createOrganizationInput: {
            ...TEST_ORGANIZATIONS.BASIC,
            name: `org_max_limit_test_${runId}`,
            maxOperator: 1000001, // Exceeds MAX_OPERATOR_INPUT_LIMIT (1000000)
          },
        },
        hypervisorToken,
      );
    });

    it('should create organization with admin emails and send invitations', async () => {
      const adminEmails = ['orgadmin1@test.com', 'orgadmin2@test.com'];
      const orgWithAdminsName = `org_with_admins_${runId}`;

      const response = await context.client.queryExpectSuccess(
        ORGANIZATION_QUERIES.CREATE_ORGANIZATION,
        {
          createOrganizationInput: {
            ...TEST_ORGANIZATIONS.BASIC,
            name: orgWithAdminsName,
            emails: adminEmails,
          },
        },
        hypervisorToken,
      );

      TestValidators.validateOrganization(response.createOrganization, {
        name: orgWithAdminsName,
      });

      // Verify admin users were created as PENDING
      for (const email of adminEmails) {
        const user = await context.factory.findUserByEmail(email);
        expect(user).toBeDefined();
        expect(user.status).toBe('PENDING');
        expect(user.roleType).toBe('ADMIN');
      }
    });
  });
});
