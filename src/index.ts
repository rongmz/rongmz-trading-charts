import * as TradingChart from './TradingChart';
import * as types from './types';

// ------------------------------------------------------------
if (typeof (window) === 'object') {
  if (!(window as any)['rongmz']) (window as any)['rongmz'] = {};
  Object.assign((window as any)['rongmz'], {
    ...TradingChart,
    ...types
  })
}
