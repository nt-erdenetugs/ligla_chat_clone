import { v4 as generateUuid, v5 as uuidv5 } from 'uuid';

import { generateRange } from '@/common/utils/array';
import { SenderType } from '@/modules/chat/entities/chat-message.entity';
import { ChatStatus } from '@/modules/chat/entities/chat.entity';
import { ChatMessageType } from '@/modules/chat/enums';
import { UserRoleType } from '@/modules/user/enums';
import * as schema from '@@/drizzle/schema';

type chatMessage = typeof schema.chatMessage.$inferSelect;
// Constants
const DEFAULT_SEED_LENGTH = 50;

export const SAMPLE = {
  ORGANIZATION_1: {
    name: 'ligla_chat',
    emailDomain: 'liglachat',
    loginLiffId: 'ligla',
    fileUploadLiffId: '2000000001-upload',
  },
  ORGANIZATION_2: {
    name: 'test_org',
    emailDomain: 'testorg',
    loginLiffId: 'test',
    fileUploadLiffId: null,
  },
};

export const TEAM_NAMES = [
  { name: 'Team 1 (Default)', isDefault: true },
  { name: 'Team 2', isDefault: false },
  ...generateRange(DEFAULT_SEED_LENGTH, 3).map((i) => ({
    name: `Team ${i}`,
    isDefault: false,
  })),
];

const STORE_NAMES_WITH_ORG = [
  { organizationName: SAMPLE.ORGANIZATION_1.name, storeName: 'Store-1' },
  { organizationName: SAMPLE.ORGANIZATION_2.name, storeName: 'Store-2' },
  ...generateRange(DEFAULT_SEED_LENGTH, 3).map((i) => ({
    organizationName: SAMPLE.ORGANIZATION_1.name,
    storeName: `Store-${i}`,
  })),
];

