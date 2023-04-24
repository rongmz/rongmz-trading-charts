// const webpack = require('webpack');
const path = require('path');
const { readFileSync } = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin')

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

const name = packageJson.name;

module.exports = {
  entry: {
    [name]: './src/index.ts',
    // [`${name}.min`]: './src/index.ts', // uncomment for prod
  },
  target: 'web',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader'
      }
    ],
  },
  output: {
    path: path.resolve(__dirname, '_bundles'),
    filename: '[name].js',
    libraryTarget: 'umd',
    library: name,
    umdNamedDefine: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    modules: ['node_modules'],
  },
  optimization: {
    minimize: true,
  },
  devtool: 'inline-source-map',
  mode: 'production',
  devServer: {
    static: {
      directory: path.join(__dirname, 'example'),
    },
    compress: true,
    port: 1000,
    client: {
      overlay: false,
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      title: name,
      template: 'example/index.html',
      scriptLoading: 'blocking'
    })
  ]
}
