# Company webmail deployment

Pushes to `fix/independent-company-mail-admin` automatically update the company webmail. The `Deploy: Company webmail` workflow uploads the exact commit to the existing server. Other branches cannot use the production deployment environment. Pull-request checks remain unchanged.

The server runs focused administrator, mailbox, session, and language tests, a full TypeScript check, and the production standalone build. These checks run with two CPU cores and a 4 GiB Node heap. Dependencies are reused only while the lockfile matches. No application build runs on the maintainer's Mac or GitHub runner. The broad legacy test suite has separate pre-existing failures and is not a production deployment gate.

Before promotion, an isolated candidate on port 3131 uses a copy of the application state. Health, anonymous administrator access denial, and Arabic/English administrator login rendering must pass. The coordinator backs up the service definition and current state, switches the production service, and checks both local and public health. Failure restores the previous service and verifies its health. Production account state, sessions, secrets, Caddy configuration, and Stalwart are preserved. Older hashed browser assets remain available to open tabs.

The GitHub environment `company-production` permits only the company branch and stores `COMPANY_DEPLOY_SSH_KEY` and the verified host key as `COMPANY_DEPLOY_KNOWN_HOSTS`. The deployment key belongs to `company-mail-deploy`, has no interactive shell command or forwarding capability, and permits only `status` and `deploy <40-character revision>`. It is not a root login key. A root-owned coordinator starts repository build code as `company-mail-build`, with production state and credentials inaccessible. Uploaded archives cannot contain links. Runtime artifact links must be relative and resolve strictly inside their artifact directory; they are preserved without dereferencing.

The installed entrypoints are deliberately outside the uploaded source:

- `company-ssh.sh` → `/usr/local/libexec/company-mail-ssh`
- `company-build.sh` → `/usr/local/libexec/company-mail-build`
- `company-deploy.py` → `/usr/local/sbin/company-mail-deploy`

Changes to those privileged entrypoints require a maintainer to install the reviewed version through the existing server administration connection. Ordinary application changes deploy automatically. Public company branding is preserved by `/srv/alahmad-mail/ci/company-branding.css` and `/srv/alahmad-mail/ci/branding`; no private environment is copied into the build.

GitHub concurrency and `/run/lock/company-mail-deploy.lock` serialize releases. A manual server build should take that same lock, or finish before a branch push. GitHub's Re-run jobs control retries a failed deployment. The last successful revision is recorded in `/srv/alahmad-mail/ci/last-success.json`; service and state backups live in `/srv/alahmad-mail/private/ci-*`. State backups are retained for recovery and are never automatically restored over newer account changes.

Run `python3 deploy/test-company-deploy.py`, `bash -n deploy/company-build.sh`, and `sh -n deploy/company-ssh.sh` to check deployment boundaries and shell syntax without building or restarting webmail. Use the restricted key with SSH command `status` to check connectivity without deploying.
