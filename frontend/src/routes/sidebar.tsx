import { type ReactNode } from 'react';

import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';
import InboxIcon from '@mui/icons-material/Inbox';
import PeopleIcon from '@mui/icons-material/People';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import RuleIcon from '@mui/icons-material/Rule';
import SettingsIcon from '@mui/icons-material/Settings';
import StorefrontIcon from '@mui/icons-material/Storefront';

import { UserRoleType } from '~/generated/graphql/types';
import { ChatPage } from '~/modules/Chat';
import { ChatReplySettingsPage } from '~/modules/ChatReplySetting';
import { ColumnSettingsPage } from '~/modules/ColumnSettings';
import { OrganizationsPage } from '~/modules/Organizations';
import { AssignmentRulesPage } from '~/modules/Rules';
import { StoresPage } from '~/modules/Stores';
import { TeamsPage } from '~/modules/Teams';
import { UsersPage } from '~/modules/Users';

import { type RouteObject } from './routes';

export const sidebarCategories = {
  chat: 'chat',
  management: 'management',
  chatSettings: 'chatSettings',
  database: 'database',
} as const;

export const PAGES = {
  USERS: 'users',
  TEAMS: 'teams',
  STORES: 'stores',
  ORGANIZATIONS: 'organizations',
  COLUMN_SETTINGS: 'columnSettings',
  REPLY_SETTINGS: 'replySettings',
  ASSIGN_RULES: 'chatAssignRules',
} as const;

export const PAGES_PATH_MAP = {
  [PAGES.COLUMN_SETTINGS]: 'column_settings',
  [PAGES.REPLY_SETTINGS]: 'reply_settings',
  [PAGES.ASSIGN_RULES]: 'assign_rules',
};

export type SidebarRoutesType = (RouteObject & {
  label: string;
  icon: ReactNode;
  category: (typeof sidebarCategories)[keyof typeof sidebarCategories];
})[];

export const sidebarRoutes: SidebarRoutesType = [
  {
    path: '/',
    element: <ChatPage />,
    index: true,
    label: 'inbox',
    icon: <InboxIcon />,
    category: sidebarCategories.chat,
    auth: {
      roles: [
        UserRoleType.AdminOperator,
        UserRoleType.Admin,
        UserRoleType.ManagerOperator,
        UserRoleType.Manager,
        UserRoleType.Operator,
      ],
    },
  },
  {
    path: PAGES.USERS,
    element: <UsersPage />,
    index: true,
    label: PAGES.USERS,
    icon: <AssignmentIndIcon />,
    category: sidebarCategories.management,
    auth: {
      roles: [
        UserRoleType.Admin,
        UserRoleType.AdminOperator,
        UserRoleType.ManagerOperator,
        UserRoleType.Manager,
        UserRoleType.Operator,
      ],
    },
  },
  {
    path: PAGES.TEAMS,
    element: <TeamsPage />,
    index: true,
    label: PAGES.TEAMS,
    icon: <PeopleIcon />,
    category: sidebarCategories.management,
    auth: {
      roles: [
        UserRoleType.Admin,
        UserRoleType.AdminOperator,
        UserRoleType.ManagerOperator,
        UserRoleType.Manager,
        UserRoleType.Operator,
      ],
    },
  },
  {
    path: PAGES_PATH_MAP[PAGES.REPLY_SETTINGS],
    element: <ChatReplySettingsPage />,
    index: true,
    label: PAGES.REPLY_SETTINGS,
    icon: <QuestionAnswerIcon />,
    category: sidebarCategories.management,
    auth: {
      roles: [UserRoleType.Admin, UserRoleType.AdminOperator],
    },
  },
  {
    path: PAGES_PATH_MAP[PAGES.ASSIGN_RULES],
    element: <AssignmentRulesPage />,
    index: true,
    label: PAGES.ASSIGN_RULES,
    icon: <RuleIcon />,
    category: sidebarCategories.chatSettings,
    auth: {
      roles: [UserRoleType.Admin, UserRoleType.AdminOperator],
    },
  },
  {
    path: PAGES.STORES,
    element: <StoresPage />,
    index: true,
    label: PAGES.STORES,
    icon: <StorefrontIcon />,
    category: sidebarCategories.database,
    auth: {
      roles: [UserRoleType.Admin, UserRoleType.AdminOperator],
    },
  },
  {
    path: PAGES_PATH_MAP[PAGES.COLUMN_SETTINGS],
    element: <ColumnSettingsPage />,
    index: true,
    label: PAGES.COLUMN_SETTINGS,
    icon: <SettingsIcon />,
    category: sidebarCategories.management,
    auth: {
      roles: [UserRoleType.Admin, UserRoleType.AdminOperator],
    },
  },
];

export const hypervisorSidebarRoutes: SidebarRoutesType = [
  {
    path: PAGES.ORGANIZATIONS,
    element: <OrganizationsPage />,
    index: true,
    label: PAGES.ORGANIZATIONS,
    category: sidebarCategories.management,
    icon: <CorporateFareIcon />,
  },
];

export const getSidebarRoutesByRole = (role: string): SidebarRoutesType => {
  return sidebarRoutes.filter((route) => route.auth?.roles.includes(role));
};
