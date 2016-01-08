

// Volume needs to lease the data cube
class Volume {
	constructor (args) {
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

	killPending () {
		this.requests.forEach(function (jqxhr) {
			jqxhr.abort();
		});
	}

	loadVolume (vid, cube) {
		// 8 * 4 chunks + 4 single tiles per channel
		let _this = this;

		let specs = this.generateUrls(vid);

		let requests = [];

		specs.forEach(function (spec) {
			let jqxhr = $.getJSON(spec.url).done(function (results) {
				results.forEach(function (result) {
					decodeBase64Image(result.data).done(function (img) {
						cube.insertImage(img, spec.x, spec.y, spec.z);
					});
				});
			});

			requests.push(jqxhr);
		})

		$.when.apply($, requests).done(function () {
			cube.loaded = true;
		});

		this.requests.push.apply(this.requests, requests);

		function decodeBase64Image (base64) {
			let imageBuffer = new Image();

			let deferred = $.Deferred();

 		 	imageBuffer.onload = function () {
    			deferred.resolve(this);
  			};

  			imageBuffer.src = base64;

  			return deferred;
		}
	}

	generateUrls (vid) {
		let _this = this;

		let specs = [];

		let CHUNK_SIZE = 128,
			BUNDLE_SIZE = 64; // results in ~130kb downloads per request

		for (let x = 0; x <= 1; x++) {
			for (let y = 0; y <= 1; y++) {
				for (let z = 0; z <= 1; z++) {
					for (let range = 0; range <= CHUNK_SIZE - BUNDLE_SIZE; range += BUNDLE_SIZE) {
						specs.push({
							url: "http://cache.eyewire.org/volume/" + vid + "/chunk/0/" + x + "/" + y + "/" + z + "/tile/xy/" + range + ":" + (range + BUNDLE_SIZE),
							x: x * CHUNK_SIZE,
							y: y * CHUNK_SIZE,
							z: z * CHUNK_SIZE + range,
							width: CHUNK_SIZE,
							height: CHUNK_SIZE,
							depth: BUNDLE_SIZE,
						});
					}
				}
			}			
		}

		// handle current slice later

		return specs;
	}
}


class DataCube {
	constructor (args) {
		this.bytes = args.bytes || 1;
		this.size = args.size || { x: 256, y: 256, z: 256 };
		this.cube = this.materialize();

		this.canvas_context = this.createImageContext();

		this.clean = true;
		this.loaded = false;
	}

	createImageContext () {
		let canvas = document.createElement('canvas');
		canvas.width = this.size.x;
		canvas.height = this.size.y;

		return canvas.getContext('2d'); // used for accelerating XY plane image insertions
	}

	// This is an expensive operation
	materialize () {
		let ArrayType = this.arrayType();

		let size = this.size;

		return new ArrayType(size.x * size.y * size.z);
	}

	clear () {
		this.cube.fill(0);
		this.clean = true;
		this.loaded = false;
	}

