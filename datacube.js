'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Volume needs to lease the data cube

var Volume = function () {
	function Volume(args) {
		_classCallCheck(this, Volume);

		this.channel_id = args.channel_id; // volume id as corresponding to the data server
		this.segmentation_id = args.segmentation_id;

		this.bounds = args.bounds;

		this.channel = args.channel; // a data cube
		this.segmentation = args.segmentation; // a segmentation cube

		this.requests = [];
	}

	_createClass(Volume, [{
		key: 'load',
		value: function load() {
			var _this = this;

			if (!this.channel.clean) {
				this.channel.clear();
			}

			if (!this.segmentation.clean) {
				this.segmentation.clear();
			}

			this.requests = [];

			// let channel_promise = this.loadVolume(this.channel_id, this.channel);
			var channel_promise = this.loadMovieVolume('./channel/channel.webm', this.channel);
			var seg_promise = this.loadVolume(this.segmentation_id, this.segmentation);

			return $.when(channel_promise, seg_promise).always(function () {
				_this.requests = [];
			});
		}
	}, {
		key: 'loadingProgress',
		value: function loadingProgress() {
			if (this.segmentation.loaded && this.channel.loaded) {
				return 1;
			} else if (this.segmentation.clean && this.channel.clean) {
				return 0;
			} else if (this.requests.length === 0) {
				return 0;
			}

			var specs = this.generateUrls();

			var resolved = this.requests.filter(function (req) {
				return req.state() === 'resolved';
			});
			return resolved.length / (2 * specs.length);
		}
	}, {
		key: 'killPending',
		value: function killPending() {
			this.requests.forEach(function (jqxhr) {
				jqxhr.abort();
			});
		}
	}, {
		key: 'fakeLoad',
		value: function fakeLoad() {
			if (!this.channel.clean) {
				this.channel.clear();
			}

			if (!this.segmentation.clean) {
				this.segmentation.clear();
			}

			var channel_promise = this.fakeLoadVolume(this.channel_id, this.channel);
			var seg_promise = this.fakeLoadVolume(this.segmentation_id, this.segmentation);

			return $.when(channel_promise, seg_promise);
		}
	}, {
		key: 'fakeLoadVolume',
		value: function fakeLoadVolume(vid, cube) {
			// 8 * 4 chunks + 4 single tiles per channel
			var _this = this;

			var specs = this.generateUrls(vid);

			specs.forEach(function (spec) {
				var img = new Image(128, 128); // test code
				for (var i = 0; i < spec.depth; i++) {
					cube.insertImage(img, spec.x, spec.y, spec.z + i);
				}
			});

			return $.Deferred().resolve().done(function () {
				// test code
				cube.loaded = true;
			});
		}
	}, {
		key: 'loadMovieVolume',
		value: function loadMovieVolume(url, cube) {
			// 8 * 4 chunks + 4 single tiles per channel
			var _this = this;

			var video = $('<video>')[0];
			video.src = url;
			video.width = cube.size.x;
			video.height = cube.size.y;
			video.id = 'v';

			$('body').append(video);
			$(video).css({
				position: 'absolute',
				right: "10px",
				top: "10px"
			});

			var canvas = document.createElement('canvas');

			var frame = 0;

			// video.addEventListener('loadeddata', function() {
			// 	canvas.width = video.width;
			// 	canvas.height = video.height;

			// 	video.currentTime = 0;

			// 	let frame_duration = video.duration / cube.size.z * 1000; // msec

			// 	video.playbackRate = 1;
			// 	frame_duration /= video.playbackRate;

			// 	let captureloop;

			// 	let start = window.performance.now();

			// 	let framesinserted = {};

			// 	function playcapture (fn) {
			// 		fn = fn || function () {};
			// 		requestAnimationFrame(function loop () {
			// 			let frame = Math.floor((performance.now() - start) / frame_duration);

			// 			if (!framesinserted[frame]) {
			// 				captureFrame(video, frame);
			// 				framesinserted[frame] = true;
			// 			}

			// 			if (frame < cube.size.z) {
			// 				requestAnimationFrame(loop);
			// 			}
			// 			else {
			// 				fn();
			// 			}
			// 		});

			// 		video.play();
			// 	}

			// 	playcapture(function () {
			// 		console.log("wow")
			// 		video.currentTime = 0;
			// 		playcapture();
			// 	})
			// });

			video.addEventListener('loadeddata', function () {
				canvas.width = video.width;
				canvas.height = video.height;

				video.currentTime = 0;
			});

			video.addEventListener('seeked', function () {
				if (frame >= cube.size.z) {
					return;
				}

				captureFrame(video, frame);

				frame++;

				var sec = frame / cube.size.z * video.duration;
				video.currentTime = sec;
			});

			function captureFrame(video, z) {
				var ctx = canvas.getContext('2d');
				ctx.drawImage(video, 0, 0, video.width, video.height);
				cube.insertCanvas(canvas, 0, 0, z);
				$('#captures').text(z + 1);
			}

			return $.Deferred().resolve();
		}
	}, {
		key: 'loadVolume',
		value: function loadVolume(vid, cube) {
			// 8 * 4 chunks + 4 single tiles per channel
			var _this = this;

			var specs = this.generateUrls(vid);

			var requests = [];

			specs.forEach(function (spec) {
				function decodeAndInsertImages(results) {
					var z = 0;
					results.forEach(function (result) {
						decodeBase64Image(result.data, z).done(function (imgz) {
							cube.insertImage(imgz.img, spec.x, spec.y, spec.z + imgz.z);
						});

						z++;
					});
				}

				var jqxhr = $.getJSON(spec.url).done(decodeAndInsertImages).fail(function () {
					// If it fails, one retry.
					setTimeout(function () {
						$.getJSON(spec.url).done(decodeAndInsertImages).fail(function () {
							console.error(spec.url + ' failed to load.');
						});
					}, 1000);
				});

				requests.push(jqxhr);
			});

			this.requests.push.apply(this.requests, requests);

			return $.when.apply($, requests).done(function () {
				cube.loaded = true;
			});

			function decodeBase64Image(base64, z) {
				var imageBuffer = new Image();

				var deferred = $.Deferred();

				imageBuffer.onload = function () {
					deferred.resolve({
						img: this,
						z: z
					});
				};

				imageBuffer.src = base64;

				return deferred;
			}
		}
	}, {
		key: 'generateUrls',
		value: function generateUrls(vid) {
			var _this = this;

			var specs = [];

			var CHUNK_SIZE = 128,
			    BUNDLE_SIZE = 64; // results in ~130kb downloads per request

			for (var x = 0; x <= 1; x++) {
				for (var y = 0; y <= 1; y++) {
					for (var z = 0; z <= 1; z++) {
						for (var range = 0; range <= CHUNK_SIZE - BUNDLE_SIZE; range += BUNDLE_SIZE) {
							specs.push({
								url: "http://cache.eyewire.org/volume/" + vid + "/chunk/0/" + x + "/" + y + "/" + z + "/tile/xy/" + range + ":" + (range + BUNDLE_SIZE),
								x: x * CHUNK_SIZE,
								y: y * CHUNK_SIZE,
								z: z * CHUNK_SIZE + range,
								width: CHUNK_SIZE,
								height: CHUNK_SIZE,
								depth: BUNDLE_SIZE
							});
						}
					}
				}
			}

			// handle current slice later

			return specs;
		}
	}]);

	return Volume;
}();

