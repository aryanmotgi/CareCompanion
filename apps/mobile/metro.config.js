const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo including bun's .bun package cache
config.watchFolders = [
  workspaceRoot,
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(projectRoot, 'node_modules'),
];

// Resolve from both app-level and workspace-root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Do NOT use unstable_enableSymlinks — bun uses real symlinks that Metro
// handles fine when watchFolders covers the target directories
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
