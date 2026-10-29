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

DevsHub Mail is a modified fork of [Bulwark Webmail 1.18.0](https://github.com/bulwarkmail/webmail), built on the JMAP protocol. Original project documentation is preserved in [UPSTREAM.md](UPSTREAM.md), and the original attribution in [NOTICE](NOTICE). All source remains licensed under [GNU AGPL-3.0-only](LICENSE). If you run a modified version for users, provide the source of that exact version as required by the license.
