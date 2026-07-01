const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = function (options, webpack) {
  return {
    ...options,
    entry: ['webpack/hot/poll?100', options.entry],
    externals: [
      nodeExternals({
        allowlist: ['webpack/hot/poll?100'],
      }),
    ],
    plugins: [
      ...options.plugins,
      new webpack.HotModuleReplacementPlugin(),
      new webpack.WatchIgnorePlugin({
        paths: [/\.js$/, /\.d\.ts$/],
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: path.resolve(__dirname, 'src/i18n'), to: 'i18n', globOptions: { ignore: ['**/*.ts'] } },
        ],
      }),
      new RunScriptWebpackPlugin({ name: options.output.filename, autoRestart: false }),
    ],
  };
};
