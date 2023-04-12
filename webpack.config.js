// const webpack = require('webpack');
const path = require('path');
const { readFileSync } = require('fs');

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

const name = packageJson.name;

const mode = 'production'

const entry = {
  [name]: './src/index.ts',
  [`${name}.min`]: './src/index.ts',
};
const devtool = 'inline-source-map';
const optimization = {
  minimize: true,
};

const resolve = {
  extensions: ['.tsx', '.ts', '.js'],
  modules: ['node_modules'],
};
const output = {
  path: path.resolve(__dirname, '_bundles'),
  filename: '[name].js',
  libraryTarget: 'umd',
  library: name,
  umdNamedDefine: true,
};

module.exports = {
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      }
    ],
  },
  output,
  resolve,
  optimization,
  devtool,
  entry,
  mode
}
