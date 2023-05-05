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
export function clearCanvas(context: CanvasRenderingContext2D | null, x: number, y: number, w: number, h: number) {
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
export function drawCandle(context: CanvasRenderingContext2D | null, color: string,
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
export function drawBar(context: CanvasRenderingContext2D | null, color: string, x: number, y: number, w: number, h: number) {
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
export function drawLine(context: CanvasRenderingContext2D | null, color: string, lineType: PlotLineType, lineWidth: number, coordinates: number[][]) {
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
 * @param coordinates including base y [x, y, baseY][]
 */
export function drawArea(context: CanvasRenderingContext2D | null, lineColor: string, lineColorBaseY: string | undefined,
  lineWidth: number, areaColors: string[], coordinates: number[][]) {
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
      miny = Math.min(miny, xy2[1], xy2[2]);
      maxy = Math.max(maxy, xy2[1], xy2[2]);
      context.lineTo(xy2[0], xy2[1]);
    }
    context.stroke();
    // create a gradient with given stops
    const gdt = context.createLinearGradient(0, miny, 0, maxy);
    areaColors.map((c, i) => gdt.addColorStop(i, c));
    context.fillStyle = gdt;
    context.lineTo(coordinates[coordinates.length - 1][0], coordinates[coordinates.length - 1][2]);
    for (let i = coordinates.length - 1; i > -1; i--) {
      const x = coordinates[i][0];
      const baseY = coordinates[i][2];
      context.lineTo(x, baseY);
    }
    context.globalCompositeOperation = 'destination-over';
    context.fill();
    if (typeof (lineColorBaseY) !== 'undefined') {
      context.beginPath();
      context.moveTo(coordinates[0][0], coordinates[0][2]);
      context.strokeStyle = lineColorBaseY;
      for (let i = 0; i < coordinates.length; i++) {
        const x = coordinates[i][0];
        const baseY = coordinates[i][2];
        context.lineTo(x, baseY);
      }
      context.stroke();
    }
    context.restore();
  }
}

/**
 * Draws text
 * @param context
 * @param color
 * @param x
 * @param y
 * @param maxWidth
 */
export function drawText(context: CanvasRenderingContext2D | null, text: string, x: number, y: number,
  maxWidth?: number, color?: string, font?: string, align?: CanvasTextAlign, baseline?: CanvasTextBaseline, direction?: CanvasDirection) {
  if (context !== null) {
    context.save();
    if (align) context.textAlign = align;
    if (font) context.font = font;
    if (baseline) context.textBaseline = baseline;
    if (direction) context.direction = direction;
    if (color) context.fillStyle = color;
    if (!maxWidth) {
      const m = context.measureText(text);
      maxWidth = m.width;
    }
    context.fillText(text, x, y, maxWidth);
    context.restore();
  }
}

export function drawCenterPivotRotatedText(context: CanvasRenderingContext2D | null, text: string, x: number, y: number, angleDegree: number,
  color?: string, font?: string) {
  if (context !== null) {
    context.save();
    if (font) context.font = font;
    if (color) context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.translate(x, y);
    context.rotate(angleDegree * Math.PI / 180);
    context.fillText(text, 0, 0)
    context.restore();
  }
}


/**
 * Draw grid lines
 * @param context
 * @param x
 * @param y
 * @param w
 * @param h
 * @param type
 */
export function drawGridLine(context: CanvasRenderingContext2D | null, color: string, x: number, y: number, w: number, h: number, type: 'vert' | 'horiz' | 'both') {
  if (context !== null) {
    context.save();
    context.lineWidth = 1;
    context.strokeStyle = color;
    if (['both', 'vert'].indexOf(type) > -1) {
      context.moveTo(x, 0);
      context.lineTo(x, h);
    }
    if (['both', 'horiz'].indexOf(type) > -1) {
      context.moveTo(0, y);
      context.lineTo(0, w);
    }
    context.stroke();
    context.restore();
  }
}


/**
 * Draw Filled box text
 * @param context
 * @param text
 * @param backColor
 * @param textColor
 * @param x
 * @param y
 * @param h
 * @param font
 * @param align
 * @param baseline
 */
export function drawBoxFilledText(context: CanvasRenderingContext2D | null, text: string, backColor: string, textColor: string, tx: number, ty: number, rx?: number, ry?: number, rw?: number, rh?: number, font?: string, align?: CanvasTextAlign, baseline?: CanvasTextBaseline) {
  if (context !== null) {
    context.save();
    if (align) context.textAlign = align;
    if (font) context.font = font;
    if (baseline) context.textBaseline = baseline;
    context.fillStyle = backColor;
    const m = context.measureText(text);
    rx = (!rx) ? tx - m.width / 2 : rx;
    context.fillRect(rx, ry || 0, rw || m.width, rh || 0);
    context.fillStyle = textColor;
    context.fillText(text, tx, ty);
    context.restore();
  }
}
