import React, {
  FC, memo, useCallback, useEffect, useState,
} from '../../lib/teact/teact';
import { withGlobal } from '../../lib/teact/teactn';

import { GlobalActions } from '../../global/types';
import { ApiChat } from '../../api/types';
import { IAnchorPosition } from '../../types';

import { IS_SINGLE_COLUMN_LAYOUT } from '../../util/environment';
import { disableScrolling, enableScrolling } from '../../util/scrollLock';
import {
  selectChat, selectNotifySettings, selectNotifyExceptions, selectUser,
} from '../../modules/selectors';
import { pick } from '../../util/iteratees';
import {
  isUserId, getCanDeleteChat, selectIsChatMuted, getCanAddContact,
} from '../../modules/helpers';
import useShowTransition from '../../hooks/useShowTransition';
import useLang from '../../hooks/useLang';

import Portal from '../ui/Portal';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import DeleteChatModal from '../common/DeleteChatModal';

import './HeaderMenuContainer.scss';

type DispatchProps = Pick<GlobalActions, (
  'updateChatMutedState' | 'enterMessageSelectMode' | 'sendBotCommand' | 'restartBot' | 'openLinkedChat' | 'addContact'
)>;

export type OwnProps = {
  chatId: string;
  threadId: number;
  isOpen: boolean;
  anchor: IAnchorPosition;
  isChannel?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  canSubscribe?: boolean;
  canSearch?: boolean;
  canMute?: boolean;
  canLeave?: boolean;
  onSubscribeChannel: () => void;
  onSearchClick: () => void;
  onClose: () => void;
  onCloseAnimationEnd: () => void;
};

type StateProps = {
  chat?: ApiChat;
  isPrivate?: boolean;
  isMuted?: boolean;
  canAddContact?: boolean;
  canDeleteChat?: boolean;
  hasLinkedChat?: boolean;
};

const HeaderMenuContainer: FC<OwnProps & StateProps & DispatchProps> = ({
  chatId,
  isOpen,
  anchor,
  isChannel,
  canStartBot,
  canRestartBot,
  canSubscribe,
  canSearch,
  canMute,
  canLeave,
  chat,
  isPrivate,
  isMuted,
  canDeleteChat,
  hasLinkedChat,
  canAddContact,
  onSubscribeChannel,
  onSearchClick,
  onClose,
  onCloseAnimationEnd,
  updateChatMutedState,
  enterMessageSelectMode,
  sendBotCommand,
  restartBot,
  openLinkedChat,
  addContact,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { x, y } = anchor;

  useShowTransition(isOpen, onCloseAnimationEnd, undefined, false);

  const handleDelete = useCallback(() => {
    setIsMenuOpen(false);
    setIsDeleteModalOpen(true);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    onClose();
  }, [onClose]);

  const closeDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    onClose();
  }, [onClose]);

  const handleStartBot = useCallback(() => {
    sendBotCommand({ command: '/start' });
  }, [sendBotCommand]);

  const handleRestartBot = useCallback(() => {
    restartBot({ chatId });
  }, [chatId, restartBot]);

  const handleToggleMuteClick = useCallback(() => {
    updateChatMutedState({ chatId, isMuted: !isMuted });
    closeMenu();
  }, [chatId, closeMenu, isMuted, updateChatMutedState]);

  const handleLinkedChatClick = useCallback(() => {
    openLinkedChat({ id: chatId });
    closeMenu();
  }, [chatId, closeMenu, openLinkedChat]);

  const handleAddContactClick = useCallback(() => {
    addContact({ userId: chatId });
    closeMenu();
  }, [addContact, chatId, closeMenu]);

  const handleSubscribe = useCallback(() => {
    onSubscribeChannel();
    closeMenu();
  }, [closeMenu, onSubscribeChannel]);

  const handleSearch = useCallback(() => {
    onSearchClick();
    closeMenu();
  }, [closeMenu, onSearchClick]);

  const handleSelectMessages = useCallback(() => {
    enterMessageSelectMode();
    closeMenu();
  }, [closeMenu, enterMessageSelectMode]);

  useEffect(() => {
    disableScrolling();

    return enableScrolling;
  }, []);

  const lang = useLang();

  return (
    <Portal>
      <div className="HeaderMenuContainer">
        <Menu
          isOpen={isMenuOpen}
          positionX="right"
          style={`left: ${x}px;top: ${y}px;`}
          onClose={closeMenu}
        >
          {IS_SINGLE_COLUMN_LAYOUT && canStartBot && (
            <MenuItem
              icon="bots"
              onClick={handleStartBot}
            >
              {lang('BotStart')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && canRestartBot && (
            <MenuItem
              icon="bots"
              onClick={handleRestartBot}
            >
              {lang('BotRestart')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && canSubscribe && (
            <MenuItem
              icon={isChannel ? 'channel' : 'group'}
              onClick={handleSubscribe}
            >
              {lang(isChannel ? 'Subscribe' : 'Join Group')}
            </MenuItem>
          )}
          {canAddContact && (
            <MenuItem
              icon="add-user"
              onClick={handleAddContactClick}
            >
              {lang('AddContact')}
            </MenuItem>
          )}
          {IS_SINGLE_COLUMN_LAYOUT && canSearch && (
            <MenuItem
              icon="search"
              onClick={handleSearch}
            >
              {lang('Search')}
            </MenuItem>
          )}
          {canMute && (
            <MenuItem
              icon={isMuted ? 'unmute' : 'mute'}
              onClick={handleToggleMuteClick}
            >
              {lang(isMuted ? 'ChatsUnmute' : 'ChatsMute')}
            </MenuItem>
          )}
          {hasLinkedChat && (
            <MenuItem
              icon={isChannel ? 'comments' : 'channel'}
              onClick={handleLinkedChatClick}
            >
              {lang(isChannel ? 'ViewDiscussion' : 'lng_profile_view_channel')}
            </MenuItem>
          )}
          <MenuItem
            icon="select"
            onClick={handleSelectMessages}
          >
            {lang('ReportSelectMessages')}
          </MenuItem>
          {canLeave && (
            <MenuItem
              destructive
              icon="delete"
              onClick={handleDelete}
            >
              {lang(isPrivate
                ? 'DeleteChatUser'
                : (canDeleteChat ? 'GroupInfo.DeleteAndExit' : (isChannel ? 'LeaveChannel' : 'Group.LeaveGroup')))}
            </MenuItem>
          )}
        </Menu>
        {chat && (
          <DeleteChatModal
            isOpen={isDeleteModalOpen}
            onClose={closeDeleteModal}
            chat={chat}
          />
        )}
      </div>
    </Portal>
  );
};

export default memo(withGlobal<OwnProps>(
  (global, { chatId }): StateProps => {
    const chat = selectChat(global, chatId);
    if (!chat || chat.isRestricted) {
      return {};
    }
    const isPrivate = isUserId(chat.id);
    const user = isPrivate ? selectUser(global, chatId) : undefined;
    const canAddContact = user && getCanAddContact(user);

    return {
      chat,
      isMuted: selectIsChatMuted(chat, selectNotifySettings(global), selectNotifyExceptions(global)),
      isPrivate,
      canAddContact,
      canDeleteChat: getCanDeleteChat(chat),
      hasLinkedChat: Boolean(chat?.fullInfo?.linkedChatId),
    };
  },
  (setGlobal, actions): DispatchProps => pick(actions, [
    'updateChatMutedState',
    'enterMessageSelectMode',
    'sendBotCommand',
    'restartBot',
    'openLinkedChat',
    'addContact',
  ]),
)(HeaderMenuContainer));
