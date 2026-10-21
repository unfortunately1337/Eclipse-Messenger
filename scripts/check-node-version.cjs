const [major, minor] = process.versions.node.split('.').map(Number);
if (!((major === 20 && minor >= 19) || (major === 22 && minor >= 13) || major > 22)) {
  console.error('Eclipse requires Node.js 20.19+ or 22.13+. On Windows, run run-dev.bat to use the local runtime.');
  process.exit(1);
}
