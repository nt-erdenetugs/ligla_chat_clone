import {
  type PropsWithChildren,
  useMemo,
  useState,
  type FC,
  type ReactNode,
  type ReactElement,
  type SyntheticEvent,
  useEffect,
} from 'react';

import AttributionIcon from '@mui/icons-material/Attribution';
import BallotIcon from '@mui/icons-material/Ballot';
import SellIcon from '@mui/icons-material/Sell';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Tab, Tabs } from '@mui/material';
import { useSearchParams } from 'react-router';

import { useTopBarHeight } from '~/common/components';
import { DataTableProvider } from '~/common/components/Elements/DataTableWithHeader/providers';
import { Title } from '~/common/components/Elements/Page/Title';
import { ACTION_PARAM_KEY, ID_PARAM_KEY } from '~/common/constants';
import { useResponsive } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import { AttributesColumnSettings } from '~/modules/Attributes';
import { MemberFeedColumnSettings } from '~/modules/Member';
import { SurveyColumnSettings } from '~/modules/SurveySettings';
import { TagsColumnSettings } from '~/modules/Tags';
type TabDefinition = {
  key: 'attributes' | 'tags' | 'memberFeedColumns' | 'surveyColumns';
  component: ReactNode;
  icon?: ReactElement;
};

export const ColumnSettingsPage = () => {
  const { t_management } = useTranslation();
  const { isMobileOrTablet } = useResponsive();
  const topBarHeight = useTopBarHeight();
  const layoutMarginTop = `${topBarHeight}px`;

  const [tabIndex, setTabIndex] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabs = useMemo<TabDefinition[]>(
    () => [
      {
        key: 'attributes',
        component: <AttributesColumnSettings />,
        icon: <AttributionIcon fontSize='small' />,
      },
      {
        key: 'tags',
        component: <TagsColumnSettings />,
        icon: <SellIcon fontSize='small' />,
      },
      {
        key: 'memberFeedColumns',
        component: <MemberFeedColumnSettings />,
        icon: <SettingsIcon fontSize='small' />,
      },
      {
        key: 'surveyColumns',
        component: <SurveyColumnSettings />,
        icon: <BallotIcon fontSize='small' />,
      },
    ],
    [],
  );

  useEffect(() => {
    try {
      const tabKey = searchParams.get('tab');
      if (tabKey) {
        const index = tabs.findIndex((tab) => tab.key === (tabKey as TabDefinition['key']));
        if (index >= 0) setTabIndex(index);
        try {
          localStorage.setItem('columnSettings.activeTab', tabKey);
        } catch (error) {
          console.error(error);
        }
      } else {
        const index = tabs.findIndex((tab) => tab.key === 'attributes');
        if (index >= 0) setTabIndex(index);
      }
    } catch (error) {
      console.error(error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <Box
      sx={{
        height: isMobileOrTablet
          ? `calc(100dvh - ${layoutMarginTop} - 16px)`
          : `calc(100dvh - 16px)`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box height='auto'>
        <Title title={t_management('columnSettings.title')} />
      </Box>
      <Box height='auto'>
        <Tabs
          value={tabIndex}
          onChange={(_event: SyntheticEvent, newValue: number) => {
            const nextIndex = newValue;
            const tabKey = tabs[nextIndex]?.key ?? String(nextIndex);

            try {
              const next = new URLSearchParams(searchParams.toString());
              Array.from(next.keys()).forEach((key) => {
                if (key.startsWith('filters') || key.startsWith('search')) next.delete(key);
              });
              next.delete(ACTION_PARAM_KEY);
              next.delete(ID_PARAM_KEY);
              next.set('tab', tabKey);
              setSearchParams(next);
            } catch (error) {
              console.error(error);
              setSearchParams(new URLSearchParams({ tab: tabKey }));
            }

            setTabIndex(nextIndex);
          }}
          aria-label='Item display tabs'
          variant='scrollable'
          scrollButtons='auto'
          sx={{ '.MuiTabs-flexContainer': { gap: '12px 16px' } }}
        >
          {tabs.map((tab, index) => (
            <Tab
              key={tab.key}
              label={t_management(`${tab.key}.title`)}
              value={index}
              icon={tab.icon}
              iconPosition='start'
              sx={{ minHeight: 'auto', padding: '12px 16px' }}
            />
          ))}
        </Tabs>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {tabs.map((tab, index) => (
          <TabPanel key={tab.key} value={tabIndex} index={index}>
            <DataTableProvider>{tab.component}</DataTableProvider>
          </TabPanel>
        ))}
      </Box>
    </Box>
  );
};

type TabPanelProps = PropsWithChildren<{ value: number; index: number }>;

const TabPanel: FC<TabPanelProps> = ({ children, value, index }) => {
  const isActive = value === index;
  if (!isActive) return null;

  return (
    <Box
      role='tabpanel'
      hidden={!isActive}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        display: isActive ? 'flex' : 'none',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  );
};
