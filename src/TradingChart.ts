import * as d3 from 'd3';
import { EventEmitter } from 'events';
import {
  Annotation, CandlePlotData, CanvasMap, ChartConfig, ChartSettings, D3YScaleMap, DarkThemeChartSettings, EVENT_PAN, EVENT_ZOOM,
  GraphData, GraphDataMat, Interpolator, LightThemeChartSettings, MIN_ZOOM_POINTS, MouseDownPosition, MousePosition, PlotLineType, ScaleRowMap,
  X_AXIS_HEIGHT_PX, ZoomPanListenerType, ZoomPanType, debug, error, log
} from './types';
import {
  clearCanvas, drawArea, drawBar, drawBoxFilledText, drawCandle, drawCenterPivotRotatedText, drawFlagMark, drawLine,
  drawRectLimiterMark, drawText, drawXRange, drawXSingle
} from './utils';

const trimLines = (string: string) => string.replace(/\n\s+/g, '');
const toDevicePixel = (number: number) => (number * window.devicePixelRatio);


export class TradingChart {

  private dataMat: GraphDataMat = [];
  private dataWindowStartIndex?: number;
  private dataWindowEndIndex?: number;

  private config: ChartConfig;
  private settings: ChartSettings;
  /** Chart root element provided as container */
  private root: d3.Selection<HTMLDivElement, any, any, any> | undefined = undefined;
  /** internal maintable */
  private table: d3.Selection<HTMLTableElement, any, any, any> | undefined = undefined;
  /** Internal Td map */
  private scaleRowMap: ScaleRowMap = {};

  private mainCanvasMap: CanvasMap = {};
  private mainUpdateCanvasMap: CanvasMap = {};

  private scaleYCanvasMap: CanvasMap = {};
  private scaleYUpdateCanvasMap: CanvasMap = {};

  private scaleXCanvas: d3.Selection<HTMLCanvasElement, any, any, any> | undefined = undefined;
  private scaleXUpdateCanvas: d3.Selection<HTMLCanvasElement, any, any, any> | undefined = undefined;

  private zoomInterpolator: Interpolator<number, number> = d3.interpolateNumber(0, 0);
  private panOffset: number = 0;
  private panOffsetSaved: number = 0;

  private d3xScale = d3.scaleBand<Date>();
  private d3yScaleMap: D3YScaleMap = {};

  private currentMouseDownStart?: MouseDownPosition;
  private mousePosition?: MousePosition;

  private zoomEventEmitter = new EventEmitter();
  private panEventEmitter = new EventEmitter();

  private annotations: Annotation[] = [];

  private data: GraphData = {};


  /**
   * Instantiate a TradingChart
   * NO AUTO INITIALIZATION.
   * @param root the element under which the chart will be rendered. The styling of the root element won't be manipulated.
   * @param config Data based config for the entire chart
   * @param settings Cosmetic settings for the chart
   */
  constructor(_config: ChartConfig, _settings: Partial<ChartSettings>, theme?: 'light' | 'dark') {
    this.config = _config;
    const scaleIds = Object.keys(_config);

    // save settings
    this.settings = Object.assign({},
      (theme === 'dark' ? DarkThemeChartSettings : LightThemeChartSettings),
      _settings, { scaleSectionRatio: (1 / scaleIds.length) }) as ChartSettings;

    debug(this);
  }

