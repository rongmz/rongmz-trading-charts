import * as TradingCharts from './TradingCharts';

// ------------------------------------------------------------
if (typeof (window) === 'object') {
  if (!(window as any)['rongmz']) (window as any)['rongmz'] = {};
  Object.assign((window as any)['rongmz'], { ...TradingCharts })
}
