#!/usr/bin/python3
"""Root-owned deployment coordinator; repository code only runs as a build user."""
import fcntl
import json
import os
import pwd
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

BASE = Path('/srv/alahmad-mail')
CI = BASE / 'ci'
SOURCE = BASE / 'ci-build/source'
RELEASES = Path('/opt/alahmad-webmail/releases')
STATE = Path('/var/lib/alahmad-webmail-company')
UNIT = Path('/etc/systemd/system/alahmad-webmail.service')
NODE = '/opt/alahmad-webmail/node'


def run(*args):
    subprocess.run(args, check=True)


def healthy(port):
    for _ in range(40):
        try:
            with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health', timeout=2) as response:
                if response.status == 200:
                    return True
        except OSError:
            pass
        time.sleep(0.5)
    return False


def verify(port):
    if not healthy(port):
        raise RuntimeError('Webmail health check failed')
    try:
        urllib.request.urlopen(f'http://127.0.0.1:{port}/api/admin/mailboxes', timeout=10)
    except urllib.error.HTTPError as error:
        if error.code != 401:
            raise RuntimeError('Administrator API protection check failed') from None
    else:
        raise RuntimeError('Anonymous administrator access was not denied')
    for locale, label in [('ar', 'كلمة مرور الإدارة'), ('en', 'Administrator password')]:
        request = urllib.request.Request(f'http://127.0.0.1:{port}/admin/login', headers={'Cookie': 'NEXT_LOCALE=' + locale})
        with urllib.request.urlopen(request, timeout=15) as response:
            if label not in response.read().decode():
                raise RuntimeError('Saved login language check failed: ' + locale)


def write_private(path, text):
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 'w') as stream:
        stream.write(text)


def replace_unit(contents):
    temporary = UNIT.with_suffix('.service.company-new')
    temporary.write_text(contents)
    temporary.chmod(0o644)
    temporary.replace(UNIT)
    run('systemctl', 'daemon-reload')


def remove(path):
    if path.is_symlink() or path.is_file():
        path.unlink()
    elif path.exists():
        shutil.rmtree(path)


def chown_tree(path, user, preserve=()):
    account = pwd.getpwnam(user)
    os.chown(path, account.pw_uid, account.pw_gid, follow_symlinks=False)
    for root, directories, files in os.walk(path, followlinks=False):
        directories[:] = [name for name in directories if not (Path(root) == path and name in preserve)
                          and not (Path(root) / name).is_symlink()]
        for name in directories + files:
            item = Path(root) / name
            if (Path(root) == path and name in preserve) or item.is_symlink():
                continue
            os.chown(item, account.pw_uid, account.pw_gid, follow_symlinks=False)


def validate_source_directory():
    expected = BASE / 'ci-build'
    if SOURCE != expected / 'source':
        raise RuntimeError('Unexpected source directory')
    if SOURCE.is_symlink():
        raise RuntimeError('Source directory must not be a symlink')
    if expected.is_symlink() or expected.resolve() != expected:
        raise RuntimeError('Build parent must not contain symlinks')
    if SOURCE.exists() and not SOURCE.is_dir():
        raise RuntimeError('Source path must be a directory')
    for name in ('node_modules', '.next', '.installed-lock'):
        if (SOURCE / name).is_symlink():
            raise RuntimeError('Preserved build path must not be a symlink: ' + name)
    metadata = expected.stat()
    if metadata.st_uid != 0 or metadata.st_mode & 0o022:
        raise RuntimeError('Build parent must be root-owned and not writable by other users')


def copy_artifact(source, target):
    # The build service has exited with its entire process group. Never follow
    # build-produced links while copying files with root privileges.
    if any(parent.is_symlink() for parent in source.parents):
        raise RuntimeError('Symlink in build output parent path')
    for item in [source, *source.rglob('*')]:
        if item.is_symlink() or not (item.is_file() or item.is_dir()):
            raise RuntimeError('Unsupported link or device in build output')
        if item.is_file() and item.stat().st_nlink != 1:
            raise RuntimeError('Hard link in build output')
    shutil.copytree(source, target, dirs_exist_ok=True)


