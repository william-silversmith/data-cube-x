

// Volume needs to lease the data cube
class Volume {
	constructor (args) {
		this.channel_id = args.channel_id; // volume id as corresponding to the data server
		this.segmentation_id = args.segmentation_id; 

		this.bounds = args.bounds;

		this.channel = args.channel; // a data cube
		this.segmentation = args.segmentation; // a segmentation cube

		this.requests = [];
	}

	load () {
		let _this = this;

		if (!this.channel.clean) {
			this.channel.clear();
		}

		if (!this.segmentation.clean) {
			this.segmentation.clear();
		}

		this.requests = [];

		// let channel_promise = this.loadVolume(this.channel_id, this.channel);
		let channel_promise = this.loadMovieVolume('./channel/channel.webm', this.channel);
		let seg_promise = this.loadVolume(this.segmentation_id, this.segmentation);

		return $.when(channel_promise, seg_promise).always(function () {
			_this.requests = [];
		});
	}

	loadingProgress () {
		if (this.segmentation.loaded && this.channel.loaded) {
			return 1;
		}
		else if (this.segmentation.clean && this.channel.clean) {
			return 0;
		}
		else if (this.requests.length === 0) {
			return 0;
		}

		let specs = this.generateUrls();

		let resolved = this.requests.filter(req => req.state() === 'resolved');
		return resolved.length / (2 * specs.length);
	}

	killPending () {
		this.requests.forEach(function (jqxhr) {
			jqxhr.abort();
		});
	}

	fakeLoad () {
		if (!this.channel.clean) {
			this.channel.clear();
		}

		if (!this.segmentation.clean) {
			this.segmentation.clear();
		}

		let channel_promise = this.fakeLoadVolume(this.channel_id, this.channel);
		let seg_promise = this.fakeLoadVolume(this.segmentation_id, this.segmentation);

		return $.when(channel_promise, seg_promise);
	}

	fakeLoadVolume (vid, cube) {
		// 8 * 4 chunks + 4 single tiles per channel
		let _this = this;

		let specs = this.generateUrls(vid);

		specs.forEach(function (spec) {
			let img = new Image(128, 128); // test code
			for (let i = 0; i < spec.depth; i++) {
				cube.insertImage(img, spec.x, spec.y, spec.z + i);
			}
		});

		return $.Deferred().resolve().done(function () { // test code
			cube.loaded = true;
		});
	}


	loadMovieVolume (url, cube) {
		// 8 * 4 chunks + 4 single tiles per channel
		let _this = this;

		let video = $('<video>')[0];
		video.src = url;
		video.width = cube.size.x;
		video.height = cube.size.y;
		video.id = 'v';

		$('body').append(video);
		$(video).css({
			position: 'absolute',
			right: "10px",
			top: "10px",
		})

		let canvas = document.createElement('canvas');

		let frame = 0;

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

		video.addEventListener('loadeddata', function() {
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

			var sec = (frame / cube.size.z) * video.duration;
			video.currentTime = sec;
		});

		function captureFrame (video, z) {
			let ctx = canvas.getContext('2d');
			ctx.drawImage(video, 0, 0, video.width, video.height);
			cube.insertCanvas(canvas, 0, 0, z);
			$('#captures').text(z + 1);
		}

		return $.Deferred().resolve();
	}

