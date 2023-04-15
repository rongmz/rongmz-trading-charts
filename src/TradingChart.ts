import * as d3 from 'd3';
import {
  CLASS_SUBGRAPH, CanvasMap, ChartConfig, ChartSettings, DEAFULT_ZOOM_LEVEL, DarkThemeChartSettings, GraphData, Interpolator,
  LightThemeChartSettings, MIN_ZOOM_POINTS, SubGraphSettings,
  X_AXIS_HEIGHT_PX,
  ZOOM_STEP, debug, log
} from './types';

declare global {
  interface String {
    trimLines(): string;
  }
}
String.prototype.trimLines = function (this: string) {
  return this.replace(/\n\s+/g, '');
}

export class TradingChart {

  private data?: GraphData;
  private settings: ChartSettings;
  /** Chart root element provided as container */
  private root;
  /** internal maintable */
  private table;

  private mainCanvasMap: CanvasMap = {};
  private mainUpdateCanvasMap: CanvasMap = {};

  private scaleYCanvasMap: CanvasMap = {};
  private scaleYUpdateCanvasMap: CanvasMap = {};

  private scaleXCanvas: HTMLCanvasElement;
  private scaleXUpdateCanvas: HTMLCanvasElement;

  private zoomLevel: number = DEAFULT_ZOOM_LEVEL;
  private zoomInterpolator: Interpolator<number, number> = d3.interpolateNumber(0, 0);
  private panOffset: number = 0;