def receive_source():
    validate_source_directory()
    with tempfile.TemporaryFile() as incoming:
        size = 0
        while chunk := sys.stdin.buffer.read(1024 * 1024):
            size += len(chunk)
            if size > 128 * 1024 * 1024:
                raise RuntimeError('Source upload exceeds 128 MiB')
            incoming.write(chunk)
        incoming.seek(0)
        with tarfile.open(fileobj=incoming, mode='r:gz') as archive:
            entries = archive.getmembers()
            if len(entries) > 50000 or sum(entry.size for entry in entries) > 512 * 1024 * 1024:
                raise RuntimeError('Source archive exceeds extraction limits')
            for entry in entries:
                parts = Path(entry.name).parts
                if not parts or Path(entry.name).is_absolute() or '..' in parts:
                    raise RuntimeError('Unsafe archive path')
                if not (entry.isfile() or entry.isdir()):
                    raise RuntimeError('Source archive must contain regular files and directories')
                if parts[0] in {'.git', '.next', 'node_modules', 'data', '.installed-lock'}:
                    raise RuntimeError('Generated or private directory in source upload')
                if any(part.startswith('.env') and part not in {'.env.example', '.env.dev.example'} for part in parts):
                    raise RuntimeError('Private environment file in source upload')
            SOURCE.mkdir(parents=True, exist_ok=True)
            for item in SOURCE.iterdir():
                if item.name not in {'node_modules', '.next', '.installed-lock'}:
                    remove(item)
            # No links are permitted, and previous source files are removed.
            for entry in entries:
                target = SOURCE / entry.name
                if entry.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with archive.extractfile(entry) as stream, target.open('wb') as output:
                        shutil.copyfileobj(stream, output)
                    target.chmod(0o755 if entry.mode & 0o111 else 0o644)
    # Keep the installed company fonts, mark, and CSS while repository changes
    # update application behavior. This overlay contains public assets only.
    shutil.copytree(CI / 'branding', SOURCE / 'public/branding/company', dirs_exist_ok=True)
    stylesheet = SOURCE / 'app/globals.css'
    marker = '/* Company branding on the existing DevsHub Mail interface. */'
    content = stylesheet.read_text().split(marker, 1)[0].rstrip()
    stylesheet.write_text(content + '\n' + (CI / 'company-branding.css').read_text())
    chown_tree(SOURCE, 'company-mail-build', preserve={'node_modules', '.next', '.installed-lock'})


