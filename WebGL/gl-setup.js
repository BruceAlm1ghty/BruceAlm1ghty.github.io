/* Copyright (c) 2016, Bruce C Amm, GE Global Research, Niskayuna, NY
*/
/**
 * return a webGL context given a canvas  
 */
function initCanvas(canvas) {
	if (canvas == undefined) {
		console.log('bad canvas')
		console.log(c); 
		return undefined;
	}
//	var glContext = canvas.getContext("webgl", {preserveDrawingBuffer: true});
	var glContext = canvas.getContext("webgl");
	if (glContext == undefined) {
		glContext = canvas.getContext("experimental-webgl");
		if (glContext == undefined) {
			console.log('bad context')
			return undefined;
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
	if (glContext == undefined) {
		console.log('no context');
		return undefined;
	}
	
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
	if(undefined == height)
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