var DataCube = function () {
	function DataCube(args) {
		_classCallCheck(this, DataCube);

		this.bytes = args.bytes || 1;
		this.size = args.size || { x: 256, y: 256, z: 256 };
		this.cube = this.materialize();

		this.canvas_context = this.createImageContext();

		this.clean = true;
		this.loaded = false;
	}

	_createClass(DataCube, [{
		key: 'createImageContext',
		value: function createImageContext() {
			var canvas = document.createElement('canvas');
			canvas.width = this.size.x;
			canvas.height = this.size.y;

			return canvas.getContext('2d'); // used for accelerating XY plane image insertions
		}

		// This is an expensive operation

	}, {
		key: 'materialize',
		value: function materialize() {
			var ArrayType = this.arrayType();

			var size = this.size;

			return new ArrayType(size.x * size.y * size.z);
		}
	}, {
		key: 'clear',
		value: function clear() {
			this.cube.fill(0);
			this.clean = true;
			this.loaded = false;
		}

		/* insertSquare
   * 
   * Insert an XY aligned plane of data into the cube.
   *
   * Square is a 1D array representing a 2D plane.
   */

	}, {
		key: 'insertSquare',
		value: function insertSquare(square, width) {
			var offsetx = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];
			var offsety = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];
			var offsetz = arguments.length <= 4 || arguments[4] === undefined ? 0 : arguments[4];

			var _this = this;

			var xsize = _this.size.x,
			    ysize = _this.size.y,
			    zsize = _this.size.z;

			offsetz *= xsize * ysize;

			for (var i = 0; i < square.length; i++) {
				var x = offsetx + i % width,
				    y = offsety + Math.floor(i / width);

				_this.cube[x + xsize * y + offsetz] = square[i];
			}

			_this.clean = false;
		}
	}, {
		key: 'insertCanvas',
		value: function insertCanvas(canvas) {
			var offsetx = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
			var offsety = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];
			var offsetz = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

			var ctx = canvas.getContext('2d');
			var imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
			this.insertImageData(imgdata, canvas.width, offsetx, offsety, offsetz);
		}
	}, {
		key: 'insertImage',
		value: function insertImage(img) {
			var offsetx = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
			var offsety = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];
			var offsetz = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

			this.canvas_context.drawImage(img, 0, 0);
			var imgdata = this.canvas_context.getImageData(0, 0, img.width, img.height);
			this.insertImageData(imgdata, img.width, offsetx, offsety, offsetz);
		}
	}, {
		key: 'insertImageData',
		value: function insertImageData(imgdata, width, offsetx, offsety, offsetz) {
			var _this = this;

			var pixels = imgdata.data; // Uint8ClampedArray
			var data32 = new Uint32Array(pixels.buffer); // creates a view, not an array

			// Note: on little endian machine, data32 is 0xaabbggrr, so it's already flipped

			var shifts = {
				1: 24,
				2: 16,
				4: 0
			};

			var shift = shifts[this.bytes];

			// This solution of shifting the bits is elegant, but individual implementations
			// for 1, 2, and 4 bytes would be more efficient.

			var x = undefined,
			    y = undefined,
			    color = undefined;

			var sizex = _this.size.x,
			    zadj = offsetz * _this.size.x * _this.size.y;

			if (this.isLittleEndian()) {
				for (var i = data32.length - 1; i >= 0; i--) {
					x = offsetx + i % width;
					y = offsety + ~ ~(i / width); // ~~ is bit twidling Math.floor using bitwise not

					_this.cube[x + sizex * y + zadj] = data32[i] << shift >>> shift;
				}
			} else {
				for (var i = data32.length - 1; i >= 0; i--) {
					x = offsetx + i % width;
					y = offsety + ~ ~(i / width); // ~~ is bit twidling Math.floor using bitwise not

					color = data32[i] >>> shift << shift;

					// rgba -> abgr in byte order

					_this.cube[x + sizex * y + zadj] = color << 24 | (color & 0xff00) << 8 | (color & 0xff0000) >>> 8 | color >>> 24;
				}
			}

			_this.clean = false;
		}
	}, {
		key: 'get',
		value: function get(x) {
			var y = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
			var z = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];

			return this.cube[x + this.size.x * y + this.size.x * this.size.y * z];
		}

		/* Return a 2D slice of the data cube as a 1D array 
   * of the same type.
   * 
   * x axis gets a yz plane, y gets xz, and z gets xy.
   *
   * z slicing is accelerated compared to the other two.
   *
   * Required:
   *   axis: x, y, or z
   *   index: 0 to size - 1 on that axis
   *   
   * Optional:
   *    buffer: Write to this provided buffer instead of making one
   *
   * Return: 1d array
   */

	}, {
		key: 'slice',
		value: function slice(axis, index) {
			var buffer = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

			var _this = this;

			if (index < 0 || index >= this.size[axis]) {
				throw new Error(index + ' is out of bounds.');
			}

			var xsize = _this.size.x,
			    ysize = _this.size.y,
			    zsize = _this.size.z;

			var xysize = xsize * ysize;

			// Go super fast... just because we can
			if (axis === 'z' && !buffer) {
				return _this.cube.subarray(xysize * index, xysize * (index + 1));
			}

			var faces = {
				x: ['y', 'z'],
				y: ['x', 'z'],
				z: ['x', 'y']
			};

			var face = faces[axis];
			var ArrayType = this.arrayType();

			var square = buffer || new ArrayType(this.size[face[0]] * this.size[face[1]]);

			var i = square.length - 1;
			if (axis === 'x') {
				for (var y = ysize - 1; y >= 0; --y) {
					for (var z = zsize - 1; z >= 0; --z) {
						square[i] = _this.cube[index + xsize * y + xysize * z];
						--i;
					}
				}
			} else if (axis === 'y') {
				var yoffset = xsize * index;
				for (var x = xsize - 1; x >= 0; --x) {
					for (var z = zsize - 1; z >= 0; --z) {
						square[i] = _this.cube[x + yoffset + xysize * z];
						--i;
					}
				}
			} else if (axis === 'z') {
				var zoffset = xysize * index;
				for (var x = xsize - 1; x >= 0; --x) {
					for (var y = ysize - 1; y >= 0; --y) {
						square[i] = _this.cube[x + xsize * y + zoffset];
						--i;
					}
				}
			}

			return square;
		}

		// see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
		// returns a data buffer suited to setting the canvas

	}, {
		key: 'imageSlice',
		value: function imageSlice(axis, index) {
			var _this = this;

			var square = this.slice(axis, index);

			var sizes = {
				x: [_this.size.y, _this.size.z],
				y: [_this.size.x, _this.size.z],
				z: [_this.size.x, _this.size.y]
			};

			var size = sizes[axis];

			var imgdata = this.canvas_context.createImageData(size[0], size[1]);

			var maskset = this.getRenderMaskSet();

			var rmask = maskset.r,
			    gmask = maskset.g,
			    bmask = maskset.b,
			    amask = maskset.a;

			// if we break this for loop up by bytes, we can extract extra performance.
			// If we want to handle transparency efficiently, you'll want to break out the
			// 32 bit case so you can avoid an if statement.

			// you can also avoid doing the assignment for index 1 and 2 for 8 bit, and 2 for 16 bit
			// This code seemed more elegant to me though, so I won't prematurely optimize.

			var data = imgdata.data;

			var fixedalpha = this.bytes === 4 // no alpha channel w/ less than 4 bytes
			? 0x00000000 : 0xffffffff;

			var di = data.length - 4;
			for (var si = square.length - 1; si >= 0; si--) {
				data[di + 0] = square[si] & rmask;
				data[di + 1] = (square[si] & gmask) >>> 8;
				data[di + 2] = (square[si] & bmask) >>> 16;
				data[di + 3] = (square[si] & amask | fixedalpha) >>> 24; // can handle transparency specially if necessary

				di -= 4;
			}

			return imgdata;
		}
	}, {
		key: 'grayImageSlice',
		value: function grayImageSlice(axis, index) {
			var _this = this;

			var square = this.slice(axis, index);

			var sizes = {
				x: [_this.size.y, _this.size.z],
				y: [_this.size.x, _this.size.z],
				z: [_this.size.x, _this.size.y]
			};

			var size = sizes[axis];

			var imgdata = this.canvas_context.createImageData(size[0], size[1]);

			var maskset = this.getRenderMaskSet();

			var rmask = maskset.r;
			var data = imgdata.data;

			var di = data.length - 4;
			for (var si = square.length - 1; si >= 0; si--) {
				data[di + 0] = square[si] & rmask;
				data[di + 1] = square[si] & rmask;
				data[di + 2] = square[si] & rmask;
				data[di + 3] = 255;

				di -= 4;
			}

			return imgdata;
		}
	}, {
		key: 'renderImageSlice',
		value: function renderImageSlice(context, axis, index) {
			var imgdata = this.imageSlice(axis, index);
			context.putImageData(imgdata, 0, 0);
		}
	}, {
		key: 'renderGrayImageSlice',
		value: function renderGrayImageSlice(context, axis, index) {
			var imgdata = this.grayImageSlice(axis, index);
			context.putImageData(imgdata, 0, 0);
		}

		// http://stackoverflow.com/questions/504030/javascript-endian-encoding

	}, {
		key: 'isLittleEndian',
		value: function isLittleEndian() {
			var arr32 = new Uint32Array(1);
			var arr8 = new Uint8Array(arr32.buffer);
			arr32[0] = 255;

			return arr8[0] === 255;
		}
	}, {
		key: 'getRenderMaskSet',
		value: function getRenderMaskSet() {
			var bitmasks = {
				true: { // little endian, most architectures
					r: 0x000000ff,
					g: 0x0000ff00,
					b: 0x00ff0000,
					a: 0xff000000
				},
				false: { // big endian, mostly ARM and some specialized equipment
					r: 0xff000000,
					g: 0x00ff0000,
					b: 0x0000ff00,
					a: 0x000000ff
				}
			};

			return bitmasks[this.isLittleEndian()];
		}
	}, {
		key: 'arrayType',
		value: function arrayType() {
			var choices = {
				1: Uint8ClampedArray,
				2: Uint16Array,
				4: Uint32Array
			};

			var ArrayType = choices[this.bytes];

			if (ArrayType === undefined) {
				throw new Error(this.bytes + ' is not a valid typed array byte count.');
			}

			return ArrayType;
		}
	}]);

	return DataCube;
}();