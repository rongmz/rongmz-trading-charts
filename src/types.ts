
export type TsOLHCVCandle = [string, number, number, number, number, number]
export type TsValue = { ts: string, value: number }
export type PlotData = { o: number, h: number, l: number, c: number } | number


/**
 * Chart config for overall chart
 */
export interface ChartConfig {
  [yScaleId: string]: SubGraphConfig
}

/**
 * The subgraph config to accomodate multiple plots in one graph
 */
export interface SubGraphConfig {
  [plotName: string]: PlotConfig
}

/** Data based config for each plot */
export interface PlotConfig {
  /** Plot type */
  type: 'line' | 'area' | 'candle' | 'bar',
  /** The dataId in data */
  dataId: string,
  /** timestamp extactor in data */
  tsValue: (data: TsOLHCVCandle | TsValue) => Date,
  /** data extractor */
  data: (data: TsOLHCVCandle | TsValue) => PlotData,
  /** Dynamic coloring based on each value or overall coloring */
  color?: string | ((data: TsOLHCVCandle | TsValue) => string),
}

/**
 * Data is provided with data id
 */
export interface GraphData {
  [dataId: string]: TsOLHCVCandle | TsValue
}

/** Graph margin
 * - if number then that value will be applied to all dims.
 */
export type GraphMargin = {
  top: number,
  left: number,
  right: number,
  bottom: number
}

export type GraphDimension = {
  width: number
  height: number
}

export type GraphLabel = string | {
  title: string,
  subtitle: string
}

/** cosmetic settings for a sub graph */
export interface SubGraphSettings {
  margin?: number | GraphMargin,
  dimension: number | GraphDimension,
  label?: GraphLabel,
  yScaleTitle?: string,
  legend?: 'top-left' | 'top-center' | 'top-right',
  autoYScale?: boolean
}

/** Cosmetic settings for the entire Chart */
export interface ChartSettings {
  [yScaleId: string]: SubGraphSettings
}


export const DefaultSubGraphSettings = (): SubGraphSettings => ({
  margin: 10,
  dimension: 100,
  autoYScale: true
})

export const isChartSettings = (settings: ChartSettings | SubGraphSettings): boolean => {
  if (typeof (settings) === 'object') {
    if (settings['dimension']) return false; // this is SubGraphSettings
    else return true; // this is actually the ChartSettings
  } else throw new Error('Invalid dimension');
}

export const log = (...msg: any[]) => console.log(msg);
export const warn = (...msg: any[]) => console.warn(msg);
export const error = (...msg: any[]) => console.error(msg);

export const getDim = (dim: GraphDimension | number) => {
  if (typeof (dim) === 'object') {
    return dim as GraphDimension;
  }
  else return { width: dim, height: dim } as GraphDimension
}

export const getMargin = (dim?: GraphMargin | number) => {
  if (typeof (dim) === 'object') {
    return dim as GraphMargin;
  }
  else if (typeof (dim) === 'undefined') return { top: 0, left: 0, right: 0, bottom: 0 } as GraphMargin
  else return { top: dim, left: dim, right: dim, bottom: dim } as GraphMargin
}

/** Calculate the total graph dimension */
export const getTotalGraphDimension = (settings: ChartSettings | SubGraphSettings): GraphDimension => {
  if (isChartSettings(settings)) {
    let width = 0;
    const height = Object.keys(settings as ChartSettings).reduce((height, id) => {
      const setting = (settings as ChartSettings)[id];
      const dim = getDim(setting.dimension);
      const margin = getMargin(setting.margin);
      width = Math.max(width, dim.width + margin.left + margin.right); // the max width in all sections will be the graph width
      return height + dim.height + margin.top + margin.bottom;
    }, 0);
    return { width, height }
  }
  else {
    const dim = getDim(settings.dimension as GraphDimension | number);
    const margin = getMargin(settings.margin as GraphMargin | number);
    return {
      width: dim.width + margin.left + margin.right,
      height: dim.height + margin.top + margin.bottom
    }
  }
}