def build(sha):
    available = next(int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    if available < 5 * 1024 * 1024 or shutil.disk_usage(BASE).free < 25 * 1024**3:
        raise RuntimeError('Build postponed: need 5 GiB available RAM and 25 GiB free disk')
    run('systemd-run', '--unit=company-mail-build-' + sha[:12], '--wait', '--pipe', '--collect',
        '--property=User=company-mail-build', '--property=Group=company-mail-build',
        '--property=WorkingDirectory=' + str(SOURCE), '--property=NoNewPrivileges=true',
        '--property=ProtectSystem=strict', '--property=ProtectHome=true', '--property=PrivateTmp=true',
        '--property=ReadWritePaths=' + str(SOURCE) + ' ' + str(BASE / 'ci-build/npm-cache'),
        '--property=InaccessiblePaths=' + str(STATE) + ' /etc/alahmad-webmail-custom.env ' + str(BASE / 'private'),
        '--property=CPUQuota=200%', '--property=RuntimeMaxSec=2100',
        '--setenv=GIT_COMMIT=' + sha, '--setenv=BULWARK_BUILD_SEED=' + sha,
        '/usr/local/libexec/company-mail-build')


def deploy(sha):
    validate_source_directory()
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    name = 'custom-ci-' + sha[:12] + '-' + stamp.lower()
    release = RELEASES / name
    candidate_state = Path('/var/lib') / ('alahmad-' + name + '-candidate')
    candidate_env = BASE / 'private' / (name + '.env')
    candidate_unit = 'alahmad-' + name
    original = UNIT.read_text()
    old = re.search(r'^WorkingDirectory=(.+)$', original, re.M).group(1)
    if not old.startswith(str(RELEASES) + '/'):
        raise RuntimeError('Unexpected production release path')
    if release.exists():
        raise RuntimeError('Release directory already exists')
    copy_artifact(SOURCE / '.next/standalone', release)
    copy_artifact(SOURCE / '.next/static', release / '.next/static')
    copy_artifact(SOURCE / 'public', release / 'public')
    (release / '.next/cache').mkdir(exist_ok=True)
    chown_tree(release / '.next/cache', 'alahmad-webmail')
    # Preserve the existing AGPL source-download endpoint, without build output,
    # credentials, runtime state, or repository metadata.
    excluded = {'node_modules', '.next', '.installed-lock', 'data', '.git', 'coverage', 'test-results', 'playwright-report'}
    def source_filter(info):
        parts = Path(info.name).parts
        if any(part in excluded or part.startswith('._') for part in parts):
            return None
        if any(part.startswith('.env') and part not in {'.env.example', '.env.dev.example'} for part in parts):
            return None
        if info.name.endswith(('.pem', '.key', '.p12', '.pfx', '.tar.gz')):
            return None
        info.uid = info.gid = 0
        info.uname = info.gname = 'root'
        return info
    with tarfile.open(release / 'public/branding/company/source.tar.gz', 'w:gz', compresslevel=3) as bundle:
        bundle.add(SOURCE, arcname='company-webmail', filter=source_filter)
    try:
        shutil.copytree(STATE, candidate_state)
        chown_tree(candidate_state, 'alahmad-webmail')
        (release / 'data').symlink_to(candidate_state, target_is_directory=True)
        env = Path('/etc/alahmad-webmail-custom.env').read_text().replace(str(STATE), str(candidate_state))
        env = re.sub(r'^PORT=.*$', 'PORT=3131', env, flags=re.M)
        env += '\nHOSTNAME=127.0.0.1\n'
        write_private(candidate_env, env)
        run('systemd-run', '--unit=' + candidate_unit, '--collect',
            '--property=User=alahmad-webmail', '--property=Group=alahmad-webmail',
            '--property=WorkingDirectory=' + str(release), '--property=EnvironmentFile=' + str(candidate_env),
            '--property=NoNewPrivileges=true', '--property=PrivateTmp=true', '--property=ProtectSystem=strict',
            '--property=ProtectHome=true', '--property=ReadWritePaths=' + str(candidate_state) + ' ' + str(release / '.next/cache'),
            NODE, str(release / 'server.js'))
        verify(3131)
        run(NODE, str(BASE / 'build-tools/prepare-language-assets.mjs'), str(release / '.next/static'))
    finally:
        subprocess.run(['systemctl', 'stop', candidate_unit], check=False)
        remove(candidate_state)
        candidate_env.unlink(missing_ok=True)
    backup = BASE / 'private' / ('ci-' + stamp)
    backup.mkdir(mode=0o700)
    write_private(backup / 'webmail.service', original)
    with tarfile.open(backup / 'webmail-state.tar.gz', 'w:gz') as archive:
        archive.add(STATE, arcname='state')
    (release / 'data').unlink()
    (release / 'data').symlink_to(STATE, target_is_directory=True)
    try:
        replace_unit(original.replace(old, str(release)))
        run('systemctl', 'restart', 'alahmad-webmail')
        verify(3130)
        # Check Caddy/TLS too; a failed public rollout also restores the unit.
        run('curl', '--fail', '--silent', '--show-error', '--output', '/dev/null',
            '--retry', '4', '--retry-delay', '3', '--connect-timeout', '10', '--max-time', '30',
            'https://webmail.alahmadmungharco.iq/api/health')
    except Exception:
        replace_unit(original)
        run('systemctl', 'restart', 'alahmad-webmail')
        if not healthy(3130):
            raise RuntimeError('Rollback needs attention: previous release did not become healthy') from None
        raise RuntimeError('Deployment failed; previous healthy release restored') from None
    result = {'revision': sha, 'release': name, 'previous': old, 'healthy': True, 'deployedAt': stamp}
    write_private(CI / 'last-success.json', json.dumps(result) + '\n')
    print(json.dumps(result), flush=True)


def main():
    if os.geteuid() != 0 or len(sys.argv) != 2:
        raise RuntimeError('Restricted deployment entrypoint')
    command = sys.argv[1]
    if command == 'status':
        print(json.dumps({'healthy': healthy(3130), 'deployment': json.loads((CI / 'last-success.json').read_text()) if (CI / 'last-success.json').exists() else None}))
        return
    match = re.fullmatch(r'deploy ([a-f0-9]{40})', command)
    if not match:
        raise RuntimeError('Only status or deploy <40-character revision> is allowed')
    with Path('/run/lock/company-mail-deploy.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        receive_source()
        build(match[1])
        deploy(match[1])


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Company deployment failed: ' + str(error), file=sys.stderr)
        sys.exit(1)
