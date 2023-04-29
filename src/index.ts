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
}
