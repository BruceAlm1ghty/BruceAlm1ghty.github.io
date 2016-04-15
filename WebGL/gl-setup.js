/* Copyright (c) 2016, Bruce C Amm, GE Global Research, Niskayuna, NY
*/
/**
 * return a webGL context given a canvas  
 */
function initCanvas(canvas) {
	if (canvas) {
//	var glContext = canvas.getContext("webgl", {preserveDrawingBuffer: true});
		var glContext = canvas.getContext("webgl");
		if (!glContext) {
			if(!(glContext = canvas.getContext("experimental-webgl"))) {
				console.log("can't create context");
				return null;
			}
		}
		// some basic set up
		glContext.clearColor(0.0, 0.0, 0.0, 1.0); // black, fully opaque
		glContext.enable(glContext.DEPTH_TEST);
		glContext.depthFunc(glContext.LEQUAL); // Near things obscure far things
		glContext.viewport(0, 0, canvas.width, canvas.height);
		glContext.clear(glContext.COLOR_BUFFER_BIT | glContext.DEPTH_BUFFER_BIT);
		return glContext;
	}
	console.log('bad canvas')
	console.log(canvas); 
	return null;
}

/**
 * return a webGL context given a canvas id  
 */
function initCanvasById(c) {
	return initCanvas(document.getElementById(c));
}

/**
 * create a webGL shader of type glType
 */
function createShader(glContext, textShader, glType) {
	var shader = glContext.createShader(glType);
	glContext.shaderSource(shader, textShader);
	glContext.compileShader(shader);
	return shader;
}

function createAndAttachShader(glContext, glProgram, textShader, glType) {
	var shader = createShader(glContext, textShader, glType);
	if (!glContext.getShaderParameter(shader, glContext.COMPILE_STATUS)) {
		if(glType == glContext.VERTEX_SHADER) {
			alert('Could not compile vertex shader');
			var x = document.getElementById('vertError');
			if(undefined != x && null != x)
				x.innerHTML = glContext.getShaderInfoLog(shader) + ' code: ' + textShader;
		} else {
			alert('Could not compile fragment Shader');
			var x = document.getElementById('fragError');
			if(undefined != x && null != x)
				x.innerHTML = glContext.getShaderInfoLog(shader) + ' code: ' + textShader;
		}
		console.log(glContext.getShaderInfoLog(shader));
	}
	glContext.attachShader(glProgram, shader);
	glContext.deleteShader(shader);
}

/**
 * create a webGL program given a vertex and fragment shader script
 */
function initProgram(glContext, textVertexShader, textFragmentShader) {
	if (glContext) {
	    //////////////////////////////////
		// the program and shaders
		var glProgram = glContext.createProgram();
		createAndAttachShader(glContext, glProgram, textVertexShader, glContext.VERTEX_SHADER);
		createAndAttachShader(glContext, glProgram, textFragmentShader, glContext.FRAGMENT_SHADER);
	    ///////////////////////////////////////
		glContext.linkProgram(glProgram);
		glContext.useProgram(glProgram);
	    ///////////////////////////////////////
		return glProgram;
	}
	console.log('no context');
	console.log(glContext);
	return null;
}

/**
 * create a webGL program given a vertex and fragment shader script node identifiers
 */
function initProgramById(glContext, vertexShader, fragmentShader) {
	return initProgram(glContext, document.getElementById(vertexShader).innerHTML, document.getElementById(fragmentShader).innerHTML);
}

/**
 * returns a new float32 glBuffer with its data set to values
 */
function pushFloats(glContext, values) {
	var buffer = glContext.createBuffer();
	glContext.bindBuffer(glContext.ARRAY_BUFFER, buffer);
	glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(values), glContext.STATIC_DRAW);
	return buffer;
}

// the image must be loaded!
/**
 * returns the glTexture
 * creates a glTexture of the specified size or
 * sets up a javascript image as a webGL texture 
 * set the active texture before making this call, e.g. glContext.activeTexture(glContext.TEXTURE1);
 */
