function profileLabel(displayName: string | null, email: string) {
  const name = displayName?.trim();
  if (name) return name;

  return email.split("@")[0]?.trim() || "My";
}

export function workspaceName(displayName: string | null, email: string) {
  const label = profileLabel(displayName, email);
  return label === "My" ? "My Agency" : `${label}'s Agency`;
}

export function workspaceSlug(localUserId: string) {
  return `agency-${localUserId}`;
}
