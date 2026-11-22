#!/bin/bash
# Installed root-owned at /usr/local/libexec/company-mail-build.
# Executed by systemd as company-mail-build, without production credentials.
set -euo pipefail
export PATH=/srv/alahmad-mail/build-tools/node-v24.22.3-linux-x64/bin:/usr/bin:/bin
export NODE_OPTIONS=--max-old-space-size=4096
export NEXT_TELEMETRY_DISABLED=1 SENTRYCLI_SKIP_DOWNLOAD=1 HUSKY=0 CI=1 npm_config_cache=/srv/alahmad-mail/ci-build/npm-cache

lock_hash=$(sha256sum package-lock.json | cut -d ' ' -f 1)
if [[ ! -d node_modules || ! -f .installed-lock || "$(cat .installed-lock)" != "$lock_hash" ]]; then
  npm ci --no-audit --no-fund
  printf '%s\n' "$lock_hash" > .installed-lock
fi

node scripts/check-action-pins.mjs .
node scripts/check-run-expressions.mjs .
npx --no-install vitest run --pool=forks --maxWorkers=2 --testTimeout=15000 \
  lib/__tests__/admin-auth-stalwart-access.test.ts \
  lib/__tests__/admin-auth-account-list.test.ts \
  lib/__tests__/admin-session-purpose.test.ts \
  lib/__tests__/admin-session-cookie-secure.test.ts \
  lib/__tests__/admin-session-signout.test.ts \
  lib/__tests__/mail-language.test.ts \
  lib/admin/__tests__/admin-password-read-only.test.ts \
  app/api/admin/mailboxes/__tests__/route.test.ts \
  app/api/admin/__tests__/config-admin-accounts.test.ts \
  app/api/admin/__tests__/config-delete-session-secret.test.ts \
  'app/(main)/admin/__tests__/mailboxes.test.tsx' \
  'app/(main)/admin/__tests__/account-languages.test.tsx' \
  'app/(main)/admin/__tests__/system-languages.test.tsx' \
  components/admin/__tests__/language-switcher.test.tsx \
  stores/__tests__/email-store-initial-data.test.ts \
  stores/__tests__/auth-store-browser-session.test.ts \
  lib/__tests__/jmap-client-resilience.test.ts \
  lib/__tests__/first-screen-catalog.test.ts
npm run typecheck
npm run build
