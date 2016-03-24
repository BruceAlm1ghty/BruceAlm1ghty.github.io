/**
 * a file queue object holds a select box and queue manipulation controls
 * NB: file is loaded EVERY time it's selected
 * var fq = fileQueue.Deploy(parentElement = document);
 * onread member (can be changed), called with the file to load
 * default behavior loads a file when selected then calls onload, user supplied
 * fq.onload = function() { 
 *			try {
 *				if(this.data instanceof ArrayBuffer) {
 *					...
 *				} else {
 *					...
 *				}
 *			} catch(ex){}
 */
var fileQueue = (function() {
	/**
	 * keep track of fileQueue objects created
	 */
	this.deployed = [];

	function create(el, parent, id) {
		var e = document.createElement(el);
		if(undefined != id) e.setAttribute('id', id);
		if(undefined != parent) parent.appendChild(e);
		return e;
	}
	function createButton(id, label, parent) {
		var ret = create('BUTTON', parent, id);
		ret.setAttribute('type', 'button');
		if(undefined != label) ret.innerHTML = label;
		return ret;
	}
	this.Deploy = function (par, idPrefix) {
		if(undefined == par) par = document.body;
		var ret = {
				// controls -- in the order of enumerates
				load : null,
				append : null,
				sel : null,
				clear : null,
				up : null, 
				del : null, 
				down : null, 
				dec : null, 
				slider : null, 
				inc : null, 
				name : null,
				list : [ ], // list of File objects in the queue
				// enumerates for controls
				LOAD:0, APPEND:1, SEL:2, CLEAR: 3, UP:4, DEL:5, DOWN:6, PREV:7, SLIDE:8, NEXT:9, NAME:10, MAX:11,
				// the control properties
				prop : [ 'load', 'append', 'sel', 'clear', 'up', 'del', 'down', 'dec', 'slider', 'inc', 'name' ],
				// ids for controls
				ids : [ 'Load', 'Append', 'Sel', 'Clear', 'Up', 'Del', 'Down', 'Dec', 'Slider', 'Inc', 'Name' ],
				// text labels for buttons
				labels : [ null, 'Append Files', null, 'Remove All', '&#x25B2;', 'Remove Sel', '&#x25BC;', '&#x25C4;', null, '&#x25BA;', null ],
				onload : null,  // update function, called by (default) onread after setting data
				onread : function(f) { readFile(this, f); },// default reader, read the supplied File object, place the result in data, call toImage or toCanvas send it to an image or canvas
				data : null,
				toImage : function(img) { return toImage(img, this.data); },
				toCanvas : function(cvs) { return toCanvas(cvs, this.data); },
				table : null, // the layout table for the buttons and list
				parent : par,
				/** create a button of id i */ 
				createButton : function (i, par) { return this[this.prop[i]] = createButton(this.ids[i], this.labels[i], undefined == par ? this.parent : par); },
				/** create a control of type ty with id ids[i] */ 
				create : function(i, ty, par) {	return this[this.prop[i]] = create(ty, undefined == par ? this.parent : par, this.ids[i]); },
				enableButtons : function() { enableButtons(this); },
				///// event handler helpers
				onFileUp : function() { var i = this.sel.selectedIndex; if(i > 0) fileSwap(this, i - 1, i); },
				onFileDown : function() { var i = this.sel.selectedIndex; if(i < this.list.length - 1) fileSwap(this, i + 1, i); },
				decSel : function() { onChooseFile(this, (this.sel.selectedIndex + this.list.length - 1) % this.list.length); },
				incSel : function() { onChooseFile(this, (this.sel.selectedIndex + 1) % this.list.length); },
				onFileClear : function() { this.list=[]; processFileList(this); },
				// utility functions 
				getSelected : function() { return this.sel.selectedIndex; },
				getSelectedFile : function() { return this.list[getSelected()]; },
				getSelectedName : function() { return this.list[getSelected()].name; },
		};
		for(var i = 0; i < ret.MAX; ++i)
			ret.ids[i] = ((idPrefix == undefined) ? 'file' : idPrefix) + ret.ids[i]; 
		ret.create(ret.LOAD, 'INPUT');
		ret.load.setAttribute('type', 'file');
		ret.load.setAttribute('accept', 'image/*,*/*');
		ret.load.setAttributeNode(document.createAttribute('multiple'));
		ret.create(ret.APPEND, 'INPUT'); 
		ret.append.setAttribute('type', 'checkbox');
		//ret.append.innerHTML = ret.labels[ret.APPEND];
		ret.append.insertAdjacentHTML('afterend', ret.labels[ret.APPEND]);
		create('br', par);
		ret.table = create('TABLE', par);
		var row = create('TR', ret.table);
		var el = create('TD', row);
		el.setAttribute('rowspan', 5);
		// the selection box
		ret.create(ret.SEL, 'SELECT', el).setAttribute('size', 7);
		el = create('TH', row);
		el.setAttribute('style', 'text-align: left;');
		el.innerHTML = 'Edit List';
		for(var i = ret.CLEAR; i <= ret.DOWN; ++i)
			ret.createButton(i, create('TD', create('TR', ret.table)));
		(el = create('p', par)).innerHTML = 'Scroll Images ';
		ret.createButton(ret.PREV, el);
		ret.create(ret.SLIDE, 'INPUT', el).setAttribute('type', 'range');
		ret.slider.setAttribute('min', 0);
		ret.slider.setAttribute('max', 0);
		ret.createButton(ret.NEXT, el);
		ret.create(ret.NAME, 'SPAN', el);
		
		// the event handlers
		ret.slider.addEventListener('change', onSliderSel, false); // use the slider to select a file
		ret.sel.addEventListener('change', onListSel, false); // select a file from the list
		ret.up.addEventListener('click', onFileUp, false); // move the selected file up one in the list
		ret.down.addEventListener('click', onFileDown, false); // move the selected file down one in the list
		ret.del.addEventListener('click', onRemoveSel, false); // remove the selected from the list
		ret.dec.addEventListener('click', decSel, false); // remove the selected from the list
		ret.inc.addEventListener('click', incSel, false); // remove the selected from the list
		ret.load.addEventListener('change', handleFileSelect, false);
		ret.clear.addEventListener('click', onRemoveAll, false);

		// event handlers have 'this' set to the document element that fired the handler
		// we'll need this to back track to our object when an event handler fires
		this.deployed.push(ret);
		ret.enableButtons();
		
		return ret;
	};
	// given an event, find which fileQueue object owns the target
	function findFromTarget(evt) {
		for(var x = 0; x < fileQueue.deployed.length; ++i) {
			var t = fileQueue.deployed[x];
			for(var i = 0; i < t.MAX; ++i)
				if(evt.target == t[t.prop[i]])
					return t;
		}
		return null;
	}
	function onSliderSel(evt) { onChooseFile(findFromTarget(evt), evt.target.value); }
	function onListSel(evt) { onChooseFile(findFromTarget(evt), evt.target.selectedIndex); }
	function onFileUp(evt) { findFromTarget(evt).onFileUp(); }
	function onFileDown(evt) { findFromTarget(evt).onFileDown(); }
	function decSel(evt) { findFromTarget(evt).decSel(); }
	function incSel(evt) { findFromTarget(evt).incSel(); }
	function onRemoveAll(evt) { findFromTarget(evt).onFileClear(); }
	function onRemoveSel(evt) { onFileDel(findFromTarget(evt)); }
	function handleFileSelect(evt) { evt.stopPropagation(); evt.preventDefault(); readFiles(findFromTarget(evt), evt.target.files); }
	
	function enableButtons(x) {
		x.load.disabled = false;
		x.sel.disabled = x.list.length == 0;
		x.up.disabled = x.list.length == 0 || x.sel.selectedIndex < 1;
		x.del.disabled = x.list.length == 0 || x.sel.selectedIndex == -1;
		x.down.disabled = x.list.length == 0 || x.sel.selectedIndex == x.list.length - 1;
		x.dec.disabled = x.slider.disabled = x.inc.disabled = x.list.length < 2;
		x.clear.disabled = x.list.length == 0;
	}
	function onChooseFile(x, i) {
		if(i >= 0 && i < x.list.length) {
			x.name.innerHTML = x.list[i].name;
			x.slider.value = i;
			x.sel.selectedIndex = i;
			enableButtons(x);
			if(null != x.onread) x.onread(x.list[i]);
			else console.log('FileQueue: onread function supplied');
		}
	}
	function fileSwap(x, iNew, iOrig) {
		// swap the entries
		var xTmp = x.list[iNew];
		x.list[iNew] = x.list[iOrig];  
		x.list[iOrig] = xTmp;
		// re-process the list
		processFileList(x);
		// update the selected file (keep the original selected)
		onChooseFile(x, iNew)
	}
	function onFileDel(x) {
		// remember where we were
		var iOrig = x.sel.selectedIndex;
		// move everyone later in the list up one
		for(var i = iOrig, ix = x.list.length - 1; i < ix; ++i)
			x.list[i] = x.list[i + 1];
		// delete the last item
		x.list.pop();
		// update the selected dialog
		processFileList(x);
		// fix the selected item
		onChooseFile(x, iOrig)
	}
	
	function processFileList(x, list, bAppend) {
		var i = 0;
		// if there's a list, we need to copy the entries (not the list itself because we might edit it later)
		if(undefined != list) {
			if(bAppend != true) x.list = [];
			for(i = 0; i < list.length; ++i) x.list.push(list[i]);
		}
		var ix = Math.min(x.sel.length, x.list.length);
		// replace any existing options
		for(i = 0; i < ix; ++i) x.sel.options[i].text = x.list[i].name;
		// add new ones
		for(; i < x.list.length; ++i) {
			var option = document.createElement("option");
			option.text = x.list[i].name;
			x.sel.add(option);			
		}
		// remove any extras
		while(i < x.sel.length)
			x.sel.remove(i);
		// set the ranges and the selected items
		// we do NOT call onChoose here
		x.slider.max = x.list.length > 0 ? x.list.length - 1 : 0;
		x.slider.value = 0;
		x.sel.selectedIndex = 0;
		enableButtons(x);
	}
	this.readFile = function(x, file) {
		if (file.type.match('image.*') == null && file.type.match('video.*') == null && file.type.match('audio.*') == null)
			readBufferFile(x, file);
		else
			readDataFile(x, file);
	}
	/** given a fileQueue object and file, set the data member to the read file
	 */
	this.readDataFile = function(x, file) {
		var reader = new FileReader();
		reader.onloadend = function() {
			x.data = this.result;
			if(undefined != x.onload) x.onload();
		}
		try {
			reader.readAsDataURL(file);
		} catch(ex) {
			console.log('readDataFile: ' + ex);
			x.data = null;
			if(undefined != x.onload) x.onload();
		}
	}
	/** given a fileQueue object and file, set the data member to the read array buffer
	 */
	this.readBufferFile = function(x, file) {
		var reader = new FileReader();
		reader.onloadend = function() {
			x.data = this.result;
			// convert his to an array as
			// new Uint8Array(x.data)
			if(undefined != x.onload) x.onload();
		}
		try {
			reader.readAsArrayBuffer(file);
		} catch(ex) {
			console.log('readBufferFile: ' + ex);
			x.data = null;
			if(undefined != x.onload) x.onload();
		} 						
	}
	function readFiles(x, files) {
		var i = x.sel.selectedIndex;
		processFileList(x, files, x.append.checked);
		if(files.length > 0) onChooseFile(x, x.append.checked && i >= 0 ? i : 0);
	}
	this.toImage = function(target, data) {
		try {
			target.src = data;
			return true;
		} catch(ex) {}
		return false;
	}
	this.toCanvas = function(target, data) {
		try {
			var image = new Image;
			image.src = data;
			if(target instanceof canvas)
			var ctx = target.getContext('2d');
			if(undefined != ctx && null != ctx) {
				ctx.canvas.width = image.width;
				ctx.canvas.height = image.height;
				ctx.drawImage(image, 0, 0);
				return true;
			}
		} catch(ex) {}
		return false;
	}
	return this;
})();