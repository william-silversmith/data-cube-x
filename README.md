# data-cube-x
DATACUBE. YOU WILL BE ASSIMILATED. Optimized prototype 3D image stack for the web.

Demonstrates the power and efficiency of materializing downloaded images into a 3D array, 
enabling slicing in xy, xz, and zy without downloading extra data and providing a sensible
architecture for accessing cube information.

Requires jQuery.

# Example Usage

The datacube consists of two objects, one, Volume, directly relevant to Eyewire, the other, Datacube, is generally useful for representing 3D images.

// let channelctx and segctx represent 

var vol = new Volume({ 
	channel_id: 2988, 
	segmentation_id: 15656, 
	channel: new DataCube({ bytes: 1 }), 
	segmentation: new DataCube({ bytes: 2 }), 
});

vol.load().done(function () {
	vol.channel.renderGrayImageSlice(channelctx, AXIS, SLICE);
	vol.segmentation.renderImageSlice(segctx, AXIS, SLICE);
})




