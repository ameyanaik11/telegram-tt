import BigInt from 'big-integer';
import { Api as GramJs } from '../../../lib/gramjs';
import {
  OnApiUpdate, ApiUser, ApiChat, ApiPhoto,
} from '../../types';

import { PROFILE_PHOTOS_LIMIT } from '../../../config';
import { invokeRequest } from './client';
import { searchMessagesLocal } from './messages';
import {
  buildInputEntity,
  buildInputPeer,
  buildInputContact,
} from '../gramjsBuilders';
import { buildApiUser, buildApiUserFromFull } from '../apiBuilders/users';
import { buildApiChatFromPreview } from '../apiBuilders/chats';
import { buildApiPhoto } from '../apiBuilders/common';
import localDb from '../localDb';
import { addPhotoToLocalDb } from '../helpers';
import { buildApiPeerId } from '../apiBuilders/peers';

let onUpdate: OnApiUpdate;

export function init(_onUpdate: OnApiUpdate) {
  onUpdate = _onUpdate;
}

export async function fetchFullUser({
  id,
  accessHash,
}: {
  id: string;
  accessHash?: string;
}) {
  const input = buildInputEntity(id, accessHash);
  if (!(input instanceof GramJs.InputUser)) {
    return;
  }

  const fullInfo = await invokeRequest(new GramJs.users.GetFullUser({ id: input }));

  if (!fullInfo) {
    return;
  }

  const userWithFullInfo = buildApiUserFromFull(fullInfo);

  onUpdate({
    '@type': 'updateUser',
    id,
    user: {
      fullInfo: userWithFullInfo.fullInfo,
    },
  });
}

export async function fetchNearestCountry() {
  const dcInfo = await invokeRequest(new GramJs.help.GetNearestDc());

  return dcInfo?.country;
}

export async function fetchTopUsers() {
  const topPeers = await invokeRequest(new GramJs.contacts.GetTopPeers({
    correspondents: true,
  }));
  if (!(topPeers instanceof GramJs.contacts.TopPeers)) {
    return undefined;
  }

  const users = topPeers.users.map(buildApiUser).filter((user) => !!user && !user.isSelf) as ApiUser[];
  const ids = users.map(({ id }) => id);

  return {
    ids,
    users,
  };
}

export async function fetchContactList() {
  const result = await invokeRequest(new GramJs.contacts.GetContacts({ hash: BigInt('0') }));
  if (!result || result instanceof GramJs.contacts.ContactsNotModified) {
    return undefined;
  }

  result.users.forEach((user) => {
    if (user instanceof GramJs.User) {
      localDb.users[buildApiPeerId(user.id, 'user')] = user;
    }
  });

  return {
    users: result.users.map(buildApiUser).filter<ApiUser>(Boolean as any),
    chats: result.users.map((user) => buildApiChatFromPreview(user)).filter<ApiChat>(Boolean as any),
  };
}

export async function fetchUsers({ users }: { users: ApiUser[] }) {
  const result = await invokeRequest(new GramJs.users.GetUsers({
    id: users.map(({ id, accessHash }) => buildInputPeer(id, accessHash)),
  }));
  if (!result || !result.length) {
    return undefined;
  }

  result.forEach((user) => {
    if (user instanceof GramJs.User) {
      localDb.users[buildApiPeerId(user.id, 'user')] = user;
    }
  });

  return result.map(buildApiUser).filter<ApiUser>(Boolean as any);
}

export function updateContact({
  phone,
  firstName,
  lastName,
}: {
  phone?: string;
  firstName?: string;
  lastName?: string;
}) {
  return invokeRequest(new GramJs.contacts.ImportContacts({
    contacts: [buildInputContact({
      phone: phone || '',
      firstName: firstName || '',
      lastName: lastName || '',
    })],
  }));
}

export function addContact({
  id,
  accessHash,
  phoneNumber = '',
  firstName = '',
  lastName = '',
}: {
  id: string;
  accessHash?: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
}) {
  return invokeRequest(new GramJs.contacts.AddContact({
    id: buildInputEntity(id, accessHash) as GramJs.InputUser,
    firstName,
    lastName,
    phone: phoneNumber,
  }), true);
}

export async function deleteUser({
  id,
  accessHash,
}: {
  id: string;
  accessHash?: string;
}) {
  const input = buildInputEntity(id, accessHash);
  if (!(input instanceof GramJs.InputUser)) {
    return;
  }

  const result = await invokeRequest(new GramJs.contacts.DeleteContacts({ id: [input] }));

  if (!result) {
    return;
  }

  onUpdate({
    '@type': 'deleteUser',
    id,
  });
}

export async function fetchProfilePhotos(user?: ApiUser, chat?: ApiChat) {
  if (user) {
    const { id, accessHash } = user;

    const result = await invokeRequest(new GramJs.photos.GetUserPhotos({
      userId: buildInputEntity(id, accessHash) as GramJs.InputUser,
      limit: PROFILE_PHOTOS_LIMIT,
      offset: 0,
      maxId: BigInt('0'),
    }));

    if (!result) {
      return undefined;
    }

    updateLocalDb(result);

    return {
      photos: result.photos
        .filter((photo): photo is GramJs.Photo => photo instanceof GramJs.Photo)
        .map(buildApiPhoto),
    };
  }

  const result = await searchMessagesLocal({
    chatOrUser: chat!,
    type: 'profilePhoto',
    limit: PROFILE_PHOTOS_LIMIT,
  });

  if (!result) {
    return undefined;
  }

  const { messages, users } = result;

  return {
    photos: messages.map((message) => message.content.action!.photo).filter<ApiPhoto>(Boolean as any),
    users,
  };
}

function updateLocalDb(result: (GramJs.photos.Photos | GramJs.photos.PhotosSlice)) {
  result.photos.forEach(addPhotoToLocalDb);
}
