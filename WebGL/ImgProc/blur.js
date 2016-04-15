/**
 * 
 */
(function(blur) {
	glimp.blur = function(source, out, parent) {
		console.log('glimp.blur constructor begin ' + arguments);
		// call the base class
		glimp.algorithm.call(this, source, out, parent, blur);
		this.fragment.main = '\
			if(nKernel > 0) {\n\
				vec3 accum = vec3(0.0);\n\
				for(int i = -nKernel; i <= nKernel; ++i) {\n\
					for(int j = -nKernel; j <= nKernel; ++j) {\n\
						// add kernel weighted color of pixel in the neighborhood\n\
						accum += fKernel[i + nKernel] * fKernel[j + nKernel] * texture2D(sourceTextureSampler, vText.xy + vec2(float(i), float(j))*sourceTexelSize.xy).rgb;\n\
					}\n\
				}\n\
				//accum = vec3(gl_FragCoord.x / sourceTextureSize.x, gl_FragCoord.y / sourceTextureSize.y, 0.0); \n\
				//accum = vec3(vText.x, vText.y, 0.0); \n\
				gl_FragColor = vec4(accum, 1.0);\n\
    		} else gl_FragColor = texture2D(sourceTextureSampler, vText);';
		this.kernel.sigma = 2;
		this.setKernel(glimp.kernel.EPAN, 6); 
		this.max = 1;
		console.log('glimp.blur constructor done');
		return this;
	};
	glimp.blur.prototype = Object.create(glimp.algorithm);
	glimp.blur.prototype.constructor = glimp.blur;

	// user friend name
	blur.name = 'Blur';
	// function name
	blur.propertyName = 'blur';
	// setting this true will run blurs of blurs
	blur.dualBuffer = true;
	// maximum iteration hint
	blur.max = 1;
	
	// add the controls
	blur.deployControls = function() {
		// call the default kernel deployment
		glimp.common.deployKernel.apply(this, arguments);
		this.graphKernel(); 
	};
	
	
})(glimp.algorithms.blur = {});
