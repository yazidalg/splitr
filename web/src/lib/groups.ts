/**
 * Groups and their members, kept in the browser.
 *
 * Deliberately not on chain. `create_bill` takes a `Vec<Address>`, so a
 * contract-side roster could not hold the thing the PRD insists on — a person
 * who has a name and no wallet yet (§9a: the split has to work before any
 * `stellarAddress` is filled in). Storing rosters on chain would also mean a
 * redeploy, and this contract has no upgrade entry point: a new address strands
 * every bill already recorded against the old one.
 *
 * So the division is: who was there is a local fact, what was settled is a
 * ledger fact. Only the second one has to be trustless, and it still is —
 * nothing here can make a bill say it was paid.
 *
 * The cost is real and worth naming: these live in one browser. Clearing site
 * data loses them, and they do not follow you to a phone. Fixing that needs a
 * backend, which this project does not have.
 */
import { useCallback, useEffect, useState } from 'react';

/**
 * Someone who was in on a bill.
 *
 * `address` is null until they have a wallet. That is the normal state for a
 * new group, not an error — it only blocks recording on chain.
 */
export type Member = {
  id: string;
  name: string;
  address: string | null;
};

export type Group = {
  id: string;
  name: string;
  members: Member[];
  createdAt: string;
};

const STORAGE_KEY = 'splitr-groups';

/** G-addresses are 56 characters of base32. Enough to catch a paste that went wrong. */
export function isValidAddress(value: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(value.trim());
}

export function newId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Reads the saved groups, discarding anything that does not look like one.
 *
 * Shape-checked rather than trusted: this is user-writable storage that
 * survives deploys, so a build from six months ago may have written it. A
 * malformed entry is dropped, not thrown — losing one group beats a blank page.
 */
export function loadGroups(): Group[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private mode, or storage disabled. Groups are a convenience, not a gate.
    return [];
  }
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isGroup);
  } catch {
    return [];
  }
}

function isGroup(value: unknown): value is Group {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    typeof g.createdAt === 'string' &&
    Array.isArray(g.members) &&
    g.members.every(isMember)
  );
}

function isMember(value: unknown): value is Member {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    (m.address === null || typeof m.address === 'string')
  );
}

export function saveGroups(groups: Group[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Quota or private mode. The groups still work for this visit.
  }
}

/**
 * Every member of `group` that has an address, as a name lookup.
 *
 * Bills come back from the contract as addresses; this is what turns them back
 * into the names the group was built with.
 */
export function namesByAddress(groups: Group[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      // First writer wins: if the same wallet is in two groups under two names,
      // arbitrarily flipping between them on re-render would be worse than
      // picking one.
      if (member.address && !names.has(member.address)) names.set(member.address, member.name);
    }
  }
  return names;
}

/**
 * The groups, and the operations the UI performs on them.
 *
 * Held once in DApp and passed down rather than kept in a context: two
 * components read it, and a provider for two consumers is ceremony. Every
 * mutation writes through to storage in the same call that sets state, so a
 * refresh mid-session never loses the last edit.
 */
export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);

  // Not a lazy `useState` initialiser: this module is inside the lazily loaded
  // app chunk, but reading storage during render still couples the first paint
  // to it for no benefit.
  useEffect(() => {
    setGroups(loadGroups());
  }, []);

  /** Every mutation goes through here, so nothing can set state without saving. */
  const commit = useCallback((change: (prev: Group[]) => Group[]) => {
    setGroups((prev) => {
      const next = change(prev);
      saveGroups(next);
      return next;
    });
  }, []);

  const addGroup = useCallback(
    (name: string): Group => {
      const group: Group = {
        id: newId(),
        name: name.trim(),
        members: [],
        createdAt: new Date().toISOString(),
      };
      commit((prev) => [...prev, group]);
      return group;
    },
    [commit],
  );

  const removeGroup = useCallback(
    (id: string) => commit((prev) => prev.filter((g) => g.id !== id)),
    [commit],
  );

  const updateGroup = useCallback(
    (id: string, change: (group: Group) => Group) =>
      commit((prev) => prev.map((g) => (g.id === id ? change(g) : g))),
    [commit],
  );

  const addMember = useCallback(
    (groupId: string, name: string, address: string | null) =>
      updateGroup(groupId, (g) => ({
        ...g,
        members: [...g.members, { id: newId(), name: name.trim(), address }],
      })),
    [updateGroup],
  );

  const removeMember = useCallback(
    (groupId: string, memberId: string) =>
      updateGroup(groupId, (g) => ({
        ...g,
        members: g.members.filter((m) => m.id !== memberId),
      })),
    [updateGroup],
  );

  const setMemberAddress = useCallback(
    (groupId: string, memberId: string, address: string | null) =>
      updateGroup(groupId, (g) => ({
        ...g,
        members: g.members.map((m) => (m.id === memberId ? { ...m, address } : m)),
      })),
    [updateGroup],
  );

  return { groups, addGroup, removeGroup, addMember, removeMember, setMemberAddress };
}

export type GroupsApi = ReturnType<typeof useGroups>;
