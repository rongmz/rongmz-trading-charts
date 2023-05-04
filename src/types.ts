
export type TsOLHCVCandle = [string, number, number, number, number, number]
export type TsValue = { ts: string, v: number }
export type CandlePlotData = { o: number, h: number, l: number, c: number };
export type PlotData = CandlePlotData | number

export const CLASS_SUBGRAPH = 'rongmz_subgraph'

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
  type: PlotLineType | 'area' | 'candle' | 'bar' | 'var-bar',
  /** The dataId in data */
  dataId: string,
  /** timestamp extactor in data timestamp will be in string */
  tsValue: (data: TsOLHCVCandle | TsValue | any) => Date,
  /** data extractor */
  data: (data: TsOLHCVCandle | TsValue | any) => PlotData,
  /** Only for area plot, the base Y value of the plot */
  baseY?: number,
  /** Dynamic coloring based on each value or overall coloring */
  color?: string | ((data: TsOLHCVCandle | TsValue | any) => string),
}


/**
 * Data is provided with data id
 */
export interface GraphData {
  [dataId: string]: (TsOLHCVCandle | TsValue | any)[]
}

export interface DataMat {
  ts: Date,
  data: {
    [scaleId: string]: {
      [plotName: string]: {
        d: PlotData,
        color: string
      }
    }
  }
}

export type GraphDataMat = DataMat[]


/** cosmetic settings for a sub graph */
export interface SubGraphSettings {
  /** Graph title */
  title: string,
  /** sub graph title font size */
  titleFontSize: string,
  /** title placement */
  titlePlacement: 'top-left' | 'top-center' | 'top-right',
  /** sub graph title color */
  titleFontColor: string,
  /** y scale title */
  yScaleTitle: string,
  /** Ticks count for y scale */
  yScaleTickCount: number,
  /** the d3 format specifier for y scale. */
  yScaleFormat: string,
  /** The format to use for crosshair pointer position value */
  crossHairYScaleFormat: string,
  /** Y scale padding pct */
  yScalePaddingPct: number,
  /** legend placement */
  legendPosition: 'top-left' | 'top-right',
  /** legend font size */
  legendFontSize: string,
  /** Margin for legend placing */
  legendMargin: [number, number, number] | number,
  /** Value formatter for legends */
  legendFormat: string,
  /** Width of the strokes of lines */
  lineWidth: number,
  /** The ratio of subgraph section compared to entire graph  */
  scaleSectionRatio: number,
  /** The delta height changed due to section resizing */
  deltaHeight: number,
  /** The color theme for graph if no color specified */
  colorPallet: string[],
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
  /** Cross hair line width */
  crossHairWidth: number,
  /** Cross hair line color */
  crossHairColor: string,
  /** Contrast color for crosshair, mainly will be used for text */
  crossHairContrastColor: string,
  /** Background color */
  background: string,
  /** Grid lines to display */
  gridLinesType: 'none' | 'vert' | 'horiz' | 'both',
  /** Color of the grid lines - [ vert, horiz ] */
  gridLinesColor: string | [string, string],
  /** The gap band of two grids */
  xGridInterval: number,
  /** xscale format */
  xScaleFormat: string,
  /** the time format for the xscale for the crosshair position */
  xScaleCrossHairFormat: string,
  /** padding for x scale after bandwidth */
  xScalePadding: number,
  /** Color of scale lines */
  scaleLineColor: string,
  /** color for the scale ticks */
  scaleFontColor: string,
  /** Font size for the scale */
  scaleFontSize: string,
  /** watermark text default: `""` */
  watermarkText: string,
  /** The zoom level for the graph in the range of [0-1] */
  zoomLevel: number,
  /** The sensitivity of mouse wheel zoom (< 1) detailed and slow zooming keep value very very low. */
  wheelZoomSensitivity: number,
  /** Individual settings for each scale sections */
  subGraph: {
    [scaleId: string]: SubGraphSettings
  }
}

