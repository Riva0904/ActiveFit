import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Every route must state who may call it.
 *
 * Before this test a handler with no `@Roles` was reachable by every logged-in
 * user, which is how a staff account could read the gym's whole payment list and
 * any member could read every gym's trainer roster. `RolesGuard` is global now,
 * so a missing decorator is the only remaining way to leave a route open — and
 * this test turns that into a build failure.
 *
 * Routes that genuinely serve all roles go in OPEN_TO_ALL_ROLES with a reason.
 * Adding to that list is a deliberate diff a reviewer will see.
 */

const SRC = join(__dirname, '../../../src');

/** `controller#handler` → why it is open to every authenticated role. */
const OPEN_TO_ALL_ROLES: Record<string, string> = {
  // Identity and session — every role needs these to use the app at all.
  'auth.controller#getProfile': 'every role hydrates from this',
  'auth.controller#getSocketToken': 'every role opens a socket',
  'auth.controller#changePassword': 'every role can change their own password',
  'auth.controller#logout': 'every role logs out',
  'users.controller#getMe': 'own profile',
  'users.controller#updateMe': 'own profile edit',

  // Self-scoped by userId in the service — no tenant data crosses.
  'notifications.controller#findAll': 'scoped to the caller',
  'mobile.controller#registerPushToken': 'every role receives push',
  'mobile.controller#deactivatePushToken': 'every role',
  'mobile.controller#getHomeData': 'returns an account shell for non-members',

  // Shared utilities.
  'chat.controller#uploadFile': 'every role sends attachments; size and type limited',
};

function controllerFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) controllerFiles(p, out);
    else if (entry.endsWith('.controller.ts')) out.push(p);
  }
  return out;
}

/** Split a controller into (decorator block, handler name) pairs, source-order. */
function handlersOf(src: string): { name: string; decorators: string }[] {
  const out: { name: string; decorators: string }[] = [];
  // A handler is a method at exactly two-space indentation preceded by decorators.
  const re = /((?:^ {2}@[\s\S]*?)?)^ {2}(?:async )?([a-zA-Z_][\w]*)\s*\(/gm;
  let m: RegExpExecArray | null;
  let cursor = 0;
  while ((m = re.exec(src)) !== null) {
    const name = m[2];
    if (name === 'constructor' || name === 'if' || name === 'for' || name === 'return') continue;
    const block = src.slice(cursor, m.index + m[0].length);
    // Only count it as a route if an HTTP method decorator appears in its block.
    if (/@(Get|Post|Patch|Put|Delete)\(/.test(block)) out.push({ name, decorators: block });
    cursor = m.index + m[0].length;
  }
  return out;
}

describe('every route declares who may call it', () => {
  const files = controllerFiles(SRC);

  it('finds the controllers', () => {
    expect(files.length).toBeGreaterThan(25);
  });

  it.each(files.map((f) => [f.split(/[\\/]/).pop()!, f]))('%s', (_name, file) => {
    const src = readFileSync(file, 'utf8');
    const controller = (file.split(/[\\/]/).pop() ?? '').replace('.ts', '');

    // Class-level decorators apply to every handler in the file.
    const head = src.slice(0, src.search(/^export class/m));
    const classHasRoles = /@Roles\(/.test(head);
    const classIsPublic = /@Public\(\)/.test(head);

    const unguarded: string[] = [];
    for (const handler of handlersOf(src)) {
      const key = `${controller}#${handler.name}`;
      if (OPEN_TO_ALL_ROLES[key]) continue;
      if (classHasRoles || classIsPublic) continue;
      if (/@Roles\(/.test(handler.decorators)) continue;
      if (/@Public\(\)/.test(handler.decorators)) continue;
      unguarded.push(key);
    }

    expect(unguarded).toEqual([]);
  });

  it('the open-to-all list stays small and justified', () => {
    // A growing allowlist is the failure mode this test exists to prevent.
    expect(Object.keys(OPEN_TO_ALL_ROLES).length).toBeLessThanOrEqual(20);
    for (const reason of Object.values(OPEN_TO_ALL_ROLES)) {
      expect(reason.length).toBeGreaterThan(5);
    }
  });
});
