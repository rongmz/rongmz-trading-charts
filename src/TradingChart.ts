import * as d3 from 'd3';
import {
  CLASS_SUBGRAPH, CandlePlotData, CanvasMap, ChartConfig, ChartSettings, DEAFULT_ZOOM_LEVEL, DarkThemeChartSettings, GraphData, Interpolator,
  LightThemeChartSettings, MIN_ZOOM_POINTS, MousePosition, PlotData, PlotLineType, PlotMatConfig, ScaleRowMap, SubGraphMatConfig, SubGraphSettings,
  X_AXIS_HEIGHT_PX,
  YCoordinateMap,
  ZOOM_STEP, debug, error, getLineDash, log
} from './types';
import { drawArea, drawBar, drawCandle, drawLine } from './utils';

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

  /** All defaults */
  public defaults = {
    colorPallet: d3.schemePaired,
    yScalePaddingPct: 0.1,
    xScalePadding: 0.2,
    marketStartTime: [9, 15],
    zoomLevel: DEAFULT_ZOOM_LEVEL,
  }


  private data?: GraphData;
  private windowedData?: GraphData
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

  private scaleXCanvas: HTMLCanvasElement;
  private scaleXUpdateCanvas: HTMLCanvasElement;

  private zoomLevel: number = this.defaults.zoomLevel;
  private zoomInterpolator: Interpolator<number, number> = d3.interpolateNumber(0, 0);
  private panOffset: number = 0;

  private currentMousePosition: MousePosition = { x: 0, y: 0 }
  private canvasYCoordinateMap: YCoordinateMap<d3.Selection<HTMLCanvasElement, any, any, any>> = {}

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
            // debug('drag', event.offsetY, scale1, scale2, scale1tds, scale2tds);
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
    `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', X_AXIS_HEIGHT_PX.toDevicePixel()).node() as HTMLCanvasElement;
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
    `.trimLines()).attr('width', chartSectionWidth.toDevicePixel()).attr('height', X_AXIS_HEIGHT_PX.toDevicePixel()).node() as HTMLCanvasElement;

    // place holder for botttom right corner
    tr.append('td').attr('style', `
      border-left: 1px solid ${this.settings.graphSeparatorColor};
      line-height: 0px;
      margin: 0;
      padding: 0;
    `.trimLines());

    // setup listeners for mouse.
    // scaleIds.map(scaleId => {
    // const d3Canvas = this.mainUpdateCanvasMap[scaleId];
    this.table.on('mousemove', (event: MouseEvent) => {
      // debug('mousemove', event.x, event.y, event.currentTarget);
      this.currentMousePosition.x = event.x;
      this.currentMousePosition.y = event.y;
      // this.currentMousePosition.canvas = (event.currentTarget as any)?.getContext ? (event.currentTarget as any) : undefined;
      this.redrawUpdateCanvas();
      // this.redrawUpdateCanvas();
    });
    // })

    // Ask for redraw with whatever data
    this.redrawMainCanvas();

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
    this._extractZoomWindowFromData(_data);
    // draw main graph
    this.redrawMainCanvas();
  }

  /** The function extracts data from zoom level. */
  private _extractZoomWindowFromData(d?: GraphData) {
    const _data = d || this.data || {};
    this.windowedData = Object.keys(_data).reduce((rv, dataId) => {
      const d = _data[dataId];
      const windowLength = this.zoomInterpolator(this.zoomLevel);
      // x2=L-1-panoffset
      // x1=L-1-panoffset - (b-1)
      rv[dataId] = (d as any[]).filter((_, i) => (
        i > (d.length - 1 - this.panOffset - windowLength) &&
        i < (d.length - this.panOffset)
      ))
      return rv;
    }, {} as GraphData);
  }

  /** Do zoom */
  public zoom(e: WheelEvent) {
    e.preventDefault();
    if (e.deltaY < 0) this.zoomLevel = Math.max(this.zoomLevel - ZOOM_STEP, 0);
    else this.zoomLevel = Math.min(this.zoomLevel + ZOOM_STEP, 1);

    this._extractZoomWindowFromData();
    debug('zoom', this.zoomLevel);
    this.redrawMainCanvas();
  }



  /**
   * Function which redraws the main canvas and corresponding scales
   * Main canvas will be redrawn for zoom, panning, section resize etc.
   */
  public redrawMainCanvas() {
    // If there is data then only main graph will be drawn
    if (this.windowedData) {
      debug('Chart Data', this.windowedData);
      Object.keys(this.config).map(scaleId => {
        const subgraphConfig = this.config[scaleId];

        const canvas = this.mainCanvasMap[scaleId].node() as HTMLCanvasElement;
        const canvasWidth = +this.mainCanvasMap[scaleId].attr('width');
        const canvasHeight = +this.mainCanvasMap[scaleId].attr('height');

        const yScaleCanvas = this.scaleYCanvasMap[scaleId].node() as HTMLCanvasElement;
        const yScaleCanvasWidth = +this.scaleYCanvasMap[scaleId].attr('width');
        const yScaleCanvasHeight = +this.scaleYCanvasMap[scaleId].attr('height');

        // now plot with every configured plot
        const xScaleDomainSet = new Set<number>() // merged with all plots
        const yScaleDomain: number[] = []; // <-- y scale domain

        const matSubGraphConfig = Object.keys(subgraphConfig).reduce((rv, plotName, i) => {
          const { type, dataId, tsValue, data, color, baseY } = subgraphConfig[plotName];
          const d = (this.windowedData as GraphData)[dataId];
          if (d) {
            // only if data is present with the given dataId.
            const tsValueMat: Date[] = [], dataMat: PlotData[] = [], colorMat: string[] = []
            d.map(_ => {
              tsValueMat.push(tsValue(_));
              dataMat.push(data(_));
              if (color) colorMat.push(typeof (color) === 'function' ? color(_) : color)
              else colorMat.push(this.defaults.colorPallet[i % this.defaults.colorPallet.length])
            });
            rv[plotName] = { type, dataId, tsValue: tsValueMat, data: dataMat, color: colorMat, baseY: baseY || canvasHeight };
            // calculate domains as well
            yScaleDomain[0] = d3.min(dataMat, d => (typeof (d) === 'object' ? d.l : d)) as number;
            yScaleDomain[1] = d3.max(dataMat, d => (typeof (d) === 'object' ? d.h : d)) as number;
            // x scale domain and merge all
            tsValueMat.map(_ => xScaleDomainSet.add(_.getTime()))
          }
          return rv;
        }, {} as SubGraphMatConfig);

        // extract xScaleDomain as date
        const xScaleDomain = Array.from(xScaleDomainSet).map(_ => new Date(_)).sort((a, b) => (a.getTime() - b.getTime())); // <-- x scale domain

        // draw scales
        const yScaleDomainPaddingLength = (yScaleDomain[1] - yScaleDomain[0]) * this.defaults.yScalePaddingPct;
        const d3yScale = d3.scaleLinear(
          [yScaleDomain[0] - yScaleDomainPaddingLength, yScaleDomain[1] + yScaleDomainPaddingLength],
          [canvasHeight, 0]
        );
        const d3xScale = d3.scaleBand(xScaleDomain, [0, canvasWidth]).padding(this.defaults.xScalePadding);
        // -----------------------------------START: Draw Axis------------------------------------------------
        // const d3xAxis = d3.axisBottom(d3xScale).tickFormat((v, i) => {
        //   const hh = v.getHours(), mm = v.getMinutes();
        //   if (i === 0 || (hh === this.defaults.marketStartTime[0] && mm === this.defaults.marketStartTime[1]))
        //     return `${v.getDate()}/${v.getMonth() + 1}`
        //   else
        //     return `${hh}:${`0${mm}`.slice(-2)}`;
        // })
        // //.tickValues(); // <-- zoom specific ticks to be calculated
        // const d3yAxis = d3.axisLeft(d3yScale).ticks(40, d3.format("~s"));
        // -----------------------------------END: Draw Axis------------------------------------------------

        // -----------------------------------START: Draw Plot------------------------------------------------
        const mainCanvasCtx = canvas.getContext('2d') as CanvasRenderingContext2D;
        debug('matSubGraphConfig', matSubGraphConfig)
        Object.keys(matSubGraphConfig).map(plotName => {
          const plotConfig = matSubGraphConfig[plotName];
          const subGraphSettings = (this.settings.subGraph || {})[scaleId] || {};
          const bandW = d3xScale.bandwidth();
          switch (plotConfig.type) {

            //--------------Candle plot------------
            case 'candle':
              (plotConfig.data as CandlePlotData[]).map((d, i) => {
                const x = d3xScale(plotConfig.tsValue[i]) as number;
                drawCandle(mainCanvasCtx, plotConfig.color[i], x, d3yScale(d.o), d3yScale(d.c), x + bandW / 2, d3yScale(d.h), d3yScale(d.l), bandW)
              });
              break;

            //--------------line plot------------
            case 'dashed-line':
            case 'dotted-line':
            case 'solid-line':
              drawLine(mainCanvasCtx, plotConfig.color[0], plotConfig.type as PlotLineType,
                (subGraphSettings.lineWidth || this.settings.lineWidth), (plotConfig.data as number[]).map((d, i) => {
                  const x = d3xScale(plotConfig.tsValue[i]) as number;
                  const y = d3yScale(d);
                  return [x + bandW / 2, y];
                }));
              break;

            //--------------bar plot------------
            case 'bar':
              (plotConfig.data as number[]).map((d, i) => {
                const x = d3xScale(plotConfig.tsValue[i]) as number;
                const y = d3yScale(d);
                drawBar(mainCanvasCtx, plotConfig.color[i], x, y, bandW, canvasHeight - y);
              });
              break;

            //--------------area plot------------
            case 'area':
              const color = d3.color(plotConfig.color[0]) as d3.RGBColor | d3.HSLColor;
              drawArea(mainCanvasCtx, color.formatHex8(), (subGraphSettings.lineWidth || this.settings.lineWidth),
                [color.copy({ opacity: 0.6 }).formatHex8(), color.copy({ opacity: 0.2 }).formatHex8()],
                plotConfig.baseY,
                (plotConfig.data as number[]).map((d, i) => {
                  const x = d3xScale(plotConfig.tsValue[i]) as number;
                  const y = d3yScale(d);
                  return [x + bandW / 2, y];
                }));
              break;

          }

        })
        // -----------------------------------END: Draw Plot------------------------------------------------



      });
    }
  }


  /** Function responsible for redrawing update canvas for mouse positions and annotations on scales. */
  public redrawUpdateCanvas() {
    if (this.currentMousePosition.canvas) {
      const d3canvas = d3.select(this.currentMousePosition.canvas);
      const canvasType = d3canvas.attr('canvasType');
      const scaleId = d3canvas.attr('scaleId');
      const width = parseInt(d3canvas.attr('width') || '0');
      const height = parseInt(d3canvas.attr('height') || '0');
      debug('redrawUpdateCanvas', canvasType, scaleId);
      const ctx = this.currentMousePosition.canvas.getContext('2d');
      if (ctx !== null) {
        // clear all
        ctx.clearRect(0, 0, width.toDevicePixel(), height.toDevicePixel());

        // x line
        ctx.beginPath();
        ctx.lineWidth = this.settings.crossHairWidth;
        ctx.strokeStyle = this.settings.crossHairColor;
        ctx.setLineDash(getLineDash(this.settings.crossHairType));
        ctx.moveTo(0, this.currentMousePosition.y.toDevicePixel());
        ctx.lineTo(width.toDevicePixel(), this.currentMousePosition.y.toDevicePixel());
        ctx.stroke();
      }
    }
  }


}
