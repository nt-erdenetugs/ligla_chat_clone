import { ATTRIBUTE_QUERIES } from '../../fixtures/graphql/attribute.queries';
import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';
import { STORE_QUERIES } from '../../fixtures/graphql/store.queries';
import { TAG_QUERIES } from '../../fixtures/graphql/tag.queries';
import { TEAM_QUERIES } from '../../fixtures/graphql/team.queries';
import { USER_QUERIES } from '../../fixtures/graphql/user.queries';
import { TestContext, TestSetup, TestValidators } from '../../utils/test-setup';

describe('OrganizationGuard (E2E)', () => {
  let context: TestContext;
  let runId: string;

  // Organization 1 resources
  let org1Name: string;
  let org1Id: string;
  let org1AdminUser: any;
  let org1AdminToken: string;
  let org1Team: any;
  let org1Store: any;
  let org1Attribute: any;
  let org1Tag: any;
  let org1Chat: any;

  // Organization 2 resources
  let org2Name: string;
  let org2Id: string;
  let org2AdminUser: any;
  let org2AdminToken: string;
  let org2Team: any;
  let org2Store: any;
  let org2Attribute: any;
  let org2Tag: any;

  // Hypervisor user
  let hypervisorToken: string;

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    runId = Date.now().toString(36);

    await context.factory.createHypervisorUser({ email: `hypervisor@guard-${runId}.test` });
    hypervisorToken = await context.authHelper.getHypervisorToken();

    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      `org_guard_1_${runId}`,
      `org_guard_2_${runId}`,
    );

    org1Name = organizations.org1.name;
    org1Id = organizations.org1.id;
    org2Name = organizations.org2.name;
    org2Id = organizations.org2.id;
    org1AdminUser = users.adminUser;
    org1AdminToken = tokens.adminToken;
    org2AdminUser = users.org2AdminUser;
    org2AdminToken = tokens.org2AdminToken;

    org1Team = await context.factory.createTeam(org1Name, {
      name: 'Org1 Team',
    });
    org1Store = await context.factory.createStore(org1Name, {
      name: 'Org1 Store',
    });
    org1Attribute = await context.factory.createAttribute(org1Name, {
      name: 'Org1 Attribute',
      type: 'string',
    });
    org1Tag = await context.factory.createTag(org1Name, {
      name: 'Org1 Tag',
    });

    const org1EndUser = await context.factory.createEndUser({
      organizationName: org1Name,
    });
    org1Chat = await context.factory.createChat(org1Name, org1EndUser.userId, {
      storeId: org1Store.id,
    });

    org2Team = await context.factory.createTeam(org2Name, {
      name: 'Org2 Team',
    });
    org2Store = await context.factory.createStore(org2Name, {
      name: 'Org2 Store',
    });
    org2Attribute = await context.factory.createAttribute(org2Name, {
      name: 'Org2 Attribute',
      type: 'string',
    });
    org2Tag = await context.factory.createTag(org2Name, {
      name: 'Org2 Tag',
    });
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('Hypervisor Bypass', () => {
    it('should allow hypervisor to access resources from any organization', async () => {
      // Hypervisor should be able to access org1's team
      const org1TeamResponse = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAM,
        { id: org1Team.id, inputOrganizationId: org1Id },
        hypervisorToken,
      );

      expect(org1TeamResponse.team).toBeDefined();
      expect(org1TeamResponse.team.id).toBe(org1Team.id);
      expect(org1TeamResponse.team.name).toBe('Org1 Team');

      // Hypervisor should be able to access org2's team
      const org2TeamResponse = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAM,
        { id: org2Team.id, inputOrganizationId: org2Id },
        hypervisorToken,
      );

      expect(org2TeamResponse.team).toBeDefined();
      expect(org2TeamResponse.team.id).toBe(org2Team.id);
      expect(org2TeamResponse.team.name).toBe('Org2 Team');
    });

    it('should allow hypervisor to list resources from any organization', async () => {
      // Hypervisor can see teams from org1
      const org1Response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAMS,
        { inputOrganizationId: org1Id },
        hypervisorToken,
      );

      expect(org1Response.teams).toBeDefined();
      expect(org1Response.teams.items).toBeDefined();
      expect(Array.isArray(org1Response.teams.items)).toBe(true);
      const org1TeamIds = org1Response.teams.items.map((t: any) => t.id);
      expect(org1TeamIds).toContain(org1Team.id);

      // Hypervisor can see teams from org2
      const org2Response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAMS,
        { inputOrganizationId: org2Id },
        hypervisorToken,
      );

      expect(org2Response.teams).toBeDefined();
      const org2TeamIds = org2Response.teams.items.map((t: any) => t.id);
      expect(org2TeamIds).toContain(org2Team.id);
    });
  });

  describe('Organization Membership Validation', () => {
    it('should allow user to access resources from their own organization', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAM,
        { id: org1Team.id },
        org1AdminToken,
      );

      TestValidators.validateTeam(response.team, {
        name: 'Org1 Team',
      });
    });

    it('should deny unauthenticated access', async () => {
      await context.client.queryExpectError(
        TEAM_QUERIES.GET_TEAM,
        'Unauthorized',
        { id: org1Team.id },
        // No token provided
      );
    });
  });

  describe('Cross-Organization Resource Access Prevention', () => {
    describe('Team Resource', () => {
      it('should deny org1 admin from accessing org2 team by ID', async () => {
        await context.client.queryExpectError(
          TEAM_QUERIES.GET_TEAM,
          'Team not found',
          { id: org2Team.id },
          org1AdminToken,
        );
      });

      it('should deny org2 admin from accessing org1 team by ID', async () => {
        await context.client.queryExpectError(
          TEAM_QUERIES.GET_TEAM,
          'Team not found',
          { id: org1Team.id },
          org2AdminToken,
        );
      });
    });

    describe('Store Resource', () => {
      it('should deny org1 admin from accessing org2 store by ID', async () => {
        await context.client.queryExpectError(
          STORE_QUERIES.GET_STORE,
          'Store not found',
          { id: org2Store.id },
          org1AdminToken,
        );
      });

      it('should allow org1 admin to access org1 store', async () => {
        const response = await context.client.queryExpectSuccess(
          STORE_QUERIES.GET_STORE,
          { id: org1Store.id },
          org1AdminToken,
        );

        TestValidators.validateStore(response.store, {
          name: 'Org1 Store',
        });
      });
    });

    describe('User Resource', () => {
      it('should deny org1 admin from accessing org2 user by ID', async () => {
        await context.client.queryExpectError(
          USER_QUERIES.GET_USER,
          'User not found',
          { id: org2AdminUser.id },
          org1AdminToken,
        );
      });

      it('should allow org1 admin to access org1 user', async () => {
        const response = await context.client.queryExpectSuccess(
          USER_QUERIES.GET_USER,
          { id: org1AdminUser.id },
          org1AdminToken,
        );

        TestValidators.validateUser(response.user, {
          email: org1AdminUser.email,
        });
      });
    });

    describe('Attribute Resource', () => {
      it('should deny org1 admin from accessing org2 attribute by ID', async () => {
        await context.client.queryExpectError(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          'Attribute not found',
          { id: org2Attribute.id },
          org1AdminToken,
        );
      });

      it('should allow org1 admin to access org1 attribute', async () => {
        const response = await context.client.queryExpectSuccess(
          ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
          { id: org1Attribute.id },
          org1AdminToken,
        );

        TestValidators.validateAttribute(response.attribute, {
          name: 'Org1 Attribute',
          type: 'string',
        });
      });
    });

    describe('Tag Resource', () => {
      it('should deny org1 admin from accessing org2 tag by ID', async () => {
        await context.client.queryExpectError(
          TAG_QUERIES.GET_TAG,
          'Tag not found',
          { id: org2Tag.id },
          org1AdminToken,
        );
      });

      it('should allow org1 admin to access org1 tag', async () => {
        const response = await context.client.queryExpectSuccess(
          TAG_QUERIES.GET_TAG,
          { id: org1Tag.id },
          org1AdminToken,
        );

        TestValidators.validateTag(response.tag, {
          name: 'Org1 Tag',
        });
      });
    });

    describe('Chat Resource', () => {
      it('should deny org2 admin from accessing org1 chat by ID', async () => {
        await context.client.queryExpectError(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          'Chat not found',
          { id: org1Chat.id },
          org2AdminToken,
        );
      });

      it('should allow org1 admin to access org1 chat', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_QUERIES.GET_CHAT_HISTORY,
          { id: org1Chat.id },
          org1AdminToken,
        );

        TestValidators.validateChat(response.chatHistory, {
          endUserId: org1Chat.endUserId,
        });
      });
    });
  });

  describe('List Query Organization Filtering', () => {
    it('should return only org1 teams when org1 admin queries teams', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAMS,
        {},
        org1AdminToken,
      );

      expect(response.teams).toBeDefined();
      expect(response.teams.items).toBeDefined();
      expect(Array.isArray(response.teams.items)).toBe(true);

      // Should contain org1 team
      const org1Teams = response.teams.items.filter((t: any) => t.id === org1Team.id);
      expect(org1Teams.length).toBe(1);

      // Should NOT contain org2 team
      const org2Teams = response.teams.items.filter((t: any) => t.id === org2Team.id);
      expect(org2Teams.length).toBe(0);
    });

    it('should return only org2 teams when org2 admin queries teams', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAMS,
        {},
        org2AdminToken,
      );

      expect(response.teams).toBeDefined();
      expect(response.teams.items).toBeDefined();
      expect(Array.isArray(response.teams.items)).toBe(true);

      // Should contain org2 team
      const org2Teams = response.teams.items.filter((t: any) => t.id === org2Team.id);
      expect(org2Teams.length).toBe(1);

      // Should NOT contain org1 team
      const org1Teams = response.teams.items.filter((t: any) => t.id === org1Team.id);
      expect(org1Teams.length).toBe(0);
    });

    it('should return only org1 stores when org1 admin queries stores', async () => {
      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORES,
        {},
        org1AdminToken,
      );

      expect(response.stores).toBeDefined();
      expect(response.stores.items).toBeDefined();
      expect(Array.isArray(response.stores.items)).toBe(true);

      // Should contain org1 store
      const org1Stores = response.stores.items.filter((s: any) => s.id === org1Store.id);
      expect(org1Stores.length).toBe(1);

      // Should NOT contain org2 store
      const org2Stores = response.stores.items.filter((s: any) => s.id === org2Store.id);
      expect(org2Stores.length).toBe(0);
    });

    it('should return only org1 users when org1 admin queries users', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_USERS,
        {},
        org1AdminToken,
      );

      expect(response.users).toBeDefined();
      expect(response.users.items).toBeDefined();
      expect(Array.isArray(response.users.items)).toBe(true);

      // Should NOT contain org2 admin
      const org2Users = response.users.items.filter((u: any) => u.id === org2AdminUser.id);
      expect(org2Users.length).toBe(0);
    });

    it('should return only org1 attributes when org1 admin queries attributes', async () => {
      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.GET_ATTRIBUTES,
        {},
        org1AdminToken,
      );

      expect(response.attributes).toBeDefined();
      expect(response.attributes.items).toBeDefined();
      expect(Array.isArray(response.attributes.items)).toBe(true);

      // Should contain org1 attribute
      const org1Attributes = response.attributes.items.filter(
        (a: any) => a.id === org1Attribute.id,
      );
      expect(org1Attributes.length).toBe(1);

      // Should NOT contain org2 attribute
      const org2Attributes = response.attributes.items.filter(
        (a: any) => a.id === org2Attribute.id,
      );
      expect(org2Attributes.length).toBe(0);
    });

    it('should return only org1 tags when org1 admin queries tags', async () => {
      const response = await context.client.queryExpectSuccess(
        TAG_QUERIES.GET_TAGS,
        {},
        org1AdminToken,
      );

      expect(response.tags).toBeDefined();
      expect(response.tags.items).toBeDefined();
      expect(Array.isArray(response.tags.items)).toBe(true);

      // Should contain org1 tag
      const org1Tags = response.tags.items.filter((t: any) => t.id === org1Tag.id);
      expect(org1Tags.length).toBe(1);

      // Should NOT contain org2 tag
      const org2Tags = response.tags.items.filter((t: any) => t.id === org2Tag.id);
      expect(org2Tags.length).toBe(0);
    });
  });

  describe('Mutation Organization Validation', () => {
    it('should allow org1 admin to create team in their organization', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.CREATE_TEAM,
        {
          createTeamInput: {
            name: 'New Org1 Team',
          },
        },
        org1AdminToken,
      );

      TestValidators.validateTeam(response.createTeam, {
        name: 'New Org1 Team',
      });
    });

    it('should allow org1 admin to update team in their organization', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.UPDATE_TEAM,
        {
          updateTeamInput: {
            id: org1Team.id,
            name: 'Updated Org1 Team',
          },
        },
        org1AdminToken,
      );

      TestValidators.validateTeam(response.updateTeam, {
        name: 'Updated Org1 Team',
      });
    });

    it('should deny org1 admin from updating org2 team', async () => {
      // Returns "Team not found" instead of "Access denied" to avoid leaking information
      // about resources in other organizations (security best practice)
      await context.client.queryExpectError(
        TEAM_QUERIES.UPDATE_TEAM,
        'Team not found',
        {
          updateTeamInput: {
            id: org2Team.id,
            name: 'Attempted Update',
          },
        },
        org1AdminToken,
      );
    });

    it('should allow org1 admin to create attribute in their organization', async () => {
      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.CREATE_ATTRIBUTE,
        {
          createAttributeInput: {
            name: 'New Org1 Attribute',
            type: 'string',
          },
        },
        org1AdminToken,
      );

      TestValidators.validateAttribute(response.createAttribute, {
        name: 'New Org1 Attribute',
        type: 'string',
      });
    });

    it('should allow org1 admin to create tag in their organization', async () => {
      const response = await context.client.queryExpectSuccess(
        TAG_QUERIES.CREATE_TAG,
        {
          createTagInput: {
            name: 'New Org1 Tag',
          },
        },
        org1AdminToken,
      );

      TestValidators.validateTag(response.createTag, {
        name: 'New Org1 Tag',
      });
    });
  });

  describe('Error Handling', () => {
    it('should return NOT_FOUND error when resource does not exist', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      await context.client.queryExpectError(
        TEAM_QUERIES.GET_TEAM,
        'Team not found',
        { id: nonExistentId },
        org1AdminToken,
      );
    });

    it('should return NOT_FOUND error when accessing other organization resource', async () => {
      // Returns "Team not found" instead of "Access denied" to avoid leaking information
      // about resources in other organizations (security best practice)
      await context.client.queryExpectError(
        TEAM_QUERIES.GET_TEAM,
        'Team not found',
        { id: org2Team.id },
        org1AdminToken,
      );
    });

    it('should return proper error when organization context is invalid', async () => {
      // This would require a malformed token, which is tested in the auth guard
      // but we can test the integration here by ensuring the guard chain works
      await context.client.queryExpectError(
        TEAM_QUERIES.GET_TEAMS,
        'Unauthorized',
        {},
        // No token provided - should fail at AuthGuard before OrganizationGuard
      );
    });
  });

  describe('Special Cases', () => {
    it('should handle introspection queries without organization validation', async () => {
      // GraphQL introspection queries (starting with __) should bypass the guard
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
            }
          }
        }
      `;

      const response = await context.client.queryExpectSuccess(
        introspectionQuery,
        {},
        org1AdminToken,
      );

      expect(response.__schema).toBeDefined();
      expect(response.__schema.queryType).toBeDefined();
    });

    it('should automatically use user organization context for mutations', async () => {
      // Mutations automatically use the organization from the JWT token
      // No organizationName parameter needed - it's derived from auth context
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.CREATE_TEAM,
        {
          createTeamInput: {
            name: 'Auto Context Team',
          },
        },
        org1AdminToken,
      );

      TestValidators.validateTeam(response.createTeam, {
        name: 'Auto Context Team',
      });
    });
  });

  describe('Resource Type Detection', () => {
    it('should correctly detect and validate team resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_TEAM,
        { id: org1Team.id },
        org1AdminToken,
      );

      expect(response.team).toBeDefined();
      expect(response.team.id).toBe(org1Team.id);
    });

    it('should correctly detect and validate store resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        STORE_QUERIES.GET_STORE,
        { id: org1Store.id },
        org1AdminToken,
      );

      expect(response.store).toBeDefined();
      expect(response.store.id).toBe(org1Store.id);
    });

    it('should correctly detect and validate user resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        USER_QUERIES.GET_USER,
        { id: org1AdminUser.id },
        org1AdminToken,
      );

      expect(response.user).toBeDefined();
      expect(response.user.id).toBe(org1AdminUser.id);
    });

    it('should correctly detect and validate attribute resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        ATTRIBUTE_QUERIES.GET_ATTRIBUTE,
        { id: org1Attribute.id },
        org1AdminToken,
      );

      expect(response.attribute).toBeDefined();
      expect(response.attribute.id).toBe(org1Attribute.id);
    });

    it('should correctly detect and validate tag resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        TAG_QUERIES.GET_TAG,
        { id: org1Tag.id },
        org1AdminToken,
      );

      expect(response.tag).toBeDefined();
      expect(response.tag.id).toBe(org1Tag.id);
    });

    it('should correctly detect and validate chat resource type', async () => {
      const response = await context.client.queryExpectSuccess(
        CHAT_QUERIES.GET_CHAT_HISTORY,
        { id: org1Chat.id },
        org1AdminToken,
      );

      expect(response.chatHistory).toBeDefined();
      expect(response.chatHistory.id).toBe(org1Chat.id);
    });
  });
});
