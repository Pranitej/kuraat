// babel-preset-expo adds the Reanimated/worklets plugin and the React Compiler (app.config experiments).
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
