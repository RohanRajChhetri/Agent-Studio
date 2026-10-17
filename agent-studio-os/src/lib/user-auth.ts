import { auth } from "@clerk/nextjs/server";

export const PRIMARY_LEGACY_USER_ID =
  process.env.PRIMARY_ADMIN_USER_ID || "user_3K4MCQCfrmabyNgQC8WdjxjggZ8";

/**
 * Retrieves the currently authenticated user's ID via Clerk.
 * Returns null if the request is unauthenticated.
 */
export async function getAuthUserId(): Promise<string | null> {
  try {
    const authObj = await auth();
    return authObj?.userId || null;
  } catch {
    return null;
  }
}

/**
 * Returns a where clause scoped to the current user.
 * If user is logged in:
 *   - If primary legacy user, can see their assigned data and any unassigned legacy data.
 *   - If any other user, strictly scopes to their own userId (isolated studio data).
 * If unauthenticated:
 *   - In local dev (default), allows guest fallback to primary workspace for seamless self-hosting.
 *   - In production or when ALLOW_LOCAL_GUEST_FALLBACK="false", strictly returns '__unauthenticated__' to protect user data.
 */
export async function getUserScopedWhere<T extends Record<string, any>>(
  baseWhere: T = {} as T
): Promise<any> {
  const userId = await getAuthUserId();
  const isLocalDev = process.env.NODE_ENV !== "production";
  const allowGuestFallback =
    process.env.ALLOW_LOCAL_GUEST_FALLBACK !== "false" && isLocalDev;

  let effectiveUserId = userId;
  if (!effectiveUserId && allowGuestFallback) {
    effectiveUserId = PRIMARY_LEGACY_USER_ID;
  }

  // Strictly block unauthenticated access in production / when guest fallback is disabled
  if (!effectiveUserId) {
    return {
      ...baseWhere,
      userId: "__unauthenticated__",
    };
  }

  // Primary admin/local mode gets access to the primary suite and legacy unassigned records
  if (effectiveUserId === PRIMARY_LEGACY_USER_ID) {
    if (Object.keys(baseWhere).length === 0) {
      return {
        OR: [{ userId: PRIMARY_LEGACY_USER_ID }, { userId: null }],
      };
    }
    return {
      AND: [
        baseWhere,
        { OR: [{ userId: PRIMARY_LEGACY_USER_ID }, { userId: null }] },
      ],
    };
  }

  // Any other authenticated user strictly gets their own isolated studio data
  return {
    ...baseWhere,
    userId: effectiveUserId,
  };
}
