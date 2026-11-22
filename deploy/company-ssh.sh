#!/bin/sh
# authorized_keys forces this root-owned entrypoint; no shell, SFTP, or forwarding.
set -eu
exec /usr/bin/sudo -n /usr/local/sbin/company-mail-deploy "${SSH_ORIGINAL_COMMAND:-}"
