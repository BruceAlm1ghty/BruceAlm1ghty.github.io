/**
 * 
 */
var glimp = (function(){
	var glimp = {
			// algorithms should attach here
			algorithms : {},
			
			/**
			 * base class for image processing algorithms
			 * 
			 * source -- canvas or img with the input image
			 * out -- output canvas, (if not supplied it will be created by deploy)
			 * parent -- the owning document element for any created controls, if null, a span will be created and appended to the document by deploy
			 * algo -- the algorithm 
			 */
			algorithm : function(source, out, parent, algo) {
				console.log('glimp.algorithm constructor begin ' + arguments);
				// if no parent was specified, create an owning span and append to the document
				this.parent = parent;
				this.algorithm = algo;
				this.time = 0;
				
				this.update = function() { 
					var tStart = Date.now();
					if(this.algorithm && this.algorithm.update) this.algorithm.update.call(this);
					else glimp.common.update.call(this);
					this.time = (Date.now() - tStart);
					if(this.controls.time) this.controls.time.innerHTML = this.time;
					if(this.controls.iterations) this.controls.iterations.innerHTML = this.iterations;
				};
				
				this.change = null; // called after update is complete
				
				/** holds the image source, an optional document element and context to that element, and the glTexture */
				this.source = new glimp.common.source(source);
	
				// hold additional controls
				this.controls = {};
				
				// output and processing
				this.canvas = out,  // the canvas
				this.context = null, // the glContext
				this.program = null, // GLSL program
				this.iterations = 0, 
				this.max = 1024, 
				this.pixels = null, // Uint8Array of pixels
				// dual buffer support
				this.done = null; // if non-null this will be used by renderDualBuffer to check for convergence
				this.textures = [], // textures
				this.fbs = []; // framebuffers
				
				// read an image file and make it the source
				this.readSourceFile = function(f) {
					return (this.algorithm && this.algorithm.readSourceFile) ? this.algorithm.readSourceFile.call(this, f) : glimp.common.readSourceFile.call(this, f); 
				}
				
				// change the source image
				this.updateSource = function(img) {
					if(!img) img = this.source.element;
					if(this.algorithm) {
						if(this.algorithm.updateSource) return this.algorithm.updateSource.call(this, img);
						if(this.algorithm.dualBuffer == true) return glimp.common.updateDualSource.call(this, img);
					}
					return glimp.common.updateSource.call(this, img); 
				}

				// must return a texture
				this.onSourceChange = function(img) {
					return (this.algorithm && this.algorithm.onSourceChange) ? this.algorithm.onSourceChange.call(this, img) : glimp.onSourceChange(this.context, this.program, img);
				}
				
				// kernels will be common to many image processing routines, we'll add support for them here
				this.kernel = new glimp.common.kernel;
				
				// the fragment shader info
				this.fragment = {
					p : glimp.p.high, // the precision
					vars : glimp.fragment.vars, // 
					main : glimp.fragment.main,
					text : null // the fragment shader text
				};
				
				this.updateFragment = function() {
					return (this.algorithm && this.algorithm.updateFragment) ? this.algorithm.updateFragment.call(this) : glimp.common.updateFragment.call(this);
				};
				
				// set the uniform variables in the shader program
				this.setUniforms = function() {
					if(this.algorithm && this.algorithm.setUniforms) this.algorithm.setUniforms.call(this);
					else glimp.common.setUniforms.call(this);
				};
				
				/**
				 * textFrag -- the fragment shader code
				 * coordText -- the texture coordinates -- defaults to glimp.texture.coordinates
				 * textVert -- the vertex shader text -- defaults to glimp.vertex.shader
				 */
				this.updateProgram = function(textFrag, textVert, coordText, coordVert) {
					if(this.context) {
						this.program = (this.algorithm && this.algorithm.updateProgram) ? 
								this.algorithm.updateProgram.call(this, textFrag ? textFrag : this.updateFragment(), textVert, coordText, coordVert) :
								glimp.createProgram(this.context, textFrag ? textFrag : this.updateFragment(), textVert, coordText, coordVert);
						this.setUniforms();
					}
					return this;
				};
	
				this.render = function() {
					if(this.context) 
						return (this.algorithm && this.algorithm.dualBuffer == true) ? this.renderDualBuffer() : glimp.common.render.call(this);
					return this;
				};
				
				this.renderDualBuffer = function() {
					this.iterations = 0;
					this.context.bindTexture(this.context.TEXTURE_2D, this.source.texture);
					return (this.algorithm && this.algorithm.renderDualBuffer) ? this.algorithm.renderDualBuffer.call(this) : glimp.common.renderDualBuffer.call(this, this.fbs, this.textures); 
				};
				
				//this.draw() = function { return glimp.common.draw.call(this); };
		
				this.setKernelGaussian = function(sz) { return this.setKernel(glimp.kernel.GAUSSIAN, sz ? sz : 5); }
				this.setKernel = function(k, sz) { return (this.algorithm && this.algorithm.setKernel ) ? this.algorithm.setKernel.call(this, arguments) : glimp.common.setKernel.call(this, k, undefined == sz || null == sz ? this.kernel.size : sz); }
				this.setKernelSize = function(sz) { return (this.algorithm && this.algorithm.setKernelSize) ? this.algorithm.setKernelSize.call(this, arguments) : glimp.common.setKernelSize.call(this, sz); }
				this.setKernelSigma = function(sz) { this.kernel.sigma = sz; return this.setKernelSize(this.kernel.size); }
				this.graphKernel = function() { if(this.controls.kgraph) drawLineGraph(this.controls.kgraph.getContext('2d'), this.kernel.value, 3); }
				this.getPixels = function() { this.pixels = getPixels(this.context, this.pixels); return this.pixels;}
		
				/* creates the required canvas and context if not supplied, and optionally any controls */
				this.deploy = function() { return (this.algorithm && this.algorithm.deploy) ? this.algorithm.deploy.call(this, arguments) : glimp.common.deploy.apply(this, arguments); }
				this.deployControls = function() {
					if(this.algorithm && this.algorithm.deployControls) this.algorithm.deployControls.call(this);
					else this.deployControlHandlers();
				}
				this.deployControlHandlers = function() {
					if(this.algorithm && this.algorithm.deployControlHandlers) this.algorithm.deployControlHandlers.call(this);
					//else glimp.common.deployControlHandlers();
				}
				// a max iter control
				this.deployMaxIter = function(parent) { return (this.algorithm && this.algorithm.deployMaxIter) ? this.algorithm.deployMaxIter.call(this, arguments) : glimp.common.deployMaxIter.call(this, parent); }
				this.deployMaxIterHandler = function(inp) { return (this.algorithm && this.algorithm.deployMaxIterHandler) ? this.algorithm.deployMaxIterHandler.call(this, arguments) : glimp.common.deployMaxIterHandler.call(this, inp); }
				// a kernel control
				this.deployKernel = function(parent) { return (this.algorithm && this.algorithm.deployKernel) ? this.algorithm.deployKernel.call(this, arguments) : glimp.common.deployKernel.call(this, parent); }
				this.deployKernelHandlers = function() { return (this.algorithm && this.algorithm.deployKernelHandlers) ? this.algorithm.deploykernelHandlers.call(this, arguments) : glimp.common.deployKernelHandlers.call(this); }
				
				console.log('glimp.algorithm constructor done');
				return this;
			},

			common : {
				kernel : function() {
					this.type = null, // one of glimp.kernel , e.g. glimp.kernel.GAUSSIAN
					this.generator = null, // a generator function for the kernel
					this.size = 0, // the half-size of the 1d generator
					this.value = [], // the 1d kernel values
					this.uniform = 'fKernel', // the name of the uniform in the shader program
					this.text = null; // the text to add to the shader program to hold the uniform
					this.sigma = 2;
					return this;
				},
				
				/** holds the image source, an optional document element and context to that element, and the glTexture */
				source : function(src) { 
					this.element = src,
					this.context = null,
					this.image = null,
					this.texture = null;
					return this;
				},
				
				///////////////////////////////////
				///////////////////////////////////
				///////////////////////////////////
				// common function default implementations -- all functions should use call() or apply() with this -> glimp.algorithm
					
				drawSource : function(ctx) {
					if(!ctx) ctx = this.source.context;
					if(ctx)
						try {
							if(this.source.image instanceof Image || (this.source.image && this.source.image.nodeName == 'IMG'))
								ctx.drawImage(this.source.image, 0, 0);
							else 
								ctx.putImageData(this.source.image, 0, 0);
							return true;
						} catch(ex) {}
					return false;
				},
				
				// call to change the input image
				updateSource : function(img) {
					this.source.image = img;
					if(this.source.element) {
						this.source.element.width = img.width;
						this.source.element.height = img.height;
					}
					try {
						if(this.source.context) {
							if(img instanceof Image)
								this.source.context.drawImage(img, 0, 0);
							else 
								this.source.context.putImageData(img, 0, 0);
						} else if(this.source.element != img) this.source.element.src = img.src;
					} catch(ex) {}
					this.source.texture = this.onSourceChange(img);
					// allocate pixel memory
					this.pixels = new Uint8Array(img.width * img.height * 4);
					if(this.update) this.update();
					return this;
				},
				
				// call to update the image and dual source input textures
				updateDualSource : function(img) {
					for(var ii = 0; ii < 2; ++ii) {
						var old = this.textures[ii];
						this.context.bindFramebuffer(this.context.FRAMEBUFFER, this.fbs[ii]);
						// attach texture to be the output of a frame buffer
						// gl.COLOR_ATTACHMENT0: Attaches the texture to the framebuffer's color buffer
						this.context.framebufferTexture2D(this.context.FRAMEBUFFER, this.context.COLOR_ATTACHMENT0, this.context.TEXTURE_2D, this.textures[ii] = imageToTexture(this.context, img), 0);
						if(old) this.context.deleteTexture(old);
					}
					return this.algorithm && this.algorithm.updateSource ? this.algorithm.updateSource.call(this, img) : glimp.common.updateSource.call(this, img);
				},
				
				renderDualBuffer : function(fbs, textures) {
					if(!fbs) fbs = this.fbs;
					if(!textures) textures = this.textures;
					if(!fbs || fbs.length < 2 || !textures || textures.length < 2) return;
					var bDone = false;
					for(var i = 0; this.iterations <= this.max; ++this.iterations, ++i) {
						// we don't bind the texture the first time, assuming that was done before the call to bind the initial input
						// active texture should be set before the call
						// use the canvas frame buffer for last render
						this.context.bindFramebuffer(this.context.FRAMEBUFFER, bDone == true || this.iterations == this.max ? null : fbs[i % 2]);
						if(this.draw) this.draw; else glimp.common.draw.call(this);
						if(bDone) return;
						if(this.done) bDone = this.done(); 
						// set the result texture result of the last render to be the input texture
						this.context.bindTexture(this.context.TEXTURE_2D, textures[i % 2]);
					}
				},
				
				render : function() {
					++this.iterations;
					return this.draw ? this.draw() : glimp.common.draw.call(this);
				},
				
				draw : function() {
					this.context.clear(this.context.COLOR_BUFFER_BIT | this.context.DEPTH_BUFFER_BIT);
					this.context.drawArrays(this.context.TRIANGLE_STRIP, 0, 4);
					return this;
				},
				
				// default function implementations, should be called with call() or apply() with this = algorithm
				update : function() {
					if(this.render) { 
						this.render(); 
						if(this.change) this.change(); 
					}
				},

				updateFragment : function() {
					this.fragment.text = this.fragment.p + this.fragment.vars;
					if(this.kernel && this.kernel.text) this.fragment.text += this.kernel.text;
					if(this.fragment.neighbors == true) this.fragment.text += glimp.fragment.neighbors;
					return this.fragment.text += 'void main(void) {\n' + this.fragment.main + '}'; 
				},
				
				deploy : function() {
					console.log('glimp.common.deploy begin');

					// if no parent was specified, create an owning span and append to the document
					if(this.parent == null) this.parent = createSpan(null, null, document.body);
					
					// try to get a context to the source (see if it's a canvas)
					if(this.source.context == null) {
						try {
							this.source.context = this.source.element.getContext('2d');
						} catch(ex) {
							this.source.context = null;
						}
					}
	
					// if no canvas was specified, create one
					// and get a context to the canvas
					this.context = initCanvas(this.canvas ? this.canvas : (this.canvas = createElement('CANVAS', this.parent)));
	
					if(this.updateProgram) this.updateProgram();
					else if(this.algorithm && this.algorithm.updateProgram) this.algorithm.updateProgram.call(this);
					
					if(this.algorithm && this.fbs.length == 0) {
						var numFbs = 0;
						if(this.algorithm.framebuffer) numFbs = this.algorithm.framebuffers;
						else if(this.algorithm.dualBuffer == true) numFbs = 2;
						while(numFbs > 0) {
							this.fbs.push(this.context.createFramebuffer());
							--numFbs;
						}
					}
						
					if(this.deployControls) this.deployControls();

					console.log('glimp.common.deploy done');
					return this;
				},
				
				/* adds widgets/elements to manipulate the kernel settings */
				deployKernel : function(parent) {
					console.log('glimp.common.deployKernel');
					if(undefined == parent || null == parent) parent = this.parent;
					var t = (parent instanceof HTMLTableElement || parent.nodeName == 'TABLE') ? parent : createElement('TABLE', parent);
					var r = createElement('TR', t);
					var e = createElement('TH',r);
					e.setAttribute('colspan',2);
					e.innerHTML = 'Kernel';
					r = createElement('TR', t);
					createElement('TH', r).innerHTML = 'Type';
					(this.controls.ktype = createElement('SELECT', createElement('TD',r))).size = 1;
					for(var i in glimp.kernel) {
						var option = document.createElement("option");
						option.text = glimp.kernel[i].name;
						this.controls.ktype.add(option);
					}
					r = createElement('TR', t);
					createElement('TH', r).innerHTML = 'Half-Size';
					(this.controls.ksize = createInput('number', null, 0, 31, 1, null, createElement('TD', r))).value = this.kernel.size;
					r = createElement('TR', t);
					createElement('TH', r).innerHTML = 'Sigma';
					(this.controls.ksigma = createInput('number', null, 0, 20,0.5, null, createElement('TD', r))).value = this.kernel.sigma;
					r = createElement('TR', t);
					var e = createElement('TD',r);
					e.setAttribute('colspan', 2);
					(this.controls.kgraph = createCanvas(null, 200, 100, e)).setAttribute('style', "padding: 0px;border: 1px solid black;");
					
					return (this.deployKernelHandlers) ? this.deployKernelHandlers() : glimp.common.deployKernelHandlers.call(this);
				},
				
				/* adds event handlers to widgets/elements to manipulate the kernel settings, call this if you manually add the kernel controls */
				deployKernelHandlers : function() {
					// add event handlers
					if(this.controls.ksize) {
						this.controls.ksize.addEventListener('change', (function(ctor) { var t = ctor;  return function(evt) { t.setKernelSize(parseInt(evt.target.value)); }})(this), false);
						if(this.kernel && (null != this.kernel.size && undefined != this.kernel.size)) this.controls.ksize.value = this.kernel.size; 
					}
					if(this.controls.ksigma) {
						this.controls.ksigma.addEventListener('change', (function(ctor) { var t = ctor;  return function(evt) { t.setKernelSigma(parseFloat(evt.target.value)); }})(this), false);
						if(this.kernel) {
							if(null != this.kernel.sigma && undefined != this.kernel.sigma) this.controls.ksigma.value = this.kernel.sigma; 
							this.controls.ksigma.disabled = (this.kernel.type != glimp.kernel.GAUSSIAN);
						}
					}
					if(this.controls.ktype) {
						this.controls.ktype.addEventListener('change', (function(ctor) { var t = ctor;  return function(evt) {
							for(var i in glimp.kernel)
								if(glimp.kernel[i].name == evt.target.value) {
									t.setKernel(glimp.kernel[i]);
									if(t.controls.ksigma)
										t.controls.ksigma.disabled = i != 'GAUSSIAN';
									return;
								}
						}})(this), false);
						if(this.kernel && this.kernel.type) this.controls.ktype.value = this.kernel.type.name;
					}
					return this;
				},
				
				deployMaxIter : function(parent) {
					if(!parent) parent = this.parent ? this.parent : document.body;
					var x = createSpan(null, 'Max Iterations ', parent ? parent : this.parent);
					var t = createInput('number', null, 8, 2048, 8, null, x);//ctor.parent);
					return this.deployMaxIterHandler ? this.deployMaxIterHandler(t) : glimp.common.deployMaxIterHandler.call(this, t);
				},
				
				deployMaxIterHandler : function(inp) {
					(this.controls.maxIter = inp).addEventListener('change', (function(ctor) { var t = ctor;  return function(evt) { t.max = evt.target.value; if(t.update) t.update(); }})(this), false);
					this.controls.maxIter.value = this.max;
					return inp;
				},

				readSourceFile : function(f) {
					if(f && f.type && f.type.match('image.*')) {
						var reader = new FileReader();
						var algo = this;
						reader.onloadend = function() {
							// if our source element is an image, use it to convert the input
							if(algo.source.element instanceof Image || (algo.source.element && algo.source.element.nodeName == 'IMG')) {
//							if(!ctor.source.context) {
//								console.log(ctor.source.element.className);
//								console.log(ctor.source.element.nodeName);
//								console.log(ctor.source.element.nodeType);
								algo.source.element.src = this.result;
								algo.updateSource();
							} else {
								// we need to convert the input ourselves
								var x = new Image();
								x.src = this.result;
								algo.updateSource(x);
							}
						}
						reader.readAsDataURL(f);
		  			} else {
		  				console.log(f.type);
		  			}
					return this;
				},
				
				setKernel : function(k, sz) {
					this.kernel.type = k;
					if(k.generator) {
						if(k == glimp.kernel.GAUSSIAN) this.kernel.generator = (function(ctor, kg) { var t = ctor; var k = kg; return function(x){ return k(x, t.kernel.sigma); }})(this, k.generator);
						else this.kernel.generator = k.generator;
					}
					return (this.setKernelSize) ? this.setKernelSize(sz) : glimp.common.setKernelSize.call(this, sz)
				},
				
				setKernelSize : function(sz) {
					if(this.kernel.generator) {
						// remember the existing kernel length
						var old = this.kernel.value ? this.kernel.value.length : -1;
						// update the kernel values
						this.kernel.value = this.kernel.generator(this.kernel.size = (undefined == sz || null == sz) ? 0 : sz);
						// if the length changed, we need to regenerate the shader program
						if(old != this.kernel.value.length) {
							// rebuild the script
							this.kernel.text = 'uniform float ' + this.kernel.uniform + '[' + this.kernel.value.length + ']; const int nKernel = ' + this.kernel.size + ';';
							if(this.updateProgram) this.updateProgram();
						} else if(this.context && this.program) { 
							// now set the kernel in shader memory
							var t = this.context.getUniformLocation(this.program, this.kernel.uniform + '[0]');
							if(t) this.context.uniform1fv(t, this.kernel.value);
						}
						this.graphKernel();
						if(this.update) this.update();
					}
					return this;
				},
				
				setUniforms : function() {
					if(this.context && this.program) {
						if(this.source.image && this.source.image.widht > 0 && this.source.image.height > 0) {
							// set up the sourceTextureSize
							this.context.uniform2f(this.context.getUniformLocation(this.program, glimp.uniform.source.size), this.source.image.width, this.source.image.height);
							// set up the sourceTexelSize
							this.context.uniform2f(this.context.getUniformLocation(this.program, glimp.uniform.source.texel), 1.0 / this.source.image.width, 1.0 / this.source.image.height);
						}
					}
					// now set the kernel if it is there
					if(this.kernel && this.kernel.uniform && this.kernel.value) {
						var t = this.context.getUniformLocation(this.program, this.kernel.uniform + '[0]');
						if(t) this.context.uniform1fv(t, this.kernel.value);
					}
					var t = this.context.getUniformLocation(this.program, glimp.uniform.source.sampler);
					if(t) this.context.uniform1i(t, 0);
				}
			},
			
		
			
		p : {
			// highp - 16-bit, floating point range: -2^62 to 2^62, integer range: -2^16 to 2^16
			// mediump - 10 bit, floating point range: -2^14 to 2^14, integer range: -2^10 to 2^10
			// lowp - 8 bit, floating point range: -2 to 2, integer range: -2^8 to 2^8
			high : 'precision highp float;',
			medium : 'precision mediump float;',
			low : 'precision lowp float;'
		},
		attribute : { vertex : 'aCoord', texture : 'aText' },
		varying : { texture : 'vText' },
		uniform : { source : { sampler : 'sourceTextureSampler', size : 'sourceTextureSize', texel : 'sourceTexelSize' } },
		// the default vertex shader with a texture coordinate
		vertex : {
			vars : '\
				// our default vertex shader\
				// coordinate attribute \n\
				attribute vec3 aCoord;\
				// input texture coordinate \n\
				attribute vec2 aText;\
				// output texture coordinate to fragment shader \n\
				varying vec2 vText;',
			main : 'void main(void) { gl_Position = vec4(aCoord,1.); vText = aText; }',
			/** default vertex coordinates, two triangles TRIANGE_STRIP */
			coordinates : [ -1., -1.,  0.,  1., -1.,  0.,  -1.,  1.,  0.,  1.,  1.,  0. ]
		},
		fragment : { 
			neighbors : '\
				// neighbors are indexed as \
				// 5 1 4 \
				// 2 . 0 \
				// 6 3 7 \
				// oh who are the people in your neighborhood, in your neighborhood, in your neighborhood, the people that you meet each day \n\
				void populateNeighbors(in sampler2D samp, in vec2 pt, in vec2 step, out vec4 neighbors[8]) { \
					vec2 ptR = vec2(step.x, 0); // one pixel right \n\
					vec2 ptU = vec2(0, step.y); // one pixel up \n\
					// pixels in the neighborhood \n\
		       		neighbors[4] = texture2D(samp, pt.xy + step.xy); \
		       		neighbors[6] = texture2D(samp, pt.xy - step.xy); \
		       		neighbors[5] = texture2D(samp, pt.xy + ptU - ptR); \
		       		neighbors[7] = texture2D(samp, pt.xy - ptU + ptR); \
		       		neighbors[3] = texture2D(samp, pt.xy - ptU); \
		       		neighbors[1] = texture2D(samp, pt.xy + ptU); \
		       		neighbors[2] = texture2D(samp, pt.xy - ptR); \
		       		neighbors[0] = texture2D(samp, pt.xy + ptR); \
				}\
				// neighbors are indexed as \
				// 5 1 4 \
				// 2 . 0 \
				// 6 3 7 \
				// oh who are the people in your neighborhood, in your neighborhood, in your neighborhood, the people that you meet each day \n\
				void populateNeighbors(in sampler2D samp, in vec2 pt, in vec2 step, out vec3 neighbors[8]) { \
					vec2 ptR = vec2(step.x, 0); // one pixel right \n\
					vec2 ptU = vec2(0, step.y); // one pixel up \n\
					// pixels in the neighborhood \n\
		       		neighbors[4] = texture2D(samp, pt.xy + step.xy).rgb; \
		       		neighbors[6] = texture2D(samp, pt.xy - step.xy).rgb; \
		       		neighbors[5] = texture2D(samp, pt.xy + ptU - ptR).rgb; \
		       		neighbors[7] = texture2D(samp, pt.xy - ptU + ptR).rgb; \
		       		neighbors[3] = texture2D(samp, pt.xy - ptU).rgb; \
		       		neighbors[1] = texture2D(samp, pt.xy + ptU).rgb; \
		       		neighbors[2] = texture2D(samp, pt.xy - ptR).rgb; \
		       		neighbors[0] = texture2D(samp, pt.xy + ptR).rgb; \
				}',
			vars : '\
				// the input image \n\
				uniform sampler2D sourceTextureSampler; \
				// image size \n\
				uniform vec2 sourceTextureSize; \
				// size of a pixel \n\
				uniform vec2 sourceTexelSize; \
				// the texture coordinate from the vertex shader \n\
				varying vec2 vText; ',
			main : 'void main() { gl_FragColor = texture2D(sourceTextureSampler, vText); }'
		},
		kernel : {
			// known kernels
			GAUSSIAN : { value : 0, name : 'Gaussian', generator : null }, 
			RECT : { value : 1, name : 'Rectagular', generator : null, }, 
			EPAN : { value : 2, name : 'Epanechnikov', generator : null }
		},
		texture : {
			/** default texture coordinates */
			coordinates : [ 0, 0,  1, 0,  0, 1,  1, 1 ]
		},
		
		/** initialize the vertex and fragment shader program */
		createProgram : function(glContext, textFrag, textVert, coordText, coordVert) {
			console.log('fragment shader:');
			console.log(textFrag);
			var glProgram = initProgram(glContext, 
					(undefined == textVert || null == textVert) ? glimp.p.high + glimp.vertex.vars + glimp.vertex.main : textVert,
					(undefined == textFrag || null == textFrag) ? glimp.p.high + glimp.fragment.vars + glimp.fragment.main : textFrag);
			// set the vertex coordinate attributes
			bufferToAttribute(glContext, glProgram, glimp.attribute.vertex, pushFloats(glContext, (undefined == coordVert || null == coordVert) ? glimp.vertex.coordinates : coordVert), 3);
			// set the vertex coordinate attributes
			bufferToAttribute(glContext, glProgram, glimp.attribute.texture, pushFloats(glContext, (undefined == coordText || null == coordText) ? glimp.texture.coordinates : coordText), 2);
			return glProgram;
		},
		
		// after the source image has been loaded, source image/texture
		onSourceChange : function (glContext, glProgram, sourceImage) {
			var text = null;
			if(glContext && glProgram && sourceImage) {
				// create a texture of our input image -- seed.color
				glContext.activeTexture(glContext.TEXTURE0);
				text = imageToTexture(glContext, sourceImage);
				// make sure we have a one-to-one mapping on pixels
				glContext.viewport(0, 0, glContext.canvas.width = sourceImage.width, glContext.canvas.height = sourceImage.height);
				// adjust for the texture size
				// set up the sourceTextureSize
				glContext.uniform2f(glContext.getUniformLocation(glProgram, glimp.uniform.source.size), sourceImage.width, sourceImage.height);
				// set up the sourceTexelSize
				glContext.uniform2f(glContext.getUniformLocation(glProgram, glimp.uniform.source.texel), 1.0 / sourceImage.width, 1.0 / sourceImage.height);
			}
			return text;
		},

		/* given an RGBA pixel source, generate histograms 
		 * if histo is non-null it is either an array of arrays(256) - each channel and b&w or a simple array(256) -- black and white*/
		populateHistogram : function(pixels, histo) {
			if(!histo) histo = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
			var i, j, bw;
			var f = [0.30, 0.59, 0.11];
			if(histo.length == 5) for(i = 0; i < 5; ++i) fillArray(histo[i], 0);
			if(pixels && pixels.length) {
				i = 0; 
				while(i < pixels.length) {
					bw = 0;
					for(j = 0; j < 3; ++j, ++i) { // each rgb histogram
						if(histo.length == 5) ++histo[j][pixels[i]];
						bw += f[j] * pixels[i]; // calculate the luma
					}
					if(histo.legnth == 5) 
						++histo[j][ctor.pixels[i]]; // the alpha histogram
					++i;
					if(histo.length == 5)
						++histo[4][Math.floor(bw)];  // the luma histogram
					else ++histo[Math.floor(bw)];
				}
			}
			return histo;
		},

	};
		
	
	//////////////////////
	// kernel generators
	
	// generate a 2D kernel from a 1D pdf
	// returns a kernel of size (sz * 2 + 1)^2
	glimp.common.kernel.generate2d = function(sz, pdf) {
		var k = [], ret = [], sum = 0.0, x = 0.0;
		for(var i = -sz; i <= sz; ++i) k.push(pdf(i));
		for(var i = 0; i < k.length; ++i)
			for(var j = 0; j < k.length; ++j) {
				sum += (x = k[i] * k[j]);
				ret.push(x);
			}
		// normalize
		if(sum > 0.0)
			for(var i = 0; i < ret.length; ++i) ret[i] /= sum; 
		return ret;
	}

	// generate a normalized 1D kernel
	glimp.kernel.generate = function(sz, pdf) {
		var ret = [], sum = 0.0, x = 0.0;
		for(var i = -sz; i <= sz; ++i) {
			ret.push(x = pdf(i));
			sum += x;
		}
		// normalize
		if(sum > 0.0)
			for(var i = 0; i < ret.length; ++i) ret[i] /= sum; 
		return ret;
	}
	
	glimp.kernel.GAUSSIAN.pdf = function(x, sigma) {
		return Math.exp(-0.5*x*x/(sigma*sigma))/sigma;
	}
	// returns a kernel of size (sz * 2 + 1)^2
	glimp.kernel.GAUSSIAN.generator = function(sz, sigma) {
		return glimp.kernel.generate(sz, (function() { var t = (sigma) ? parseFloat(sigma) : 0.001; return function(x) { return glimp.kernel.GAUSSIAN.pdf(x, t); }})());}
	
	glimp.kernel.RECT.pdf = function(x) {
		return 1.0;
	}
	// returns a kernel of size (sz * 2 + 1)^2
	glimp.kernel.RECT.generator = function(sz) {
		return glimp.kernel.generate(sz, glimp.kernel.RECT.pdf);
	}

	glimp.kernel.EPAN.pdf = function(x, l) {
		return 1.0 - (x / l) * (x / l);
	}
	// returns a kernel of size (sz * 2 + 1)^2
	glimp.kernel.EPAN.generator = function(sz) {
		return glimp.kernel.generate(sz, (function() { var t = sz + 0.5; return function(x) { return glimp.kernel.EPAN.pdf(x, t); }})());
	}

	///////////////////////
	// handler helpers
	/** algo -- the algorithm
	 * ctrl -- the control
	 * when -- event type
	 * f -- the handler function f(evt) will be called with this set to algo
	 */
	glimp.addHandler = function(algo, ctrl, when, f) {
		ctrl.addEventListener(when, (function(x) { var t = x; return function(evt) { f.call(t, evt); }})(algo), false);
	}
	glimp.addClickHandler = function(algo, ctrl, f) { glimp.addHandler(algo, ctrl, 'click', f); }
	glimp.addChangeHandler = function(algo, ctrl, f) { glimp.addHandler(algo, ctrl, 'change', f); }
	glimp.addInputHandler = function(algo, ctrl, f) { glimp.addHandler(algo, ctrl, 'input', f); }

	glimp.doCall = function(pThis, fthis, falgo, fglimp, args) {
		console.log('doCall ' + pThis + ' ' + fthis + ' ' + falgo + ' ' + fglimp);
		if(fthis) fthis.apply(pThis, args);
		else if(falgo) falgo.apply(pThis, args);
		else if(fglimp) fglimp.apply(pThis, args);
	}
	
	return glimp;
})();
