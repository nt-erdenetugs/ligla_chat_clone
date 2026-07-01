import { CHAT_ASSIGNMENT_QUERIES } from '../../fixtures/graphql/chat-assignment.queries';
import { CHAT_QUERIES } from '../../fixtures/graphql/chat.queries';
import { TEAM_QUERIES } from '../../fixtures/graphql/team.queries';
import { TestSetup, TestValidators, TestContext } from '../../utils/test-setup';

const TEST_ORGANIZATIONS = {
  ORG1: 'chat_assignment_test_org1',
  ORG2: 'chat_assignment_test_org2',
} as const;

const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  CHAT_NOT_FOUND: 'Chat not found',
  TEAM_NOT_FOUND: 'Team not found',
  OPERATOR_NOT_FOUND: 'Assigned operator not found',
  CANNOT_ASSIGN_TEAM: 'You cannot assign a team to a chat',
  TEAM_ALREADY_ASSIGNED: 'Team already assigned to chat',
  TEAM_NOT_ASSIGNED: 'Team not assigned to chat',
  OPERATOR_FROM_ANOTHER_TEAM: 'You cannot assign an operator from another team to this chat',
  CANNOT_REMOVE_ASSIGNED_OPERATOR_TEAM: 'Cannot remove team with assigned operator',
  CANNOT_REMOVE_DEFAULT_TEAM_WITH_ADMIN: 'Cannot remove default team with assigned admin',
} as const;

const TEST_USERS = {
  OPERATOR_2: { displayName: 'Operator 2', role: 'OPERATOR' },
  ADMIN_OPERATOR: { displayName: 'Admin Operator', role: 'ADMIN_OPERATOR' },
  OPERATOR_NOT_IN_TEAM: { displayName: 'Operator Not In Team', role: 'OPERATOR' },
} as const;

const TEST_TEAMS = {
  TEAM_1: { name: 'Team 1' },
  TEAM_2: { name: 'Team 2' },
  DEFAULT: { name: 'Default', isDefault: true },
  DIFFERENT: { name: 'Different Team' },
  UNASSIGNED: { name: 'Unassigned Team' },
} as const;

// Test Helper Class
class ChatAssignmentTestHelpers {
  static createChatAssignInput(chatId: string, assignedUserId: string) {
    return {
      chatId,
      assignedUserId,
    };
  }

  static createChatTeamAssignInput(chatId: string, teamId: string) {
    return {
      chatId,
      teamId,
    };
  }

  static validateOperatorAssignment(
    activity: any,
    chatId: string,
    newUserId: string,
    oldUserId?: string,
  ) {
    TestValidators.validateChatActivity(activity, {
      chatId,
      activityType: 'USER_CHANGE',
      newUserId,
      ...(oldUserId && { oldUserId }),
    });
  }

  static validateTeamAssignment(activity: any, chatId: string, action: 'ADDED' | 'REMOVED') {
    TestValidators.validateChatActivity(activity, {
      chatId,
      activityType: 'TEAMS_CHANGE',
      teamAssignAction: action,
    });
  }

  static async verifyTeamsAssignedToChat(
    client: any,
    chatId: string,
    expectedTeamIds: string[],
    token: string,
  ) {
    const response = await client.queryExpectSuccess(
      CHAT_QUERIES.GET_CHAT_HISTORY,
      { id: chatId },
      token,
    );
    const actualTeamIds = response.chatHistory.chatTeamAssignment.map((cta: any) => cta.teamId);
    expect(actualTeamIds).toHaveLength(expectedTeamIds.length);
    expectedTeamIds.forEach((teamId) => expect(actualTeamIds).toContain(teamId));
  }

  static async verifyDefaultTeamAssigned(client: any, chatId: string, token: string) {
    const response = await client.queryExpectSuccess(
      CHAT_QUERIES.GET_CHAT_HISTORY,
      { id: chatId },
      token,
    );
    const hasDefaultTeam = response.chatHistory.chatTeamAssignment.some(
      (cta: any) => cta.team.name === 'Default',
    );
    expect(hasDefaultTeam).toBe(true);
  }
}

