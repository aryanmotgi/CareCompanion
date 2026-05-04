// Explicit dynamic config so EAS can evaluate runtimeVersion deterministically.
// Without this, EAS worker (bare workflow) sometimes resolves runtimeVersion as null.
const baseConfig = require('./app.json');

module.exports = () => ({
  ...baseConfig.expo,
  runtimeVersion: '1.0.0',
});
