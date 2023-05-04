import * as d3 from 'd3';
import {
  CandlePlotData, CanvasMap, ChartConfig, ChartSettings, D3YScaleMap, DarkThemeChartSettings,
  GraphData, GraphDataMat, Interpolator, LightThemeChartSettings, MIN_ZOOM_POINTS, MouseDownPosition, MousePosition, PlotData, PlotLineType, ScaleRowMap,
  X_AXIS_HEIGHT_PX, debug
} from './types';
import { clearCanvas, drawArea, drawBar, drawBoxFilledText, drawCandle, drawCenterPivotRotatedText, drawLine, drawText } from './utils';

declare global {
  interface String {
    trimLines(): string;
  }
  interface Number {
    toDevicePixel(): number;
  }
}
String.prototype.trimLines = function (this: string) {
  return this.replace(/\n\s+/g, '');
}
Number.prototype.toDevicePixel = function (this: number) {
  return this * window.devicePixelRatio;
}

export class TradingChart {

  private dataMat: GraphDataMat = [];
  private dataWindowStartIndex?: number;
  private dataWindowEndIndex?: number;

  private settings: ChartSettings;
  /** Chart root element provided as container */
  private root;
  /** internal maintable */
  private table;
  /** Internal Td map */
  private scaleRowMap: ScaleRowMap = {};

  private mainCanvasMap: CanvasMap = {};
  private mainUpdateCanvasMap: CanvasMap = {};

  private scaleYCanvasMap: CanvasMap = {};
  private scaleYUpdateCanvasMap: CanvasMap = {};

  private scaleXCanvas: d3.Selection<HTMLCanvasElement, any, any, any>;
  private scaleXUpdateCanvas: d3.Selection<HTMLCanvasElement, any, any, any>;

  private zoomInterpolator: Interpolator<number, number> = d3.interpolateNumber(0, 0);
  private panOffset: number = 0;
  private panOffsetSaved: number = 0;

  private d3xScale = d3.scaleBand<Date>();
  private d3yScaleMap: D3YScaleMap = {};

  private currentMouseDownStart?: MouseDownPosition;
  private mousePosition?: MousePosition;