	/* insertSquare
	 * 
	 * Insert an XYZ aligned cube of data.
	 */
	insertCube (subcube, offsetx = 0, offsety = 0, offsetz = 0) {
		let _this = this;

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
	insertSquare (square, width, offsetx = 0, offsety = 0, offsetz = 0) {
		let _this = this;

		const xsize = _this.size.x,
			ysize = _this.size.y,
			zsize = _this.size.z;

		offsetz *= xsize * ysize;

		for (let i = 0; i < square.length; i++) {
			let x = offsetx + (i % width),
				y = offsety + (Math.floor(i / width));

			_this.cube[x + xsize * y + offsetz] = square[i];
		}

		_this.clean = false;
	}

	insertImage (img, offsetx = 0, offsety = 0, offsetz = 0) {
		let _this = this;

		this.canvas_context.drawImage(img, 0, 0);
		let pixels = this.canvas_context.getImageData(0, 0, img.width, img.height).data; // Uint8ClampedArray
		let data32 = new Uint32Array(pixels.buffer); // creates a view, not an array

		let shifts = {
			1: 24,
			2: 16,
			4: 0,
		};

		const rshift = shifts[this.bytes];

		// This solution of shifting the bits is elegant, but individual implementations
		// for 1, 2, and 4 bytes would be more efficient.
		
		let x, y, color;
		
		const sizex = _this.size.x,
			  width = img.width,
			  zadj = offsetz * _this.size.x * _this.size.y;

		for (let i = data32.length - 1; i >= 0; i--) {
			x = offsetx + (i % width);
			y = offsety + (~~(i / width));

			color = (data32[i] >>> rshift << rshift);

			// rgba -> abgr in byte order

			_this.cube[x + sizex * y + zadj] = (
				(color << 24)
				| ((color & 0xff00) << 8)
				| ((color & 0xff0000) >>> 8) 
				| (color >>> 24)
			);
		}

		_this.clean = false;
	}

	// http://stackoverflow.com/questions/504030/javascript-endian-encoding
	isLittleEndian () {
		var arr32 = new Uint32Array(1);
		var arr8 = new Uint8Array(arr32.buffer);
		arr32[0] = 255;

		return arr8[0] === 255;
	}

	get (x, y = 0, z = 0) {
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
	slice (axis, index, buffer = null) {
		let _this = this;

		let faces = {
			x: ['y', 'z'],
			y: ['x', 'z'],
			z: ['x', 'y'],
		};

		if (index < 0 || index >= this.size[axis]) {
			throw new Error(index + ' is out of bounds.');
		}

		if (axis === 'z') { 
			let offset = _this.size.x * _this.size.y;
			return _this.cube.subarray(offset * index, offset * (index + 1));
		}

		// note, contiguous z access is most efficient,
		// can use typedarray.subarray

		let face = faces[axis];
		let ArrayType = this.arrayType();

		let square = buffer || (new ArrayType(this.size[face[0]] * this.size[face[1]]));

		const xsize = _this.size.x,
			ysize = _this.size.y,
			zsize = _this.size.z;
	
		let i = 0;
		if (axis === 'x') {
			for (let y = 0; y < ysize; y++) {
				for (let z = 0; z < zsize; z++) {
					square[i] = _this.cube[index + xsize * y + xsize * ysize * z];
					i++;
				}
			}
		}
		else if (axis === 'y') { 
			// One day, this can be accellerated with ArrayBuffer.transfer which is like memcpy
			// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/transfer

			// In the mean time, we can copy the x axis with a larger stride of 32 bits
			// if we're looking at 8 or 16 bit, just like with canvas

			if ((_this.bytes === 1 
					&& xsize % 4 === 0)
				|| (_this.bytes === 2
					&& xsize % 2 === 0)) {

				let cube32 = new Uint32Array(_this.cube.buffer); // creates a view, not an array
				let square32 = new Uint32Array(square.buffer);

				let stride = _this.bytes === 1 ? 4 : 2;

				const xsize32 = xsize / stride;

				for (let x = 0; x < xsize32; x++) {
					for (let z = 0; z < zsize; z++) {
						square32[i] = cube32[x + xsize32 * index + xsize32 * ysize * z];
						i++;
					}
				}
			}
			else { // slow path, but only as slow as axis = x
				for (let x = 0; x < xsize; x++) {
					for (let z = 0; z < zsize; z++) {
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
	renderImageSlice (context, axis, index) {
		let _this = this;

		let square = this.slice(axis, index);

		let sizes = {
			x: [ _this.size.y, _this.size.z ],
			y: [ _this.size.x, _this.size.z ],
			z: [ _this.size.x, _this.size.y ],
		};

		let size = sizes[axis];

		let imgdata = context.createImageData(size[0], size[1]);

		let bitmasks = {
			1: {
				r: [ 0xff, 0 ], // mask, zpad right shift
				g: [ 0x00, 0 ],
				b: [ 0x00, 0 ],
				a: [ 0x00, 0 ],
			},
			2: {
				r: [ 0xff00, 8 ],
				g: [ 0x00ff, 0 ],
				b: [ 0x0000, 0 ],
				a: [ 0x0000, 0 ], 
			},
			4: {
				r: [ 0xff000000, 24 ],
				g: [ 0x00ff0000, 16 ],
				b: [ 0x0000ff00, 8 ],
				a: [ 0x000000ff, 0 ],
			},
		};

		const rmask = bitmasks[this.bytes].r[0],
			gmask = bitmasks[this.bytes].g[0],
			bmask = bitmasks[this.bytes].b[0];

		const rshift = bitmasks[this.bytes].r[1],
			gshift = bitmasks[this.bytes].g[1],
			bshift = bitmasks[this.bytes].b[1];

		// if we break this for loop up by bytes, we can extract extra performance.
		// If we want to handle transparency efficiently, you'll want to break out the
		// 32 bit case so you can avoid an if statement.

		// you can also avoid doing the assignment for index 1 and 2 for 8 bit, and 2 for 16 bit
		// This code seemed more elegant to me though, so I won't prematurely optimize.

		let data = imgdata.data;

		let i = data.length - 4;
		for (let i = square.length - 1; i >= 0; i--) {
			data[i + 0] = (square[i] & rmask) >>> rshift; 
			data[i + 1] = (square[i] & gmask) >>> gshift;
			data[i + 2] = (square[i] & bmask) >>> bshift;
			data[i + 3] = 255; // can handle transparency specially if necessary
				
			i -= 4;
		}

		context.putImageData(imgdata, 0, 0);
	}

	arrayType () {
		let choices = {
			1: Uint8ClampedArray,
			2: Uint16Array,
			4: Uint32Array,
		};

		let ArrayType = choices[this.bytes];

		if (ArrayType === undefined) {
			throw new Error(this.bytes + ' is not a valid typed array byte count.');
		}

		return ArrayType;
	}
}


// main

var onebyte = new DataCube({ bytes: 1 });
var twobyte = new DataCube({ bytes: 2 });

var v = new Volume({ channel_id: 2988, segmentation_id: 15656, channel: onebyte, segmentation: twobyte });