  /** Initializes all dom nodes. This is a heavy loading process. This is called automatically at first initialization. This does not attch the root to DOM. */
  public initialize() {
    // get scale ids
    const scaleIds = Object.keys(this.config);

    // d3 root
    this.root = d3.select(document.createElement('div')).style('position', 'relative');

    // now create tabular view based on given config and scales
    const table = this.root.append('table').attr('class', 'chartTable').attr('style', trimLines(`
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
    `));

    this.table = table;
    const chartSectionWidth = this.settings.width * this.settings.plotSectionRatio;
    const scaleSectionWidth = this.settings.width - chartSectionWidth;
    const chartHeight = this.settings.height - scaleIds.length - X_AXIS_HEIGHT_PX;

    scaleIds.map((scaleId, i, _) => {
      const sectionHeight = chartHeight * (((this.settings.subGraph || {})[scaleId]?.scaleSectionRatio) || this.settings.scaleSectionRatio) +
        ((this.settings.subGraph || {})[scaleId]?.deltaHeight || 0);

      // append tr and canvas within
      const tr = table.append('tr').attr('class', `subChart ${scaleId}`)
      const graphTd = tr.append('td').attr('class', `section ${scaleId}`).attr('style', trimLines(`
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
      `))
      const graphContainer = graphTd.append('div').attr('class', `canvasContainer ${scaleId}`).attr('style', trimLines(`
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `))

      this.mainCanvasMap[scaleId] = graphContainer.append('canvas').attr('class', `mainCanvas ${scaleId}`).attr('style', trimLines(`
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${chartSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
      `))
        .attr('width', toDevicePixel(chartSectionWidth))
        .attr('height', toDevicePixel(sectionHeight))
        .attr('scaleId', scaleId).attr('canvasType', 'mainCanvas');

      this.mainUpdateCanvasMap[scaleId] = graphContainer.append('canvas').attr('class', `mainUpdateCanvas ${scaleId}`).attr('style', trimLines(`
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${sectionHeight}px;
      position: absolute;
      left: 0px;
      top: 0px;
      z-index: 1;
    `))
        .attr('width', toDevicePixel(chartSectionWidth))
        .attr('height', toDevicePixel(sectionHeight))
        .attr('scaleId', scaleId)
        .attr('canvasType', 'mainUpdateCanvas');

      const rightScaleTd = tr.append('td').attr('class', `scale ${scaleId}`).attr('style', trimLines(`
        border-left: 1px solid ${this.settings.graphSeparatorColor};
        line-height: 0px;
        margin: 0;
        padding: 0;
        text-align: left;
        vertical-align: top;
        width: ${scaleSectionWidth}px;
        min-width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
      `))
      const rightScaleContainer = rightScaleTd.append('div').attr('class', `scaleContainer ${scaleId}`).attr('style', trimLines(`
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `))
      this.scaleYCanvasMap[scaleId] = rightScaleContainer.append('canvas').attr('class', `scaleYCanvas ${scaleId}`).attr('style', trimLines(`
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
      `))
        .attr('width', toDevicePixel(scaleSectionWidth))
        .attr('height', toDevicePixel(sectionHeight))
        .attr('scaleId', scaleId).attr('canvasType', 'scaleYCanvas');

      this.scaleYUpdateCanvasMap[scaleId] = rightScaleContainer.append('canvas').attr('class', `scaleYUpdateCanvas ${scaleId}`).attr('style', trimLines(`
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        width: ${scaleSectionWidth}px;
        height: ${sectionHeight}px;
        position: absolute;
        left: 0px;
        top: 0px;
        z-index: 1;
        cursor: ns-resize;
      `))
        .attr('width', toDevicePixel(scaleSectionWidth))
        .attr('height', toDevicePixel(sectionHeight))
        .attr('scaleId', scaleId)
        .attr('canvasType', 'scaleYUpdateCanvas');

      // save ref to row map
      this.scaleRowMap[scaleId] = [graphTd, rightScaleTd];

      if (i < _.length - 1) {
        const separatorhandle = table
          .append('tr').attr('style', `height: 1px;`)
          .append('td').attr('colspan', '2').attr('style', trimLines(`
            margin: 0;
            padding: 0;
            position: relative;
            background: ${this.settings.graphSeparatorColor}
          `))
          .append('div')
          .attr('class', 'separatorHandle')
          .attr('style', trimLines(`
            height: 9px;
            left: 0;
            position: absolute;
            top: -4px;
            width: 100%;
            z-index: 50;
            cursor: row-resize;
          `))
          .attr('draggable', true)
          .attr('scale1', _[i])
          .attr('scale2', _[i + 1]);

        // attach dragging and resize functionality and listener
        separatorhandle.on('drag', (event) => {
          if (event.pageY && event.offsetY) { // work around for drag end
            const scale1 = _[i], scale2 = _[i + 1];
            const scale1tds = this.scaleRowMap[scale1];
            const scale2tds = this.scaleRowMap[scale2];
            const scale1newH = scale1tds.reduce((_, td) => {
              const h = parseFloat(td.style('height'));
              const newH = h + event.offsetY;
              td.style('height', `${newH}px`);
              return newH;
            }, 0);
            const scale2newH = scale2tds.reduce((_, td) => {
              const h = parseFloat(td.style('height'));
              const newH = h - event.offsetY;
              td.style('height', `${newH}px`);
              return newH;
            }, 0);
            // change canvas h
            this.mainCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', toDevicePixel(scale1newH));
            this.mainUpdateCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', toDevicePixel(scale1newH));
            this.scaleYCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', toDevicePixel(scale1newH));
            this.scaleYUpdateCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', toDevicePixel(scale1newH));
            // scale 2
            this.mainCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', toDevicePixel(scale2newH));
            this.mainUpdateCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', toDevicePixel(scale2newH));
            this.scaleYCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', toDevicePixel(scale2newH));
            this.scaleYUpdateCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', toDevicePixel(scale2newH));

            // ask to redaw the main canvas
            this.redrawMainCanvas();
          }
        });
      }
    });

    // append x scale
    const tr = this.table
      .append('tr').attr('style', trimLines(`
        border-top: 1px solid ${this.settings.graphSeparatorColor};
      `))
    const xdiv = tr.append('td').attr('style', trimLines(`
        line-height: 0px;
        margin: 0;
        padding: 0;
        text-align: left;
        vertical-align: top;
        overflow: hidden;
        width: ${chartSectionWidth}px;
        min-width: ${chartSectionWidth}px;
      `))
      .append('div')
      .attr('class', `xScaleContainer`)
      .attr('style', trimLines(`
        width:100%;
        height:100%;
        position: relative;
        overflow: hidden;
      `))

    this.scaleXCanvas = xdiv.append('canvas')
      .attr('class', `scaleXCanvas`)
      .attr('style', trimLines(`
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${X_AXIS_HEIGHT_PX}px;
      position: absolute;
      left: 0px;
      top: 0px;
    `))
      .attr('width', toDevicePixel(chartSectionWidth))
      .attr('height', toDevicePixel(X_AXIS_HEIGHT_PX));

    this.scaleXUpdateCanvas = xdiv.append('canvas')
      .attr('class', `scaleXUpdateCanvas`)
      .attr('style', trimLines(`
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${X_AXIS_HEIGHT_PX}px;
      position: absolute;
      left: 0px;
      top: 0px;
      z-index: 1;
      cursor: ew-resize;
    `))
      .attr('width', toDevicePixel(chartSectionWidth))
      .attr('height', toDevicePixel(X_AXIS_HEIGHT_PX));

    // place holder for botttom right corner
    tr.append('td').attr('style', trimLines(`
      border-left: 1px solid ${this.settings.graphSeparatorColor};
      line-height: 0px;
      margin: 0;
      padding: 0;
    `));

    // setup listeners for mouse.
    scaleIds.map(scaleId => {
      const d3Canvas = this.mainUpdateCanvasMap[scaleId];
      d3Canvas.on('mousedown', event => {
        event.preventDefault();
        this.currentMouseDownStart = { scaleId, x: event.x, y: event.y };
        this.scaleRowMap[scaleId][0].style('cursor', 'grabbing');
      })
      d3Canvas.on('mouseup', event => {
        event.preventDefault();
        this.currentMouseDownStart = undefined;
        this.panOffsetSaved = this.panOffset;
        this.scaleRowMap[scaleId][0].style('cursor', 'crosshair');
      });
      d3Canvas.on('mousemove', (event: MouseEvent) => {
        event.preventDefault();
        this.clearUpdateCanvas(); // clear the update canvas
        if (this.currentMouseDownStart) {
          this.currentMouseDownStart.dx = event.x - this.currentMouseDownStart.x;
          this.currentMouseDownStart.dy = event.y - this.currentMouseDownStart.y;
          this.pan(this.currentMouseDownStart.dx || 0, this.currentMouseDownStart.dy || 0)
        }
        else {
          // just normal mouse move update pointer crosshead
          const canvas = this.mainUpdateCanvasMap[scaleId].node();
          const rect = canvas?.getBoundingClientRect();
          const x = rect ? event.x - rect.left : event.x;
          const y = rect ? event.y - rect.top : event.y;
          if (!this.mousePosition) this.mousePosition = { x, y, scaleId };
          else {
            this.mousePosition.x = x;
            this.mousePosition.y = y;
            this.mousePosition.scaleId = scaleId;
          }
          this.redrawUpdateCanvas();
        }
      });
      d3Canvas.on('mouseout', () => {
        this.clearUpdateCanvas();
      })
    });
    // attach zoom to table
    this.table.on('wheel', (event: WheelEvent) => {
      event.preventDefault();
      if (event.deltaY < 0) this.zoom(this.settings.wheelZoomSensitivity);
      else this.zoom(-this.settings.wheelZoomSensitivity);
    })

    // Ask for redraw with whatever data
    this.redrawMainCanvas();

    // watermark
    if (this.settings.watermarkText) {
      this.root.append('div')
        .attr('class', 'watermark')
        .attr('style', trimLines(`
        position: absolute;
        width: ${this.settings.width}px;
        height: ${this.settings.height}px;
        text-align: center;
        vertical-align: middle;
        line-height: ${this.settings.height}px;
        font-size: 3rem;
        overflow: hidden;
        color: #00000012;
      `))
        .append('span')
        .attr('style', 'white-space:break-spaces')
        .html(this.settings.watermarkText);
    }

  }

