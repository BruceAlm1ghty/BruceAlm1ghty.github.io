/**
 * Check the byte order of this file
 */
var isLittleEndian = (function(){
    var a = new ArrayBuffer(4);
    var b = new Uint8Array(a);
    var c = new Uint32Array(a);
    b[0] = 0xa1;
    b[1] = 0xb2;
    b[2] = 0xc3;
    b[3] = 0xd4;
    return (c[0] == 0xd4c3b2a1);
    //if(c[0] == 0xd4c3b2a1) return "little endian";
    //if(c[0] == 0xa1b2c3d4) return "big endian";
})();

function findMax(arr) { return findMinMax(arr)[1]; } //return Math.max(...arr);
function findMin(arr) { return findMinMax(arr)[0]; } //return Math.min(...arr);

function findMinMax(arr) {
	if(arr.length > 0) {
		var x = arr[0];
		var n = arr[0];
		for(var i = 1; i < arr.length; ++i) {
			if(arr[i] > x) x = arr[i];
			if(arr[i] < n) n = arr[i];
		}
		return [n, x];
	}
	return [0,0];
}

/**
 * Sadly FireFox does not have offsetX and offsetY, uses jQuery
 * @param ev an event
 * @returns {___anonymous966_967}
 */
function fixEvent(ev) {
	if(typeof ev.offsetX === "undefined" || typeof ev.offsetY === "undefined") {
		var targetOffset = $(ev.target).offset();
		ev.offsetX = ev.pageX - targetOffset.left;
		ev.offsetY = ev.pageY - targetOffset.top;
	}
	return ev;
}

function fillArray(x, v) {
	try {
		x.fill(v);
		return x;
	} catch(ex) {
	}
	for(var i = 0; i < x.length; ++i) x[i] = v;
	return x;
}

//////////////////////////

function createElement(el, parent, id) {
	var e = document.createElement(el);
	if(undefined != id && null != id) e.setAttribute('id', id);
	if(undefined != parent && null != parent) parent.appendChild(e);
	return e;
}

function createButton(id, label, parent) {
	var ret = createElement('BUTTON', parent, id);
	ret.setAttribute('type', 'button');
	if(undefined != label && null != label) ret.innerHTML = label;
	return ret;
}

function createInput(type, id, mn, mx, stp, w, parent) {
	var ret = createElement('INPUT', parent, id);
	ret.setAttribute('type', type);
	if(undefined != mn && null != mn) ret.setAttribute('min', mn);
	if(undefined != mx && null != mx) ret.setAttribute('max', mx);
	if(undefined != stp && null != stp) ret.setAttribute('step', stp);
	if(undefined != w && null != w) ret.setAttribute('style', 'width: ' + w + 'px;');
	return ret;
}

function createSpan(id, label, parent) {
	var ret = createElement('SPAN', parent, id);
	if(undefined != label && null != label) ret.innerHTML = label;
	return ret;
}

// <input type='range' min="0.0" max="1.0" value="1.0" step='0.002' id="window"  style='width: 501px;'> Window <span id='windowValue'>1</span>
function createRange(id, mn, mx, stp, w, parent) {
	return createInput('range', id, mn, mx, stp, w, parent);
}

function createCanvas(id, w, h, parent) {
	var ret = createElement('CANVAS', parent, id);
	if(undefined != w && null != w) ret.setAttribute('width', w);
	if(undefined != h && null != h) ret.setAttribute('height', h);
	return ret;
}

function createHeading(text, lvl, parent) {
	var ret = createElement('H' + ((undefined == lvl || null == lvl) ? 1 : lvl), parent);
	ret.appendChild(document.createTextNode(text)); // Create a text node
	return ret;
}

////////////////////
// two forms
// mapFlipY(src, dst, w) --> copies src to dst flipping the Y component, w is the length of the line in data (pixels * 4)
// mapFlipY(src, dst, w, test, f) --> copies src to dst, using test and f, where f is test and copy function, test is flipped in Y
// f = function(dst, src, i, test, it) { if(test[it] > 0) { dst[i] = src[i]; dst[i+1]=src[i+1]; ... } else dst[i] = dst[i+1] = 0; }
function mapFlipY(src, dst, w, test, f) {
	var isd = 0, iesd = Math.min(src.length, dst.length);
	var it = (test ? test.length : dst.length) - w; 
	for(var isd = 0; isd < iesd; it -= w)
		if(test && f)
			for(var x = 0; x < w; x += 4, isd += 4)
				f(dst, src, isd, test, it + x)
		else 
			for(var x = 0; x < w; ++x, ++isd)
				dst[it + x] = src[isd];
}