export type ChatUserRead = {
  userId: string;
  readTimestamp: Nullable<Date>;
};

export type ResolveEffectiveReadTimestampParams<T extends ChatUserRead> = {
  chatId: string;
  chatUserReads: T[];
  currentUserId?: string;
  userReadTimestamp?: Nullable<Date>;
  fallbackReadTimestamp?: Nullable<Date>;
  fetchUserReadTimestamp: (chatId: string, userId: string) => Promise<Nullable<Date>>;
};

export async function resolveEffectiveReadTimestamp<T extends ChatUserRead>(
  params: ResolveEffectiveReadTimestampParams<T>,
): Promise<Nullable<Date>> {
  const {
    chatId,
    chatUserReads,
    currentUserId,
    userReadTimestamp,
    fallbackReadTimestamp,
    fetchUserReadTimestamp,
  } = params;

  if (userReadTimestamp !== undefined) {
    return userReadTimestamp ?? fallbackReadTimestamp ?? null;
  }

  if (!currentUserId) {
    return fallbackReadTimestamp ?? null;
  }

  const matchingCachedReads = chatUserReads.filter((read) => read.userId === currentUserId);

  if (matchingCachedReads.length > 0) {
    const latestCachedRead = matchingCachedReads.reduce<Nullable<Date>>((latest, read) => {
      if (!read.readTimestamp) return latest;
      if (!latest) return read.readTimestamp;
      return read.readTimestamp > latest ? read.readTimestamp : latest;
    }, null);

    return latestCachedRead ?? fallbackReadTimestamp ?? null;
  }

  const fetchedRead = await fetchUserReadTimestamp(chatId, currentUserId);

  return fetchedRead ?? fallbackReadTimestamp ?? null;
}