function imageToTexture(glContext, image_or_width, height) {
	var texture = glContext.createTexture();
	// make texture the active texture/target of future operations
	glContext.bindTexture(glContext.TEXTURE_2D, texture);
	// Sets pixel storage modes for readPixels and unpacking of textures with texImage2D and texSubImage2D .	
	glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, true);
	// put the image data into the texture
	if(undefined == height || null == height)
		glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, glContext.RGBA, glContext.UNSIGNED_BYTE, image_or_width);
	else
		glContext.texImage2D(glContext.TEXTURE_2D, 0, glContext.RGBA, image_or_width, height, 0, glContext.RGBA, glContext.UNSIGNED_BYTE, null);
	// how to zoom the texture
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MAG_FILTER, glContext.LINEAR);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_MIN_FILTER, glContext.LINEAR);
	// how to handle coordinates outside of the texture
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_S, glContext.CLAMP_TO_EDGE);
	glContext.texParameteri(glContext.TEXTURE_2D, glContext.TEXTURE_WRAP_T, glContext.CLAMP_TO_EDGE);
	return texture;
};

/**
 * sets a glBuffer to a vertex attribute
 * attr -- string, the attribute variable name from the shader
 * buffer -- the glBuffer with the attribute values (sa pushFloats)
 * nCompPer -- components per vertex
 */
function bufferToAttribute(glContext, glProgram, attr, buffer, nCompPer) {
	// look up the index of our variable
	var attrLocation = glContext.getAttribLocation(glProgram, attr);
	// enable it, and set the currently bound buffer to that variable
	glContext.enableVertexAttribArray(attrLocation);
	// bind the vertices to the attribute
	// this is the buffer we're talking about....
	glContext.bindBuffer(glContext.ARRAY_BUFFER, buffer);
	// set the attribute to the bound buffer
	// (the attribute index, components per attribute [1-4], data type, normalized stride, offset) 
	glContext.vertexAttribPointer(attrLocation, nCompPer, glContext.FLOAT, false, 0, 0);
	return attrLocation;
}
/**
 * 
 * @param src -- the source array 
 * @param img -- the destination array
 * @param w -- the length of a line (for images RGBA this is 4 * width) 
 */
function copyFlipY(src, dst, w) {
	var ix = src.length;
	if(dst.length == ix) {
		// for each source element
		for(var i = 0, dstStart = dst.length - w; i < ix; dstStart -= w)
			// copy each line to the right location in dest
			for(var idst = dstStart, x = 0; x < w; ++idst, ++x, ++i) 
				dst[idst] = src[i];
	}
}

function setAttributeBuffer(glContext, attrib, buffer, length) {
   // bind our coordinate buffer to the attribute
   glContext.bindBuffer(glContext.ARRAY_BUFFER, buffer);
   glContext.vertexAttribPointer(attrib, length, glContext.FLOAT, false, 0, 0); 
}

function getPixels(glContext, pixels) {
	if(!pixels || pixels.length != glContext.canvas.width * glContext.canvas.height * 4)
		pixels = new Uint8Array(glContext.canvas.width * glContext.canvas.height * 4);
	// scan the pixels for change
	glContext.readPixels(0, 0, glContext.canvas.width, glContext.canvas.height, glContext.RGBA, glContext.UNSIGNED_BYTE, pixels);
	return pixels;
}

