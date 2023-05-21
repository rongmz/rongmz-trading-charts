// const webpack = require('webpack');
const path = require('path');
const { readFileSync, writeFileSync } = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin')

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))

const name = packageJson.name;

module.exports = env => {
  console.log('webpack building ', name, 'env=', env);
  if (env.web) {
    writeFileSync('./src/webpack-build.ts', `
import * as TradingChart from './TradingChart';
import * as types from './types';
import * as d3 from 'd3';

// ------------------------------------------------------------
if (typeof (window) === 'object') {
  if (!(window as any)['rongmz']) (window as any)['rongmz'] = {};
  Object.assign((window as any)['rongmz'], {
    ...TradingChart,
    ...types,
    d3: { ...d3 }
  })
}`, 'utf-8');
  }

  return {
    entry: {
      [name]: (env.web || env.WEBPACK_SERVE) ? './src/webpack-build.ts' : './src/index.ts',
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
  };
}
