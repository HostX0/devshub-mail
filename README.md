# DevsHub Mail

A calm, responsive, self-hosted email experience for teams. It includes mail, calendar, contacts, files, account settings and a polished Arabic/English interface. It connects to a [Stalwart](https://stalw.art/) mail server over JMAP.

![DevsHub Mail visual](public/assets/devshub-mail/editorial-banner.jpg)

## Experience

- Mail, search, calendar, contacts and files in one interface, on desktop and mobile.
- Light and dark modes, several built-in color palettes, and subtle occasion themes for New Year, Valentine's Day, International Women's Day, World Health Day, Pink October, Halloween and Black Friday. Each person may turn automatic themes off or choose a fixed palette.
- Account settings, chosen theme and profile photo can follow the person across devices when encrypted settings sync is enabled.
- Optional “Stay signed in” control; the server can set the inactivity window, and explicit sign-out clears the browser session.
- Clear IMAP and SMTP instructions in Account settings for Apple Mail, Outlook and Gmail.

## Quick start

A running Stalwart server is required. Build the image and connect it to your own server:

```sh
docker build -t devshub-mail .
docker run -d --name devshub-mail -p 3000:3000 \
  -e JMAP_SERVER_URL=https://mail.example.com \
  -e APP_NAME='DevsHub Mail' \
  -e LOGIN_SHOW_REMEMBER_ME=true \
  -e SETTINGS_SYNC_ENABLED=true \
  -v devshub-mail-data:/app/data \
  devshub-mail
```

Open `http://localhost:3000`. For production, use HTTPS and set a stable session secret through the admin setup or `SESSION_SECRET_FILE`. Set `SOURCE_CODE_URL` to the exact public source revision of the build you deploy.

For an email client, use the full mailbox address as username and the mailbox password. Incoming IMAP: mail server, port 993 with SSL/TLS. Outgoing SMTP: same server, port 465 with SSL/TLS and authentication. Confirm the server's ports if your installation differs.

## Credits and license

DevsHub Mail is a modified fork of [Bulwark Webmail 1.21.2](https://github.com/bulwarkmail/webmail), built on the JMAP protocol. Original project documentation is preserved in [UPSTREAM.md](UPSTREAM.md), and the original attribution in [NOTICE](NOTICE). All source remains licensed under [GNU AGPL-3.0-only](LICENSE). If you run a modified version for users, provide the source of that exact version as required by the license.

## Employee mailbox administration

On Stalwart 1.1 or newer, set `MAILBOX_ADMIN_DOMAINS=example.com,example.org`
with the domains this installation may manage. Leave it unset to disable
mailbox administration. Keep `STALWART_ADMIN_ACCESS=auto` to let the existing
Stalwart super-admin open the webmail admin area with the same mailbox login.
No new default super-admin password is created: designate the owner account
in Stalwart, then sign in to that account normally.

Open **Admin → بريد الموظفين** (`/admin/mailboxes`) to create employee
mailboxes, choose storage limits, change display names and passwords, disable
or re-enable access, or delete a mailbox. Quotas use GiB (1024 MiB). New
employees always receive the ordinary User role; administrator accounts and
accounts with custom roles, permissions or group memberships cannot be modified
by this panel. Use the Stalwart console to manage those accounts.
Password changes preserve MFA and secondary credentials. Disabling replaces
inherited permissions with an empty permission set without deleting messages
or credentials; enabling restores the ordinary inherited User permissions.
Deletion permanently removes the mailbox and its messages.

Every request checks the actual signed-in credential against the configured
mail server's super-admin-only JMAP method. A webmail settings password, a
claimed username or an untrusted custom JMAP endpoint cannot grant mailbox
administration. Each successful change is written to the existing audit log
without passwords or credential material. Domain DNS is configured once;
creating subsequent employee mailboxes does not require new DNS records.

## Staying signed in

The login page shows the stay-signed-in choice by default. Remembered cookies
renew hourly while the signed-in mail app is active in browsers with Web Locks;
the sealed sign-in time stays unchanged. Set `SESSION_REMEMBER_DAYS=400` for the
longest browser-supported renewal window. An unticked sign-in retains the
existing browser-session behavior and is never upgraded during restore.

Organisation idle and maximum-session limits remain enforced when configured.
Their existing value `0` means no automatic timeout. Sign-out serializes cookie writes across tabs before clearing the session.
Browsers without Web Locks restore normally without background cookie renewal. Disabled accounts, revoked
credentials and upstream administrator checks keep their existing enforcement.
