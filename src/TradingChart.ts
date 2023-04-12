import * as d3 from 'd3';
import { ChartConfig, ChartSettings, DefaultSubGraphSettings, GraphDimension, SubGraphSettings, getTotalGraphDimension, log } from './types';


export class TradingChart {

  private settings: ChartSettings | SubGraphSettings = DefaultSubGraphSettings();
  private root;
  private canvas;
  private svg;
  private dimension: GraphDimension = { width: 0, height: 0 }

  /**
   * Instantiate a TradingChart
   * @param root the element under which the chart will be rendered. The styling of the root element won't be manipulated.
   * @param config Data based config for the entire chart
   * @param settings Cosmetic settings for the chart
   */
  constructor(private _root: HTMLElement, public readonly config: ChartConfig, _settings?: ChartSettings | SubGraphSettings) {
    log(`Instantiating trading chart.`, 'root', _root, 'config', config, 'settings', _settings);
    // save settings
    if (_settings) this.settings = _settings;
    // get dim
    this.dimension = getTotalGraphDimension(this.settings);

    this.root = d3.select(_root).style('position', 'relative');
    this.canvas = this.root.append('canvas')
      .attr('width', this.dimension.width).attr('height', this.dimension.height)
      .style('position', 'absolute').style('top', '0px').style('left', '0px');

    this.svg = this.root.append('svg')
      .attr('width', this.dimension.width).attr('height', this.dimension.height)
      .style('position', 'absolute').style('top', '0px').style('left', '0px');


  }


}
