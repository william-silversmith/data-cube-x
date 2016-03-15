'use strict';

var Stream = (function stream() {
  function constructor(url) {
    this.url = url;
  }
  
  constructor.prototype = {
    readAll: function(progress, complete) {
      var xhr = new XMLHttpRequest();
      xhr.open("GET", this.url, true);
      xhr.responseType = "arraybuffer";

      xhr.onload = function (event, status) {
        console.log(event, status);
        console.log('response', xhr.response);
        complete(xhr.response);
      };

      xhr.send();
    }
  };
  return constructor;
})();
