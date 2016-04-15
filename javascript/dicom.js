/**
 * dicom image helper functions
 * assumes a dicomParser.DataSet -- \sa dicomParser.js 
 * 
 * functions to convert a dicomParser.DataSet to ImageData
 * window, level and histogram controls (Deploy)
 */
var dicom = (function () {
	var ret = {};
	
	/**
	 * create the default controls for dicom Viewing
	 */
	ret.Deploy = function(canvas, parent) {
		// if no parent was specified, create an owning span and append to the document
		if(!parent) 
			parent = createSpan(null, null, document.body);
		
		var controls = { 
			canvas : canvas, // canvas to draw the image to
			context : null, // 2d context for the canvas 
			window : null, // slider for window value
			windowValue : null, // text of window value
			level : null, // slider for level/floor value
			levelValue : null, // text of level/floor value
			range : null, // a canvas to represent the window/level range
			rangeCtx : null, // 2d context of the range canvas
			hist : new Uint16Array(256), // the pixel histogram array
			histCanvas : null, // canvas to draw the histogram on
			histCtx : null, // context for the histogram canvas
			histDown : null, // mouse down point on the histogram canvas
			parent : parent, // parent for all the controls
			defaultW : 0.8, // default window value
			defaultL : 0.166, // default level value
			imageData : null, // the ImageData (pixels are imageData.data) for the canvas
			onchange : null, // called to request redraw, call onrender with the data
			onrender : function(data) { dicom.onRender(this, data); if(undefined != this.onupdate && null != this.onupdate) this.onupdate(); } // default drawing function
		};

		// if no canvas was specified, create one
		if(!canvas)
			controls.canvas = createElement('CANVAS', controls.parent);
		// and get a context to it
		controls.context = controls.canvas.getContext('2d');
		
//		<input type='range' min="0.0" max="1.0" value="1.0" step='0.002' id="window"  style='width: 501px;'> Window <span id='windowValue'>1</span>
//		<br>
//		<input type='range' min="0.0" max="1.0" value="0.0" step='0.002' id="level" style='width: 501px;'> Floor <span id='levelValue'>0</span>
//		<br>
//		<canvas id='showWL' style="border: 1px solid green;" width='501' height='20'></canvas>
//		<br>
//		<h3>Histogram</h3>
//		<canvas id="hist" width='501' height='100' style="border: 1px solid green;"></canvas>
		
		// window range and text output
		controls.window = createRange(null, 0.0, 1.0, 0.002, 501, controls.parent);
		controls.parent.appendChild(document.createTextNode(' Window '));
		controls.windowValue = createSpan(null, 1, controls.parent);
		createElement('BR', controls.parent);
		
		// level range and text output
		controls.level = createRange(null, 0.0, 1.0, 0.002, 501, controls.parent);
		controls.parent.appendChild(document.createTextNode(' Floor '));
		controls.levelValue = createSpan(null, 0, controls.parent);
		createElement('BR', controls.parent);
		
		// canvas to graphically depict the window and level 
		controls.range = createCanvas(null, 501, 20, controls.parent);
		controls.range.setAttribute('style', 'border: 1px solid green;');
		controls.rangeCtx = controls.range.getContext('2d');
		createElement('BR', controls.parent);
		
		// canvas to draw the histogram on 
		createElement('H3', controls.parent).innerHTML = "Historgram";
		controls.histCanvas = createCanvas(null, 501, 100, controls.parent);
		controls.histCanvas.setAttribute('style', 'border: 1px solid green;');
		controls.histCtx = controls.histCanvas.getContext('2d');

		/////////
		// event handlers
		// double click sets the default window and level
		controls.range.addEventListener('dblclick', (function() { var c = controls; return function(evt) { ret.setDefaultWL(c); }})(), false);
	
		// histogram window/level selection
		controls.resetHistDown = (function() { var t = controls.histDown; return function() { t = null };})();
		controls.histCanvas.addEventListener('mouseenter', controls.resetHistDown, false);
		controls.histCanvas.addEventListener('mouseleave', controls.resetHistDown, false);
		
		controls.histCanvas.addEventListener('mousedown', (function() { var t = controls; return function(evt) {
					t.histDown = fixEvent(evt).offsetX / evt.target.width;
				}})(), false);
		controls.histCanvas.addEventListener('mouseup', (function() { var t = controls; return function(evt) {
					if(t.histDown) {
						var x = fixEvent(evt).offsetX / evt.target.width;  // the fractional offset into the window
						var oldL = parseFloat(t.level.value); // the old window level
						var l = Math.min(x, t.histDown) * t.window.value * (1 - oldL) + oldL; // the new window level
						// correct our window, since changing the level, means changing the window fraction
						ret.setWL(t, 
								Math.floor(Math.abs(t.histDown - x) * t.window.value * (1 - oldL) / (1 - l) * 500) / 500, 
								Math.floor(l * 500) / 500);
					}
					t.histDown = null;
				}})(), false);
		// window change
		controls.level.addEventListener('change', (function() { var t = controls; return function(evt) {
					ret.setWL(t, t.window.value, t.level.value);
				}})(), false);
		// level change
		controls.window.addEventListener('change', (function() { var t = controls; return function(evt) {
					ret.setWL(t, t.window.value, t.level.value);
				}})(), false);
		
		// initialize and draw the window/level
		ret.drawWindowLevel(controls, controls.window.value = 1, controls.level.value = 0);
		return controls;
	}
	
	/**
	 * convert the dicom data to RBGA pixel data
	 * pixels -- an array of Uint8 pixel data
	 * data -- the dicom data
	 * w -- window fraction (0-1]
	 * l -- floor fraction [0-1]
	 * bSwap -- swap bytes
	 * hist -- if non-null, a histogram to be populated
	 */
	ret.toPixels = function(pixels, data, w, l, bSwap, hist) {
		if(null == bSwap || undefined == bSwap) bSwap = false;
		if(null == w || undefined == w) w = 1.0;
		if(null == l || undefined == l) l = 0;
		try {
			var ii = ret.imageInfo(data);
	
			var pixelDataElement = data.elements.x7fe00010;
			var pixelData;
		    
			if(ii.pixelSigned)
				pixelData = new Int16Array(data.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
			else
				pixelData = new Uint16Array(data.byteArray.buffer, pixelDataElement.dataOffset, pixelDataElement.length / 2);
	
		    ii.windowWidth *= 1.5; // expanding the window a bit
		    var pixelMin = ii.windowCenter - ii.windowWidth / 2;
		    // calculate the floor and window in pixel values
		    l = Math.floor(ii.windowWidth * l + 0.5);
		    w = Math.floor(w * (ii.windowWidth - l) + 0.5);
		    l += pixelMin;
		    if(w < 1) w = 1;
	    	if(hist) fillArray(hist, 0);
			// if the endian-ness doesn't match, we need to swap (or toggle the swap request)
			if((data.byteArrayParser === dicomParser.littleEndianByteArrayParser) != isLittleEndian) bSwap = !bSwap;
		    for(var iSrc = 0, iDst = 0; iSrc < pixelData.length && iDst < pixels.length; ++iSrc, iDst += 4) {
		    	b = pixelData[iSrc];
		    	if(bSwap) b = ((b & 0xff00) >> 8) | ((b & 0x00ff) << 8);
		    	if(b <= l) b = 0;
		    	else {
		    		b -= l;
		    		b = (b >= w) ? 255 : Math.floor(255 * (b / w) + 0.5);
		    	}
	    		pixels[iDst] = pixels[iDst+1] = pixels[iDst+2] = b;
		    	pixels[iDst+3] = 255;
		    	if(hist)
		    		++hist[pixels[iDst]];
		    }
	    	if(hist) {
	    		hist[0] = 0;
	    		hist[255] = 0;
	    	}
		} catch(ex) {
		   	console.log('Error rendering dicom');
			console.log(ex);
		}
		return pixels;
	};
	/**
	 * draw dicom data to a 2d context, return the ImageData
	 * pixels -- an array of Uint8 pixel data
	 * data -- the dicom data
	 * w -- window fraction (0-1]
	 * l -- floor fraction [0-1]
	 * bSwap -- swap bytes
	 * hist -- if non-null, a histogram to be populated
	 */
	ret.toContext = function(ctx, data, w, l, bSwap, hist) {
		try {
		    var id = ctx.createImageData(ctx.canvas.width = data.uint16('x00280011'), ctx.canvas.height = data.uint16('x00280010'));
		    ret.toPixels(id.data, data, w, l, bSwap, hist);
		    ctx.putImageData(id, 0, 0);
		    return id;
		}catch(ex) {
		   	console.log('Error reading dicom');
			console.log(ex);
		}
		return null;
	}
	/**
	 * return the image information for a dicomParser.DataSet
	 */
	ret.imageInfo = function(dataSet) {
		return { 
			samplePerPixel : dataSet.uint16('x00280002'),
			photoInterp : dataSet.string('x00280004'),
			planarConfig : dataSet.uint16('x00280006'),
			frames : dataSet.int32('x00280008'),
			rows : dataSet.uint16('x00280010'),
			cols : dataSet.uint16('x00280011'),
			bitsAllocated : dataSet.uint16('x00280100'),
			bitsStored : dataSet.uint16('x00280101'),
			highBit : dataSet.uint16('x00280102'),
			pixelSigned : dataSet.uint16('x00280103'),
			windowCenter : parseFloat(dataSet.string('x00281050')),
			windowWidth : parseFloat(dataSet.string('x00281051')),
			rescaleIntercept : parseFloat(dataSet.string('x00281052')),
			rescaleSlope : parseFloat(dataSet.string('x00281053'))
		};
	};
	
	/** renders the grayscale gradient for the current window/level settings */
	ret.drawWindowLevel = function(ctrls, w, l) {
		if(ctrls) {
			var ctx = ctrls.rangeCtx;
			ctx.fillStyle='#00D000';			
			ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			//ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			w *= ctx.canvas.width * (1 - l);
			l *= ctx.canvas.width;
			var grd=ctx.createLinearGradient(l,0,l + w,ctx.canvas.height);
			grd.addColorStop(0,"black");
			grd.addColorStop(1,"white");
			ctx.fillStyle=grd;			
			ctx.fillRect(l, 0, w, ctx.canvas.height);
		}
	}
	
	/** sets the window and floor for dicom */
	ret.setWL = function(ctrls, w, l) {
		if(ctrls) {
			ctrls.windowValue.innerHTML = ctrls.window.value = w;
			ctrls.levelValue.innerHTML = ctrls.level.value = l;
			ret.drawWindowLevel(ctrls, w, l);
			if(ctrls.onchange) ctrls.onchange();
		}
	}
	
	ret.setDefaultWL = function(ctrls) {
		if(ctrls) ret.setWL(ctrls, ctrls.defaultW, ctrls.defaultL);
	}
	
	/** 
	* default rendering
	* convert dicom data to pixel data, render to canvas and render the histogram
	* based on he current window/level settings
	*/
	ret.onRender = function(ctrls, data) {
		if(ctrls && ctrls.canvas && data) {
			if(!ctrls.context) ctrls.context = ctrls.canvas.getContext('2d');
			if(!ctrls.hist) ctrls.hist = new Uint16Array(256);
			// does the image data exist and is it the right size
			if(ctrls.imageData && ctrls.imageData.width == data.uint16('x00280011') && ctrls.imageData.height == data.uint16('x00280010')) {
				// just draw it
				// transform pixels
				ret.toPixels(ctrls.imageData.data, data, ctrls.window.value, ctrls.level.value, false, ctrls.hist);
				// draw
				ctrls.context.putImageData(ctrls.imageData, 0, 0);
			} else 
				// no image data -- create it
				ctrls.imageData = ret.toContext(ctrls.context, data, ctrls.window.value, ctrls.level.value, false, ctrls.hist);
			// render the histogram
			if(ctrls.histCtx) {
				if(!ctrls.histCanvas) return;
				ctrls.histCtx = ctrls.histCanvas.getContext('2d');
			}
			if(ctrls.histCtx) drawBarGraph(ctrls.histCtx, ctrls.hist);
		}
	}
	return ret;
})();
