/* Copyright (c) 2016, Bruce C Amm, GE Global Research, Niskayuna, NY
 */

/**
 * draws a line graph
 * g -- 2d context
 * values -- array of values of graph
 * w -- if present the marker size in pixels, default is none
 * 
 * set the line and fill style to set the color
 * e.g., g.fillStyle="#FF0000";  for the marker color
 */
function drawLineGraph(g, values, w) {
	g.save();
	g.setTransform(1,0,0,1,0,0);
	g.clearRect(0, 0, g.canvas.width, g.canvas.height);
	var dXPixel = values.length / g.canvas.width;
	var dYPixel = /*Math.max(...values)*/ findMax(values) / g.canvas.height;
	g.setTransform(1.0 / dXPixel,0,0,-0.95 / dYPixel,0,g.canvas.height);
	g.lineWidth = 2 * Math.min(dXPixel, dYPixel);
	g.beginPath();
	for(var i = 0; i < values.length; ++i) {
		if(i)
			g.lineTo(i + 0.5, values[i]);
		else
			g.moveTo(0.5,values[i]);
		if(undefined != w) g.fillRect(i + 0.5 - dXPixel, values[i] - dYPixel * (w - 1) / 2, w * dXPixel, w * dYPixel);
	}
	g.stroke();
	g.restore();
}

/**
 * draws a line graph
 * g -- 2d context
 * values -- array of values of graph
 * 
 * set the fill style to set the color
 * e.g., g.fillStyle="#FF0000";  red bars
 */
function drawBarGraph(g, values) {
	g.save();
	g.setTransform(1,0,0,1,0,0);
	g.clearRect(0, 0, g.canvas.width, g.canvas.height);
	var YMinMax = findMinMax(values);
	var YMin = YMinMax[0];
	var YMax = YMinMax[1];
	if(YMax > 0.0 && YMin > 0.0) YMin = 0.0;
	if(YMax < 0.0 && YMin < 0.0) YMax = 0.0;
	var YRange = (YMax - YMin);
	if(YRange != 0.0) {
		var dXPixel = values.length / g.canvas.width;
		var dYPixel = YRange / g.canvas.height;
		g.setTransform(1.0 / dXPixel,0,0,-0.95 / dYPixel,0,g.canvas.height * YMax / YRange);
	//	g.lineWidth = 2 * Math.min(dXPixel, dYPixel);
	//	g.fillStyle="#000000";
		for(var i = 0; i < values.length; ++i)
			if(values[i] < 0.0)
				g.fillRect(i, values[i], 1, -values[i]);
			else
				g.fillRect(i, 0.0, 1, values[i]);
	}
	g.restore();
}
