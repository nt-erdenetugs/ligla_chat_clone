export * from './upload';

export type NumberOrString = number | string;
export type ID = NumberOrString;

export enum NotificationClickEventType {
  CHAT_NOTIFICATION_CLICKED = 'chatClicked',
}

// TODO: in case of sending more message events from the SW update the data payload type
export type SWMessageEvent = {
  type: NotificationClickEventType;
  data: Record<string, any>;
};
