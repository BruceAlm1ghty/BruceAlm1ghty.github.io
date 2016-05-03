/**
 * 
 */
var gc = (function(gc){
	
	gc.name = "Grow-Cut";
	gc.propertyName = 'growCut';
	gc.dualBuffer = true;
	gc.max = 1024; // maximum iteration hint
	
	// the constructor
	glimp.gc = function(canvasSeed, canvasOut, parent) {
		console.log('gc.ctor');
		// calling base class constructor
		glimp.algorithm.call(this, canvasSeed, canvasOut, parent);
		
		// grow cut specific extensions/settings
		this.source.mouse = { over : [], drag : false, max : 256, maxOrig : 1024 };
		this.source.color = null; // the input image as ImageData -- this.source.image may be an Image and not ImageData 
		this.source.encode = null; // ImageData of the encoded states
		
		this.algorithm = gc;
		
		// default initial states
		this.states = [ new gc.state('background', 1, '#00FF00'), new gc.state('foreground', 1, '#FF0000') ];
		// foreground seed(s)
		this.states[1].seeds = [ [ 0.5, 0.5 ] ];
		// background seeds
		this.states[0].seeds = [ [ 0.1, 0.1 ], [0.1, 0.9], [0.9, 0.1], [0.9, 0.9] ];
		// radius of a seed point on the image (pixels)
		this.rTol = 3;
		this.checkEvery = 15;
		this.max = 1024;
		
		this.controls = {
			list : null,
			label : null,
			strength : null, 
			color : null, 
			add : null, 
			clear : null, 
			del : null,
			hist : null
		};
		
		this.fragment.main = gc.fragment.main;
		this.fragment.vars = glimp.fragment.vars + gc.fragment.vars;
		this.fragment.neighbors = true;
		
		// copies the color image to output image data only for the masked states
		// mask is an boolean array for each state, e.g. [false, true, true, false, true]
		this.stencil = function(imagedata, mask) {
			if(this.source.color) {
				if(!(imagedata = gc.makeImageData.call(this, imagedata))) return null;
				if(!mask) {
					mask = [];
					for(var i = 0; i < this.states.length; ++i) mask.push(i > 0);
				}
				gc.stencil(this.source.color.data, this.pixels, imagedata.data, mask, this.source.color.width * 4);
			}
			return imagedata;
		};
		this.grayscale = function(imagedata, nPix) {
			if(this.source.color) {
				if(!(imagedata = gc.makeImageData.call(this, imagedata))) return null;
				gc.grayscale(this.pixels, imagedata.data, this.source.color.width * 4, nPix);
			}
			return imagedata;
		};
		this.labelImage = function(imagedata) { return this.grayscale(imagedata, 0); }
		this.strengthImage = function(imagedata) { return this.grayscale(imagedata, 1); }
		this.changeImage = function(imagedata) { return this.grayscale(imagedata, 2); }
		this.stateImage = function(imagedata) {
			if(this.source.color) {
				if(!(imagedata = gc.makeImageData.call(this, imagedata))) return null;
				mapFlipY(this.pixels, imagedata.data, this.source.color.width * 4);
			}
			return imagedata;
		}
		this.inputImage = function(imagedata) {
			if(this.source.color) {
				if(!(imagedata = gc.makeImageData.call(this, imagedata))) return null;
				for(var i = 0; i < this.source.color.data.length; ++i) imagedata.data[i] = this.source.color.data[i];
			}
			return imagedata;
		}
		this.mode = function(m) {
			this.context.uniform1i(this.context.getUniformLocation(this.program, "mode"), m);
		};
		this.done = function() {
			this.mode(this.iterations == this.max - 1 ? -4 : 0);
			return gc.done.call(this);
		};
		this.populateStencilMask = function(ctrlSelect) { return gc.populateStencilMask(this, ctrlSelect); }
		return this;
	};
	// point to the base type
	glimp.gc.prototype = Object.create(glimp.algorithm.prototype);
	glimp.gc.prototype.constructor = glimp.gc;
	
	
	/**
	 * create the default controls for growcut
	 */
	gc.deploy = function() {
		// if no parent was specified, create an owning span and append to the document
		if(this.parent == null) this.parent = createSpan(null, null, document.body);
	
		var controls = this.controls;

		if(this.source.element == null)
			this.source.element = createElement('CANVAS', this.parent);

		createElement('H3', this.parent).innerHTML = 'States \&mdash; Labels and Strengths'; 
		var t = createElement('TABLE', this.parent);
		var r = createElement('TR', t);
		controls.list = createElement('SELECT', createElement('TD', r));
		controls.list.setAttribute('size', 6);
		var ul = createElement('UL', createElement('TD', r))
		var tIns = [
			'clear to remove all seed points for the currently selected label',
			'delete to remove a label',
			'to add a label, type its name into the box and click add',
			'to change a label strength or marker color, select and click update',
			'label names cannot be changed, delete and re-create'];
		for(var i = 0; i < tIns.length; ++i)
			createElement('LI', ul).appendChild(document.createTextNode(tIns[i]));
			
		(controls.label = createInput('text', null, null, null, null, null, this.parent)).setAttribute('placeHolder', 'Label');
		(controls.strength = createInput('number', null, 0.0, 1.0, 0.1, null, this.parent)).setAttribute('placeHolder', 'Strength [0-1]');
		controls.color = createInput('color', null, null, null, null, null, this.parent);
		controls.add = createButton(null, 'Add', this.parent);
		controls.clear = createButton(null, 'Clear', this.parent);
		controls.del = createButton(null, 'Delete', this.parent);
		createElement('br', this.parent);
		controls.hist = createCanvas(null, 400, 40, this.parent).getContext('2d');
		
		//<h3>Output State Map</h3><canvas id='workingImage'></canvas>
		if(!this.canvas) {
			createHeading('Ouptut State Map', 3, this.parent);
			this.canvas = createElement('CANVAS', this.parent);
		}
		
		return glimp.common.deploy.call(this);
	};
	
	// controls for grow cut
	gc.deployControls = function() {
		// we added our controls in deploy already, just add the handlers
		return gc.deployHandlers.call(this);
	};
	
	// add event handlers to the controls
	gc.deployHandlers = function() {
		console.log('gc.deployHandlers');
		gc.deployStateHandlers.call(this);
		this.controls.list.selectedIndex = 0;
		gc.onUpdateStates(this.states, this.controls.list);
		gc.populateState.call(this);
		gc.deploySeedHandlers.call(this);
		if(this.update) this.update();
		return this;
	};
	
	// called after updateSource -- return a texture of the input image
	gc.onSourceChange = function(img) {
		if(img instanceof ImageData) {
			this.source.color = img; 
		} else if(this.source.context){
			this.source.color = this.source.context.getImageData(0, 0, this.source.context.canvas.width, this.source.context.canvas.height);
		} else 
			this.source.context.clearRect(0, 0, seed.context.canvas.width, seed.context.canvas.height);
		if(this.source && this.source.element && this.source.element.onload) this.source.element.onload();
		gc.updateSeeds.call(this);
		return glimp.onSourceChange(this.context, this.program, img);
	};

	////////////////////////////
	////////////////////////////
	// states
	gc.state = function(label, str, color) {
		this.label = label;
		// strength should really be per seed point, no reason all seeds have to have the same strength -- future work
		this.str = (undefined == str || str.length < 1) ? 1.0 : str;
		this.setStr = function(x) { if(x) this.str = x; return this.str; }
		this.color = (undefined == color) ? '#ff0000' : color;
//		this.text = function() { return this.label + ' : ' +  this.str + ' : ' + this.color + ' : ' + this.seeds.length + ' seed(s)'; }
		this.text = function() { return this.label + ' : ' +  this.str + ' : ' + this.seeds.length + ' seed(s)'; }
		this.style = function() { return 'color: ' + this.color + ';'; }
		this.seeds = [];
		// remove a seed at index i
		this.remove = function(i) {
			if(i < this.seeds.length) {
				for(var ix = this.seeds.length - 1; i < ix; ++i)
					this.seeds[i] = this.seeds[i + 1];
				this.seeds.pop();
			}
		};
		return this;
	};
	
	
	gc.deployStateHandlers = function() {
		this.controls.add.disabled = this.controls.clear.disabled = this.controls.del.disabled = true;
		glimp.addClickHandler(this, this.controls.add, gc.onAddState);
		glimp.addClickHandler(this, this.controls.clear, gc.onClearState);
		glimp.addClickHandler(this, this.controls.del, gc.onDelState);
		glimp.addInputHandler(this, this.controls.label, gc.onChangeLabel);
		glimp.addChangeHandler(this, this.controls.list, gc.populateState);
	};
	
	// find a state in the list matching label
	function findState(states, label) {
		for(var i = 0; i < states.length; ++i)
			if(states[i].label == label) return i;
		return -1;
	};
	
	// convert the states to an encoded bitmap
	// label in red, strength in green
	gc.encodeStates = function(seed, states) {
		if(seed.encode == null || seed.encode.width != seed.color.width || seed.encode.height != seed.color.height) {
			if(seed.color && seed.context)
				seed.encode = seed.context.createImageData(seed.color.width, seed.color.height);
			else return false;
		}
		var img = seed.encode;
		// zero out the image
		for(var i = 0; i < img.data.length; ++i) img.data[i] = 0;
		// calculate the label packing
		var label = Math.floor(256 / states.length / 2);
		var step = label < 1 ? 1 : label * 2;
		for(var i = 0; i < states.length; ++i, label += step) {
			for(var j = 0; j < states[i].seeds.length; ++j) {
				// calculate the pixel location
				var x = Math.floor(img.width * states[i].seeds[j][0] + 0.5);
				var y = Math.floor(img.height * (1 - states[i].seeds[j][1]) + 0.5);
				var off = ((y * img.width) + x) * 4;
				img.data[off] = label;
				img.data[off + 1] = states[i].str * 255; // strength
			}
		}
		return true;
	};

	// populate the boxes based on xState
	gc.populateState = function() {
		if(this.controls.list.selectedIndex >= 0 && this.controls.list.selectedIndex < this.states.length) {
			var xState = this.states[this.controls.list.selectedIndex];
			this.controls.label.value = xState.label;
			this.controls.strength.value = xState.str;
			this.controls.color.value = xState.color;
			this.controls.del.disabled = false;
			this.controls.clear.disabled = xState.seeds.length == 0;
			this.controls.add.innerHTML = 'Update';
			this.controls.add.disabled = false;
		}
	};
	
	// add a new or update an existing state
	gc.onAddState = function() {
		var label = this.controls.label.value;
		var str = this.controls.strength.value;
		for(var i = 0; i < this.states.length; ++i)
			if(this.states[i].label == label) {
				// updating
				this.states[i].setStr(str);
				this.states[i].color = this.controls.color.value;
				gc.onUpdateStates(this.states, this.controls.list);
				if(this.update) this.update();
				return;
			}
		// no matches, add a new state
		this.states.push(new gc.state(label, str, this.controls.color.value));
		gc.onUpdateStates(this.states, this.controls.list);
		this.controls.list.selectedIndex = this.controls.list.length - 1;
		gc.populateState.call(this); //controls, controls.states[controls.list.length - 1]);
	};
	
	// populate the select ctrl with states
	gc.onUpdateStates = function(states, ctrl) {
		var i = 0;
		var ix = Math.min(states.length, ctrl.length);
		// replace any existing options
		for(i = 0; i < ix; ++i) {
			ctrl.options[i].text = states[i].text();
			ctrl.options[i].style = states[i].style();
		}
		// add new ones
		for(; i < states.length; ++i) {
			var option = document.createElement("option");
			option.text = states[i].text();
			if(option.style.writable)
				option.style =  states[i].style();
			ctrl.add(option);			
		}
		// remove any extras
		while(i < ctrl.length)
			ctrl.remove(i);
		if(ctrl.length) {
			if(ctrl.selectedIndex < 0) ctrl.selectedIndex = 0;
			else if(ctrl.selectedIndex >= ctrl.length) ctrl.selectedIndex = ctrl.length - 1;
		}
	};
	
	// remove all seed points from a state
	gc.onClearState = function() {
		var i = this.controls.list.selectedIndex;
		if(i >= 0 && i < this.states.length) {
			this.states[i].seeds = [];
			gc.populateState.call(this);
			gc.onUpdateStates(this.states, this.controls.list);
			if(this.update) this.update();
		}
	};
	
	// delete a state
	gc.onDelState = function() {
		// find the deleted state
		var i = this.controls.list.selectedIndex;
		if(i >= 0) {
			// bump everyone after it, up one
			for(var j = i; j < this.states.length - 1; ++j)
				this.states[j] = this.states[j + 1];
			this.states.pop();
			onUpdateStates(this.states, this.controls.list);
			this.controls.list.selectedIndex = i < this.states.length ? i : this.states.length - 1;
			gc.onChangeLabel.call(this);
			console.log('updating');
			if(this.update) this.update();
		} 
	};

	// typing in the label box
	gc.onChangeLabel = function() {
		// see if it matches an existing state
		if((this.controls.list.selectedIndex = findState(this.states, this.controls.label.value)) < 0) {
			// it does not
			this.controls.del.disabled = true;
			this.controls.clear.disabled = true;
			this.controls.add.innerHTML = 'Add';
			this.controls.add.disabled = this.controls.label.value.length == 0;
		} else
			// it does
			gc.populateState.call(this);
	};
	
	// draws the seeds on the canvas
	gc.updateSeeds = function() {
		var TwoPI = 2 * Math.PI;
		if(this.states && this.source && this.source.context && this.source.context.canvas.width > 0 && this.source.context.canvas.height > 0) {
			this.source.context.save();
			this.source.context.setTransform(1,0,0,-1,0,this.source.context.canvas.height);
			for(var i = 0; i < this.states.length; ++i) {
				this.source.context.fillStyle = this.states[i].color;
				for(var j = 0; j < this.states[i].seeds.length; ++j) {
					this.source.context.beginPath();
					this.source.context.arc(this.states[i].seeds[j][0] * this.source.context.canvas.width, this.states[i].seeds[j][1] * this.source.context.canvas.height, this.rTol, 0, TwoPI);
					this.source.context.fill();
				}
			}
			this.source.context.restore();
		}
		return this;
	};
	
	///////////////////////
	// drawing seeds
	gc.deploySeedHandlers = function() {
		var ctx = this.source.context;
		glimp.addHandler(this, ctx.canvas, 'mousemove', gc.onMouseMove);
		glimp.addHandler(this, ctx.canvas, 'mousedown', gc.onMouseDown);
		glimp.addHandler(this, ctx.canvas, 'mouseup', gc.onMouseUp);
		glimp.addHandler(this, ctx.canvas, 'mouseenter', gc.onMouseEnter);
		glimp.addHandler(this, ctx.canvas, 'mouseleave', gc.onMouseLeave);
		glimp.addHandler(this, ctx.canvas, 'dblclick', gc.onDblClick);
	};
	
	gc.onMouseDown = function(evt) {
		if(evt.button == 0) {
		    evt.stopPropagation();
		    evt.preventDefault();
			if(this.source.mouse.over.length > 0) {
				this.source.mouse.drag = true;
				this.source.mouse.maxOrig = this.max;
				this.max = this.source.mouse.max;
			}
		}
	};
	
	gc.onMouseUp = function(evt) {
		if(evt.button == 0) {
			fixEvent(evt);
		    evt.stopPropagation();
		    evt.preventDefault();
		    if(this.source.mouse.drag == false || this.source.mouse.over.length == 0) {
		    	// adding a point
		    	if(this.controls.list.selectedIndex >= 0 && this.controls.list.selectedIndex < this.states.length) {
		    		this.states[this.controls.list.selectedIndex].seeds.push([evt.offsetX / this.source.context.canvas.width, 1 - evt.offsetY / this.source.context.canvas.height]);
		    		gc.populateState.call(this); // calling this to change the enable/disable of buttons
		    		gc.onUpdateStates(this.states, this.controls.list);
		    		if(this.update) this.update();
		    	}
		    } else {
		    	// moving a seed
	    		this.states[this.source.mouse.over[0][0]].seeds[this.source.mouse.over[0][1]] = [evt.offsetX / this.source.context.canvas.width, 1 - evt.offsetY / this.source.context.canvas.height];
		    	this.source.mouse.drag = false;
				this.max = this.source.mouse.maxOrig;
	    		if(this.update) this.update();
		    }
		}
	};
	
	gc.onMouseMove = function(evt) {
		fixEvent(evt);
		if(this.source.mouse.drag == false) {
			var tol = 0.015 * 0.015, dx , dy;
			var x = evt.offsetX / this.source.context.canvas.width;
			var y = 1.0 - evt.offsetY / this.source.context.canvas.height;
			//console.log('move ' + [evt.offsetX, evt.offsetY]);
			for(var i = 0; i < this.states.length; ++i) {
				for(var j = 0; j < this.states[i].seeds.length; ++j) {
					dx = this.states[i].seeds[j][0] - x;
					dy = this.states[i].seeds[j][1] - y;
					if(dx * dx + dy * dy < tol) {
						this.source.context.canvas.style.cursor='move';
						// which seed and its original value
						// if we try to drag it out, we reset it
						this.source.mouse.over = [[i, j], this.states[i].seeds[j]];
						return;
					}
				}
			}
			this.source.mouse.over = [];
			this.source.context.canvas.style.cursor='crosshair';
		} else {
    		this.states[this.source.mouse.over[0][0]].seeds[this.source.mouse.over[0][1]] = [evt.offsetX / this.source.context.canvas.width, 1 - evt.offsetY / this.source.context.canvas.height];
	    	this.update();
		}			
	};
	
	gc.onMouseEnter = function() {
		this.source.context.canvas.style.cursor='crosshair';
		this.source.mouse.over = [];
		this.source.mouse.drag = false;
	};
	
	gc.onMouseLeave = function() {
		if(this.source.mouse.over.length > 0 && this.source.mouse.drag == true) {
			// you dragged something out
			this.states[this.source.mouse.over[0][0]].remove(this.source.mouse.over[0][1]);
    		gc.populateState.call(this); // calling this to change the enable/disable of buttons
    		gc.onUpdateStates(this.states, this.controls.list);
    		if(this.update) this.update();
		}				
		this.source.context.canvas.style.cursor='auto';
	};
	
	gc.onDblClick = function(evt) {
	    evt.stopPropagation();
	    evt.preventDefault();
	    this.source.mouse.over = [];
	    this.source.mouse.drag = false;
	};
	
	//////////////////////////
	//////////////////////////
	// webGL
	
	gc.setUniforms = function() {
		glimp.common.setUniforms.call(this);
		// set to compute mode
		this.mode(0);
		// texture 1 is the state texture
		this.context.uniform1i(this.context.getUniformLocation(this.program, "stateTextureSampler"), 1);
	};

	// avoid the call to update dual source -- we don't need it, we'll handle it in update itself
	gc.updateSource = function (img) {
		glimp.common.updateSource.call(this, img);
	};
	
	gc.update = function() {
		// update the encoding
		if(!glimp.common.drawSource.call(this)) this.source.context.clearRect(0, 0, this.source.context.canvas.width, this.source.context.canvas.height);
		gc.updateSeeds.call(this);
		if(gc.encodeStates(this.source, this.states) && this.context) {
			// set the encoding textures
			this.context.activeTexture(this.context.TEXTURE1);
			for(var i = 0; i < 2; ++i) {
				var old = this.textures[i]; 
				this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.fbs[i]);
				// attach texture to be the output of a frame buffer
				// gl.COLOR_ATTACHMENT0: Attaches the texture to the framebuffer's color buffer
				this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.textures[i] = imageToTexture(this.context, this.source.encode), 0);
				if(old) this.context.deleteTexture(old);
			}
			this.render(); //glimp.common.update.call(this);
			gc.drawPixelsPerState.call(this);
		}
	};
	
	gc.renderDualBuffer = function() {
		// glimp.common.renderDualBuffer initializes texture 0, where we're flippping on texture 1
		this.context.activeTexture(this.context.TEXTURE0);
		this.context.bindTexture(this.context.TEXTURE_2D, this.source.texture);
		this.context.activeTexture(this.context.TEXTURE1);
		this.context.bindTexture(this.context.TEXTURE_2D, this.textures[1]);
		glimp.common.renderDualBuffer.call(this, this.fbs, this.textures);
	};
	
	gc.fragment = {
		main : "\
			// look up my pixel value \n\
  			vec4 c = texture2D(sourceTextureSampler, vText); \
			// look up my state -- label and strength \n\
			vec3 s = texture2D(stateTextureSampler, vText).rgb; \
			if(mode == 0) { \
				// iterating \n\
				// the output -- my current strength and label \n\
				vec4 o = vec4(s.r, s.g, 0.0, 1.0); \
				float attackStr; \
				vec3 colors[8], states[8];\
				// get my neighbors states (labels and strengths) \n\
				populateNeighbors(stateTextureSampler, vText, sourceTexelSize, states); \n\
				// get my neighbors colors \n\
				populateNeighbors(sourceTextureSampler, vText, sourceTexelSize, colors); \n\
				// ready ... fight! \n\
				for(int i = 0; i < 8; ++i) { \
					// calculate the attack strength of each neighbor \
					// attack strength is 1 minus the normalized difference in color between the \
					// attacking neighbor and this pixel times the strength of the neighbor pixel \
					// i.e. the closer the colors, the stronger the attack \
					// maximum L2 norm -- color difference is (1,1,1) -> sqrt(3) \
					// what's with the 0.002 ???? -- our quantization is 1/256 = 0.00390625 \
					// to avoid rounding/quantization errors we'll look at half of that value \
					// otherwise our algorithm may never converge  \
					// (if you don't believe me, set it to 0 and watch the change map keep changing, be glad I did the debugging for you) \n\
					if(((attackStr = (1.0 - distance(c.rgb, colors[i]) * 0.57735) * states[i].g) - o.g) > 0.002) { \
						// change my label and strength \n\
						o.r = states[i].r; \
						o.g = attackStr; \
						o.b = 1.0; // flag that we made a change \n\
					} \
				}\
				gl_FragColor = o;\
			} else if(mode == -1) { \
				// just the label (red) \n\
				gl_FragColor = vec4(s.r, s.r, s.r, 1.0); \
			} else if(mode == -2) { \
				// just the strength (green) \n\
				gl_FragColor = vec4(s.g, s.g, s.g, 1.0); \
			} else if(mode == -3) { \
				// just changed in the last iteration \n\
				gl_FragColor = vec4(s.b, s.b, s.b, 1.0); \
			} else if(mode == -4) { \
				// the full state map \n\
				gl_FragColor = vec4(s, 1.0); \
			} else if(mode == -5) { \
				// original input image \n\
				gl_FragColor = c; \
			} else { \
				// pass through the original  pixels if the label is above the mode value \n\
				float fMode = float(mode); \
				if(s.r * 255.0 > fMode) gl_FragColor = c; \
				else gl_FragColor = vec4(0, 0, 0, 0.0); \
			}",
		vars : "\
			// the label and strength -- this gets updated each pass\
			// r -- the label, g -- strength\n\
			uniform sampler2D stateTextureSampler;\
			// the output mode\n\
			uniform int mode;"
	};
	
	/** generates an output image of the input colors masked by the states in mask
	 * src -- source image -- seed.color
	 * out -- output state array -- out.pixels
	 * imagedata -- ImageData array of pixels  
	 * mask -- boolean array, if null or undefined, all states except the first
	 * */
	gc.stencil = function(src, out, imagedata, mask, w) {
		if(mask && src && out && imagedata) {
			// calculate the label packing
			var label = Math.floor(256 / mask.length / 2);
			var step = label < 1 ? 1 : label * 2;
			//var s;
			mapFlipY(src, imagedata, w, out, (function(s, m) { var step = s; var mask = m; return function(dst, src, i, test, it) {
				var s = Math.floor(test[it] / step);
				dst[i] = src[i], dst[i + 1] = src[i + 1], dst[i + 2] = src[i + 2], dst[i + 3] = src[i + 3];
				if(s < 0 || s >= mask.length || mask[s] == false) {
					/*dst[i] = dst[i + 1] = dst[i + 2] = 0; */dst[i + 3] = 0; }
//				} else {
	//				dst[i] = src[i], dst[i + 1] = src[i + 1], dst[i + 2] = src[i + 2], dst[i + 3] = src[i + 3];
	//			}
			}})(step, mask));
		}
		return imagedata;
	}

	gc.grayscale = function(src, imagedata, w, nPix) {
		if(src && imagedata) {
			mapFlipY(src, imagedata, w, src, (function(n) { var nPix = n; return function(dst, src, i, test, it) {
				dst[it] = dst[it + 1] = dst[it + 2] = src[i + nPix], dst[it + 3] = 255;
			}})(nPix));
		}
		return imagedata;
	}
	
	gc.makeImageData = function(imagedata) {
		if(this.source.color) {
			if(!imagedata || imagedata.width != this.source.color.width || imagedata.height != this.source.color.height) { 
				if(!this.source.context) return null;
				imagedata = this.source.context.createImageData(this.source.color);
			}
		}
		return imagedata;
	}
	// check if the algorithm is converged
	gc.done = function() {
		if((this.iterations % this.checkEvery) == (this.checkEvery - 1) || this.iterations == this.max - 1) {
			// scan the pixels for change
			this.getPixels();
			// look at the blue pixels (offset 2), these are the change flag
			for(var i = 2, ix = this.pixels.length; i < ix; i += 4)
				// did at least one pixel change
				if(this.pixels[i] > 0) return false;
			return true;
		}
		return false;
	}
	
	gc.pixelsPerState = function() {
		var hist = [];
		if(this.states.length && this.pixels) {
			var label = Math.floor(256 / this.states.length);
			if(label > 1) --label;
			hist.length = this.states.length;
			fillArray(hist, 0);
			// count the pixels per state
			for(i = 0; i < this.pixels.length; i += 4)
				++hist[Math.floor(this.pixels[i] / label)] 
		}
		return hist;
	}
	
	gc.populateStencilMask = function (gc, ctrl) {
		var i = 0, ix = Math.min(gc.states.length, ctrl.options.length);
		var x;
//		var hist = this.pixelsPerState.call(gc);
		for(i = 0; i < gc.states.length; ++i) {
			if(i < ix) x = ctrl.options[i];
			else ctrl.options.add(x = document.createElement('OPTION'));
			if(ix == 0) x.selected = (i > 0); 
			x.text = gc.states[i].label;
//			if(hist.length) x.text += ' : ' + hist[i];
		}
		// remove any extra
		while(i < ctrl.options.length)
			ctrls.options.remove(i);
	}

	gc.drawPixelsPerState = function(hist) {
		if(!hist) hist = gc.pixelsPerState.call(this);
		var g = this.controls.hist;
		g.save();
		g.setTransform(1,0,0,1,0,0);
		g.clearRect(0, 0, g.canvas.width, g.canvas.height);
		g.textBaseline="middle"; 
		g.font="12px Arial"
		if(this.pixels.length > 0) {
			var dYPixel = hist.length / g.canvas.height;
			var dXPixel = this.pixels.length / g.canvas.width / 4;
			g.setTransform(0.95 / dXPixel,0,0, 1 / dYPixel,0,0);
		//	g.lineWidth = 2 * Math.min(dXPixel, dYPixel);
			for(var i = 0; i < hist.length; ++i) {
				g.fillStyle = this.states[i].color;
				g.fillRect(0.0, i, hist[i],1);
			}
			g.setTransform(1,0,0,1,0,0);
			for(var i = 0; i < hist.length; ++i) {
				g.fillStyle='#000000';
				g.fillText(this.states[i].label + ' : ' + hist[i],5,(i+0.5)/dYPixel);
			}
		}
		g.restore();
		
	}
	
	return gc;
})(glimp.algorithms.growCut = {});