describe('Chat Assignment Module (E2E)', () => {
  let context: TestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let adminUser: any;
  let operatorUser: any;
  let operator2: any;
  let adminOperator: any;
  let tenantSchemaNames: string[];
  let endUser: any;
  let chat: any;
  let team1: any;
  let team2: any;

  beforeAll(async () => {
    context = await TestSetup.createTestApp();
    const { organizations, users, tokens } = await TestSetup.createStandardTestData(
      context.factory,
      context.authHelper,
      TEST_ORGANIZATIONS.ORG1,
      TEST_ORGANIZATIONS.ORG2,
    );

    org1 = organizations.org1;
    org2 = organizations.org2;
    adminUser = users.adminUser;
    operatorUser = users.operatorUser;
    adminToken = tokens.adminToken;
    managerToken = tokens.managerToken;
    operatorToken = tokens.operatorToken;

    tenantSchemaNames = await Promise.all([
      context.factory.getTenantSchemaNameForOrganization(org1.name),
      context.factory.getTenantSchemaNameForOrganization(org2.name),
    ]);

    operator2 = await context.factory.createUser(org1.name, TEST_USERS.OPERATOR_2.role, {
      displayName: TEST_USERS.OPERATOR_2.displayName,
    });
    adminOperator = await context.factory.createUser(org1.name, TEST_USERS.ADMIN_OPERATOR.role, {
      displayName: TEST_USERS.ADMIN_OPERATOR.displayName,
    });
  });

  beforeEach(async () => {
    // Create teams
    team1 = await context.factory.createTeam(org1.name, TEST_TEAMS.TEAM_1);
    team2 = await context.factory.createTeam(org1.name, TEST_TEAMS.TEAM_2);
    const defaultTeam = await context.factory.createTeam(org1.name, TEST_TEAMS.DEFAULT);

    // Add operators to teams
    await context.factory.addUserToTeam(team1.id, operatorUser.id);
    await context.factory.addUserToTeam(team1.id, operator2.id);
    await context.factory.addUserToTeam(team2.id, operator2.id);
    await context.factory.addUserToTeam(defaultTeam.id, adminOperator.id);

    // Create end user and chat
    endUser = await context.factory.createEndUser();
    chat = await context.factory.createChat(org1.name, endUser.userId, {
      chatStatus: 'PENDING',
    });
  });

  afterEach(async () => {
    await context.cleaner.cleanChatAssignmentTestData(tenantSchemaNames);
  });

  afterAll(async () => {
    await TestSetup.cleanupTestApp(context);
  });

  describe('assignOperatorToChat', () => {
    beforeEach(async () => {
      await context.factory.assignTeamToChat(chat.id, team1.id);
    });

    describe('successful operator assignment', () => {
      it('should allow ADMIN to assign operator', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorUser.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          operatorUser.id,
        );
      });

      it('should allow MANAGER to assign operator', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorUser.id,
            ),
          },
          managerToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          operatorUser.id,
        );
      });

      it('should allow operator to self-assign', async () => {
        const operatorToken2 = context.authHelper.generateToken(operatorUser.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorUser.id,
            ),
          },
          operatorToken2,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          operatorUser.id,
        );
      });

      it('should allow reassigning operator', async () => {
        await context.factory.assignUserToChat(chat.id, operatorUser.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(chat.id, operator2.id),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          operator2.id,
          operatorUser.id,
        );
      });

      it('should record activity with correct user names', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorUser.id,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatActivity(response.assignOperatorToChat, {
          activityType: 'USER_CHANGE',
          actorUserName: adminUser.displayName,
          newUserId: operatorUser.id,
          newUserName: operatorUser.displayName,
        });
      });
    });

    describe('admin operator privileges', () => {
      it('should assign admin operator to chat with teams', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              adminOperator.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          adminOperator.id,
        );
      });

      it('should auto-assign default team when admin operator assigned to chat without teams', async () => {
        const chatWithoutTeam = await context.factory.createChat(org1.name, endUser.userId, {
          chatStatus: 'PENDING',
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chatWithoutTeam.id,
              adminOperator.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chatWithoutTeam.id,
          adminOperator.id,
        );

        await ChatAssignmentTestHelpers.verifyDefaultTeamAssigned(
          context.client,
          chatWithoutTeam.id,
          adminToken,
        );
      });

      it('should allow admin operator to self-assign without being in chat teams', async () => {
        const adminOpToken = context.authHelper.generateToken(adminOperator.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              adminOperator.id,
            ),
          },
          adminOpToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          adminOperator.id,
        );
      });
    });

    describe('validation and error handling', () => {
      it('should reject assigning operator not in chat team', async () => {
        const operatorNotInTeam = await context.factory.createUser(
          org1.name,
          TEST_USERS.OPERATOR_NOT_IN_TEAM.role,
          { displayName: TEST_USERS.OPERATOR_NOT_IN_TEAM.displayName },
        );

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.OPERATOR_FROM_ANOTHER_TEAM,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorNotInTeam.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject assigning non-existent operator', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.OPERATOR_NOT_FOUND,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminToken,
        );
      });

      it('should reject assigning to non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              '00000000-0000-0000-0000-000000000000',
              operatorUser.id,
            ),
          },
          adminToken,
        );
      });

      it('should prevent cross-organization assignment', async () => {
        const org2Chat = await context.factory.createChat(org2.name, endUser.userId, {
          chatStatus: 'PENDING',
        });

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              org2Chat.id,
              operatorUser.id,
            ),
          },
          adminToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorUser.id,
            ),
          },
        );
      });
    });

    describe('multi-team scenarios', () => {
      it('should assign operator in multiple teams', async () => {
        await context.factory.assignTeamToChat(chat.id, team2.id);

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(chat.id, operator2.id),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateOperatorAssignment(
          response.assignOperatorToChat,
          chat.id,
          operator2.id,
        );
      });

      it('should reject operator from different team', async () => {
        const differentTeam = await context.factory.createTeam(org1.name, TEST_TEAMS.DIFFERENT);
        const operatorNotInTeam = await context.factory.createUser(
          org1.name,
          TEST_USERS.OPERATOR_NOT_IN_TEAM.role,
          { displayName: TEST_USERS.OPERATOR_NOT_IN_TEAM.displayName },
        );
        await context.factory.addUserToTeam(differentTeam.id, operatorNotInTeam.id);

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_OPERATOR_TO_CHAT,
          ERROR_MESSAGES.OPERATOR_FROM_ANOTHER_TEAM,
          {
            chatAssignInput: ChatAssignmentTestHelpers.createChatAssignInput(
              chat.id,
              operatorNotInTeam.id,
            ),
          },
          adminToken,
        );
      });
    });
  });

  describe('assignTeamToChat', () => {
    describe('successful team assignment', () => {
      it('should allow ADMIN to assign team', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateTeamAssignment(
          response.assignTeamToChat,
          chat.id,
          'ADDED',
        );
      });

      it('should allow MANAGER to assign team', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          managerToken,
        );

        ChatAssignmentTestHelpers.validateTeamAssignment(
          response.assignTeamToChat,
          chat.id,
          'ADDED',
        );
      });

      it('should allow assigning multiple teams to chat', async () => {
        await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team2.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateTeamAssignment(
          response.assignTeamToChat,
          chat.id,
          'ADDED',
        );

        await ChatAssignmentTestHelpers.verifyTeamsAssignedToChat(
          context.client,
          chat.id,
          [team1.id, team2.id],
          adminToken,
        );
      });

      it('should record activity with correct team names', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatActivity(response.assignTeamToChat, {
          activityType: 'TEAMS_CHANGE',
          actorUserName: adminUser.displayName,
        });
        expect(response.assignTeamToChat.changedTeamName).toBe(team1.name);
      });
    });

    describe('authorization and permissions', () => {
      it('should deny OPERATOR from assigning team', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          undefined,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
        );
      });
    });

    describe('validation and error handling', () => {
      it('should reject assigning same team twice', async () => {
        await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          ERROR_MESSAGES.TEAM_ALREADY_ASSIGNED,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject assigning to non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              '00000000-0000-0000-0000-000000000000',
              team1.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject assigning non-existent team', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          ERROR_MESSAGES.TEAM_NOT_FOUND,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminToken,
        );
      });

      it('should prevent cross-organization team assignment', async () => {
        const org2Chat = await context.factory.createChat(org2.name, endUser.userId, {
          chatStatus: 'PENDING',
        });

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.ASSIGN_TEAM_TO_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              org2Chat.id,
              team1.id,
            ),
          },
          adminToken,
        );
      });
    });
  });

  describe('removeTeamFromChat', () => {
    beforeEach(async () => {
      await context.factory.assignTeamToChat(chat.id, team1.id);
      await context.factory.assignTeamToChat(chat.id, team2.id);
    });

    describe('successful team removal', () => {
      it('should allow ADMIN to remove team', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        ChatAssignmentTestHelpers.validateTeamAssignment(
          response.removeTeamFromChat,
          chat.id,
          'REMOVED',
        );

        await ChatAssignmentTestHelpers.verifyTeamsAssignedToChat(
          context.client,
          chat.id,
          [team2.id],
          adminToken,
        );
      });

      it('should allow MANAGER to remove team', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          managerToken,
        );

        ChatAssignmentTestHelpers.validateTeamAssignment(
          response.removeTeamFromChat,
          chat.id,
          'REMOVED',
        );
      });

      it('should record activity with correct team names', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatActivity(response.removeTeamFromChat, {
          activityType: 'TEAMS_CHANGE',
          actorUserName: adminUser.displayName,
          teamAssignAction: 'REMOVED',
        });
        expect(response.removeTeamFromChat.changedTeamName).toBe(team1.name);
      });
    });

    describe('authorization and permissions', () => {
      it('should deny OPERATOR from removing team', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          undefined,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
        );
      });
    });

    describe('validation and error handling', () => {
      it('should reject removing team that is not assigned', async () => {
        const unassignedTeam = await context.factory.createTeam(org1.name, TEST_TEAMS.UNASSIGNED);

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.TEAM_NOT_ASSIGNED,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              unassignedTeam.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject removing team when assigned operator would be left without team', async () => {
        await context.factory.assignUserToChat(chat.id, operatorUser.id);
        await context.client.queryExpectSuccess(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team2.id,
            ),
          },
          adminToken,
        );

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.CANNOT_REMOVE_ASSIGNED_OPERATOR_TEAM,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              team1.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject removing default team when admin operator is assigned', async () => {
        const defaultTeam = await context.factory.createTeam(org1.name, TEST_TEAMS.DEFAULT);
        await context.factory.assignTeamToChat(chat.id, defaultTeam.id);
        await context.factory.assignUserToChat(chat.id, adminOperator.id);

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.CANNOT_REMOVE_DEFAULT_TEAM_WITH_ADMIN,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              defaultTeam.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject removing from non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              '00000000-0000-0000-0000-000000000000',
              team1.id,
            ),
          },
          adminToken,
        );
      });

      it('should reject removing non-existent team', async () => {
        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.TEAM_NOT_ASSIGNED,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              chat.id,
              '00000000-0000-0000-0000-000000000000',
            ),
          },
          adminToken,
        );
      });

      it('should prevent cross-organization team removal', async () => {
        const org2Chat = await context.factory.createChat(org2.name, endUser.userId, {
          chatStatus: 'PENDING',
        });

        await context.client.queryExpectError(
          CHAT_ASSIGNMENT_QUERIES.REMOVE_TEAM_FROM_CHAT,
          ERROR_MESSAGES.CHAT_NOT_FOUND,
          {
            chatTeamAssignInput: ChatAssignmentTestHelpers.createChatTeamAssignInput(
              org2Chat.id,
              team1.id,
            ),
          },
          adminToken,
        );
      });
    });
  });

  describe('default team auto-assignment', () => {
    it('should verify default team exists and is configured correctly', async () => {
      const teamsResponse = await context.client.queryExpectSuccess(
        TEAM_QUERIES.GET_SELECTABLE_TEAMS,
        {},
        adminToken,
      );
      const defaultTeams = teamsResponse.selectableTeams.filter((t: any) => t.isDefault);

      expect(defaultTeams.length).toBeGreaterThan(0);
      const defaultTeam = defaultTeams[0];
      expect(defaultTeam.name).toBe('Default');
    });
  });
});
