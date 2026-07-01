import { ATTRIBUTE_QUERIES } from '../../fixtures/graphql/attribute.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

const TEST_ATTRIBUTES = {
  BASIC: { name: 'Customer Age', type: 'number' },
  ENCRYPTED: { name: 'SSN', type: 'string', isEncryptionEnabled: true },
  SELECTION: { name: 'Priority', type: 'selection' },
  WITH_SPACES: { name: '  Customer   Name  ', expectedName: 'Customer Name' },
  DUPLICATE: { name: 'Customer Email', type: 'string' },
  EMPTY: { name: '   ' },
  TOO_LONG: { name: 'This is a very long attribute name that exceeds the 20 character limit' },
  CROSS_ORG: { name: 'Shared Name', type: 'string' },
} as const;

const SELECT_OPTIONS = {
  PRIORITY: [
    { value: 'low', label: 'Low Priority' },
    { value: 'medium', label: 'Medium Priority' },
    { value: 'high', label: 'High Priority' },
  ],
  STATUS: [
    { value: 'active', label: null },
    { value: 'inactive', label: null },
  ],
  TOO_MANY: Array.from({ length: 51 }, (_, i) => ({
    value: `option${i}`,
    label: `Option ${i}`,
  })),
  DUPLICATE_VALUES: [
    { value: 'option1', label: 'Option 1' },
    { value: 'option1', label: 'Duplicate' },
  ],
  EMPTY_VALUE: [{ value: '' }, { value: 'valid' }],
  WHITESPACE_VALUE: [{ value: '   ' }, { value: 'valid' }],
};

const TEST_VALUES = {
  ORIGINAL: 'Original Value',
  UPDATED: 'Updated Value',
  TRIMMED: '  Trimmed   Value  ',
  EXPECTED_TRIMMED: 'Trimmed Value',
} as const;

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden resource',
  UNAUTHORIZED: 'Unauthorized',
  DUPLICATE_NAME: 'Attribute name already exists',
  EMPTY_NAME: 'cannot be empty',
  NAME_TOO_LONG: 'must contain at most 20 character',
  NO_SELECT_OPTIONS: 'Select options are not provided',
  DUPLICATE_OPTIONS: 'Duplicated select options provided',
  INVALID_OPTION_VALUE: 'Select options must be valid string and no longer than allowed length',
  TOO_MANY_OPTIONS: 'Too many select options provided',
  ATTRIBUTE_NOT_FOUND: 'Attribute not found',
  ACCESS_DENIED: 'Access denied to attribute',
  INVALID_FILTER_FIELD: 'errors.filter.invalidFilterField',
} as const;

// Test Helper Functions
class AttributeTestHelpers {
  static createAttributeInput(overrides: any = {}) {
    return {
      name: 'Test Attribute',
      type: 'string',
      isEncryptionEnabled: false,
      ...overrides,
    };
  }

  static updateAttributeInput(id: string, overrides: any = {}) {
    const { isEncryptionEnabled: _omit, ...rest } = {
      name: 'Updated Attribute',
      type: 'string',
      isActive: true,
      ...overrides,
    } as any;
    return {
      id,
      ...rest,
    };
  }

  static fillValueInput(chatId: string, attributeId: string, value: string) {
    return {
      chatId,
      attributeId,
      value,
    };
  }

  static validateSelectOptions(actual: any[], expected: any[]) {
    expect(actual).toHaveLength(expected.length);
    const actualValues = actual.map((opt) => opt.value);
    const expectedValues = expected.map((opt) => opt.value);
    expect(actualValues).toEqual(expect.arrayContaining(expectedValues));
  }
}