const TIME_UNITS = {
  MINUTE: 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

// Shared with backend-core/scripts/seed_tenant_data.py — keep in sync
export const DEFAULT_PASSWORD = 'ligla_Chat@2024';

// Namespace UUID for deterministic seed data generation
const SEED_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

function generateStaticId(endsWith: number | string): string {
  // Generate a valid UUID v5 based on the suffix for deterministic seed data
  const name = `seed-id-${endsWith}`;
  return uuidv5(name, SEED_NAMESPACE);
}

const createOrganization = (
  name: string,
  displayName: string,
  maxOperator: number,
  loginLiffId: string,
  fileUploadLiffId: string | null,
) => ({
  name,
  displayName,
  maxOperator,
  loginLiffId,
  fileUploadLiffId,
});

const createOrganizations = (startIndex: number, length = DEFAULT_SEED_LENGTH) =>
  generateRange(length, startIndex).map((i) =>
    createOrganization(
      `organization_${i}`,
      `Organization ${i}`,
      10,
      `test-${i}`,
      `200000000${i}-upload`,
    ),
  );

const createTeam = (name: string, organizationName: string, isDefault: boolean) => ({
  id: generateUuid(),
  name,
  organizationName,
  isDefault,
});

const createStore = (name: string, index: number, organizationName: string) => ({
  id: generateUuid(),
  name,
  areaName: 'Location area',
  typeName: 'Apparel',
  liglaStoreId: index,
  organizationName,
});

const createUser = (
  displayName: string,
  email: string,
  roleType: UserRoleType,
  organizationName = SAMPLE.ORGANIZATION_1.name,
  userId = generateUuid(),
) => ({
  userId,
  displayName,
  email,
  pictureUrl: '',
  password: DEFAULT_PASSWORD,
  roleType,
  organizationName,
});

const createUsers = (
  baseName: string,
  baseEmailPrefix: string,
  roleType: UserRoleType,
  count = 19,
  startIndex = 2,
  orgName = SAMPLE.ORGANIZATION_1.name,
) => {
  return Array.from({ length: count }, (_, i) => {
    const index = i + startIndex;
    return createUser(
      `${baseName} ${index}`,
      `${baseEmailPrefix}${index}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
      roleType,
      orgName,
      generateUuid(),
    );
  });
};

// Organizations and Teams
export const SAMPLE_ORGANIZATIONS = [
  createOrganization(
    SAMPLE.ORGANIZATION_1.name,
    'Ligla Chat',
    100,
    SAMPLE.ORGANIZATION_1.loginLiffId,
    SAMPLE.ORGANIZATION_1.fileUploadLiffId,
  ),
  createOrganization(
    SAMPLE.ORGANIZATION_2.name,
    'Test Org',
    10,
    SAMPLE.ORGANIZATION_2.loginLiffId,
    SAMPLE.ORGANIZATION_2.fileUploadLiffId,
  ),
  ...createOrganizations(3, 1),
];

export const SAMPLE_TEAMS = SAMPLE_ORGANIZATIONS.flatMap((org) => {
  const getTeamsForOrganization = (orgName: string) => {
    if (orgName === SAMPLE.ORGANIZATION_1.name) {
      return TEAM_NAMES;
    } else if (orgName === SAMPLE.ORGANIZATION_2.name) {
      return TEAM_NAMES.slice(0, 2);
    }
    return [];
  };

  const teams = getTeamsForOrganization(org.name);
  return teams.map(({ name, isDefault }) => createTeam(name, org.name, isDefault));
});

export const SAMPLE_STORES = SAMPLE_ORGANIZATIONS.flatMap((org) => {
  const stores = STORE_NAMES_WITH_ORG.filter((store) => store.organizationName === org.name);
  return stores.map((store, i) => createStore(store.storeName, i + 1, org.name));
});

// Hypervisor User
export const SAMPLE_HYPERVISOR_USERS = [
  {
    userId: generateUuid(),
    email: 'hypervisor@liglachat.com',
    password: DEFAULT_PASSWORD,
  },
];

// Sample Users
const USER_PREFIXES = {
  admin: {
    name: 'Admin',
    email: 'admin',
  },
  adminOperator: {
    name: 'Admin Operator',
    email: 'admin-operator',
  },
  manager: {
    name: 'Manager',
    email: 'manager',
  },
  managerOperator: {
    name: 'Manager Operator',
    email: 'manager-operator',
  },
  operator: {
    name: 'Operator',
    email: 'operator',
  },
};

export const TEAM_1_USERS_EMAILS = [
  USER_PREFIXES.admin.email,
  USER_PREFIXES.adminOperator.email,
  USER_PREFIXES.manager.email,
  USER_PREFIXES.managerOperator.email,
  USER_PREFIXES.operator.email,
  'operator2',
].map((user) => `${user}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`);

export const TEAM_2_USERS_EMAILS = ['operator3', 'operator4'].map(
  (user) => `${user}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
);

export const ORGANIZATION_2_USERS_EMAILS = [
  USER_PREFIXES.admin.email,
  USER_PREFIXES.operator.email,
].map((user) => `${user}@${SAMPLE.ORGANIZATION_2.emailDomain}.com`);

const SAMPLE_OPERATOR_USERS = [
  createUser(
    'Operator General',
    `operator@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
    generateStaticId(1),
  ),
  createUser(
    'Operator 2',
    `operator2@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
    generateStaticId(2),
  ),
  createUser(
    'Operator 3',
    `operator3@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
    generateStaticId(3),
  ),
  createUser(
    'Operator 4',
    `operator4@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
    generateStaticId(4),
  ),
  ...createUsers(
    USER_PREFIXES.operator.name,
    USER_PREFIXES.operator.email,
    UserRoleType.OPERATOR,
    46, // Create additional operators up to 50 follow the 4 operators created above
    5, // Start indexes at 5 to follow the 4 operators created above
  ),
];

const ORGANIZATION_1_USERS = [
  createUser(
    `${USER_PREFIXES.admin.name} General`,
    `${USER_PREFIXES.admin.email}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.ADMIN,
    SAMPLE.ORGANIZATION_1.name,
  ),
  createUser(
    USER_PREFIXES.adminOperator.name,
    `${USER_PREFIXES.adminOperator.email}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.ADMIN_OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
  ),
  createUser(
    `${USER_PREFIXES.manager.name} General`,
    `${USER_PREFIXES.manager.email}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.MANAGER,
    SAMPLE.ORGANIZATION_1.name,
  ),
  createUser(
    USER_PREFIXES.managerOperator.name,
    `${USER_PREFIXES.managerOperator.email}@${SAMPLE.ORGANIZATION_1.emailDomain}.com`,
    UserRoleType.MANAGER_OPERATOR,
    SAMPLE.ORGANIZATION_1.name,
  ),
  ...createUsers(
    USER_PREFIXES.adminOperator.name,
    USER_PREFIXES.adminOperator.email,
    UserRoleType.ADMIN_OPERATOR,
  ),
  ...createUsers(USER_PREFIXES.manager.name, USER_PREFIXES.manager.email, UserRoleType.MANAGER),
  ...createUsers(
    USER_PREFIXES.managerOperator.name,
    USER_PREFIXES.managerOperator.email,
    UserRoleType.MANAGER_OPERATOR,
  ),
  ...SAMPLE_OPERATOR_USERS,
];

const ORGANIZATION_2_USERS = [
  createUser(
    `${USER_PREFIXES.admin.name} General`,
    `${USER_PREFIXES.admin.email}@${SAMPLE.ORGANIZATION_2.emailDomain}.com`,
    UserRoleType.ADMIN,
    SAMPLE.ORGANIZATION_2.name,
  ),
  createUser(
    'Operator General',
    `${USER_PREFIXES.operator.email}@${SAMPLE.ORGANIZATION_2.emailDomain}.com`,
    UserRoleType.OPERATOR,
    SAMPLE.ORGANIZATION_2.name,
    generateStaticId(5),
  ),
];

export const SAMPLE_USERS = [...ORGANIZATION_1_USERS, ...ORGANIZATION_2_USERS];

// End Users
export const SAMPLE_END_USERS = [
  {
    userId: 'Uc6c3264e8bbb2f3c67fed76400d858b9',
    clientUserId: 'client_user_1',
    displayName: 'LINE Taro',
    pictureUrl: '',
  },
  {
    userId: 'Uae35f45f35f1af5b3f8d4756a9ddcb23',
    displayName: 'Test user',
    clientUserId: 'client_user_2',
    pictureUrl: '',
  },
  {
    userId: 'U7bc45d12f3a678e9b4f52a3c89d14f5a',
    displayName: 'Test end user',
    clientUserId: 'client_user_3',
    pictureUrl: '',
  },
];

// Chat Times
const [AChatStartTime, AChatEndTime] = [
  new Date(Date.now() - TIME_UNITS.DAY),
  new Date(Date.now() - 3 * TIME_UNITS.MINUTE),
];
const [BChatStartTime, BChatEndTime] = [
  new Date(Date.now() - 3 * TIME_UNITS.DAY),
  new Date(Date.now() - 2 * TIME_UNITS.DAY),
];
const [CChatStartTime, CChatEndTime] = [
  new Date(Date.now() - 5 * TIME_UNITS.DAY),
  new Date(Date.now() - 4 * TIME_UNITS.DAY),
];

// Chat Data
export const SAMPLE_CHATS = [
  {
    id: generateStaticId(10),
    endUserId: SAMPLE_END_USERS[0].userId,
    clientUserId: SAMPLE_END_USERS[0].clientUserId,
    assignedUserId: SAMPLE_OPERATOR_USERS[0].userId,
    chatStatus: ChatStatus.ADDRESSING,
    organizationName: SAMPLE.ORGANIZATION_1.name,
    createdAt: AChatStartTime,
  },
  {
    id: generateStaticId(11),
    endUserId: SAMPLE_END_USERS[1].userId,
    clientUserId: SAMPLE_END_USERS[1].clientUserId,
    assignedUserId: SAMPLE_OPERATOR_USERS[0].userId,
    chatStatus: ChatStatus.ADDRESSING,
    organizationName: SAMPLE.ORGANIZATION_1.name,
    createdAt: BChatStartTime,
  },
  {
    id: generateStaticId(12),
    endUserId: SAMPLE_END_USERS[2].userId,
    clientUserId: SAMPLE_END_USERS[2].clientUserId,
    assignedUserId: null,
    chatStatus: ChatStatus.PENDING,
    organizationName: SAMPLE.ORGANIZATION_1.name,
    createdAt: CChatStartTime,
  },
];

export type Chat = (typeof SAMPLE_CHATS)[number];

// Chat Assignees
export const SAMPLE_CHAT_TEAM_ASSIGNMENTS = SAMPLE_CHATS.map((chat) => ({
  id: generateUuid(),
  teamId: '',
  chatId: chat.id,
}));

// Chat Templates and Messages
const generateContextualMessages = (
  chatId: string,
  template: { senderType: SenderType; text: string }[],
  endUserId: string,
  startTime: Date,
  endTime: Date,
): chatMessage[] => {
  const messages = template.map((message, index) => {
    const { senderType, text } = message;
    const senderId =
      senderType === SenderType.END_USER ? endUserId : SAMPLE_OPERATOR_USERS[0].userId;
    const timestamp = new Date(
      startTime.getTime() +
        ((endTime.getTime() - startTime.getTime()) * (index + 1)) / template.length,
    );

    return {
      id: generateUuid(),
      chatId,
      senderId,
      senderType,
      type: ChatMessageType.TEXT,
      content: { text },
      isDelivered: true,
      createdAt: timestamp,
      previewImageUrl: null,
      messageId: null,
      isUnsent: false,
      contentUrl: null,
      duration: null,
      latitude: null,
      longitude: null,
      quoteToken: null,
      fileName: null,
      fileSize: null,
      stickerId: null,
      packageId: null,
      stickerResourceType: null,
      quotedMessageId: null,
      address: null,
      title: null,
      image: null,
      keywords: [],
      emojis: {},
      text,
      isEncrypted: false,
    };
  });

  return messages;
};

const chatTimes = [
  {
    startTime: AChatStartTime,
    endTime: AChatEndTime,
  },
  {
    startTime: BChatStartTime,
    endTime: BChatEndTime,
  },
  {
    startTime: CChatStartTime,
    endTime: CChatEndTime,
  },
];

const CHAT_TEMPLATES = [
  [
    { senderType: SenderType.END_USER, text: 'Hi, I have a question.' },
    { senderType: SenderType.OPERATOR, text: 'Hello.' },
    { senderType: SenderType.OPERATOR, text: 'Sure, how can I assist you?' },
    { senderType: SenderType.END_USER, text: "I'm having trouble with my order." },
    { senderType: SenderType.OPERATOR, text: 'Can you share your order ID, please?' },
    { senderType: SenderType.END_USER, text: "It's 12345." },
    { senderType: SenderType.OPERATOR, text: "Thanks! I'll check it right now." },
    { senderType: SenderType.END_USER, text: 'Okay!' },
    { senderType: SenderType.END_USER, text: "I'll wait." },
    { senderType: SenderType.OPERATOR, text: 'I found the issue and resolved it for you.' },
    { senderType: SenderType.END_USER, text: 'Great, thank you!' },
    {
      senderType: SenderType.OPERATOR,
      text: "You're welcome. Let me know if there's anything else.",
    },
  ],
  [
    { senderType: SenderType.END_USER, text: 'Hello, I need help with my account.' },
    { senderType: SenderType.OPERATOR, text: 'Hi! What seems to be the issue?' },
    { senderType: SenderType.END_USER, text: 'I forgot my password.' },
    {
      senderType: SenderType.OPERATOR,
      text: 'No problem. I will guide you through the reset process.',
    },
    { senderType: SenderType.END_USER, text: 'Thanks a lot!' },
    { senderType: SenderType.OPERATOR, text: 'Okay' },
  ],
  [{ senderType: SenderType.END_USER, text: 'Hello!' }],
];

export const SAMPLE_CHAT_MESSAGES = SAMPLE_CHATS.map((_, chatIndex) =>
  generateContextualMessages(
    SAMPLE_CHATS[chatIndex].id,
    CHAT_TEMPLATES[chatIndex],
    SAMPLE_END_USERS[chatIndex].userId,
    chatTimes[chatIndex].startTime,
    chatTimes[chatIndex].endTime,
  ),
).flat();

// Number of chat tags to associate with chats
const CHAT_TAGS_LIMIT = 3;

// Determine if a tag is active based on its index
// For seeding purposes, one tag (at index CHAT_TAGS_LIMIT) is set as disabled for testing.
const isTagActive = (index: number): boolean => index !== CHAT_TAGS_LIMIT;

// Tags and chatTags
export const SAMPLE_TAGS = generateRange(DEFAULT_SEED_LENGTH).map((index) => ({
  id: generateStaticId(`999${String(index).padStart(2, '0')}`),
  name: `Tag ${index}`,
  organizationName: SAMPLE.ORGANIZATION_1.name,
  isActive: isTagActive(index),
}));

export const SAMPLE_CHAT_TAGS = SAMPLE_TAGS.slice(0, CHAT_TAGS_LIMIT).flatMap((tag) =>
  SAMPLE_CHATS.map((chat) => ({
    id: generateUuid(),
    chatId: chat.id,
    tagId: tag.id,
  })),
);

// Per-org data accessor for tenant-aware seeding
export type OrgSeedData = {
  orgName: string;
  users: typeof SAMPLE_USERS;
  teams: typeof SAMPLE_TEAMS;
  stores: typeof SAMPLE_STORES;
  chats: typeof SAMPLE_CHATS;
  chatMessages: typeof SAMPLE_CHAT_MESSAGES;
  chatTeamAssignments: typeof SAMPLE_CHAT_TEAM_ASSIGNMENTS;
  endUsers: typeof SAMPLE_END_USERS;
  tags: typeof SAMPLE_TAGS;
  chatTags: typeof SAMPLE_CHAT_TAGS;
};

export function getOrgData(orgName: string): OrgSeedData | null {
  const users = SAMPLE_USERS.filter((u) => u.organizationName === orgName);
  const teams = SAMPLE_TEAMS.filter((t) => t.organizationName === orgName);
  const stores = SAMPLE_STORES.filter((s) => s.organizationName === orgName);
  const chats = SAMPLE_CHATS.filter((c) => c.organizationName === orgName);

  if (users.length === 0 && teams.length === 0) return null;

  const chatIds = new Set(chats.map((c) => c.id));
  const chatMessages = SAMPLE_CHAT_MESSAGES.filter((m) => chatIds.has(m.chatId));
  const chatTeamAssignments = SAMPLE_CHAT_TEAM_ASSIGNMENTS.filter((a) => chatIds.has(a.chatId));

  // endUsers are referenced by chats in this org
  const endUserIds = new Set(chats.map((c) => c.endUserId));
  const endUsers = SAMPLE_END_USERS.filter((e) => endUserIds.has(e.userId));

  const tags = SAMPLE_TAGS.filter((t) => t.organizationName === orgName);
  const tagIds = new Set(tags.map((t) => t.id));
  const chatTags = SAMPLE_CHAT_TAGS.filter((ct) => chatIds.has(ct.chatId) && tagIds.has(ct.tagId));

  return {
    orgName,
    users,
    teams,
    stores,
    chats,
    chatMessages,
    chatTeamAssignments,
    endUsers,
    tags,
    chatTags,
  };
}
