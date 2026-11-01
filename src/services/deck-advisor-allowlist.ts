/**
 * Checks if user is allowlisted via environment variables.
 */
export function isUserAdvisorAllowlisted(user: { id?: string | null; email?: string | null }): boolean {
  const allowedEmailsRaw = process.env.ADVISOR_ALLOWED_EMAILS || "";
  const allowedUserIdsRaw = process.env.ADVISOR_ALLOWED_USER_IDS || "";

  const allowedEmails = allowedEmailsRaw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const allowedUserIds = allowedUserIdsRaw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (allowedEmails.length === 0 && allowedUserIds.length === 0) {
    return false;
  }

  if (user.email && allowedEmails.includes(user.email.trim().toLowerCase())) {
    return true;
  }

  if (user.id && allowedUserIds.includes(user.id.trim())) {
    return true;
  }

  return false;
}
