import { CHAT_NOTE_QUERIES } from '../../fixtures/graphql/chat-note.queries';
import { TestValidators } from '../../utils/test-setup';
import {
  ChatTestContext,
  getSharedChatTestApp,
  cleanupSharedChatTestApp,
  setupChatTests,
} from '../chat/chat-test.setup';

const TEST_NOTES = {
  BASIC: { noteValue: 'Basic test note' },
  WITH_SPACES: {
    noteValue: '  Multiple    spaces    test  ',
    expectedValue: 'Multiple    spaces    test',
  },
  EMPTY: { noteValue: '' },
  WHITESPACE_ONLY: { noteValue: '   ' },
  MAX_LENGTH: { noteValue: 'a'.repeat(2000) },
  EXCEEDS_MAX: { noteValue: 'a'.repeat(2001) },
  FIRST: { noteValue: 'First note' },
  SECOND: { noteValue: 'Second note' },
  ORIGINAL: { noteValue: 'Original operator note' },
  UPDATED: { noteValue: 'Updated operator note' },
} as const;

const ERROR_MESSAGES = {
  FORBIDDEN: 'Forbidden',
  UNAUTHORIZED: 'Unauthorized',
  ACCESS_DENIED: 'Access denied',
  NOT_FOUND: 'not found',
  EMPTY_NOTE_VALUE: 'noteValue must be longer than or equal to 1 characters',
  NOTE_TOO_LONG: 'text is too long',
} as const;

// Test Helper Functions
class ChatNoteTestHelpers {
  static createNoteInput(chatId: string, noteValue: string) {
    return {
      chatId,
      noteValue,
    };
  }

  static updateNoteInput(id: string, chatId: string, noteValue: string) {
    return {
      id,
      chatId,
      noteValue,
    };
  }

  static removeNoteInput(id: string, chatId: string) {
    return {
      id,
      chatId,
    };
  }

  static validateNoteFields(note: any, expectedUserId: string, expectedNoteValue: string) {
    expect(note.id).toBeDefined();
    expect(typeof note.id).toBe('string');
    expect(note.userId).toBe(expectedUserId);
    expect(note.noteValue).toBe(expectedNoteValue);
    expect(note.isActive).toBe(true);
    expect(note.createdAt).toBeDefined();
    expect(note.updatedAt).toBeDefined();
  }

  static validateUserRelation(note: any) {
    expect(note.user).toBeDefined();
    expect(note.user.id).toBeDefined();
    expect(note.user.displayName).toBeDefined();
  }
}

