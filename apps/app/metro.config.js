const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
// Rava is an npm-workspaces + Turborepo monorepo, so Metro has to be told about the root:
// @reelbazaar/config and @reelbazaar/api resolve to raw TypeScript sources up there, and
// dependencies are hoisted to the root node_modules.
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// Without this, a hoisted package and a locally-installed copy of the same package can both
// end up in the graph, which breaks singletons like React and firebase/app.
config.resolver.disableHierarchicalLookup = true;

// Firebase's web ESM bundles import `idb`; help Metro resolve it on native + web.
config.resolver.unstable_enablePackageExports = true;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'idb') {
    return {
      filePath: require.resolve('idb/build/index.cjs'),
      type: 'sourceFile',
    };
  }
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (err) {
    // Allow nested node_modules resolution (e.g. simple-swizzle -> is-arrayish) when disableHierarchicalLookup is true.
    if (context.originModulePath && context.originModulePath.includes('node_modules')) {
      try {
        return {
          filePath: require.resolve(moduleName, { paths: [path.dirname(context.originModulePath)] }),
          type: 'sourceFile',
        };
      } catch {
        // Fall through to original Metro error.
      }
    }
    throw err;
  }
};

module.exports = config;
