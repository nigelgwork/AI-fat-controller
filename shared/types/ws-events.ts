// WebSocket event channel names and payload types

export type WSEventChannel =
  | 'mode-changed'
  | 'controller:stateChanged'
  | 'controller:approvalRequired'
  | 'controller:actionCompleted'
  | 'controller:progressUpdated'
  | 'controller:usageWarning'
  | 'executor-log'
  | 'task:statusChanged'
  | 'session:updated'
  | 'session:log'
  | 'gui-test:progress'
  | 'gui-test:complete'
  | 'ntfy:questionAsked'
  | 'ntfy:questionAnswered'
  | 'clone:progress'
  | 'setup:progress'
  | 'update:checking'
  | 'update:available'
  | 'update:not-available'
  | 'update:progress'
  | 'update:downloaded'
  | 'update:error';

export interface WSMessage {
  channel: WSEventChannel;
  data: unknown;
}
