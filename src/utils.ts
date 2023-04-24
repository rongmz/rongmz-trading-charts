import { PlotLineType, debug } from "./types";

/**
 * Clear the given canvas based on given dim
 * @param context
 * @param x
 * @param y
 * @param w
 * @param h
 * @param color
 */
export function clearCanvas(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // console.log('clear canvas area', x, y, w, h, color);
  if (context !== null) {
    context.save();
    context.clearRect(x, y, w, h);
    context.restore();
  }
}

/**
 * Draw a single Candle
 * @param context
 * @param color candle color
 * @param ocx open-close x coordinate
 * @param oy open y
 * @param cy close y
 * @param hlx high-low x
 * @param hy high y
 * @param ly low y
 * @param bw candle width
 * @param sw shadow line width deafult: 1
 */
export function drawCandle(context: CanvasRenderingContext2D, color: string,
  ocx: number, oy: number, cy: number, hlx: number, hy: number, ly: number, bw: number, sw: number = 1) {
  // console.log('clear canvas area', x, y, w, h, color);
  if (context !== null) {
    context.save();
    context.fillStyle = color;
    context.fillRect(ocx, oy, bw, (cy - oy) || 1);
    context.fillRect(hlx, hy, sw, ly - hy);
    context.restore();
  }
}


/**
 * Draw a bar
 * @param context
 * @param color
 * @param x
 * @param y
 * @param w
 * @param h
 */
export function drawBar(context: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  if (context !== null) {
    context.save();
    context.fillStyle = color;
    context.fillRect(x, y, w, h);
    context.restore();
  }
}

/**
 * Draw a line with given coordinates
 * @param context
 * @param color
 * @param lineType
 * @param lineWidth
 * @param coordinates The [x,y] array of points
 */
export function drawLine(context: CanvasRenderingContext2D, color: string, lineType: PlotLineType, lineWidth: number, coordinates: number[][]) {
  if (context !== null && coordinates.length > 1) {
    context.save();
    context.lineWidth = lineWidth;
    if (lineType === 'dashed-line') context.setLineDash([5, 10]);
    else if (lineType === 'dotted-line') context.setLineDash([2, 4]);
    else context.setLineDash([]);
    context.strokeStyle = color;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(coordinates[0][0], coordinates[0][1]);
    for (let i = 1; i < coordinates.length; i++) {
      const xy2 = coordinates[i];
      context.lineTo(xy2[0], xy2[1]);
    }
    context.stroke();
    context.restore();
  }
}



/**
 * Draw a area graph
 * @param context
 * @param lineColor the line graph color
 * @param lineWidth line graph line width
 * @param areaColors area color gradient stops.
 * @param baseY area base line y
 * @param coordinates
 */
export function drawArea(context: CanvasRenderingContext2D, lineColor: string, lineWidth: number,
  areaColors: string[], baseY: number, coordinates: number[][]) {
  if (context !== null && coordinates.length > 1) {
    context.save();
    context.lineWidth = lineWidth;
    context.setLineDash([]);
    context.strokeStyle = lineColor;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(coordinates[0][0], coordinates[0][1]);
    let miny = coordinates[0][1], maxy = coordinates[0][1];
    for (let i = 1; i < coordinates.length; i++) {
      const xy2 = coordinates[i];
      miny = Math.min(miny, xy2[1]);
      maxy = Math.max(maxy, xy2[1]);
      context.lineTo(xy2[0], xy2[1]);
    }
    context.stroke();
    // create a gradient with given stops
    const gdt = context.createLinearGradient(0, miny, 0, maxy);
    areaColors.map((c, i) => gdt.addColorStop(i, c));
    context.fillStyle = gdt;
    const cli = coordinates.length - 1;
    context.lineTo(coordinates[cli][0], baseY);
    context.lineTo(coordinates[0][0], baseY);
    context.globalCompositeOperation = 'destination-over';
    context.fill();
    context.restore();
  }
}