	loadVolume (vid, cube) {
		// 8 * 4 chunks + 4 single tiles per channel
		let _this = this;

		let specs = this.generateUrls(vid);

		let requests = [];

		specs.forEach(function (spec) {
			function decodeAndInsertImages (results) {
				let z = 0;
				results.forEach(function (result) {
					decodeBase64Image(result.data, z).done(function (imgz) {
						cube.insertImage(imgz.img, spec.x, spec.y, spec.z + imgz.z);
					});

					z++;
				});
			}

			let jqxhr = $.getJSON(spec.url)
				.done(decodeAndInsertImages)
				.fail(function () { // If it fails, one retry.
					setTimeout(function () {
						$.getJSON(spec.url)
							.done(decodeAndInsertImages)
							.fail(function () {
								console.error(spec.url + ' failed to load.');
							});
					}, 1000);
				})

			requests.push(jqxhr);
		})

		this.requests.push.apply(this.requests, requests);

		return $.when.apply($, requests).done(function () {
			cube.loaded = true;
		});

		function decodeBase64Image (base64, z) {
			let imageBuffer = new Image();

			let deferred = $.Deferred();

 		 	imageBuffer.onload = function () {
    			deferred.resolve({
    				img: this,
    				z: z,
    			});
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

	insertCanvas (canvas, offsetx = 0, offsety = 0, offsetz = 0) {
		let ctx = canvas.getContext('2d');
		let imgdata = ctx.getImageData(0, 0, canvas.width, canvas.height);
		this.insertImageData(imgdata, canvas.width, offsetx, offsety, offsetz);
	}

	insertImage (img, offsetx = 0, offsety = 0, offsetz = 0) {
		this.canvas_context.drawImage(img, 0, 0);
		let imgdata = this.canvas_context.getImageData(0, 0, img.width, img.height);
		this.insertImageData(imgdata, img.width, offsetx, offsety, offsetz);
	}

	insertImageData (imgdata, width, offsetx, offsety, offsetz) {
		let _this = this;

		let pixels = imgdata.data; // Uint8ClampedArray
		let data32 = new Uint32Array(pixels.buffer); // creates a view, not an array

		// Note: on little endian machine, data32 is 0xaabbggrr, so it's already flipped

		let shifts = {
			1: 24,
			2: 16,
			4: 0,
		};

		const shift = shifts[this.bytes];

		// This solution of shifting the bits is elegant, but individual implementations
		// for 1, 2, and 4 bytes would be more efficient.
		
		let x, y, color;
		
		const sizex = _this.size.x,
			  zadj = offsetz * _this.size.x * _this.size.y;

		if (this.isLittleEndian()) {
			for (let i = data32.length - 1; i >= 0; i--) {
				x = offsetx + (i % width);
				y = offsety + (~~(i / width)); // ~~ is bit twidling Math.floor using bitwise not

				_this.cube[x + sizex * y + zadj] = (data32[i] << shift >>> shift);	
			}
		}
		else {
			for (let i = data32.length - 1; i >= 0; i--) {
				x = offsetx + (i % width);
				y = offsety + (~~(i / width)); // ~~ is bit twidling Math.floor using bitwise not

				color = (data32[i] >>> shift << shift);

				// rgba -> abgr in byte order

				_this.cube[x + sizex * y + zadj] = (
					(color << 24)
					| ((color & 0xff00) << 8)
					| ((color & 0xff0000) >>> 8) 
					| (color >>> 24)
				);
			}
		}

		_this.clean = false;
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

		if (index < 0 || index >= this.size[axis]) {
			throw new Error(index + ' is out of bounds.');
		}

		const xsize = _this.size.x,
			ysize = _this.size.y,
			zsize = _this.size.z;

		const xysize = xsize * ysize;

		// Go super fast... just because we can
		if (axis === 'z' && !buffer) {
			return _this.cube.subarray(xysize * index, xysize * (index + 1));
		}

		let faces = {
			x: ['y', 'z'],
			y: ['x', 'z'],
			z: ['x', 'y'],
		};

		let face = faces[axis];
		let ArrayType = this.arrayType();

		let square = buffer || (new ArrayType(this.size[face[0]] * this.size[face[1]]));

		let i = square.length - 1;
		if (axis === 'x') {
			for (let y = ysize - 1; y >= 0; --y) {
				for (let z = zsize - 1; z >= 0; --z) {
					square[i] = _this.cube[index + xsize * y + xysize * z];
					--i;
				}
			}
		}
		else if (axis === 'y') {
			const yoffset = xsize * index;
			for (let x = xsize - 1; x >= 0; --x) {
				for (let z = zsize - 1; z >= 0; --z) {
					square[i] = _this.cube[x + yoffset + xysize * z];
					--i;
				}
			}
		}
		else if (axis === 'z') { 
			const zoffset = xysize * index;
			for (let x = xsize - 1; x >= 0; --x) {
				for (let y = ysize - 1; y >= 0; --y) {
					square[i] = _this.cube[x + xsize * y + zoffset];
					--i;
				}
			}
		}

		return square;
	}

	// see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Pixel_manipulation_with_canvas
	// returns a data buffer suited to setting the canvas
	imageSlice (axis, index) {
		let _this = this;

		let square = this.slice(axis, index);

		let sizes = {
			x: [ _this.size.y, _this.size.z ],
			y: [ _this.size.x, _this.size.z ],
			z: [ _this.size.x, _this.size.y ],
		};

		let size = sizes[axis];

		let imgdata = this.canvas_context.createImageData(size[0], size[1]);

		let maskset = this.getRenderMaskSet();

		const rmask = maskset.r,
			gmask = maskset.g,
			bmask = maskset.b,
			amask = maskset.a;

		// if we break this for loop up by bytes, we can extract extra performance.
		// If we want to handle transparency efficiently, you'll want to break out the
		// 32 bit case so you can avoid an if statement.

		// you can also avoid doing the assignment for index 1 and 2 for 8 bit, and 2 for 16 bit
		// This code seemed more elegant to me though, so I won't prematurely optimize.

		let data = imgdata.data;

		let fixedalpha = this.bytes === 4 // no alpha channel w/ less than 4 bytes
			? 0x00000000 
			: 0xffffffff;

		let di = data.length - 4;
		for (let si = square.length - 1; si >= 0; si--) {
			data[di + 0] = (square[si] & rmask); 
			data[di + 1] = (square[si] & gmask) >>> 8;
			data[di + 2] = (square[si] & bmask) >>> 16;
			data[di + 3] = ((square[si] & amask) | fixedalpha) >>> 24; // can handle transparency specially if necessary
				
			di -= 4;
		}

		return imgdata;
	}

	grayImageSlice (axis, index) {
		let _this = this;

		let square = this.slice(axis, index);

		let sizes = {
			x: [ _this.size.y, _this.size.z ],
			y: [ _this.size.x, _this.size.z ],
			z: [ _this.size.x, _this.size.y ],
		};

		let size = sizes[axis];

		let imgdata = this.canvas_context.createImageData(size[0], size[1]);

		let maskset = this.getRenderMaskSet();

		const rmask = maskset.r;
		let data = imgdata.data;

		let di = data.length - 4;
		for (let si = square.length - 1; si >= 0; si--) {
			data[di + 0] = (square[si] & rmask); 
			data[di + 1] = (square[si] & rmask);
			data[di + 2] = (square[si] & rmask);
			data[di + 3] = 255; 
				
			di -= 4;
		}

		return imgdata;
	}

	renderImageSlice (context, axis, index) {
		var imgdata = this.imageSlice(axis, index);
		context.putImageData(imgdata, 0, 0);
	}

	renderGrayImageSlice (context, axis, index) {
		var imgdata = this.grayImageSlice(axis, index);
		context.putImageData(imgdata, 0, 0);
	}

	// http://stackoverflow.com/questions/504030/javascript-endian-encoding
	isLittleEndian () {
		var arr32 = new Uint32Array(1);
		var arr8 = new Uint8Array(arr32.buffer);
		arr32[0] = 255;

		return arr8[0] === 255;
	}

	getRenderMaskSet () {
		let bitmasks = {
			true: { // little endian, most architectures
				r: 0x000000ff,
				g: 0x0000ff00,
				b: 0x00ff0000,
				a: 0xff000000,
			},
			false: { // big endian, mostly ARM and some specialized equipment
				r: 0xff000000,
				g: 0x00ff0000,
				b: 0x0000ff00,
				a: 0x000000ff,
			},
		};

		return bitmasks[this.isLittleEndian()];
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







