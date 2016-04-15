/**
 * 
 */
(function(ms) {
	// user friend name
	ms.name = 'Mean Shift';
	// function name
	ms.propertyName = 'meanShift';
	// setting this true will run blurs of blurs
	ms.dualBuffer = true;
	// maximum iteration hint
	ms.max = 512;
	
	glimp.ms = function(source, out, parent) {
		// call the base class
		glimp.algorithm.call(this, source, out, parent, ms);
		
		this.fragment.norm = 'float norm(vec3 x) { return dot(x, x); }\n';
		this.fragment.main = 'vec4 c = texture2D(sourceTextureSampler, vText);\n\
			if(nKernel > 0) {\n\
				vec3 accum = vec3(0.0);\n\
				vec3 tmp; \n\
				float fWeight, fSum = 0.0, dt; \n\
				for(int i = -nKernel; i <= nKernel; ++i) {\n\
					for(int j = -nKernel; j <= nKernel; ++j) {\n\
						// add kernel weighted color of pixel in the neighborhood\n\
						tmp = texture2D(sourceTextureSampler, vText.xy + vec2(float(i), float(j))*sourceTexelSize.xy).rgb;\n\
						dt = norm(c.rgb - tmp) * 0.333333;\n\
						if(dt < tolerance) {\n\
							// add to the average \n\
							fSum += (fWeight = fKernel[nKernel+j]*fKernel[nKernel+i]); \n\
							accum += fWeight*tmp;\n\
						}\n\
					}\n\
				}\n\
				accum /= fSum;\n\
				// how much did it change\n\
				dt = norm(c.rgb - accum) * 0.333333;\n\
				//gl_FragColor = vec4(accum, 1.0); //1.0 - dt);\n\
				gl_FragColor = vec4(accum, 1.0 - dt);\n\
    		} else gl_FragColor = texture2D(sourceTextureSampler, vText);';
		this.fragment.vars = glimp.fragment.vars + 'uniform float tolerance;'; 

		this.tolerance = 0.1;
		this.max = 64;
		this.kernel.sigma = 2;
		// this will also create the program
		this.setKernel(glimp.kernel.GAUSSIAN, 5);
		
		// called after each iteration
		this.done = function() {
			if(this.iterations % 8 == 7) {
				this.getPixels();
				for(var i = 3; i < this.pixels.length; i += 4)
					if(this.pixels[i] < 255) return false;
				this.histogram = glimp.populateHistogram(this.pixels, this.histogram);
				if(this.controls.histogram) {
					this.histogram[4][0] = this.histogram[4][255] = 0;
					drawBarGraph(this.controls.histogram.getContext('2d'), this.histogram[4]);
/*
					var x = this.controls.histogram.getContext('2d');
					x.fillStyle = 'rgba(255,0,0,64)';
					drawBarGraph(this.controls.histogram.getContext('2d'), this.histogram[0], false);
					x.fillStyle = 'rgba(0, 255,0,64)';
					drawBarGraph(this.controls.histogram.getContext('2d'), this.histogram[1], false);
					x.fillStyle = 'rgba(0,0,255,64)';
					drawBarGraph(this.controls.histogram.getContext('2d'), this.histogram[2], false);*/
				}
				return true;
			}
			return false;
		}
		return this;
	};
	ms.setUniforms = function() {
		glimp.common.setUniforms.call(this);
		ms.setTolerance.call(this);
	},

	ms.setTolerance = function() {
		this.context.uniform1f(this.context.getUniformLocation(this.program, 'tolerance'), this.tolerance * this.tolerance);
	},
	
	ms.updateTolerance = function() {
		this.tolerance = this.controls.tolerance.value;
		ms.setTolerance.call(this);
		this.update();
	},
	
	ms.updateFragment = function() {
		return this.fragment.text = this.fragment.p + this.fragment.vars + this.fragment.norm + this.kernel.text + 'void main(void) {\n' + this.fragment.main + '}'; 
	},
	
	// add the controls
	ms.deployControls = function() {
		var ctor = this;
		var t = createElement('TABLE', ctor.parent);
		var r = createElement('TR', t);
		createElement('TH', r).innerHTML = 'Tolerance ';
		ctor.controls.tolerance = createInput('number', null, 0.0, 1.0, 0.004, null, createElement('TD', r));
		ctor.controls.tolerance.value = ctor.tolerance;
		r = createElement('TR', t);
		createElement('TH', r).innerHTML = 'Max Iterations ';
		ctor.controls.maxIter = createInput('number', null, 8, 2048, 8, null, createElement('TD', r));
		ctor.controls.maxIter.value = ctor.max;
		r = createElement('TR', t);
		createElement('TH', r).innerHTML = 'Iterations ';
		ctor.controls.iterations = createElement('TD', r);
		r = createElement('TR', t);
		ctor.controls.histogram = createCanvas(null, 256, 100, createElement('TD', r));
		ctor.controls.histogram.parentElement.setAttribute('colspan', 2);
		return ms.deployControlHandlers.call(this);
	}
	ms.deployControlHandlers = function() {
		glimp.addChangeHandler(this, this.controls.tolerance, ms.updateTolerance);
		this.deployMaxIterHandler(this.controls.maxIter);
		return this;
	}
	
})(glimp.algorithms.meanShift = {});
	