# data-cube-x
DATACUBE. YOU WILL BE ASSIMILATED. Optimized prototype 3D image stack for the web.

SEE https://github.com/seung-lab/data-cube-x

Demonstrates the power and efficiency of materializing downloaded images into a 3D array, 
enabling slicing in xy, xz, and zy without downloading extra data and providing a sensible
architecture for accessing cube information.

Requires jQuery and gulp.

# Setup

Run gulp without arguments in the directory, you can now access the index.html page.

# Example Usage

The datacube consists of two objects, one, Volume, directly relevant to Eyewire, the other, Datacube, is generally useful for representing 3D images.

    // let channelctx and segctx represent some canvas contexts for channel and segmentation

	var vol = new Volume({ 
		task_id: 332,
		channel: new DataCube({ bytes: 1 }), 
		segmentation: new DataCube({ bytes: 2 }), 
	});

	// Direct cube access version

	vol.load().done(function () {
		vol.channel.renderGrayImageSlice(channelctx, 'x', 0); // these should be synchronized
		vol.segmentation.renderImageSlice(segctx, 'x', 0); 
	})

	// Checkerboard version

	vol.load().done(function () {
		vol.renderChannelImage(channelctx, 'x', 0); // these should be synchronized
		vol.renderSegmentationImage(segctx, 'x', 0); 
	})

You can also access the cube data as squares -- planes that cut through the cube on an axis:

	vol.channel.slice('x', 52) => 1D array of 8 bit values, arranged as x,y,z
	vol.segmentation.slice('z', 156) => 1D array of 16 bit values, arranged as x,y,z

You can grab single values:

	vol.channel.get(35, 12, 0) => Single integer value at x=35, y=12, z=0

...or if you really need to, you can access the cube directly:

	vol.channel.cube => 1D array representing the whole 3D cube

vol.size.x, vol.size.y, vol.size.z gives you the parameters neceessary to work with that





