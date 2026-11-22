"""Deployment boundary checks: python3 deploy/test-company-deploy.py."""
import importlib.util
import io
import os
import tarfile
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('company_deploy', Path(__file__).with_name('company-deploy.py'))
deploy = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deploy)


def archive_for(name, kind=tarfile.REGTYPE):
    output = io.BytesIO()
    with tarfile.open(fileobj=output, mode='w:gz') as archive:
        info = tarfile.TarInfo(name)
        info.type = kind
        info.linkname = '/etc/passwd' if kind == tarfile.SYMTYPE else ''
        info.size = 1 if kind == tarfile.REGTYPE else 0
        archive.addfile(info, io.BytesIO(b'x'))
    output.seek(0)
    return SimpleNamespace(buffer=output)


class DeploymentBoundaries(unittest.TestCase):
    def test_rejects_source_symlink_before_reading_upload_or_removing_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'ci-build').mkdir()
            outside = root / 'outside'
            outside.mkdir()
            (outside / 'keep').write_text('untouched')
            source = root / 'ci-build/source'
            source.symlink_to(outside, target_is_directory=True)
            with patch.object(deploy, 'BASE', root), patch.object(deploy, 'SOURCE', source), \
                 patch.object(deploy.sys, 'stdin', None):
                with self.assertRaisesRegex(RuntimeError, 'Source directory must not be a symlink'):
                    deploy.receive_source()
            self.assertEqual((outside / 'keep').read_text(), 'untouched')

    def test_rejects_preserved_root_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            source = root / 'ci-build/source'
            source.mkdir(parents=True)
            for name in ('node_modules', '.next', '.installed-lock'):
                link = source / name
                link.symlink_to(root / 'outside')
                with self.subTest(name=name), patch.object(deploy, 'BASE', root), patch.object(deploy, 'SOURCE', source):
                    with self.assertRaisesRegex(RuntimeError, 'Preserved build path must not be a symlink'):
                        deploy.validate_source_directory()
                link.unlink()

    def test_rejects_artifact_ancestor_symlink(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'outside/standalone').mkdir(parents=True)
            (root / 'outside/standalone/private').write_text('private')
            (root / '.next').symlink_to(root / 'outside', target_is_directory=True)
            with self.assertRaisesRegex(RuntimeError, 'Symlink in build output parent path'):
                deploy.copy_artifact(root / '.next/standalone', root / 'target')
            self.assertFalse((root / 'target').exists())

    def test_rejects_unsafe_uploads_before_changing_source(self):
        for name, kind in [('../escape', tarfile.REGTYPE), ('/tmp/escape', tarfile.REGTYPE),
                           ('public/link', tarfile.SYMTYPE), ('node_modules/file', tarfile.REGTYPE),
                           ('.env.production', tarfile.REGTYPE), ('data/config.json', tarfile.REGTYPE)]:
            with self.subTest(name=name), patch.object(deploy, 'validate_source_directory'), \
                 patch.object(deploy.sys, 'stdin', archive_for(name, kind)):
                with self.assertRaises(RuntimeError):
                    deploy.receive_source()

    def test_rejects_shell_commands(self):
        for command in ['bash', 'deploy ' + 'a' * 40 + '; id', 'deploy ../../etc', '', 'status extra']:
            with self.subTest(command=command), patch.object(deploy.os, 'geteuid', return_value=0), \
                 patch.object(deploy.sys, 'argv', ['deploy', command]):
                with self.assertRaises(RuntimeError):
                    deploy.main()

    def test_does_not_copy_artifact_symlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'source').mkdir()
            (root / 'source/private').symlink_to('/etc/passwd')
            with self.assertRaises(RuntimeError):
                deploy.copy_artifact(root / 'source', root / 'target')
            self.assertFalse((root / 'target').exists())

    def test_does_not_copy_artifact_hardlinks(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'source').mkdir()
            (root / 'outside').write_text('private')
            os.link(root / 'outside', root / 'source/private')
            with self.assertRaises(RuntimeError):
                deploy.copy_artifact(root / 'source', root / 'target')

    def test_copies_regular_artifacts(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            (root / 'source').mkdir()
            (root / 'source/server.js').write_text('server')
            deploy.copy_artifact(root / 'source', root / 'target')
            self.assertEqual((root / 'target/server.js').read_text(), 'server')


if __name__ == '__main__':
    unittest.main()