function glShape(glContext, verts, locVert, mode) {
	// mode is one of
	// glContext.POINTS - Draws a single dot per vertex. For example, 10 vertices produce 10 dots. 
	// glContext.LINES - Draws a line between a pair of vertices. For example, 10 vertices produce 5 separate lines.
	// glContext.LINE_STRIP - Draws a line to the next vertex by a straight line. For example, 10 vertices produce 9 lines connected end to end. 
	// glContext.LINE_LOOP - Similar to gl.LINE_STRIP, but connects the last vertex back to the first. For example, 10 vertices produce 10 straight lines.
	// glContext.TRIANGLES - Draws a triangle for each group of three consecutive vertices. For example, 12 vertices create 4 separate triangles.
	// glContext.TRIANGLE_STRIP - Creates a strip of triangles where each additional vertex creates an additional triangle once the first three vertices have been drawn. For example, 12 vertices create 10 triangles. 
	// glContext.TRIANGLE_FAN = 
	this.mode = mode ? mode : null;
	
	// ARRAY_BUFFERS with coordinates, colors, and normals for each vertex 
	this.attributes = { 
			coordinates : { buffer : null, location : null },
			normals : { buffer : null, location : null },
			colors : { buffer : null, location : null}, 
			length : 0 
		};

	this.toAttribute = function(glContext, attr, array, loc) {
		if(undefined != loc && null != loc) attr.location = loc;
		// create a buffer and bind it, so we can manipulate it
		glContext.bindBuffer(glContext.ARRAY_BUFFER, attr.buffer = glContext.createBuffer());
		// set the data
        glContext.bufferData(glContext.ARRAY_BUFFER, new Float32Array(array), glContext.STATIC_DRAW);
        return array.length;
	}
	
	/**
	 * glContext -- the webGL context
	 * verts -- the vertices
	 * loc -- the location in the program of the coordinate array buffer
	 */
	this.setVerts = function(glContext, verts, loc) {
		return this.attributes.length = this.toAttribute(glContext, this.attributes.coordinates, verts, loc) / 3;
	}
	
	/**
	 * glContext -- the webGL context
	 * clrs -- the vertex colors
	 * loc -- the location in the program of the color attribute 
	 */
	this.setColors = function(glContext, clrs, loc) {
		return this.attributes.length = this.toAttribute(glContext, this.attributes.colors, clrs, loc) / 4;
	}
	
	this.setAttributes = function(glContext, attr, sz) {
		if(attr.buffer && null != attr.location && undefined != attr.location) {
    	   // bind our buffer to the attribute
    	   glContext.bindBuffer(glContext.ARRAY_BUFFER, attr.buffer);
    	   // sz components per attribute e.g. (X,Y,Z) or (R,G,B,A)
    	   glContext.vertexAttribPointer(attr.location, sz, glContext.FLOAT, false, 0, 0);
    	   // enable the attribute
    	   glContext.enableVertexAttribArray(attr.location);
		}
	}
	/**
	 * glContext -- the webGL context
	 * progCoord -- the location in the program of the coordinate array buffer
	 * progColor -- the location in the program of the color array buffer
	 */
	this.draw = function(glContext) {
		this.setAttributes(glContext, this.attributes.coordinates, 3);
		this.setAttributes(glContext, this.attributes.colors, 4);
		glContext.drawArrays((null == this.mode) ? glContext.TRIANGE_STRIP : this.mode, 0, this.attributes.length);
	};
	
	if(verts) this.setVerts(glContext, verts, locVert);
	return this;
}

// locVert -- program location of vertex attribute
function glCube(glContext, locVert, locColor) {
	var ret = new glShape(glContext, [
	    // front
		0.0, 0.0, 0.0,
		1.0, 0.0, 0.0,
		0.0, 1.0, 0.0,
		1.0, 1.0, 0.0,
		// top
		1.0, 1.0, 1.0,
		0.0, 1.0, 0.0,
		0.0, 1.0, 1.0,
		0.0, 0.0, 0.0,
		// 
		0.0, 0.0, 1.0,
		1.0, 0.0, 0.0,
		1.0, 0.0, 1.0,
		1.0, 1.0, 0.0,
		1.0, 1.0, 1.0,
		1.0, 0.0, 1.0,
		0.0, 1.0, 1.0,
		0.0, 0.0, 1.0
       ], locVert, glContext.TRIANGLE_STRIP);
	[ 0.0, 0,0, 1.0, 0.0, 0,0, 1.0, 0.0, 0,0, 1.0, 0.0, 0,0, 1.0,
	  0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0,
	  ]
/*	ret.setColors(glContext,[ 
			0.0, 0.0, 0.0, 1.0,
			1.0, 0.0, 0.0, 1.0,
			0.0, 1.0, 0.0, 1.0,
			1.0, 1.0, 0.0, 1.0,
			1.0, 1.0, 1.0, 1.0,
			0.0, 1.0, 0.0, 1.0,
			0.0, 1.0, 1.0, 1.0,
			0.0, 0.0, 0.0, 1.0,
			0.0, 0.0, 1.0, 1.0,
			1.0, 0.0, 0.0, 1.0,
			1.0, 0.0, 1.0, 1.0,
			1.0, 1.0, 0.0, 1.0,
			1.0, 1.0, 1.0, 1.0,
			1.0, 0.0, 1.0, 1.0,
			0.0, 1.0, 1.0, 1.0,
			0.0, 0.0, 1.0, 1.0], locColor); */
	return ret;
}