  /**
   * Dynamically update config for this Chart.
   * NO AUTO INITIALIZATION.
   * @param _config
   */
  public setConfig(_config: ChartConfig) {
    this.config = _config;
    // change the subgraph ratio
    this.settings.scaleSectionRatio = 1 / Object.keys(_config).length;
    if (this.settings.subGraph) {
      Object.keys(this.settings.subGraph).map(sid => {
        delete this.settings.subGraph[sid].scaleSectionRatio;
      })
    }
  }

  /**
   * Dynamically update the chart theme.
   * NO AUTO INITIALIZATION.
   * @param theme
   */
  public updateTheme(theme: 'light' | 'dark') {
    // save settings
    this.settings = Object.assign({}, this.settings,
      (theme === 'dark' ? DarkThemeChartSettings : LightThemeChartSettings)) as ChartSettings;
    // draw main graph
    this.redrawMainCanvas();
  }

  /** Get a color pallet */
  private getColorPallet(scaleId?: string) {
    const colorpallet = (scaleId ? ((this.settings.subGraph || {})[scaleId] || {}).colorPallet : undefined) || this.settings.colorPallet || d3.schemePaired;
    return colorpallet;
  }

  /**
   * Set the data to the the existing chart.
   * This triggers rendering for the entire chart based on changes.
   * @param data
   */
  public setData(_data: GraphData) {
    this.data = _data;
    this.recalculateData();
    // debug(this.dataMat);
    this.zoomInterpolator = d3.interpolateNumber(this.dataMat.length, MIN_ZOOM_POINTS)
    this.updateWindowFromZoomPan();
    // draw main graph
    this.redrawMainCanvas();
  }

  /** This is a internal function which re-calculates all data points */
  private recalculateData() {
    if (this.data && Object.keys(this.data).length > 0) {
      // extract grouped data
      const dtgrouped = Object.keys(this.config).reduce((rv, scaleId) => {
        const subgraph = this.config[scaleId];
        Object.keys(subgraph).map((plotName, i) => {
          const plotConf = subgraph[plotName];
          const d = this.data[plotConf.dataId] || [];
          const colorpallet = this.getColorPallet(scaleId);
          const defaultColor = colorpallet[i % colorpallet.length];
          let lastBaseY: number | undefined = undefined;
          // loop thourgh d
          d.map(d => {
            const ts = plotConf.tsValue(d);
            const data = plotConf.data(d);
            const color = (plotConf.color) ? (typeof (plotConf.color) === 'function' ? plotConf.color(d) : plotConf.color) : defaultColor;
            const baseY = (typeof (plotConf.baseY) === 'undefined') ? lastBaseY : (typeof (plotConf.baseY) === 'function' ? plotConf.baseY(d) : plotConf.baseY);
            lastBaseY = baseY; // replace last
            if (!rv[ts.getTime()]) rv[ts.getTime()] = { [scaleId]: { [plotName]: { d: data, color, baseY } } };
            else if (!rv[ts.getTime()][scaleId]) rv[ts.getTime()][scaleId] = { [plotName]: { d: data, color, baseY } };
            else if (!rv[ts.getTime()][scaleId][plotName]) rv[ts.getTime()][scaleId][plotName] = { d: data, color, baseY };
          })
        });
        return rv;
      }, {} as any);
      // save data mat
      const xDomainValus = Object.keys(dtgrouped).sort((a, b) => ((+a) - (+b)));
      this.dataMat = xDomainValus.map(tsk => {
        return { ts: new Date(+tsk), data: dtgrouped[tsk] }
      });
    }
  }