  /**
   * Instantiate a TradingChart
   * @param root the element under which the chart will be rendered. The styling of the root element won't be manipulated.
   * @param config Data based config for the entire chart
   * @param settings Cosmetic settings for the chart
   */
  constructor(private _root: HTMLElement, public readonly config: ChartConfig, _settings: Partial<ChartSettings>, theme?: 'light' | 'dark') {

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
      const sectionHeight = chartHeight * (((this.settings.subGraph || {})[scaleId]?.scaleSectionRatio) || this.settings.scaleSectionRatio) +
        ((this.settings.subGraph || {})[scaleId]?.deltaHeight || 0);

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
      `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', sectionHeight.toDevicePixel()).attr('scaleId', scaleId).attr('canvasType', 'mainCanvas');

      this.mainUpdateCanvasMap[scaleId] = graphContainer.append('canvas').attr('class', `mainUpdateCanvas ${scaleId}`).attr('style', `
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      width: ${chartSectionWidth}px;
      height: ${sectionHeight}px;
      position: absolute;
      left: 0px;
      top: 0px;
      z-index: 1;
    `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', sectionHeight.toDevicePixel()).attr('scaleId', scaleId).attr('canvasType', 'mainUpdateCanvas');

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
      `.trimLines()).attr('width', scaleSectionWidth.toDevicePixel()).attr('height', sectionHeight.toDevicePixel()).attr('scaleId', scaleId).attr('canvasType', 'scaleYCanvas');
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
      `.trimLines()).attr('width', scaleSectionWidth.toDevicePixel()).attr('height', sectionHeight.toDevicePixel()).attr('scaleId', scaleId).attr('canvasType', 'scaleYUpdateCanvas');

      // save ref to row map
      this.scaleRowMap[scaleId] = [graphTd, rightScaleTd];

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
          `.trimLines()).attr('draggable', true).attr('scale1', _[i]).attr('scale2', _[i + 1]);
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
            this.mainCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', scale1newH.toDevicePixel());
            this.mainUpdateCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', scale1newH.toDevicePixel());
            this.scaleYCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', scale1newH.toDevicePixel());
            this.scaleYUpdateCanvasMap[scale1].style('height', `${scale1newH}px`).attr('height', scale1newH.toDevicePixel());
            // scale 2
            this.mainCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', scale2newH.toDevicePixel());
            this.mainUpdateCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', scale2newH.toDevicePixel());
            this.scaleYCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', scale2newH.toDevicePixel());
            this.scaleYUpdateCanvasMap[scale2].style('height', `${scale2newH}px`).attr('height', scale2newH.toDevicePixel());

            // ask to redaw the main canvas
            this.redrawMainCanvas();
          }
        });
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
    `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', X_AXIS_HEIGHT_PX.toDevicePixel());
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
    `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', X_AXIS_HEIGHT_PX.toDevicePixel());

    // place holder for botttom right corner
    tr.append('td').attr('style', `
      border-left: 1px solid ${this.settings.graphSeparatorColor};
      line-height: 0px;
      margin: 0;
      padding: 0;
    `.trimLines());

    // setup listeners for mouse.
    scaleIds.map(scaleId => {
      const d3Canvas = this.mainUpdateCanvasMap[scaleId];
      d3Canvas.on('mousedown', event => {
        event.preventDefault();
        this.currentMouseDownStart = { scaleId, x: event.x, y: event.y };
      })
      d3Canvas.on('mouseup', event => {
        event.preventDefault();
        this.currentMouseDownStart = undefined;
        this.panOffsetSaved = this.panOffset;
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
      this.root.append('div').attr('class', 'watermark').attr('style', `
        position: absolute;
        width: ${this.settings.width}px;
        height: ${this.settings.height}px;
        text-align: center;
        vertical-align: middle;
        line-height: ${this.settings.height}px;
        font-size: 3rem;
        overflow: hidden;
        color: #00000012;
      `.trimLines()).append('span').attr('style', 'white-space:break-spaces').html(this.settings.watermarkText);
    }

    // debug(this);
  }

  /**
   * Set the data to the the existing chart.
   * This triggers rendering for the entire chart based on changes.
   * @param data
   */
  public setData(_data: GraphData) {
    // extract grouped data
    const dtgrouped = Object.keys(this.config).reduce((rv, scaleId) => {
      const subgraph = this.config[scaleId];
      Object.keys(subgraph).map((plotName, i) => {
        const plotConf = subgraph[plotName];
        const d = _data[plotConf.dataId] || [];
        const colorpallet = ((this.settings.subGraph || {})[scaleId] || {}).colorPallet || this.settings.colorPallet || d3.schemePaired;
        const defaultColor = colorpallet[i % colorpallet.length];
        // loop thourgh d
        d.map(d => {
          const ts = plotConf.tsValue(d);
          const data = plotConf.data(d);
          const color = (plotConf.color) ? (typeof (plotConf.color) === 'function' ? plotConf.color(d) : plotConf.color) : defaultColor;

          if (!rv[ts.getTime()]) rv[ts.getTime()] = { [scaleId]: { [plotName]: { d: data, color } } };
          else if (!rv[ts.getTime()][scaleId]) rv[ts.getTime()][scaleId] = { [plotName]: { d: data, color } };
          else if (!rv[ts.getTime()][scaleId][plotName]) rv[ts.getTime()][scaleId][plotName] = { d: data, color };
        })
      });
      return rv;
    }, {} as any);
    // save data mat
    const xDomainValus = Object.keys(dtgrouped).sort((a, b) => ((+a) - (+b)));
    this.dataMat = xDomainValus.map(tsk => {
      return { ts: new Date(+tsk), data: dtgrouped[tsk] }
    });

    this.zoomInterpolator = d3.interpolateNumber(this.dataMat.length, MIN_ZOOM_POINTS)
    this.updateWindowFromZoomPan();
    // draw main graph
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
  }

  /**
   * Dynamically update chart settings.
   * @param _settings
   */
  public updateSettings(_settings: Partial<ChartSettings>) {
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
          max = Math.max(max, typeof (plotd.d) === 'object' ? plotd.d.l : plotd.d);
          min = Math.min(min, typeof (plotd.d) === 'object' ? plotd.d.l : plotd.d);
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
  private redrawMainCanvas() {
    // If there is data then only main graph will be drawn
    if (this.dataMat && this.dataMat.length) {
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
          switch (plotConfig.type) {

            //--------------Candle plot------------
            case 'candle':
              windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName])).map(d => {
                const _d = d.data[scaleId][plotName];
                const _c = _d.d as CandlePlotData;
                const x = this.d3xScale(d.ts) as number;
                drawCandle(mainCanvasCtx, _d.color, x, d3yScale(_c.o), d3yScale(_c.c), x + bandW / 2, d3yScale(_c.h), d3yScale(_c.l), bandW)
              });
              break;

            //--------------line plot------------
            case 'dashed-line':
            case 'dotted-line':
            case 'solid-line':
              drawLine(mainCanvasCtx, windowedData[windowedData.length - 1].data[scaleId][plotName].color, plotConfig.type as PlotLineType,
                (subGraphSettings.lineWidth || this.settings.lineWidth), windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName])).map(d => {
                  const _d = d.data[scaleId][plotName];
                  const x = this.d3xScale(d.ts) as number;
                  const y = d3yScale(_d.d as number);
                  return [x + bandW / 2, y];
                }));
              break;

            //--------------bar plot------------
            case 'bar':
              windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName])).map(d => {
                const _d = d.data[scaleId][plotName];
                const x = this.d3xScale(d.ts) as number;
                const y = d3yScale(_d.d as number);
                drawBar(mainCanvasCtx, _d.color, x, y, bandW, canvasHeight - y);
              });
              break;

            //--------------var bar plot------------
            case 'var-bar':
              const baseY = typeof (plotConfig.baseY) !== 'undefined' ? d3yScale(plotConfig.baseY) : canvasHeight;
              windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName])).map(d => {
                const _d = d.data[scaleId][plotName];
                const x = this.d3xScale(d.ts) as number;
                const y = d3yScale(_d.d as number);
                drawBar(mainCanvasCtx, _d.color, x, y, bandW, baseY - y);
              });
              break;

            //--------------area plot------------
            case 'area':
              const color = d3.color(windowedData[windowedData.length - 1].data[scaleId][plotName].color) as d3.RGBColor | d3.HSLColor;
              drawArea(mainCanvasCtx, color.formatHex8(), (subGraphSettings.lineWidth || this.settings.lineWidth),
                [color.copy({ opacity: 0.6 }).formatHex8(), color.copy({ opacity: 0.2 }).formatHex8()],
                typeof (plotConfig.baseY) !== 'undefined' ? d3yScale(plotConfig.baseY) : canvasHeight,
                windowedData.filter(d => (d.data[scaleId] && d.data[scaleId][plotName])).map(d => {
                  const _d = d.data[scaleId][plotName];
                  const x = this.d3xScale(d.ts) as number;
                  const y = d3yScale(_d.d as number);
                  return [x + bandW / 2, y];
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

      });

      // ----------------Draw X axis-----------------------
      callOnXTicks('forward', (d, i, _) => {
        const xscaleY = xScaleCanvasHeight / 2;
        const x = this.d3xScale(d) as number;
        drawText(xScaleCanvasCtx, xScaleFormat(d), x, xscaleY, 0, this.settings.scaleFontColor, this.settings.scaleFontSize, 'left');
      });

    }
  }


  /** Function responsible for redrawing update canvas for mouse positions and annotations on scales. */
  private redrawUpdateCanvas() {
    // calculate
    const windowedData = this.getWindowedData();
    const xScaleCtx = this.scaleXUpdateCanvas.node()?.getContext('2d');
    const xstep = this.d3xScale.step();
    const bandW = this.d3xScale.bandwidth();
    const domainVal = this.d3xScale.domain()[Math.floor((this.mousePosition?.x || 0).toDevicePixel() / xstep)]
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
          const y = (this.mousePosition?.y || 0).toDevicePixel();
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
              0, y - parseInt(this.settings.scaleFontSize) / 2 - 5, yscalecanvasWidth.toDevicePixel(), parseInt(this.settings.scaleFontSize) + 10, this.settings.scaleFontSize, 'left', 'middle');
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
              const legendText = typeof (plotLegendVal.d.d) === 'object' ? `O ${plotLegendVal.d.d.o} H ${plotLegendVal.d.d.h} L ${plotLegendVal.d.d.l} C ${plotLegendVal.d.d.c}` : `${plotLegendVal.name}: ${formatter(plotLegendVal.d.d)}`;

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
    const xScalecanvasCtx = this.scaleXUpdateCanvas.node()?.getContext('2d');
    const xScalecanvasWidth = +this.scaleXUpdateCanvas.attr('width');
    const xScalecanvasHeight = +this.scaleXUpdateCanvas.attr('height');
    if (xScalecanvasCtx) clearCanvas(xScalecanvasCtx, 0, 0, xScalecanvasWidth, xScalecanvasHeight);
  }

  /**
   * Cleanup the DOM and destroy all intermidiatery.
   */
  public destroy() {
    const rootDetached = this.root.remove();
  }


}
