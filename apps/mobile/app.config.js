module.exports = ({ config }) => ({
  ...config,
  runtimeVersion: '1.0.0',
  extra: {
    ...config.extra,
    eas: {
      projectId: '845c42cd-33e6-42d0-8189-59131144999f',
    },
  },
});