  /**
   * Set chart annotations.
   * @param _annotations
   */
  public setAnnotations(_annotations: Partial<Annotation>[]) {
    this.annotations = _annotations.map((a, i) => {
      if (typeof (a.color) === 'undefined') {
        const colorPallet = this.getColorPallet(a.scaleId);
        a.color = colorPallet[i];
        if (typeof (a.areaColor) === 'undefined') {
          a.areaColor = d3.color(colorPallet[i])?.copy({ opacity: 0.2 }).formatHex8() || colorPallet[i];
        }
      }
      if (typeof (a.text) === 'undefined') a.text = `${i + 1}`;
      a.x = (a.x || []).map(x => ((Object.prototype.toString.call(x) === '[object Date]') ? x : new Date(x)));
      if (typeof (a.textColor) === 'undefined') a.textColor = this.settings.crossHairContrastColor;
      return a as Annotation; // return enriched
    });
    // ask for redraw.
    this.redrawMainCanvas();
  }

  /**
   * Funtion to get the windowes data based on zoom. Do not slice the actual data.
   */
  public getWindowedData(): GraphDataMat {
    return this.dataMat.slice(this.dataWindowStartIndex || 0, this.dataWindowEndIndex || this.dataMat.length);
  }

  /**
   * Update window from zoom and pan
   */
  private updateWindowFromZoomPan() {
    const windowLength = this.zoomInterpolator(this.settings.zoomLevel);
    // x2=L-1-panoffset
    // x1=L-1-panoffset - (b-1)
    this.dataWindowStartIndex = Math.max(0, this.dataMat.length - 1 - this.panOffset - windowLength);
    this.dataWindowEndIndex = Math.min(this.dataMat.length, this.dataMat.length - this.panOffset);
  }

  /** Do zoom */
  public zoom(step: number) {
    this.settings.zoomLevel = Math.max(Math.min(this.settings.zoomLevel + step, 1), 0.001);

    this.updateWindowFromZoomPan();
    this.redrawMainCanvas();
    // call any listeners
    this.zoomEventEmitter.emit(EVENT_ZOOM);
  }

  /**
   * Set zoom level and pan based on calculated start and end
   * @param start
   * @param end
   */
  public zoomPanToRange(start: Date, end: Date) {
    if (this.dataMat && this.dataMat.length > 0) {
      const [i1, i2] = this.dataMat.reduce((rv, mat, i) => {
        if (mat.ts.getTime() <= start.getTime()) rv[0] = Math.max(i - 1, 0); // update till ts == start or atleast before start.
        if (mat.ts.getTime() <= end.getTime()) rv[1] = Math.min(i + 1, this.dataMat.length - 1); // update till ts == end or atleast before end
        return rv;
      }, [0, this.dataMat.length - 1]);
      // got the window [i1, i2]
      this.panOffset = i2;
      this.dataWindowEndIndex = i2 - 1;
      this.dataWindowStartIndex = i1;
      const windowLength = this.dataWindowEndIndex - this.dataWindowStartIndex;
      const zoomLevel = (windowLength - this.dataMat.length) / (MIN_ZOOM_POINTS - this.dataMat.length);
      log(`Zoom level determined: ${zoomLevel}`);
      this.settings.zoomLevel = zoomLevel;
      this.redrawMainCanvas();
      // call any listeners
      this.zoomEventEmitter.emit(EVENT_ZOOM);
    }
  }

  /**
   * Panning. positive dx for pan to see latest data at right hand side.
   * @param dx
   * @param dy
   */
  public pan(dx: number, dy: number) {
    const xBandW = this.d3xScale.step();
    const maxBarsToscroll = Math.floor(dx / xBandW);
    const windowLength = this.zoomInterpolator(this.settings.zoomLevel);
    this.panOffset = Math.min(Math.max(0, this.panOffsetSaved + maxBarsToscroll), this.panOffset + windowLength);
    this.updateWindowFromZoomPan();
    this.redrawMainCanvas();
    // call listeners
    this.panEventEmitter.emit(EVENT_PAN);
  }

  /**
   * Dynamically update chart settings.
   * @param _settings
   */
  public updateSettings(_settings: Partial<ChartSettings>) {
    this.recalculateData();
    this.settings = Object.assign(this.settings || {}, _settings) as ChartSettings;
    // ask for redraw
    this.updateWindowFromZoomPan();
    this.redrawMainCanvas();
  }

  /**
   * Update all scale domains
   * @param windowedData
   */
  private updateDomains(windowedData: GraphDataMat) {
    // update x scale domain
    this.d3xScale.domain(windowedData.map(_ => _.ts));
    // update y scale domains
    const maxminMap = windowedData.reduce((rv, d) => {
      const scaleIds = Object.keys(d.data);
      scaleIds.map(scaleId => {
        let max = -Infinity, min = Infinity;
        Object.keys(d.data[scaleId]).map(plotName => {
          const plotd = d.data[scaleId][plotName];
          max = Math.max(max, typeof (plotd.d) === 'object' ? plotd.d.l : plotd.d, plotd.baseY || -Infinity);
          min = Math.min(min, typeof (plotd.d) === 'object' ? plotd.d.l : plotd.d, plotd.baseY || Infinity);
        });
        if (!rv[scaleId]) rv[scaleId] = { max, min };
        else {
          rv[scaleId].max = Math.max(rv[scaleId].max, max);
          rv[scaleId].min = Math.min(rv[scaleId].min, min);
        }
      });
      return rv;
    }, {} as any);
    Object.keys(maxminMap).map(scaleId => {
      const { max, min } = maxminMap[scaleId];
      const yScaleDomainPaddingLength = (max - min) * (((this.settings.subGraph || {})[scaleId] || {}).yScalePaddingPct || this.settings.yScalePaddingPct);
      if (!this.d3yScaleMap[scaleId]) this.d3yScaleMap[scaleId] = d3.scaleLinear();
      this.d3yScaleMap[scaleId]
        .domain([min - yScaleDomainPaddingLength, max + yScaleDomainPaddingLength])
    })
  }

