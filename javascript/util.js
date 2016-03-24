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