describe('Attribute Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;
  let tenantSchemaNames: string[];

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      'attribute_test_org1',
      'attribute_test_org2',
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;
    org2AdminToken = tokens.org2AdminToken;
    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);
  });

  afterEach(async () => {
    await context.cleaner.cleanAttributeTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('createAttribute', () => {
    describe('authorization', () => {
      const input = AttributeTestHelpers.createAttributeInput();

      it('should allow ADMIN to create attribute', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          { createAttributeInput: input },
          adminToken,
        );

        TestValidators.validateAttribute(response.createAttribute, {
          name: input.name,
          type: input.type,
        });
        expect(response.createAttribute.isActive).toBe(true);
        expect(response.createAttribute.isEncryptionEnabled).toBe(false);
      });

      it('should deny MANAGER from creating attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          { createAttributeInput: input },
          managerToken,
        );
      });

      it('should deny OPERATOR from creating attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          { createAttributeInput: input },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.UNAUTHORIZED,
          { createAttributeInput: input },
        );
      });
    });

    describe('validation', () => {
      it('should trim and clean spaces in name', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.WITH_SPACES.name,
            }),
          },
          adminToken,
        );

        expect(response.createAttribute.name).toBe(TEST_ATTRIBUTES.WITH_SPACES.expectedName);
      });

      it('should reject empty name', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.EMPTY_NAME,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.EMPTY.name,
            }),
          },
          adminToken,
        );
      });

      it('should reject name exceeding 20 characters', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.NAME_TOO_LONG,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.TOO_LONG.name,
            }),
          },
          adminToken,
        );
      });

      it('should reject duplicate attribute name (case-insensitive)', async () => {
        await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.DUPLICATE.name,
            }),
          },
          adminToken,
        );

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.DUPLICATE.name.toLowerCase(),
            }),
          },
          adminToken,
        );
      });
    });

    describe('attribute types', () => {
      const types = [
        { type: 'string', name: 'String Attr' },
        { type: 'number', name: 'Number Attr' },
        { type: 'date', name: 'Date Attr' },
      ];

      types.forEach(({ type, name }) => {
        it(`should create ${type} type attribute`, async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
            {
              createAttributeInput: AttributeTestHelpers.createAttributeInput({ name, type }),
            },
            adminToken,
          );

          expect(response.createAttribute.type).toBe(type);
        });
      });
    });

    describe('encryption', () => {
      it('should create attribute with encryption enabled', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              ...TEST_ATTRIBUTES.ENCRYPTED,
            }),
          },
          adminToken,
        );

        expect(response.createAttribute.isEncryptionEnabled).toBe(true);
      });

      it('should default isEncryptionEnabled to false', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              isEncryptionEnabled: false,
            }),
          },
          adminToken,
        );

        expect(response.createAttribute.isEncryptionEnabled).toBe(false);
      });
    });

    describe('multi-tenancy', () => {
      it('should allow duplicate names across organizations', async () => {
        await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.CROSS_ORG.name,
            }),
          },
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: TEST_ATTRIBUTES.CROSS_ORG.name,
            }),
          },
          org2AdminToken,
        );

        expect(response.createAttribute.name).toBe(TEST_ATTRIBUTES.CROSS_ORG.name);
      });
    });
  });

  describe('attributes (list)', () => {
    beforeEach(async () => {
      await context.factory.createAttribute(org1.name, { name: 'Attr 1' });
      await context.factory.createAttribute(org1.name, { name: 'Attr 2' });
      await context.factory.createAttribute(org1.name, {
        name: 'Attr 3',
        isEncryptionEnabled: true,
      });
      await context.factory.createAttribute(org2.name, { name: 'Org2 Attr' });
    });

    describe('basic listing', () => {
      it('should list attributes for organization', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          adminToken,
        );

        expect(response.attributes.items).toHaveLength(3);
        expect(response.attributes.count).toBe(3);
        expect(response.attributes.items.every((attr: any) => attr.name.startsWith('Attr'))).toBe(
          true,
        );
      });

      it('should include isEncryptionEnabled in response', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          adminToken,
        );

        const encryptedAttr = response.attributes.items.find((attr: any) => attr.name === 'Attr 3');
        expect(encryptedAttr.isEncryptionEnabled).toBe(true);

        const normalAttr = response.attributes.items.find((attr: any) => attr.name === 'Attr 1');
        expect(normalAttr.isEncryptionEnabled).toBe(false);
      });

      it('should allow OPERATOR to list attributes', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          operatorToken,
        );

        expect(response.attributes.items).toHaveLength(3);
      });

      it('should order by createdAt ascending', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          adminToken,
        );

        TestValidators.validateAscendingOrder(response.attributes.items);
      });
    });

    describe('pagination', () => {
      it('should respect skip and take', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          { skip: 1, take: 2 },
          adminToken,
        );

        expect(response.attributes.items).toHaveLength(2);
        expect(response.attributes.count).toBe(3);
      });

      it('should handle skip only', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          { skip: 1 },
          adminToken,
        );

        expect(response.attributes.items).toHaveLength(2);
        expect(response.attributes.count).toBe(3);
      });

      it('should handle take only', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          { take: 2 },
          adminToken,
        );

        expect(response.attributes.items).toHaveLength(2);
        expect(response.attributes.count).toBe(3);
      });
    });

    describe('multi-tenancy', () => {
      it('should not list attributes from other organizations', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          adminToken,
        );

        expect(response.attributes.items.every((attr: any) => !attr.name.includes('Org2'))).toBe(
          true,
        );
      });

      it('should isolate counts per organization', async () => {
        const org1Response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          adminToken,
        );

        const org2Response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
          {},
          org2AdminToken,
        );

        expect(org1Response.attributes.count).toBe(3);
        expect(org2Response.attributes.count).toBe(1);
      });
    });

    describe('filtering', () => {
      beforeEach(async () => {
        await context.cleaner.cleanAttributeTestData(tenantSchemaNames);

        await context.factory.createAttribute(org1.name, { name: 'Customer Name', type: 'string' });
        await context.factory.createAttribute(org1.name, { name: 'Customer Age', type: 'number' });
        await context.factory.createAttribute(org1.name, { name: 'Product Type', type: 'string' });
        await context.factory.createAttribute(org1.name, {
          name: 'Order Status',
          type: 'selection',
        });
      });

      describe('searchValue', () => {
        it('should filter by searchValue (case-insensitive)', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            { filter: { searchValue: 'customer' } },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(2);
          expect(
            response.attributes.items.every((attr: any) =>
              attr.name.toLowerCase().includes('customer'),
            ),
          ).toBe(true);
        });

        it('should return empty for non-matching search', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            { filter: { searchValue: 'NonExistent' } },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(0);
        });

        it('should not leak across organizations', async () => {
          await context.factory.createAttribute(org2.name, { name: 'Customer Data' });

          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            { filter: { searchValue: 'Customer' } },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(2);
          expect(response.attributes.items.every((attr: any) => !attr.name.includes('Data'))).toBe(
            true,
          );
        });
      });

      describe('refineConditions', () => {
        const conditions = [
          { condition: 'equals', value: 'Customer Name', expectedCount: 1 },
          { condition: 'contains', value: 'Type', expectedCount: 1 },
          { condition: 'starts with', value: 'Customer', expectedCount: 2 },
          { condition: 'ends with', value: 'Status', expectedCount: 1 },
          { condition: 'not equals', value: 'Customer Name', expectedCount: 3 },
        ];

        conditions.forEach(({ condition, value, expectedCount }) => {
          it(`should filter by name ${condition}`, async () => {
            const response = await context.client.queryExpectSuccess(
              ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
              {
                filter: {
                  refineConditions: [{ searchItem: 'name', condition, value }],
                },
              },
              adminToken,
            );

            expect(response.attributes.items).toHaveLength(expectedCount);
          });
        });

        it('should filter by type equals', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            {
              filter: {
                refineConditions: [{ searchItem: 'type', condition: 'equals', value: 'number' }],
              },
            },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(1);
          expect(response.attributes.items[0].type).toBe('number');
        });

        it('should reject invalid filter field', async () => {
          await context.client.queryExpectError(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            ERROR_MESSAGES.INVALID_FILTER_FIELD,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'invalidField', condition: 'equals', value: 'test' },
                ],
              },
            },
            adminToken,
          );
        });
      });

      describe('combined filtering', () => {
        it('should combine searchValue and refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            {
              filter: {
                searchValue: 'Customer',
                refineConditions: [{ searchItem: 'type', condition: 'equals', value: 'string' }],
              },
            },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(1);
          expect(response.attributes.items[0].name).toBe('Customer Name');
        });

        it('should support multiple refineConditions', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            {
              filter: {
                refineConditions: [
                  { searchItem: 'name', condition: 'starts with', value: 'Customer' },
                  { searchItem: 'type', condition: 'equals', value: 'number' },
                ],
              },
            },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(1);
          expect(response.attributes.items[0].name).toBe('Customer Age');
        });

        it('should combine filtering with pagination', async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
            {
              skip: 1,
              take: 1,
              filter: { searchValue: 'Customer' },
            },
            adminToken,
          );

          expect(response.attributes.items).toHaveLength(1);
          expect(response.attributes.count).toBe(2);
        });
      });
    });
  });

  describe('attribute (single)', () => {
    let testAttribute: any;

    beforeEach(async () => {
      testAttribute = await context.factory.createAttribute(org1.name, {
        name: 'Test Single',
      });
    });

    describe('authorization', () => {
      it('should allow ADMIN to get single attribute', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          { id: testAttribute.id },
          adminToken,
        );

        expect(response.attribute.id).toBe(testAttribute.id);
        expect(response.attribute.name).toBe('Test Single');
      });

      it('should deny MANAGER from getting single attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testAttribute.id },
          managerToken,
        );
      });

      it('should deny OPERATOR from getting single attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          { id: testAttribute.id },
          operatorToken,
        );
      });
    });

    describe('encryption field', () => {
      it('should return isEncryptionEnabled field', async () => {
        const encryptedAttr = await context.factory.createAttribute(org1.name, {
          name: 'Encrypted Single',
          isEncryptionEnabled: true,
        });

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          { id: encryptedAttr.id },
          adminToken,
        );

        expect(response.attribute.isEncryptionEnabled).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should prevent cross-organization access', async () => {
        const org2Attribute = await context.factory.createAttribute(org2.name, {
          name: 'Org2 Attr',
        });

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          { id: org2Attribute.id },
          adminToken,
        );
      });

      it('should return error for non-existent attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          { id: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });
    });
  });

  describe('updateAttribute', () => {
    let testAttribute: any;

    beforeEach(async () => {
      testAttribute = await context.factory.createAttribute(org1.name, {
        name: 'Original Name',
        type: 'string',
      });
    });

    describe('authorization', () => {
      it('should allow ADMIN to update attribute', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Updated Name',
            }),
          },
          adminToken,
        );

        expect(response.updateAttribute.name).toBe('Updated Name');
      });

      it('should deny MANAGER from updating attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Hacked',
            }),
          },
          managerToken,
        );
      });

      it('should deny OPERATOR from updating attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.FORBIDDEN,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Hacked',
            }),
          },
          operatorToken,
        );
      });
    });

    describe('validation', () => {
      it('should reject duplicate name on update', async () => {
        await context.factory.createAttribute(org1.name, { name: 'Another Attr' });

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Another Attr',
            }),
          },
          adminToken,
        );
      });

      it('should reject duplicate name with different case on update', async () => {
        await context.factory.createAttribute(org1.name, { name: 'Case Test Attr' });

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'CASE TEST ATTR',
            }),
          },
          adminToken,
        );
      });

      it('should reject duplicate name with mixed case on update', async () => {
        await context.factory.createAttribute(org1.name, { name: 'MixedCaseAttr' });

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.DUPLICATE_NAME,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'mixedcaseattr',
            }),
          },
          adminToken,
        );
      });

      it('should allow updating to same name', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Original Name',
              isActive: false,
            }),
          },
          adminToken,
        );

        expect(response.updateAttribute.name).toBe('Original Name');
        expect(response.updateAttribute.isActive).toBe(false);
      });
    });

    describe('field updates', () => {
      it('should update all fields except encryption flag', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'New Name',
              type: 'number',
              isActive: false,
            }),
          },
          adminToken,
        );

        TestValidators.validateAttribute(response.updateAttribute, {
          name: 'New Name',
          type: 'number',
        });
        expect(response.updateAttribute.isActive).toBe(false);
      });

      it('should reject isEncryptionEnabled in update input', async () => {
        const response = await context.client.query(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: {
              id: testAttribute.id,
              name: 'Original Name',
              type: 'string',
              isActive: true,
              isEncryptionEnabled: true,
            },
          },
          adminToken,
        );

        expect(response.errors).toBeDefined();
        expect(response.errors![0].message).toContain('isEncryptionEnabled');
      });

      it('should preserve isEncryptionEnabled across updates', async () => {
        const encryptedAttr = await context.factory.createAttribute(org1.name, {
          name: 'Encrypted',
          isEncryptionEnabled: true,
        });

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(encryptedAttr.id, {
              name: 'Encrypted',
            }),
          },
          adminToken,
        );

        expect(response.updateAttribute.isEncryptionEnabled).toBe(true);
      });
    });

    describe('error cases', () => {
      it('should reject updating non-existent attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminToken,
        );
      });

      it('should prevent cross-organization update', async () => {
        const org2Attribute = await context.factory.createAttribute(org2.name);

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(org2Attribute.id, {
              name: 'Hacked',
            }),
          },
          adminToken,
        );
      });
    });
  });

  describe('toggleAttributeStatus', () => {
    let testAttribute: any;

    beforeEach(async () => {
      testAttribute = await context.factory.createAttribute(org1.name, { isActive: true });
    });

    it('should toggle from active to inactive', async () => {
      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.TOGGLE_ATTRIBUTE_STATUS,
        { id: testAttribute.id },
        adminToken,
      );

      expect(response.toggleAttributeStatus.isActive).toBe(false);
    });

    it('should toggle from inactive to active', async () => {
      await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.TOGGLE_ATTRIBUTE_STATUS,
        { id: testAttribute.id },
        adminToken,
      );

      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.TOGGLE_ATTRIBUTE_STATUS,
        { id: testAttribute.id },
        adminToken,
      );

      expect(response.toggleAttributeStatus.isActive).toBe(true);
    });

    it('should deny OPERATOR from toggling status', async () => {
      await context.client.queryExpectError(
        ATTRIBUTE_QUERIES.TOGGLE_ATTRIBUTE_STATUS,
        ERROR_MESSAGES.FORBIDDEN,
        { id: testAttribute.id },
        operatorToken,
      );
    });
  });

  describe('disableAttribute', () => {
    let testAttribute: any;

    beforeEach(async () => {
      testAttribute = await context.factory.createAttribute(org1.name, { isActive: true });
    });

    it('should disable attribute', async () => {
      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.DISABLE_ATTRIBUTE,
        { id: testAttribute.id },
        adminToken,
      );

      expect(response.disableAttribute.isActive).toBe(false);
    });

    it('should deny OPERATOR from disabling attribute', async () => {
      await context.client.queryExpectError(
        ATTRIBUTE_QUERIES.DISABLE_ATTRIBUTE,
        ERROR_MESSAGES.FORBIDDEN,
        { id: testAttribute.id },
        operatorToken,
      );
    });

    it('should reject disabling non-existent attribute', async () => {
      await context.client.queryExpectError(
        ATTRIBUTE_QUERIES.DISABLE_ATTRIBUTE,
        ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
        { id: '00000000-0000-0000-0000-000000000000' },
        adminToken,
      );
    });
  });

  describe('selectOptions', () => {
    describe('create with select options', () => {
      it('should create attribute with select options', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: 'Priority',
              type: 'selection',
              selectOptions: SELECT_OPTIONS.PRIORITY,
            }),
          },
          adminToken,
        );

        expect(response.createAttribute.type).toBe('selection');
        AttributeTestHelpers.validateSelectOptions(
          response.createAttribute.selectOption,
          SELECT_OPTIONS.PRIORITY,
        );
      });

      it('should create attribute with null labels', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
          {
            createAttributeInput: AttributeTestHelpers.createAttributeInput({
              name: 'Status',
              type: 'selection',
              selectOptions: SELECT_OPTIONS.STATUS,
            }),
          },
          adminToken,
        );

        expect(response.createAttribute.selectOption.every((opt: any) => opt.label === null)).toBe(
          true,
        );
      });

      const validationTests = [
        {
          testName: 'selection type without select options',
          attributeName: 'No Options',
          input: { type: 'selection' },
          error: ERROR_MESSAGES.NO_SELECT_OPTIONS,
        },
        {
          testName: 'selection type with empty array',
          attributeName: 'Empty Array',
          input: { type: 'selection', selectOptions: [] },
          error: ERROR_MESSAGES.NO_SELECT_OPTIONS,
        },
        {
          testName: 'duplicate select option values',
          attributeName: 'Duplicate Opts',
          input: { type: 'selection', selectOptions: SELECT_OPTIONS.DUPLICATE_VALUES },
          error: ERROR_MESSAGES.DUPLICATE_OPTIONS,
        },
        {
          testName: 'empty select option value',
          attributeName: 'Empty Value',
          input: { type: 'selection', selectOptions: SELECT_OPTIONS.EMPTY_VALUE },
          error: 'selectOptions',
        },
        {
          testName: 'whitespace-only value',
          attributeName: 'Whitespace',
          input: { type: 'selection', selectOptions: SELECT_OPTIONS.WHITESPACE_VALUE },
          error: ERROR_MESSAGES.INVALID_OPTION_VALUE,
        },
        {
          testName: 'exceeding max options (51)',
          attributeName: 'Too Many',
          input: { type: 'selection', selectOptions: SELECT_OPTIONS.TOO_MANY },
          error: ERROR_MESSAGES.TOO_MANY_OPTIONS,
        },
      ];

      validationTests.forEach(({ testName, attributeName, input, error }) => {
        it(`should reject ${testName}`, async () => {
          await context.client.queryExpectError(
            ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
            error,
            {
              createAttributeInput: AttributeTestHelpers.createAttributeInput({
                name: attributeName,
                ...input,
              }),
            },
            adminToken,
          );
        });
      });
    });

    describe('list and get with select options', () => {
      it('should include select options in single attribute query', async () => {
        const attr = await context.factory.createAttribute(org1.name, {
          name: 'Single Selection',
          type: 'selection',
        });
        await context.factory.createSelectOption(attr.id, { value: 'yes', label: 'Yes' });
        await context.factory.createSelectOption(attr.id, { value: 'no', label: 'No' });

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          { id: attr.id },
          adminToken,
        );

        expect(response.attribute.selectOption).toHaveLength(2);
        expect(response.attribute.selectOption).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ value: 'yes', label: 'Yes' }),
            expect.objectContaining({ value: 'no', label: 'No' }),
          ]),
        );
      });
    });

    describe('update with select options', () => {
      let testAttribute: any;

      beforeEach(async () => {
        testAttribute = await context.factory.createAttribute(org1.name, {
          name: 'Updatable Selection',
          type: 'selection',
        });
        await context.factory.createSelectOption(testAttribute.id, {
          value: 'old1',
          label: 'Old 1',
        });
        await context.factory.createSelectOption(testAttribute.id, {
          value: 'old2',
          label: 'Old 2',
        });
      });

      it('should update with new select options', async () => {
        const newOptions = [
          { value: 'new1', label: 'New 1' },
          { value: 'new2', label: 'New 2' },
        ];

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              name: 'Updated',
              type: 'selection',
              selectOptions: newOptions,
            }),
          },
          adminToken,
        );

        AttributeTestHelpers.validateSelectOptions(
          response.updateAttribute.selectOption,
          newOptions,
        );
        const values = response.updateAttribute.selectOption.map((opt: any) => opt.value);
        expect(values).not.toContain('old1');
        expect(values).not.toContain('old2');
      });

      it('should reject updating with duplicate select option values', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.DUPLICATE_OPTIONS,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              type: 'selection',
              selectOptions: [
                { value: 'option1', label: 'Option 1' },
                { value: 'option1', label: 'Duplicate Option' },
              ],
            }),
          },
          adminToken,
        );
      });

      it('should reject updating selection without options', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.UPDATE_ATTRIBUTE,
          ERROR_MESSAGES.NO_SELECT_OPTIONS,
          {
            updateAttributeInput: AttributeTestHelpers.updateAttributeInput(testAttribute.id, {
              type: 'selection',
              selectOptions: [],
            }),
          },
          adminToken,
        );
      });
    });
  });

  describe('fillChatAttributeValue', () => {
    let testAttribute: any;
    let testChat: any;
    let endUser: any;

    beforeEach(async () => {
      testAttribute = await context.factory.createAttribute(org1.name, {
        name: 'Customer Name',
        isActive: true,
      });
      endUser = await context.factory.createEndUser();
      testChat = await context.factory.createChat(org1.name, endUser.userId);
    });

    describe('create and update values', () => {
      it('should create chat attribute value', async () => {
        const emailSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const admin = await context.factory.createUser(org1.name, 'ADMIN', {
          email: `test-admin-${emailSuffix}@test.com`,
        });
        const token = context.authHelper.generateToken(admin.id);

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              testAttribute.id,
              'John Doe',
            ),
          },
          token,
        );

        expect(response.fillChatAttributeValue.value).toBe('John Doe');
        expect(response.fillChatAttributeValue.chatId).toBe(testChat.id);
        expect(response.fillChatAttributeValue.attributeId).toBe(testAttribute.id);
        expect(response.fillChatAttributeValue.userId).toBe(admin.id);
      });

      it('should update existing value (upsert)', async () => {
        const emailSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const operator = await context.factory.createUser(org1.name, 'OPERATOR', {
          email: `test-op-${emailSuffix}@test.com`,
        });
        const token = context.authHelper.generateToken(operator.id);

        await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              testAttribute.id,
              TEST_VALUES.ORIGINAL,
            ),
          },
          token,
        );

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              testAttribute.id,
              TEST_VALUES.UPDATED,
            ),
          },
          token,
        );

        expect(response.fillChatAttributeValue.value).toBe(TEST_VALUES.UPDATED);
      });

      it('should trim and clean spaces in value', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              testAttribute.id,
              TEST_VALUES.TRIMMED,
            ),
          },
          adminToken,
        );

        expect(response.fillChatAttributeValue.value).toBe(TEST_VALUES.EXPECTED_TRIMMED);
      });
    });

    describe('authorization', () => {
      const roles = [
        { role: 'OPERATOR', token: () => operatorToken },
        { role: 'MANAGER', token: () => managerToken },
      ];

      roles.forEach(({ role, token }) => {
        it(`should allow ${role} to fill attribute value`, async () => {
          const response = await context.client.queryExpectSuccess(
            ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
            {
              createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
                testChat.id,
                testAttribute.id,
                `${role} Value`,
              ),
            },
            token(),
          );

          expect(response.fillChatAttributeValue.value).toBe(`${role} Value`);
        });
      });
    });

    describe('validation', () => {
      it('should reject inactive attribute', async () => {
        const inactiveAttr = await context.factory.createAttribute(org1.name, { isActive: false });

        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              inactiveAttr.id,
              'Test',
            ),
          },
          adminToken,
        );
      });

      it('should reject non-existent attribute', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          ERROR_MESSAGES.ATTRIBUTE_NOT_FOUND,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              '00000000-0000-0000-0000-000000000000',
              'Test',
            ),
          },
          adminToken,
        );
      });
    });

    describe('selection type attributes', () => {
      let selectionAttribute: any;

      beforeEach(async () => {
        selectionAttribute = await context.factory.createAttribute(org1.name, {
          name: 'Customer Type',
          type: 'selection',
          isActive: true,
        });
        await context.factory.createSelectOption(selectionAttribute.id, {
          value: 'regular',
          label: 'Regular',
        });
        await context.factory.createSelectOption(selectionAttribute.id, {
          value: 'vip',
          label: 'VIP',
        });
      });

      it('should fill with valid select option', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              selectionAttribute.id,
              'vip',
            ),
          },
          adminToken,
        );

        expect(response.fillChatAttributeValue.value).toBe('vip');
      });

      it('should update to different select option', async () => {
        await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              selectionAttribute.id,
              'regular',
            ),
          },
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              selectionAttribute.id,
              'vip',
            ),
          },
          adminToken,
        );

        expect(response.fillChatAttributeValue.value).toBe('vip');
      });

      it('should reject invalid select option', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.FILL_CHAT_ATTRIBUTE_VALUE,
          ERROR_MESSAGES.NO_SELECT_OPTIONS,
          {
            createChatAttributeValueInput: AttributeTestHelpers.fillValueInput(
              testChat.id,
              selectionAttribute.id,
              'invalid_option',
            ),
          },
          adminToken,
        );
      });
    });
  });
});