  /**
   * Function which redraws the main canvas and corresponding scales
   * Main canvas will be redrawn for zoom, panning, section resize etc.
   */
  public redrawMainCanvas() {
    // If there is data then only main graph will be drawn
    if (this.dataMat && this.dataMat.length && this.scaleXCanvas) {
      const windowedData = this.getWindowedData();
      // update scale domains
      this.updateDomains(windowedData);

      const xScaleCanvas = this.scaleXCanvas.node() as HTMLCanvasElement;
      const xScaleCanvasWidth = +this.scaleXCanvas.attr('width');
      const xScaleCanvasHeight = +this.scaleXCanvas.attr('height');
      const xScaleFormat = d3.timeFormat(this.settings.xScaleFormat);

      const xScaleCanvasCtx = xScaleCanvas.getContext('2d') as CanvasRenderingContext2D;

      // clear canvas
      clearCanvas(xScaleCanvasCtx, 0, 0, xScaleCanvasWidth, xScaleCanvasHeight);

      const callOnXTicks = (direction: 'forward' | 'backward', fn: (d: Date, i: number, _: Date[]) => void) => {
        const domain = this.d3xScale.domain();
        const totalDomainLength = domain.length;
        const stepsize = Math.floor(totalDomainLength / this.settings.xGridInterval);
        for (let i = 0; i < this.settings.xGridInterval; i++) {
          const index = i * stepsize;
          const j = (direction === 'backward') ? totalDomainLength - 1 - index : index;
          fn(domain[j], i, domain);
        }
      }

      Object.keys(this.config).map(scaleId => {
        const subgraphConfig = this.config[scaleId];

        const canvas = this.mainCanvasMap[scaleId].node() as HTMLCanvasElement;
        const canvasWidth = +this.mainCanvasMap[scaleId].attr('width');
        const canvasHeight = +this.mainCanvasMap[scaleId].attr('height');

        const yScaleCanvas = this.scaleYCanvasMap[scaleId].node() as HTMLCanvasElement;
        const yScaleCanvasWidth = +this.scaleYCanvasMap[scaleId].attr('width');
        const yScaleCanvasHeight = +this.scaleYCanvasMap[scaleId].attr('height');

        // draw scales
        this.d3yScaleMap[scaleId].range([canvasHeight, 0]);
        const d3yScale = this.d3yScaleMap[scaleId];

        this.d3xScale
          .range([0, xScaleCanvasWidth])
          .padding(this.settings.xScalePadding);

        const mainCanvasCtx = canvas.getContext('2d') as CanvasRenderingContext2D;
        const yScaleCanvasCtx = yScaleCanvas.getContext('2d') as CanvasRenderingContext2D;


        // clear canvas before drawing
        clearCanvas(mainCanvasCtx, 0, 0, canvasWidth, canvasHeight);
        clearCanvas(yScaleCanvasCtx, 0, 0, yScaleCanvasWidth, yScaleCanvasHeight);

        // -----------------------------------END: Draw Axis------------------------------------------------

        // -----------------------------------START: Draw Plot------------------------------------------------
        Object.keys(subgraphConfig).map(plotName => {
          const plotConfig = subgraphConfig[plotName];
          const subGraphSettings = (this.settings.subGraph || {})[scaleId] || {};
          const bandW = this.d3xScale.bandwidth();
          const filteredWindowedData = windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName] && typeof (d.data[scaleId][plotName].d) !== 'undefined'));
          switch (plotConfig.type) {

            //--------------Candle plot------------
            case 'candle':
              filteredWindowedData.map(d => {
                const _d = d.data[scaleId][plotName];
                if (typeof (_d.d) !== 'undefined') {
                  const _c = _d.d as CandlePlotData;
                  const x = this.d3xScale(d.ts) as number;
                  drawCandle(mainCanvasCtx, _d.color, x, d3yScale(_c.o), d3yScale(_c.c), x + bandW / 2, d3yScale(_c.h), d3yScale(_c.l), bandW)
                }
              });
              break;

            //--------------line plot------------
            case 'dashed-line':
            case 'dotted-line':
            case 'solid-line':
              drawLine(mainCanvasCtx, filteredWindowedData[filteredWindowedData.length - 1].data[scaleId][plotName].color, plotConfig.type as PlotLineType,
                (subGraphSettings.lineWidth || this.settings.lineWidth), filteredWindowedData.map(d => {
                  const _d = d.data[scaleId][plotName];
                  const x = this.d3xScale(d.ts) as number;
                  const y = d3yScale(_d.d as number);
                  return [x + bandW / 2, y];
                }));
              break;

            //--------------bar plot------------
            case 'bar':
              filteredWindowedData.map(d => {
                const _d = d.data[scaleId][plotName];
                const x = this.d3xScale(d.ts) as number;
                const y = d3yScale(_d.d as number);
                drawBar(mainCanvasCtx, _d.color, x, y, bandW, canvasHeight - y);
              });
              break;

            //--------------var bar plot------------
            case 'var-bar':
              filteredWindowedData.map(d => {
                const _d = d.data[scaleId][plotName];
                const x = this.d3xScale(d.ts) as number;
                const y = d3yScale(_d.d as number);
                const baseY = typeof (_d.baseY) !== 'undefined' ? d3yScale(_d.baseY) : canvasHeight;
                drawBar(mainCanvasCtx, _d.color, x, y, bandW, baseY - y);
              });
              break;

            //--------------area plot------------
            case 'area':
              const color = d3.color(filteredWindowedData[filteredWindowedData.length - 1].data[scaleId][plotName].color) as d3.RGBColor | d3.HSLColor;
              const areaColor = plotConfig.areaColor ? [plotConfig.areaColor, plotConfig.areaColor] : [color.copy({ opacity: 0.6 }).formatHex8(), color.copy({ opacity: 0.2 }).formatHex8()];
              drawArea(mainCanvasCtx, color.formatHex8(), plotConfig.colorBaseY, (subGraphSettings.lineWidth || this.settings.lineWidth),
                areaColor, filteredWindowedData.map(d => {
                  const _d = d.data[scaleId][plotName];
                  const x = this.d3xScale(d.ts) as number;
                  const y = d3yScale(_d.d as number);
                  const baseY = typeof (_d.baseY) !== 'undefined' ? d3yScale(_d.baseY) : canvasHeight;
                  return [x + bandW / 2, y, baseY];
                }));
              break;
          }
        })
        // -----------------------------------END: Draw Plot------------------------------------------------

        // -----------------------------------START: Draw Grid Lines------------------------------------------------
        // if (this.settings.gridLinesType !== 'none') {
        //   // x grid lines
        //   callOnXTicks('backward', (d, i, _) => {
        //     const x = this.d3xScale(d) as number;
        //     const color = typeof (this.settings.gridLinesColor) === 'string' ? this.settings.gridLinesColor as string : this.settings.gridLinesColor[0];
        //     drawGridLine(mainCanvasCtx, color, x, 0, 0, canvasHeight, this.settings.gridLinesType as 'vert');
        //   });
        // }
        // -----------------------------------END: Draw Grid Lines------------------------------------------------

        // -----------------------------------START: Draw y Scale------------------------------------------------
        const yScaleTicksCount = ((this.settings.subGraph || {})[scaleId] || {}).yScaleTickCount || this.settings.yScaleTickCount;
        const ticks = d3yScale.ticks(yScaleTicksCount);
        const yScaleDomainSize = d3yScale.domain().reduce((rv, d, i, _) => {
          if (i === 0) rv = d;
          else if (i === _.length - 1) {
            return Math.abs(rv - d);
          }
          return rv;
        }, 0);

        const tickFormat = d3yScale.tickFormat(yScaleTicksCount, ((this.settings.subGraph || {})[scaleId] || {}).yScaleFormat ||
          ((yScaleDomainSize > 1000) ? '~s' : (yScaleDomainSize < 10) ? '.2~f' : 'd'));

        ticks.map((tick) => {
          const y = d3yScale(tick);
          drawText(yScaleCanvasCtx, tickFormat(tick), 1, y, 0, this.settings.scaleFontColor, this.settings.scaleFontSize, 'left');
        })
        const yScaleTitle = ((this.settings.subGraph || {})[scaleId] || {}).yScaleTitle || this.settings.yScaleTitle;
        if (yScaleTitle)
          drawCenterPivotRotatedText(yScaleCanvasCtx, yScaleTitle, yScaleCanvasWidth - parseInt(this.settings.scaleFontSize), yScaleCanvasHeight / 2, 270,
            this.settings.scaleFontColor, this.settings.scaleFontSize);
        // -----------------------------------END: Draw y Scale------------------------------------------------

        // -----------------------------------START: Draw title------------------------------------------------
        const title = ((this.settings.subGraph || {})[scaleId] || {}).title;
        if (title) {
          const titleFontColor = ((this.settings.subGraph || {})[scaleId] || {}).titleFontColor || this.settings.scaleFontColor;
          const titleFontSize = ((this.settings.subGraph || {})[scaleId] || {}).titleFontSize || this.settings.scaleFontSize;
          const titlePosition = ((this.settings.subGraph || {})[scaleId] || {}).titlePlacement || this.settings.titlePlacement || 'top-right';
          const legendMargin = ((this.settings.subGraph || {})[scaleId] || {}).legendMargin || this.settings.legendMargin || [10, 10, 10];
          const legendMarginType = typeof (legendMargin);
          switch (titlePosition) {
            case 'top-center':
              drawText(mainCanvasCtx, title, canvasWidth / 2, legendMarginType === 'number' ? legendMargin : (legendMargin as any)[0], undefined, titleFontColor, titleFontSize, 'center', 'top');
              break;

            case 'top-right':
              drawText(mainCanvasCtx, title, canvasWidth - (legendMarginType === 'number' ? legendMargin : (legendMargin as any)[2]), legendMarginType === 'number' ? legendMargin : (legendMargin as any)[0], undefined, titleFontColor, titleFontSize, 'right', 'top');
              break;

            case 'top-left':
              drawText(mainCanvasCtx, title, legendMarginType === 'number' ? legendMargin : (legendMargin as any)[1], legendMarginType === 'number' ? legendMargin : (legendMargin as any)[0], undefined, titleFontColor, titleFontSize, 'left', 'top');
              break;
          }
        }
        // -----------------------------------END: Draw title------------------------------------------------

        // -----------------------------------START: Try to draw annotations------------------------------------------------
        const annotations = this.annotations.filter(a => ((a.scaleId === scaleId) || (typeof (a.scaleId) === 'undefined')));
        if (annotations && annotations.length > 0) {
          // debug('annotations', scaleId, annotations);
          const lineWidth = this.settings.annotationLineWidth;
          const annotationFontSize = this.settings.annotationFontSize;
          const xBandW = this.d3xScale.bandwidth();
          annotations.map(annotation => {
            const x = annotation.x.map(_ => this.d3xScale(_) as number);
            const y = annotation.y.map(_ => d3yScale(_) as number);
            switch (annotation.type) {
              case 'xRange':
                if (x.length > 1) drawXRange(mainCanvasCtx, x[0], x[1], canvasHeight, annotation.color, lineWidth, annotation.areaColor, annotation.text, annotationFontSize);
                break;

              case 'xSingle':
                if (x.length > 0) drawXSingle(mainCanvasCtx, x[0] + xBandW / 2, canvasHeight, annotation.color, lineWidth, annotation.text, annotationFontSize);
                break;

              case 'flag':
                x.map((x, i) => {
                  drawFlagMark(mainCanvasCtx, x + xBandW / 2, y[i], annotation.text, annotation.direction, annotation.color, annotation.textColor, annotationFontSize);
                })
                break;

              case 'rect':
                drawRectLimiterMark(mainCanvasCtx, x[0], x[1], y[0], y[1], y[2], y[3], annotation.color, lineWidth, annotation.areaColor, annotation.text, annotationFontSize)
                break;
            }
          })
        }
        // -----------------------------------END: Try to draw annotations------------------------------------------------

      });

      // ----------------Draw X axis-----------------------
      callOnXTicks('forward', (d, i, _) => {
        const xscaleY = xScaleCanvasHeight / 2;
        const x = this.d3xScale(d) as number;
        drawText(xScaleCanvasCtx, xScaleFormat(d), x, xscaleY, 0, this.settings.scaleFontColor, this.settings.scaleFontSize, 'left');
      });

      // -------------------Draw for only xrange and xSingle annotations to xscale-------------------------------
      this.annotations.filter(a => ((a.type === 'xRange' || a.type === 'xSingle') && a.x.length > 0)).map(annotation => {
        try {
          const x = annotation.x.map(_ => this.d3xScale(_) as number);
          const txt = annotation.x.map(_ => xScaleFormat(_));
          const rh = parseInt(this.settings.annotationFontSize);
          switch (annotation.type) {
            case 'xRange':
              drawBoxFilledText(xScaleCanvasCtx, txt[0], annotation.color, annotation.textColor, x[0], 5, x[0], 0, undefined, rh + 10, this.settings.annotationFontSize, 'right', 'top');
              drawBoxFilledText(xScaleCanvasCtx, txt[1], annotation.color, annotation.textColor, x[1], 5, x[1], 0, undefined, rh + 10, this.settings.annotationFontSize, 'left', 'top');
              break;

            case 'xSingle':
              drawBoxFilledText(xScaleCanvasCtx, txt[0], annotation.color, annotation.textColor, x[0] + this.d3xScale.bandwidth() / 2, 5, undefined, 0, undefined, rh + 10, this.settings.annotationFontSize, 'center', 'top');
              break;
          }

        } catch (e) {
          error('Error while drawing annotation', e);
        }
      })

    }
  }


  /** Function responsible for redrawing update canvas for mouse positions and annotations on scales. */
  private redrawUpdateCanvas() {
    if (this.scaleXUpdateCanvas)
      try {
        // calculate
        const windowedData = this.getWindowedData();
        const xScaleCtx = this.scaleXUpdateCanvas.node()?.getContext('2d');
        const xstep = this.d3xScale.step();
        const bandW = this.d3xScale.bandwidth();
        const domainVal = this.d3xScale.domain()[Math.floor(toDevicePixel(this.mousePosition?.x || 0) / xstep)]
        const x = (this.d3xScale(domainVal) || 0) + bandW / 2;
        if (xScaleCtx) {
          const text = `  ${d3.timeFormat(this.settings.xScaleCrossHairFormat)(domainVal)}  `;
          drawBoxFilledText(xScaleCtx, text, this.settings.crossHairColor, this.settings.crossHairContrastColor, x, 5, undefined, 0, undefined,
            parseInt(this.settings.scaleFontSize) + 10, this.settings.scaleFontSize, 'center', 'top');
          // drawText(xScaleCtx, text, x, 0, undefined, this.settings.crossHairContrastColor, this.settings.scaleFontSize, 'center', 'top')
        }

        Object.keys(this.config).map(scaleId => {
          const canvas = this.mainUpdateCanvasMap[scaleId];
          const ctx = canvas.node()?.getContext('2d');
          const canvasWidth = +canvas.attr('width');
          const canvasHeight = +canvas.attr('height');

          if (ctx) {
            drawLine(ctx, this.settings.crossHairColor, 'dotted-line', this.settings.crossHairWidth, [[x, 0], [x, canvasHeight]]);
            // draw only if this is the current scale subgraph
            if (this.mousePosition?.scaleId === scaleId) {
              const y = toDevicePixel(this.mousePosition?.y || 0);
              const ydomainVal = this.d3yScaleMap[scaleId].invert(y);
              const yformatter = d3.format(((this.settings.subGraph || {})[scaleId] || {}).crossHairYScaleFormat || this.settings.crossHairYScaleFormat)
              const yscalecanvas = this.scaleYUpdateCanvasMap[scaleId];
              const yscalectx = yscalecanvas.node()?.getContext('2d');
              const yscalecanvasWidth = +yscalecanvas.attr('width');
              // draw y line
              drawLine(ctx, this.settings.crossHairColor, 'dotted-line', this.settings.crossHairWidth, [[0, y], [canvasWidth, y]]);
              if (yscalectx) {
                // y scale drawing
                drawBoxFilledText(yscalectx, yformatter(ydomainVal), this.settings.crossHairColor, this.settings.crossHairContrastColor, 5, y,
                  0, y - parseInt(this.settings.scaleFontSize) / 2 - 5, toDevicePixel(yscalecanvasWidth), parseInt(this.settings.scaleFontSize) + 10, this.settings.scaleFontSize, 'left', 'middle');
              }
            }
            // render legends at the current x coordinates
            const matData = windowedData.find(v => v.ts.getTime() === domainVal.getTime());
            if (matData) {
              const plots = Object.keys(this.config[scaleId]);
              const plotVals = plots.map(plot => ((matData.data[scaleId] || {})[plot] || {})).map((d, i) => ({ name: plots[i], d }));

              if (plotVals.length > 0) {
                const legendFontSize = ((this.settings.subGraph || {})[scaleId] || {}).legendFontSize || this.settings.legendFontSize;
                const legendPosition = ((this.settings.subGraph || {})[scaleId] || {}).legendPosition || this.settings.legendPosition || 'top-left';
                const legendMargin = ((this.settings.subGraph || {})[scaleId] || {}).legendMargin || this.settings.legendMargin || [10, 10, 10];
                const legendMarginType = typeof (legendMargin);
                const formatter = d3.format(((this.settings.subGraph || {})[scaleId] || {}).legendFormat || this.settings.legendFormat);
                plotVals.map((plotLegendVal, i) => {
                  const y = (i + 1) * (legendMarginType === 'number' ? legendMargin : (legendMargin as any)[0]) + (i * parseInt(legendFontSize));
                  const legendText = typeof (plotLegendVal.d.d) === 'object' ? `O ${plotLegendVal.d.d.o}   H ${plotLegendVal.d.d.h}   L ${plotLegendVal.d.d.l}   C ${plotLegendVal.d.d.c}` : `${plotLegendVal.name}: ${formatter(plotLegendVal.d.d)} ${(typeof (plotLegendVal.d.baseY) !== 'undefined') ? `   BaseY: ${formatter(plotLegendVal.d.baseY)}` : ''}`;

                  switch (legendPosition) {
                    case 'top-right':
                      drawText(ctx, legendText, canvasWidth - (legendMarginType === 'number' ? legendMargin : (legendMargin as any)[2]), y, undefined, plotLegendVal.d.color, legendFontSize, 'right', 'top');
                      break;

                    case 'top-left':
                      drawText(ctx, legendText, legendMarginType === 'number' ? legendMargin : (legendMargin as any)[1], y, undefined, plotLegendVal.d.color, legendFontSize, 'left', 'top');
                      break;
                  }
                });
              }
            }
          }
        })
      } catch (e) { log(e); }
  }

  /**
   * This is to clear the update canvas
   */
  private clearUpdateCanvas() {
    const scaleIds = Object.keys(this.config);
    scaleIds.map(scaleId => {
      const canvas = this.mainUpdateCanvasMap[scaleId];
      const canvasCtx = canvas.node()?.getContext('2d');
      const canvasWidth = +canvas.attr('width');
      const canvasHeight = +canvas.attr('height');
      if (canvasCtx) clearCanvas(canvasCtx, 0, 0, canvasWidth, canvasHeight);

      const yScalecanvas = this.scaleYUpdateCanvasMap[scaleId];
      const yScalecanvasCtx = yScalecanvas.node()?.getContext('2d');
      const yScalecanvasWidth = +yScalecanvas.attr('width');
      const yScalecanvasHeight = +yScalecanvas.attr('height');
      if (yScalecanvasCtx) clearCanvas(yScalecanvasCtx, 0, 0, yScalecanvasWidth, yScalecanvasHeight);
    });
    if (this.scaleXUpdateCanvas) {
      const xScalecanvasCtx = this.scaleXUpdateCanvas.node()?.getContext('2d');
      const xScalecanvasWidth = +this.scaleXUpdateCanvas.attr('width');
      const xScalecanvasHeight = +this.scaleXUpdateCanvas.attr('height');
      if (xScalecanvasCtx) clearCanvas(xScalecanvasCtx, 0, 0, xScalecanvasWidth, xScalecanvasHeight);
    }
  }

  /**
   * Detach the chart root from DOM.
   */
  public detach() {
    if (this.root)
      this.root.remove();
    this.zoomEventEmitter.removeAllListeners();
    this.panEventEmitter.removeAllListeners();
  }

  /**
   * Attach to given DOM root node
   */
  public attach(domRoot: HTMLElement) {
    if (this.root) {
      const _root = this.root.node();
      if (_root) domRoot.appendChild(_root);
    }
  }


  /**
   * Add listener to events
   * @param event
   * @param listener
   * @returns
   */
  public on(event: ZoomPanType, listener: ZoomPanListenerType) {
    switch (event) {
      case 'zoom':
        return this.zoomEventEmitter.on(EVENT_ZOOM, listener);

      case 'pan':
        return this.panEventEmitter.on(EVENT_PAN, listener);
    }
  }

  /**
   * Add one off listener to events
   * @param event
   * @param listener
   * @returns
   */
  public once(event: ZoomPanType, listener: ZoomPanListenerType) {
    switch (event) {
      case 'zoom':
        return this.zoomEventEmitter.once(EVENT_ZOOM, listener);

      case 'pan':
        return this.panEventEmitter.once(EVENT_PAN, listener);
    }
  }

  /**
   * Remove a listener to events
   * @param event
   * @param listener
   * @returns
   */
  public off(event: ZoomPanType, listener: ZoomPanListenerType) {
    switch (event) {
      case 'zoom':
        return this.zoomEventEmitter.off(EVENT_ZOOM, listener);

      case 'pan':
        return this.panEventEmitter.off(EVENT_PAN, listener);
    }
  }

  /**
   * Remove all listeners for events
   * @param event
   * @param listener
   * @returns
   */
  public offAll(event: ZoomPanType) {
    switch (event) {
      case 'zoom':
        return this.zoomEventEmitter.removeAllListeners(EVENT_ZOOM);

      case 'pan':
        return this.panEventEmitter.removeAllListeners(EVENT_PAN);
    }
  }


}
