
export type TsOLHCVCandle = [string, number, number, number, number, number]
export type TsValue = { ts: string, v: number }
export type CandlePlotData = { o: number, h: number, l: number, c: number };
export type PlotData = CandlePlotData | number

export const CLASS_SUBGRAPH = 'rongmz_subgraph'

export const ZOOM_STEP = 0.01;
export const DEAFULT_ZOOM_LEVEL = 0.8;
export const MIN_ZOOM_POINTS = 3;
export const X_AXIS_HEIGHT_PX = 25;

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

export type PlotLineType = 'solid-line' | 'dashed-line' | 'dotted-line'

/** Data based config for each plot */
export interface PlotConfig {
  /** Plot type */
  type: PlotLineType | 'area' | 'candle' | 'bar',
  /** The dataId in data */
  dataId: string,
  /** timestamp extactor in data timestamp will be in string */
  tsValue: (data: TsOLHCVCandle | TsValue) => Date,
  /** data extractor */
  data: (data: TsOLHCVCandle | TsValue) => PlotData,
  /** Only for area plot, the base Y value of the plot */
  baseY?: number,
  /** Dynamic coloring based on each value or overall coloring */
  color?: string | ((data: TsOLHCVCandle | TsValue) => string),
}

export interface SubGraphMatConfig {
  [plotName: string]: PlotMatConfig
}

export interface PlotMatConfig {
  /** Plot type */
  type: PlotLineType | 'area' | 'candle' | 'bar' | 'var-bar',
  /** The dataId in data */
  dataId: string,
  /** timestamp extactor in data */
  tsValue: Date[],
  /** data extractor */
  data: PlotData[],
  /** Only for area plot, the base Y value of the plot */
  baseY?: number,
  /** Dynamic coloring based on each value or overall coloring */
  color: string[],
}

/**
 * Data is provided with data id
 */
export interface GraphData {
  [dataId: string]: TsOLHCVCandle[] | TsValue[]
}


/** cosmetic settings for a sub graph */
export interface SubGraphSettings {
  /** Graph title */
  title: string,
  /** y scale title */
  yScaleTitle: string,
  /** legend placement */
  legend: 'top-left' | 'top-center' | 'top-right',
  /** Width of the strokes of lines */
  lineWidth: number,
  /** Margin for the data plot from top */
  dataMarginTop: number
  /** Margin for the data plot from bottom */
  dataMarginBottom: number,
  /** The ratio of subgraph section compared to entire graph  */
  scaleSectionRatio: number,
  /** The delta height changed due to section resizing */
  deltaHeight: number,
}

/** Cosmetic settings for the entire Chart */
export interface ChartSettings extends SubGraphSettings {
  /** Width of the entire chart */
  width: number,
  /** Height of the entire chart */
  height: number,
  /** The ratio of the chart plot portion compared to the width */
  plotSectionRatio: number,
  /** Color of the graph separator */
  graphSeparatorColor: string
  /** Cross hair line type */
  crossHairType: 'solid' | 'dashed' | 'dotted',
  /** Cross hair line width */
  crossHairWidth: number,
  /** Cross hair line color */
  crossHairColor: string,
  /** Background color */
  background: string,
  /** Grid lines to display */
  gridLinesType: 'none' | 'vert' | 'horiz' | 'both',
  /** Color of the grid lines - [ vert, horiz ] */
  gridLinesColor: string | [string, string],
  /** Color of scale lines */
  scaleLineColor: string,
  /** color for the scale ticks */
  scaleFontColor: string,
  /** Font size for the scale */
  scaleFontSize: number,
  /** Watermark position default: `bottom-left` */
  watermarkPosition: 'top-left' | 'top-center' | 'top-right' | 'center' | 'bottom-left' | 'bottom-center' | 'bottom-right',
  /** watermark text default: `""` */
  watermarkText: string,
  /** Individual settings for each scale sections */
  subGraph: {
    [scaleId: string]: SubGraphSettings
  }
}

/** Light theme graph settings */
export const LightThemeChartSettings: Partial<ChartSettings> = {
  graphSeparatorColor: '#00000054',
  crossHairType: 'dotted',
  crossHairWidth: 1,
  crossHairColor: '#3d3d3d',
  background: '#FFFFFFFF',
  gridLinesType: 'both',
  gridLinesColor: '#00000010',
  scaleLineColor: '#00000030',
  scaleFontColor: '#000000',
  scaleFontSize: 12,
  watermarkPosition: 'bottom-left',
  watermarkText: '',
  title: '@rongmz/trading-charts',
  yScaleTitle: '₹',
  legend: 'top-left',
  lineWidth: 2,
  dataMarginTop: 10,
  dataMarginBottom: 10,
  plotSectionRatio: 0.94,
  // scaleSectionRatio will be calculated based on scales given if not provided expicitly
}

/** Dark theme graph settings */
export const DarkThemeChartSettings: Partial<ChartSettings> = {
  graphSeparatorColor: '#FFFFFF54',
  crossHairType: 'dotted',
  crossHairWidth: 1,
  crossHairColor: '#E8E8E8',
  background: '#000000FF',
  gridLinesType: 'both',
  gridLinesColor: '#FFFFFF10',
  scaleLineColor: '#FFFFFF30',
  scaleFontColor: '#FFFFFF',
  scaleFontSize: 12,
  watermarkPosition: 'bottom-left',
  watermarkText: '',
  title: '@rongmz/trading-charts',
  yScaleTitle: '₹',
  legend: 'top-left',
  lineWidth: 2,
  dataMarginTop: 10,
  dataMarginBottom: 10,
  plotSectionRatio: 0.94,
  // scaleSectionRatio will be calculated based on scales given if not provided expicitly
}


export const debug = (...msg: any[]) => console.log(msg);
export const log = (...msg: any[]) => console.log(msg);
export const warn = (...msg: any[]) => console.warn(msg);
export const error = (...msg: any[]) => console.error(msg);

export type Interpolator<K, V> = (t: K) => V
export interface CanvasMap {
  [scaleId: string]: d3.Selection<HTMLCanvasElement, any, any, any>
}

export interface ScaleRowMap {
  [scaleId: string]: d3.Selection<HTMLTableCellElement, any, any, any>[]
}

export interface MousePosition {
  x: number,
  y: number,
  canvas?: HTMLCanvasElement
}

export const getLineDash = (type: 'solid' | 'dashed' | 'dotted') => {
  switch (type) {
    case 'solid':
      return [16, 0];
    case 'dashed':
      return [4, 16];
    case 'dotted':
      return [2, 2];
  }
}


export interface YCoordinateMap<T> {
  [range: string]: T
}
