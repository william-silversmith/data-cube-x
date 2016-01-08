

// Volume needs to lease the data cube
"use strict";

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Volume = (function () {
	function Volume(args) {
		_classCallCheck(this, Volume);

		this.channel_id = args.channel_id; // volume id as corresponding to the data server
		this.segmentation_id = args.segmentation_id;

		this.bounds = args.bounds;

		this.channel = args.channel; // a data cube
		this.segmentation = args.segmentation; // a segmentation cube

		if (!this.channel.clean) {
			this.channel.clear();
		}

		if (!this.segmentation.clean) {
			this.segmentation.clear();
		}

		this.requests = [];

		this.loadVolume(this.channel_id, this.channel);
		this.loadVolume(this.segmentation_id, this.segmentation);
	}

	_createClass(Volume, [{
		key: "killPending",
		value: function killPending() {
			this.requests.forEach(function (jqxhr) {
				jqxhr.abort();
			});
		}
	}, {
		key: "loadVolume",
		value: function loadVolume(vid, cube) {
			// 8 * 4 chunks + 4 single tiles per channel
			var _this = this;

			var specs = this.generateUrls(vid);

			var requests = [];

			specs.forEach(function (spec) {
				var jqxhr = $.getJSON(spec.url).done(function (results) {
					results.forEach(function (result) {
						decodeBase64Image(result.data).done(function (img) {
							cube.insertImage(img, spec.x, spec.y, spec.z);
						});
					});
				});

				requests.push(jqxhr);
			});

			$.when.apply($, requests).done(function () {
				cube.loaded = true;
			});

			this.requests.push.apply(this.requests, requests);

			function decodeBase64Image(base64) {
				var imageBuffer = new Image();

				var deferred = $.Deferred();

				imageBuffer.onload = function () {
					deferred.resolve(this);
				};

				imageBuffer.src = base64;

				return deferred;
			}
		}
	}, {
		key: "generateUrls",
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
})();

var DataCube = (function () {
	function DataCube(args) {
		_classCallCheck(this, DataCube);

		this.bytes = args.bytes || 1;
		this.size = args.size || { x: 256, y: 256, z: 256 };
		this.cube = this.materialize();

		this.canvas_context = this.createImageContext();

		this.clean = true;
		this.loaded = false;
	}

	// main

	_createClass(DataCube, [{
		key: "createImageContext",
		value: function createImageContext() {
			var canvas = document.createElement('canvas');
			canvas.width = this.size.x;
			canvas.height = this.size.y;

			return canvas.getContext('2d'); // used for accelerating XY plane image insertions
		}

		// This is an expensive operation
	}, {
		key: "materialize",
		value: function materialize() {
			var ArrayType = this.arrayType();

			var size = this.size;

			return new ArrayType(size.x * size.y * size.z);
		}
	}, {
		key: "clear",
		value: function clear() {
			this.cube.fill(0);
			this.clean = true;
			this.loaded = false;
		}

		/* insertSquare
   * 
   * Insert an XYZ aligned cube of data.
   */
	}, {
		key: "insertCube",
		value: function insertCube(subcube) {
			var offsetx = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
			var offsety = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];
			var offsetz = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

			var _this = this;

			// const xsize = _this.size.x,
			// 	ysize = _this.size.y,
			// 	zsize = _this.size.z;

			// offsetz *= xsize * ysize;

			// for (let i = 0; i < square.length; i++) {
			// 	let x = offsetx + (i % xsize),
			// 		y = offsety + (Math.floor(i / xsize));

			// 	_this.cube[x + xsize * y + offsetz] = square[i];
			// }

			_this.clean = false;
		}

		/* insertSquare
   * 
   * Insert an XY aligned plane of data into the cube.
   *
   * Square is a 1D array representing a 2D plane.
   */
	}, {
		key: "insertSquare",
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
		key: "insertImage",
		value: function insertImage(img) {
			var offsetx = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];
			var offsety = arguments.length <= 2 || arguments[2] === undefined ? 0 : arguments[2];
			var offsetz = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

			var _this = this;

			this.canvas_context.drawImage(img, 0, 0);
			var pixels = this.canvas_context.getImageData(0, 0, img.width, img.height).data; // Uint8ClampedArray
			var data32 = new Uint32Array(pixels.buffer); // creates a view, not an array

			var shifts = {
				1: 24,
				2: 16,
				4: 0
			};

			var rshift = shifts[this.bytes];

			// This solution of shifting the bits is elegant, but individual implementations
			// for 1, 2, and 4 bytes would be more efficient.

			var x = undefined,
			    y = undefined,
			    color = undefined;

			var sizex = _this.size.x,
			    width = img.width,
			    zadj = offsetz * _this.size.x * _this.size.y;

			for (var i = data32.length - 1; i >= 0; i--) {
				x = offsetx + i % width;
				y = offsety + ~ ~(i / width);

				color = data32[i] >>> rshift << rshift;

				// rgba -> abgr in byte order

				_this.cube[x + sizex * y + zadj] = color << 24 | (color & 0xff00) << 8 | (color & 0xff0000) >>> 8 | color >>> 24;
			}

			_this.clean = false;
		}

		// http://stackoverflow.com/questions/504030/javascript-endian-encoding
	}, {
		key: "isLittleEndian",
		value: function isLittleEndian() {
			var arr32 = new Uint32Array(1);
			var arr8 = new Uint8Array(arr32.buffer);
			arr32[0] = 255;

			return arr8[0] === 255;
		}
	}, {
		key: "get",
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
		key: "slice",
		value: function slice(axis, index) {
			var buffer = arguments.length <= 2 || arguments[2] === undefined ? null : arguments[2];

			var _this = this;

			var faces = {
				x: ['y', 'z'],
				y: ['x', 'z'],
				z: ['x', 'y']
			};

			if (index < 0 || index >= this.size[axis]) {
				throw new Error(index + ' is out of bounds.');
			}

			if (axis === 'z') {
				var offset = _this.size.x * _this.size.y;
				return _this.cube.subarray(offset * index, offset * (index + 1));
			}

			// note, contiguous z access is most efficient,
			// can use typedarray.subarray

			var face = faces[axis];
			var ArrayType = this.arrayType();

			var square = buffer || new ArrayType(this.size[face[0]] * this.size[face[1]]);

			var xsize = _this.size.x,
			    ysize = _this.size.y,
			    zsize = _this.size.z;

			var i = 0;
			if (axis === 'x') {
				for (var y = 0; y < ysize; y++) {
					for (var z = 0; z < zsize; z++) {
						square[i] = _this.cube[index + xsize * y + xsize * ysize * z];
						i++;
					}
				}
			} else if (axis === 'y') {
				// One day, this can be accellerated with ArrayBuffer.transfer which is like memcpy
				// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer

				// In the mean time, we can copy the x axis with a larger stride of 32 bits
				// if we're looking at 8 or 16 bit, just like with canvas

				if (_this.bytes === 1 && xsize % 4 === 0 || _this.bytes === 2 && xsize % 2 === 0) {

					var cube32 = new Uint32Array(_this.cube.buffer); // creates a view, not an array
					var square32 = new Uint32Array(square.buffer);

					var stride = _this.bytes === 1 ? 4 : 2;

					var xsize32 = xsize / stride;

					for (var x = 0; x < xsize32; x++) {
						for (var z = 0; z < zsize; z++) {
							square32[i] = cube32[x + xsize32 * index + xsize32 * ysize * z];
							i++;
						}
					}
				} else {
					// slow path, but only as slow as axis = x
					for (var x = 0; x < xsize; x++) {
						for (var z = 0; z < zsize; z++) {
							square[i] = _this.cube[x + xsize * index + xsize * ysize * z];
							i++;
						}
					}
				}
			}

			return square;
		}

		// see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
		// returns a data buffer suited to setting the canvas
	}, {
		key: "renderImageSlice",
		value: function renderImageSlice(context, axis, index) {
			var _this = this;

			var square = this.slice(axis, index);

			var sizes = {
				x: [_this.size.y, _this.size.z],
				y: [_this.size.x, _this.size.z],
				z: [_this.size.x, _this.size.y]
			};

			var size = sizes[axis];

			var imgdata = context.createImageData(size[0], size[1]);

			var bitmasks = {
				1: {
					r: [0xff, 0], // mask, zpad right shift
					g: [0x00, 0],
					b: [0x00, 0],
					a: [0x00, 0]
				},
				2: {
					r: [0xff00, 8],
					g: [0x00ff, 0],
					b: [0x0000, 0],
					a: [0x0000, 0]
				},
				4: {
					r: [0xff000000, 24],
					g: [0x00ff0000, 16],
					b: [0x0000ff00, 8],
					a: [0x000000ff, 0]
				}
			};

			var rmask = bitmasks[this.bytes].r[0],
			    gmask = bitmasks[this.bytes].g[0],
			    bmask = bitmasks[this.bytes].b[0];

			var rshift = bitmasks[this.bytes].r[1],
			    gshift = bitmasks[this.bytes].g[1],
			    bshift = bitmasks[this.bytes].b[1];

			// if we break this for loop up by bytes, we can extract extra performance.
			// If we want to handle transparency efficiently, you'll want to break out the
			// 32 bit case so you can avoid an if statement.

			// you can also avoid doing the assignment for index 1 and 2 for 8 bit, and 2 for 16 bit
			// This code seemed more elegant to me though, so I won't prematurely optimize.

			var data = imgdata.data;

			var i = data.length - 4;
			for (var _i = square.length - 1; _i >= 0; _i--) {
				data[_i + 0] = (square[_i] & rmask) >>> rshift;
				data[_i + 1] = (square[_i] & gmask) >>> gshift;
				data[_i + 2] = (square[_i] & bmask) >>> bshift;
				data[_i + 3] = 255; // can handle transparency specially if necessary

				_i -= 4;
			}

			context.putImageData(imgdata, 0, 0);
		}
	}, {
		key: "arrayType",
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
})();

var onebyte = new DataCube({ bytes: 1 });
var twobyte = new DataCube({ bytes: 2 });

var v = new Volume({ channel_id: 2988, segmentation_id: 15656, channel: onebyte, segmentation: twobyte });