/** Light theme graph settings */
export const LightThemeChartSettings: Partial<ChartSettings> = {
  graphSeparatorColor: '#00000054',
  crossHairWidth: 1,
  crossHairColor: '#3d3d3d',
  crossHairContrastColor: '#ffffff',
  background: '#FFFFFFFF',
  gridLinesType: 'both',
  gridLinesColor: '#00000010',
  xGridInterval: 7,
  scaleLineColor: '#00000030',
  scaleFontColor: '#000000',
  scaleFontSize: '12px Arial',
  watermarkText: '',
  title: '@rongmz/trading-charts',
  yScaleTitle: '₹',
  legendPosition: 'top-left',
  legendFontSize: '12px Arial',
  legendFormat: '.3~f',
  lineWidth: 2,
  plotSectionRatio: 0.94,
  yScaleTickCount: 5,
  legendMargin: 10,
  yScalePaddingPct: 0.1,
  xScalePadding: 0.2,
  zoomLevel: DEAFULT_ZOOM_LEVEL,
  wheelZoomSensitivity: 0.01,
  xScaleFormat: '%d/%m, %H:%M',
  xScaleCrossHairFormat: '%d/%m, %H:%M',
  crossHairYScaleFormat: '.2~f',
  titlePlacement: 'top-right',
  // scaleSectionRatio will be calculated based on scales given if not provided expicitly
}

/** Dark theme graph settings */
export const DarkThemeChartSettings: Partial<ChartSettings> = {
  graphSeparatorColor: '#FFFFFF54',
  crossHairWidth: 1,
  crossHairColor: '#E8E8E8',
  crossHairContrastColor: '#000000',
  background: '#000000FF',
  gridLinesType: 'both',
  gridLinesColor: '#FFFFFF10',
  xGridInterval: 7,
  scaleLineColor: '#FFFFFF30',
  scaleFontColor: '#FFFFFF',
  scaleFontSize: '12px Arial',
  watermarkText: '',
  title: '@rongmz/trading-charts',
  yScaleTitle: '₹',
  legendPosition: 'top-left',
  legendFontSize: '12px Arial',
  legendFormat: '.3~f',
  lineWidth: 2,
  plotSectionRatio: 0.94,
  yScaleTickCount: 5,
  legendMargin: 10,
  yScalePaddingPct: 0.1,
  xScalePadding: 0.2,
  zoomLevel: DEAFULT_ZOOM_LEVEL,
  wheelZoomSensitivity: 0.01,
  xScaleFormat: '%d/%m, %H:%M',
  xScaleCrossHairFormat: '%d/%m, %H:%M',
  crossHairYScaleFormat: '.2~f',
  titlePlacement: 'top-right',
  // scaleSectionRatio will be calculated based on scales given if not provided expicitly
}


export const debug = (...msg: any[]) => console.log(...msg);
export const log = (...msg: any[]) => console.log(...msg);
export const warn = (...msg: any[]) => console.warn(...msg);
export const error = (...msg: any[]) => console.error(...msg);

export type Interpolator<K, V> = (t: K) => V
export interface CanvasMap {
  [scaleId: string]: d3.Selection<HTMLCanvasElement, any, any, any>
}

export interface ScaleRowMap {
  [scaleId: string]: d3.Selection<HTMLTableCellElement, any, any, any>[]
}

export interface MouseDownPosition {
  x: number,
  y: number,
  dx?: number,
  dy?: number,
  scaleId: string
}

export interface MousePosition {
  x: number,
  y: number,
  scaleId: string
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

export interface D3YScaleMap {
  [scaleId: string]: d3.ScaleLinear<number, number>
}


export type ZoomPanType = 'zoom' | 'pan';
export type ZoomPanListenerType = () => void

export const EVENT_ZOOM = 'onzoom';
export const EVENT_PAN = 'onpan';
