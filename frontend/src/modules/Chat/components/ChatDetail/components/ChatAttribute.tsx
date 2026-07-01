import { Fragment, useEffect, useState, memo, useCallback } from 'react';

import EditIcon from '@mui/icons-material/Edit';
import { Stack, Typography, IconButton, Box, Tooltip } from '@mui/material';

import { Loading } from '~/common/components';
import { useErrorHandledAction } from '~/common/hooks';
import { useTranslation } from '~/locales/hooks';
import {
  type IAttribute,
  type IAttributeValue,
  useAttributesActions,
  useChatAttributesActions,
} from '~/modules/Attributes';
import { chatAttributeStyles, typographyColors, AttributeInput } from '~/modules/Chat';

interface ChatAttributeProps {
  chatId: string;
  chatAttributeValues: IAttributeValue[];
}
export type SelectOption = {
  id: string;
  value: string;
  label: string;
};

export type AttributeField = {
  id: string;
  name: string;
  isEditing: boolean;
  isActive: boolean;
  value?: string;
  type: string;
  selectOption?: SelectOption[];
  isEncryptionEnabled?: boolean;
  user?: {
    id: string;
    displayName: string;
  };
};

export const ChatAttribute = memo(
  function ChatAttribute({ chatId, chatAttributeValues }: ChatAttributeProps) {
    const { fillChatAttributeValue } = useChatAttributesActions(chatId);
    const { attributes, isFetchingAll } = useAttributesActions();
    const { executeAction } = useErrorHandledAction();
    const { t_chat } = useTranslation();

    const [attributeFields, setAttributeFields] = useState<AttributeField[]>([]);

    // Memoize handlers
    const handleShowInput = useCallback((id: string, isActive: boolean) => {
      if (isActive) {
        setAttributeFields((prevFields) =>
          prevFields.map((field) => ({
            ...field,
            isEditing: field.id === id,
          })),
        );
      }
    }, []);

    const handleClose = useCallback((id: string) => {
      setAttributeFields((prevFields) =>
        prevFields.map((field) => ({
          ...field,
          isEditing: field.id === id ? false : field.isEditing,
        })),
      );
    }, []);

    const handleFillField = useCallback(
      async (field: AttributeField) => {
        const { value, id } = field;
        if (value === undefined) return;

        const previousValue = attributeFields.find((f) => f.id === id)?.value;
        if (previousValue === value) {
          handleClose(id);
          return;
        }

        await executeAction(
          async () => {
            await fillChatAttributeValue({
              attributeId: id,
              value,
            });
          },
          () => handleClose(id),
        );
      },
      [attributeFields, executeAction, fillChatAttributeValue, handleClose],
    );

    useEffect(() => {
      const mapAttributesToFields = (
        attributes: IAttribute[],
        attributeValues: IAttributeValue[],
      ) =>
        attributes.map((attribute) => {
          const matchedValue = attributeValues.find((val) => val.attributeId === attribute.id);
          return {
            ...attribute,
            value: matchedValue?.value,
            user: matchedValue?.user,
            filledAt: matchedValue?.createdAt,
            isEditing: false,
          };
        });

      const filteredFields = mapAttributesToFields(attributes, chatAttributeValues).filter(
        (field) => field.isActive || !!field.value,
      );

      setAttributeFields(filteredFields);
    }, [attributes, chatAttributeValues]);

    if (isFetchingAll) {
      return <Loading />;
    }

    if (attributeFields.length === 0) {
      return <Box>{t_chat('chatAttributes.noList')}</Box>;
    }

    return (
      <Stack spacing={2}>
        {attributeFields.map((field) => (
          <Fragment key={field.id}>
            {field.isEditing ? (
              <AttributeInput
                field={field}
                handleSave={handleFillField}
                handleClose={handleClose}
              />
            ) : (
              <Stack direction='row' sx={{ paddingRight: 2, alignItems: 'center' }}>
                <Box sx={chatAttributeStyles.textContainerStyle}>
                  <Stack direction='column'>
                    <Typography
                      variant='body2'
                      color={typographyColors.name}
                      sx={chatAttributeStyles.nameStyle}
                    >
                      {field.name}:
                    </Typography>
                    <Tooltip
                      key={`${chatId}-${field.id}`}
                      title={field.user ? `${t_chat('edited')}: ${field.user.displayName}` : ''}
                      placement='left'
                      arrow
                    >
                      <Typography
                        color={typographyColors.value}
                        sx={chatAttributeStyles.valueStyle}
                      >
                        {field.value || '-'}
                      </Typography>
                    </Tooltip>
                  </Stack>
                </Box>
                <IconButton
                  size='small'
                  sx={chatAttributeStyles.buttonStyle}
                  disabled={!field.isActive}
                  onClick={() => {
                    handleShowInput(field.id, field.isActive);
                  }}
                >
                  <EditIcon sx={chatAttributeStyles.buttonStyle} />
                </IconButton>
              </Stack>
            )}
          </Fragment>
        ))}
      </Stack>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.chatId === nextProps.chatId &&
      JSON.stringify(prevProps.chatAttributeValues) ===
        JSON.stringify(nextProps.chatAttributeValues)
    );
  },
);

ChatAttribute.displayName = 'ChatAttribute';