describe('ChatNote Module (E2E)', () => {
  let context: ChatTestContext;
  let org1: any;
  let org2: any;
  let adminToken: string;
  let managerToken: string;
  let operatorToken: string;
  let org2AdminToken: string;

  let adminUser: any;
  let managerUser: any;
  let operatorUser: any;

  beforeAll(async () => {
    const baseContext = await getSharedChatTestApp();
    context = await setupChatTests(baseContext, 'chat_note');
  });

  beforeEach(async () => {
    const updated = await setupChatTests(context, 'chat_note');
    Object.assign(context, updated);

    org1 = context.org1;
    org2 = context.org2;
    adminUser = context.adminUser;
    managerUser = context.managerUser;
    operatorUser = context.operatorUser;

    adminToken = context.adminToken;
    managerToken = context.managerToken;
    operatorToken = context.operatorToken;
    org2AdminToken = context.org2AdminToken;
  });

  afterEach(async () => {
    await context.cleaner.cleanChatTestData(context.tenantSchemaNames);
  });

  afterAll(async () => {
    await cleanupSharedChatTestApp();
  });

  describe('notes (list)', () => {
    let endUser: any;
    let chat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser();
      chat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });

      // Create test notes with delay to ensure different timestamps
      await context.factory.createChatNote(chat.id, operatorUser.id, org1.name, {
        noteValue: TEST_NOTES.FIRST.noteValue,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      await context.factory.createChatNote(chat.id, adminUser.id, org1.name, {
        noteValue: TEST_NOTES.SECOND.noteValue,
      });
    });

    describe('authorization', () => {
      it('should allow ADMIN to list notes', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.notes).toBeInstanceOf(Array);
        expect(response.notes.length).toBe(2);
      });

      it('should allow MANAGER to list notes', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          managerToken,
        );

        expect(response.notes).toBeInstanceOf(Array);
        expect(response.notes.length).toBe(2);
      });

      it('should allow OPERATOR to list notes', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          operatorToken,
        );

        expect(response.notes).toBeInstanceOf(Array);
        expect(response.notes.length).toBe(2);
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.GET_NOTES,
          ERROR_MESSAGES.UNAUTHORIZED,
          { chatId: chat.id },
        );
      });
    });

    describe('basic listing', () => {
      it('should return notes with correct structure and user relation', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          adminToken,
        );

        TestValidators.validateChatNote(response.notes[0], {
          chatId: chat.id,
          userId: adminUser.id,
          noteValue: TEST_NOTES.SECOND.noteValue,
          isActive: true,
        });

        TestValidators.validateChatNote(response.notes[1], {
          chatId: chat.id,
          userId: operatorUser.id,
          noteValue: TEST_NOTES.FIRST.noteValue,
          isActive: true,
        });

        ChatNoteTestHelpers.validateUserRelation(response.notes[0]);
        ChatNoteTestHelpers.validateUserRelation(response.notes[1]);
      });

      it('should only return active notes', async () => {
        await context.factory.createChatNote(chat.id, adminUser.id, org1.name, {
          noteValue: 'Inactive note',
          isActive: false,
        });

        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.notes.length).toBe(2);
        expect(response.notes.every((note: any) => note.isActive === true)).toBe(true);
      });

      it('should order notes by updatedAt/createdAt descending', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          adminToken,
        );

        expect(response.notes[0].noteValue).toBe(TEST_NOTES.SECOND.noteValue);
        expect(response.notes[1].noteValue).toBe(TEST_NOTES.FIRST.noteValue);
        TestValidators.validateDescendingOrder(response.notes);
      });
    });

    describe('error cases', () => {
      it('should return error for non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.GET_NOTES,
          ERROR_MESSAGES.ACCESS_DENIED,
          { chatId: '00000000-0000-0000-0000-000000000000' },
          adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should not allow access to notes from other organizations', async () => {
        const org2EndUser = await context.factory.createEndUser();
        const org2Chat = await context.factory.createChat(org2.name, org2EndUser.userId);

        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.GET_NOTES,
          ERROR_MESSAGES.ACCESS_DENIED,
          { chatId: org2Chat.id },
          adminToken,
        );
      });

      it('should isolate notes per organization', async () => {
        const org2EndUser = await context.factory.createEndUser();
        const org2Chat = await context.factory.createChat(org2.name, org2EndUser.userId);
        const org2Admin = await context.factory.createUser(org2.name, 'ADMIN');

        await context.factory.createChatNote(org2Chat.id, org2Admin.id, org2.name, {
          noteValue: 'Org2 note',
        });

        const org1Response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: chat.id },
          adminToken,
        );

        const org2Response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: org2Chat.id },
          org2AdminToken,
        );

        expect(org1Response.notes.length).toBe(2);
        expect(org2Response.notes.length).toBe(1);
        expect(org1Response.notes.every((n: any) => n.noteValue !== 'Org2 note')).toBe(true);
      });
    });
  });

  describe('createNote', () => {
    let endUser: any;
    let chat: any;
    let assignedChat: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser();
      chat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });

      assignedChat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });
      await context.factory.assignUserToChat(assignedChat.id, operatorUser.id);
    });

    describe('authorization', () => {
      it('should allow ADMIN to create note on any chat', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatNote(response.createNote, {
          chatId: chat.id,
          userId: adminUser.id,
          noteValue: TEST_NOTES.BASIC.noteValue,
          isActive: true,
        });
      });

      it('should allow MANAGER to create note on any chat', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          managerToken,
        );

        TestValidators.validateChatNote(response.createNote, {
          chatId: chat.id,
          userId: managerUser.id,
          noteValue: TEST_NOTES.BASIC.noteValue,
          isActive: true,
        });
      });

      it('should allow OPERATOR to create note on assigned chat', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              assignedChat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          operatorToken,
        );

        TestValidators.validateChatNote(response.createNote, {
          chatId: assignedChat.id,
          userId: operatorUser.id,
          noteValue: TEST_NOTES.BASIC.noteValue,
          isActive: true,
        });
      });

      it('should deny OPERATOR from creating note on unassigned chat', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should trim and clean spaces from noteValue', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.WITH_SPACES.noteValue,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatNote(response.createNote, {
          chatId: chat.id,
          userId: adminUser.id,
          noteValue: TEST_NOTES.WITH_SPACES.expectedValue,
          isActive: true,
        });
      });

      it('should reject empty noteValue', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.EMPTY_NOTE_VALUE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.EMPTY.noteValue,
            ),
          },
          adminToken,
        );
      });

      it('should reject noteValue exceeding 2000 characters', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.NOTE_TOO_LONG,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.EXCEEDS_MAX.noteValue,
            ),
          },
          adminToken,
        );
      });

      it('should allow noteValue with exactly 2000 characters', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              chat.id,
              TEST_NOTES.MAX_LENGTH.noteValue,
            ),
          },
          adminToken,
        );

        TestValidators.validateChatNote(response.createNote, {
          chatId: chat.id,
          userId: adminUser.id,
          noteValue: TEST_NOTES.MAX_LENGTH.noteValue,
          isActive: true,
        });
      });
    });

    describe('error cases', () => {
      it('should return error for non-existent chat', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              '00000000-0000-0000-0000-000000000000',
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization note creation', async () => {
        const org2EndUser = await context.factory.createEndUser();
        const org2Chat = await context.factory.createChat(org2.name, org2EndUser.userId);

        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.CREATE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            createNoteInput: ChatNoteTestHelpers.createNoteInput(
              org2Chat.id,
              TEST_NOTES.BASIC.noteValue,
            ),
          },
          adminToken,
        );
      });
    });
  });

  describe('updateNote', () => {
    let endUser: any;
    let chat: any;
    let assignedChat: any;
    let operatorNote: any;
    let adminNote: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser();

      assignedChat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });
      await context.factory.assignUserToChat(assignedChat.id, operatorUser.id);

      chat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });

      operatorNote = await context.factory.createChatNote(
        assignedChat.id,
        operatorUser.id,
        org1.name,
        {
          noteValue: TEST_NOTES.ORIGINAL.noteValue,
        },
      );

      adminNote = await context.factory.createChatNote(chat.id, adminUser.id, org1.name, {
        noteValue: 'Original admin note',
      });
    });

    describe('authorization', () => {
      it('should allow note creator (OPERATOR) to update their own note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              TEST_NOTES.UPDATED.noteValue,
            ),
          },
          operatorToken,
        );

        TestValidators.validateChatNote(response.updateNote, {
          noteValue: TEST_NOTES.UPDATED.noteValue,
          isActive: true,
        });
        expect(response.updateNote.id).toBe(operatorNote.id);
        expect(response.updateNote.updatedAt).toBeDefined();
      });

      it('should allow ADMIN to update any note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              'Admin updated note',
            ),
          },
          adminToken,
        );

        TestValidators.validateChatNote(response.updateNote, {
          chatId: assignedChat.id,
          userId: adminUser.id,
          noteValue: 'Admin updated note',
          isActive: true,
        });
        expect(response.updateNote.id).toBe(operatorNote.id);
      });

      it('should allow MANAGER to update any note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              'Manager updated note',
            ),
          },
          managerToken,
        );

        TestValidators.validateChatNote(response.updateNote, {
          chatId: assignedChat.id,
          userId: managerUser.id,
          noteValue: 'Manager updated note',
          isActive: true,
        });
        expect(response.updateNote.id).toBe(operatorNote.id);
      });

      it('should deny OPERATOR from updating others notes', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              adminNote.id,
              chat.id,
              'Hacked note',
            ),
          },
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.UNAUTHORIZED,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              'Updated note',
            ),
          },
        );
      });
    });

    describe('validation', () => {
      it('should trim and clean spaces on update', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              TEST_NOTES.WITH_SPACES.noteValue,
            ),
          },
          operatorToken,
        );

        TestValidators.validateChatNote(response.updateNote, {
          chatId: assignedChat.id,
          noteValue: TEST_NOTES.WITH_SPACES.expectedValue,
          isActive: true,
        });
        expect(response.updateNote.id).toBe(operatorNote.id);
      });

      it('should reject empty noteValue on update', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.EMPTY_NOTE_VALUE,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              TEST_NOTES.EMPTY.noteValue,
            ),
          },
          operatorToken,
        );
      });

      it('should reject noteValue exceeding 2000 characters on update', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.NOTE_TOO_LONG,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              operatorNote.id,
              assignedChat.id,
              TEST_NOTES.EXCEEDS_MAX.noteValue,
            ),
          },
          operatorToken,
        );
      });
    });

    describe('error cases', () => {
      it('should deny update if note does not exist', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              '00000000-0000-0000-0000-000000000000',
              chat.id,
              'Updated note',
            ),
          },
          adminToken,
        );
      });

      it('should deny update if note is inactive', async () => {
        const inactiveNote = await context.factory.createChatNote(
          chat.id,
          adminUser.id,
          org1.name,
          {
            noteValue: 'Inactive note',
            isActive: false,
          },
        );

        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.NOT_FOUND,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              inactiveNote.id,
              chat.id,
              'Updated note',
            ),
          },
          adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization note update', async () => {
        const org2EndUser = await context.factory.createEndUser();
        const org2Chat = await context.factory.createChat(org2.name, org2EndUser.userId);
        const org2Admin = await context.factory.createUser(org2.name, 'ADMIN');
        const org2Note = await context.factory.createChatNote(org2Chat.id, org2Admin.id, org2.name);

        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.UPDATE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          {
            updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
              org2Note.id,
              org2Chat.id,
              'Hacked note',
            ),
          },
          adminToken,
        );
      });
    });
  });

  describe('removeNote', () => {
    let endUser: any;
    let chat: any;
    let assignedChat: any;
    let operatorNote: any;
    let adminNote: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser();

      assignedChat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });
      await context.factory.assignUserToChat(assignedChat.id, operatorUser.id);

      chat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });

      operatorNote = await context.factory.createChatNote(
        assignedChat.id,
        operatorUser.id,
        org1.name,
        {
          noteValue: 'Operator note to delete',
        },
      );

      adminNote = await context.factory.createChatNote(chat.id, adminUser.id, org1.name, {
        noteValue: 'Admin note to delete',
      });
    });

    describe('authorization', () => {
      it('should allow note creator (OPERATOR) to remove their own note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          operatorToken,
        );

        expect(response.removeNote.id).toBe(operatorNote.id);
        expect(response.removeNote.isActive).toBe(false);
        expect(response.removeNote.updatedAt).toBeDefined();
      });

      it('should allow ADMIN to remove any note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          adminToken,
        );

        expect(response.removeNote.id).toBe(operatorNote.id);
        expect(response.removeNote.isActive).toBe(false);
      });

      it('should allow MANAGER to remove any note', async () => {
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          managerToken,
        );

        expect(response.removeNote.id).toBe(operatorNote.id);
        expect(response.removeNote.isActive).toBe(false);
      });

      it('should deny OPERATOR from removing others notes', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          ChatNoteTestHelpers.removeNoteInput(adminNote.id, chat.id),
          operatorToken,
        );
      });

      it('should deny unauthenticated access', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ERROR_MESSAGES.UNAUTHORIZED,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
        );
      });
    });

    describe('soft delete behavior', () => {
      it('should verify soft delete (note still exists but inactive)', async () => {
        await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          operatorToken,
        );

        // Verify note is not returned in list query
        const response = await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.GET_NOTES,
          { chatId: assignedChat.id },
          operatorToken,
        );

        expect(response.notes.find((n: any) => n.id === operatorNote.id)).toBeUndefined();
      });

      it('should deny remove if note is already inactive', async () => {
        // First remove
        await context.client.queryExpectSuccess(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          operatorToken,
        );

        // Try to remove again
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ERROR_MESSAGES.NOT_FOUND,
          ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
          operatorToken,
        );
      });
    });

    describe('error cases', () => {
      it('should deny remove if note does not exist', async () => {
        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ERROR_MESSAGES.NOT_FOUND,
          ChatNoteTestHelpers.removeNoteInput('00000000-0000-0000-0000-000000000000', chat.id),
          adminToken,
        );
      });
    });

    describe('multi-tenancy', () => {
      it('should prevent cross-organization note removal', async () => {
        const org2EndUser = await context.factory.createEndUser();
        const org2Chat = await context.factory.createChat(org2.name, org2EndUser.userId);
        const org2Admin = await context.factory.createUser(org2.name, 'ADMIN');
        const org2Note = await context.factory.createChatNote(org2Chat.id, org2Admin.id, org2.name);

        await context.client.queryExpectError(
          CHAT_NOTE_QUERIES.REMOVE_NOTE,
          ERROR_MESSAGES.ACCESS_DENIED,
          ChatNoteTestHelpers.removeNoteInput(org2Note.id, org2Chat.id),
          adminToken,
        );
      });
    });
  });

  describe('Role-based authorization summary', () => {
    let endUser: any;
    let assignedChat: any;
    let unassignedChat: any;
    let operatorNote: any;

    beforeEach(async () => {
      endUser = await context.factory.createEndUser();

      assignedChat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });
      await context.factory.assignUserToChat(assignedChat.id, operatorUser.id);

      unassignedChat = await context.factory.createChat(org1.name, endUser.userId, {
        chatStatus: 'ADDRESSING',
      });

      operatorNote = await context.factory.createChatNote(
        assignedChat.id,
        operatorUser.id,
        org1.name,
      );
    });

    it('ADMIN should have full access to all note operations', async () => {
      // Can create on any chat
      const created = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.CREATE_NOTE,
        {
          createNoteInput: ChatNoteTestHelpers.createNoteInput(unassignedChat.id, 'Admin note'),
        },
        adminToken,
      );
      TestValidators.validateChatNote(created.createNote, {
        chatId: unassignedChat.id,
        noteValue: 'Admin note',
        isActive: true,
      });

      // Can update any note
      const updated = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.UPDATE_NOTE,
        {
          updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
            operatorNote.id,
            assignedChat.id,
            'Updated by admin',
          ),
        },
        adminToken,
      );
      TestValidators.validateChatNote(updated.updateNote, {
        noteValue: 'Updated by admin',
        isActive: true,
      });

      // Can remove any note
      const removed = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.REMOVE_NOTE,
        ChatNoteTestHelpers.removeNoteInput(created.createNote.id, unassignedChat.id),
        adminToken,
      );
      expect(removed.removeNote.isActive).toBe(false);
    });

    it('MANAGER should have full access to all note operations', async () => {
      // Can create on any chat
      const created = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.CREATE_NOTE,
        {
          createNoteInput: ChatNoteTestHelpers.createNoteInput(unassignedChat.id, 'Manager note'),
        },
        managerToken,
      );
      TestValidators.validateChatNote(created.createNote, {
        chatId: unassignedChat.id,
        noteValue: 'Manager note',
        isActive: true,
      });

      // Can update any note
      const updated = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.UPDATE_NOTE,
        {
          updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
            operatorNote.id,
            assignedChat.id,
            'Updated by manager',
          ),
        },
        managerToken,
      );
      TestValidators.validateChatNote(updated.updateNote, {
        noteValue: 'Updated by manager',
        isActive: true,
      });

      // Can remove any note
      const removed = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.REMOVE_NOTE,
        ChatNoteTestHelpers.removeNoteInput(created.createNote.id, unassignedChat.id),
        managerToken,
      );
      expect(removed.removeNote.isActive).toBe(false);
    });

    it('OPERATOR should have limited access to note operations', async () => {
      // Can create only on assigned chat
      const created = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.CREATE_NOTE,
        {
          createNoteInput: ChatNoteTestHelpers.createNoteInput(assignedChat.id, 'Operator note'),
        },
        operatorToken,
      );
      TestValidators.validateChatNote(created.createNote, {
        chatId: assignedChat.id,
        noteValue: 'Operator note',
        isActive: true,
      });

      // Cannot create on unassigned chat
      await context.client.queryExpectError(
        CHAT_NOTE_QUERIES.CREATE_NOTE,
        ERROR_MESSAGES.ACCESS_DENIED,
        {
          createNoteInput: ChatNoteTestHelpers.createNoteInput(unassignedChat.id, 'Unauthorized'),
        },
        operatorToken,
      );

      // Can update own note
      const updated = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.UPDATE_NOTE,
        {
          updateNoteInput: ChatNoteTestHelpers.updateNoteInput(
            operatorNote.id,
            assignedChat.id,
            'Updated own note',
          ),
        },
        operatorToken,
      );
      TestValidators.validateChatNote(updated.updateNote, {
        noteValue: 'Updated own note',
        isActive: true,
      });

      // Can remove own note
      const removed = await context.client.queryExpectSuccess(
        CHAT_NOTE_QUERIES.REMOVE_NOTE,
        ChatNoteTestHelpers.removeNoteInput(operatorNote.id, assignedChat.id),
        operatorToken,
      );
      expect(removed.removeNote.isActive).toBe(false);
    });
  });
});