  /**
   * Instantiate a TradingChart
   * @param root the element under which the chart will be rendered. The styling of the root element won't be manipulated.
   * @param config Data based config for the entire chart
   * @param settings Cosmetic settings for the chart
   */
  constructor(private _root: HTMLElement, public readonly config: ChartConfig, _settings: Partial<ChartSettings>, theme?: 'light' | 'dark') {
    debug(`Instantiating trading chart.`, 'root', _root, 'config', config, 'settings', _settings);

    const scaleIds = Object.keys(config);

    // save settings
    this.settings = Object.assign({},
      (theme === 'dark' ? DarkThemeChartSettings : LightThemeChartSettings),
      _settings, { scaleSectionRatio: (1 / scaleIds.length) }) as ChartSettings;

    // d3 root
    this.root = d3.select(_root).append('div')
      .style('position', 'relative')

    // now create tabular view based on given config and scales
    this.table = this.root.append('table').attr('class', 'chartTable').attr('style', `
      position: absolute;
      width: ${this.settings.width}px;
      height: ${this.settings.height}px;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      border: none;
      border-collapse: collapse;
      border-spacing: 0;
      line-height: 0px;
      margin: 0;
      padding: 0;
      background: ${this.settings.background}
    `.trimLines());

    const chartSectionWidth = this.settings.width * this.settings.plotSectionRatio;
    const scaleSectionWidth = this.settings.width - chartSectionWidth;
    const chartHeight = this.settings.height - scaleIds.length - X_AXIS_HEIGHT_PX;

    scaleIds.map((scaleId, i, _) => {
      const sectionHeight = chartHeight * (((this.settings.subGraph || {})[scaleId]?.scaleSectionRatio) || this.settings.scaleSectionRatio);
      // append tr and canvas within
      const tr = this.table.append('tr').attr('class', `subChart ${scaleId}`)
      const graphTd = tr.append('td').attr('class', `section ${scaleId}`).attr('style', `
        border: none;
        line-height: 0px;
        margin: 0;
        padding: 0;
        text-align: left;
        vertical-align: top;
        cursor: crosshair;
        overflow: hidden;
        width: ${chartSectionWidth}px;
        height: ${sectionHeight}px;
      `.trimLines())
      const graphContainer = graphTd.append('div').attr('class', `canvasContainer ${scaleId}`).attr('style', `
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `.trimLines())

      this.mainCanvasMap[scaleId] = graphContainer.append('canvas').attr('class', `mainCanvas ${scaleId}`).attr('style', `
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${chartSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
      `.trimLines()).attr('width', chartSectionWidth).attr('height', sectionHeight).node() as HTMLCanvasElement;

      this.mainUpdateCanvasMap[scaleId] = graphContainer.append('canvas').attr('class', `mainUpdateCanvas ${scaleId}`).attr('style', `
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${sectionHeight}px;
      position: absolute;
      left: 0px;
      top: 0px;
      z-index: 1;
    `.trimLines()).attr('width', chartSectionWidth).attr('height', sectionHeight).node() as HTMLCanvasElement;

      const rightScaleTd = tr.append('td').attr('class', `scale ${scaleId}`).attr('style', `
        border-left: 1px solid ${this.settings.graphSeparatorColor};
        line-height: 0px;
        margin: 0;
        padding: 0;
        text-align: left;
        vertical-align: top;
        width: ${scaleSectionWidth}px;
        min-width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
      `.trimLines())
      const rightScaleContainer = rightScaleTd.append('div').attr('class', `scaleContainer ${scaleId}`).attr('style', `
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `.trimLines())
      this.scaleYCanvasMap[scaleId] = rightScaleContainer.append('canvas').attr('class', `scaleYCanvas ${scaleId}`).attr('style', `
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
      `.trimLines()).attr('width', scaleSectionWidth).attr('height', sectionHeight).node() as HTMLCanvasElement;
      this.scaleYUpdateCanvasMap[scaleId] = rightScaleContainer.append('canvas').attr('class', `scaleYUpdateCanvas ${scaleId}`).attr('style', `
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
        z-index: 1;
        cursor: ns-resize;
      `.trimLines()).attr('width', scaleSectionWidth).attr('height', sectionHeight).node() as HTMLCanvasElement;


      if (i < _.length - 1) {
        const separatorhandle = this.table
          .append('tr').attr('style', `height: 1px;`)
          .append('td').attr('colspan', '2').attr('style', `
            margin: 0;
            padding: 0;
            position: relative;
            background: ${this.settings.graphSeparatorColor}
          `.trimLines())
          .append('div').attr('class', 'separatorHandle').attr('style', `
            height: 9px;
            left: 0;
            position: absolute;
            top: -4px;
            width: 100%;
            z-index: 50;
            cursor: row-resize;
          `.trimLines());
        // attach dragging and resize functionality and listener

      }
    });

    // append x scale
    const tr = this.table
      .append('tr').attr('style', `
        border-top: 1px solid ${this.settings.graphSeparatorColor};
      `.trimLines())
    const xdiv = tr.append('td').attr('style', `
        line-height: 0px;
        margin: 0;
        padding: 0;
        text-align: left;
        vertical-align: top;
        overflow: hidden;
        width: ${chartSectionWidth}px;
        min-width: ${chartSectionWidth}px;
      `.trimLines())
      .append('div').attr('class', `xScaleContainer`).attr('style', `
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `.trimLines())
    this.scaleXCanvas = xdiv.append('canvas').attr('class', `scaleXCanvas`).attr('style', `
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${X_AXIS_HEIGHT_PX}px;
      position: absolute;
      left: 0px;
      top: 0px;
    `.trimLines()).attr('width', chartSectionWidth).attr('height', X_AXIS_HEIGHT_PX).node() as HTMLCanvasElement;
    this.scaleXUpdateCanvas = xdiv.append('canvas').attr('class', `scaleXUpdateCanvas`).attr('style', `
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${X_AXIS_HEIGHT_PX}px;
      position: absolute;
      left: 0px;
      top: 0px;
      z-index: 1;
      cursor: ew-resize;
    `.trimLines()).attr('width', chartSectionWidth).attr('height', X_AXIS_HEIGHT_PX).node() as HTMLCanvasElement;

    // place holder for botttom right corner
    tr.append('td').attr('style', `
      border-left: 1px solid ${this.settings.graphSeparatorColor};
      line-height: 0px;
      margin: 0;
      padding: 0;
    `.trimLines());

    debug(this)
  }

  /**
   * Set the data to the the existing chart.
   * This triggers rendering for the entire chart based on changes.
   * @param data
   */
  public setData(_data: GraphData) {
    this.data = _data;
    const l = Object.keys(_data).reduce((l, id) => Math.max(l, _data[id].length), 0);
    this.zoomInterpolator = d3.interpolateNumber(l, MIN_ZOOM_POINTS)
    this.render();
  }

  /** Do zoom */
  public zoom(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) this.zoomLevel = Math.max(this.zoomLevel - ZOOM_STEP, 0);
    else this.zoomLevel = Math.min(this.zoomLevel + ZOOM_STEP, 1);
    debug('zoom', this.zoomLevel);
    this.render();
  }


  /** The actual rendering code */
  public render() {
    console.debug('render', this.data);
    if (this.data) {

    }
  }


}
