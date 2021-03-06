/**
 * PhantomHigh
 * Adapted from highcharts downloaded bundle and added serving capability
 * Dimas Priyanto (dimas.priyanto@gmail.com) - March 2013
 */

/*global window, require, phantom, console, $, document, Image, Highcharts, clearTimeout, options */


var app_conf = {
  SERVER_PORT: 3333,
  LOG: 'log/',
  TMP: 'tmp/'
}

var server, service;

server = require('webserver').create();
service = server.listen(app_conf.SERVER_PORT, function(request, response){

  (function () {
    "use strict";

    var config = {
      /* define locations of mandatory javascript files */
      HIGHCHARTS: 'src/Highcharts-2.3.5/js/highcharts.js',
      HIGHCHARTS_MORE: 'src/Highcharts-2.3.5/js/highcharts-more.js',
      JQUERY: 'src/jQuery/jquery-1.9.1.js'
    },
    /* Internal */
      page = require('webpage').create(),
      fs = require('fs'),
      system = require('system'),
      args,
      HC = {},
      pick,
      mapArguments,
      scaleAndClipPage,
      input,
      constr,
      callback,
      width,
      callbackStr,
      optionsStr,
      output,
      outputExtension,
      pdfOutput,
      svg,
      svgFile,
      svgElem,
      timer;

    HC.imagesLoaded = 'Highcharts.imagesLoaded:7a7dfcb5df73aaa51e67c9f38c5b07cb';
    window.imagesLoaded = false;

    page.onConsoleMessage = function (msg) {
      console.log(msg);
      /*
       * Ugly hack, but only way to get messages out of the 'page.evaluate()'
       * sandbox. If any, please contribute with improvements on this!
       */
      if (msg === HC.imagesLoaded) {
        window.imagesLoaded = true;
      }
    };

    page.onAlert = function (msg) {
      console.log(msg);
    };

    pick = function () {
      var args = arguments, i, arg, length = args.length;
      for (i = 0; i < length; i += 1) {
        arg = args[i];
        if (arg !== undefined && arg !== null && arg !== 'null' && arg != '0') {
          return arg;
        }
      }
    };

    mapArguments = function () {
      var map = {},
        i;
      for (i = 0; i < system.args.length; i += 1) {
        if (system.args[i].charAt(0) === '-') {
          map[system.args[i].substr(1, i.length)] = system.args[i + 1];
        }
      }
      //return map;
      map = { infile: 'source.json', 
        outfile: 'chart-output.png', 
        scale: 2, 
        width: 500, 
        constr: 'Chart' }
      return map;
    };

    /* scale and clip the page */
    scaleAndClipPage = function (svg, pdf) {
      /*	param: svg: The scg configuration object
          param: pdf: boolean, if true set papersize
      */

      var zoom = 1,
        pageWidth = pick(args.width, svg.width),
        clipwidth, clipheight;

      if (parseInt(pageWidth, 10) == pageWidth) {
        zoom = pageWidth / svg.width;
      }

      /* set this line when scale factor has a higher precedence
      scale has precedence : page.zoomFactor = args.scale  ? zoom * args.scale : zoom;*/

      /* args.width has a higher precedence over scaling, to not break backover compatibility */
      page.zoomFactor = args.scale && args.width == undefined ? zoom * args.scale : zoom;

      clipwidth = svg.width * page.zoomFactor;
      clipheight = svg.height * page.zoomFactor;

      /* define the clip-rectangle */
      page.clipRect = {
        top: 0,
        left: 0,
        width: clipwidth,
        height: clipheight
      };

      /* for pdf we need a bit more paperspace in some cases for example (w:600,h:400), I don't know why.*/
      if (pdf) {
        page.paperSize = { width: clipwidth, height: clipheight + 2};
      }
    };

    /* get the arguments from the commandline and map them */
    args = mapArguments();

    // Bypass arguments
    // log
    console.log(JSON.stringify(args));

    if (args.length < 1) {
      console.log('Usage: highcharts-convert.js -infile URL -outfile filename -scale 2.5 -width 300 -constr Chart -callback callback.js');
      console.log('Commandline parameter width is used for scaling, not for creating the chart');
      //phantom.exit(1);
    } else {
      input = args.infile;
      output = pick(args.outfile, "chart.png");
      constr = pick(args.constr, 'Chart');
      callback = args.callback;
      width = args.width;

      outputExtension = output.split('.').pop();
      pdfOutput = outputExtension === 'pdf';

      /* Decide to generate the page from javascript or to load from svg file. */

      if (input.split('.').pop() === 'json') {
        // We have a json file, -> go headless!

        // load necessary libraries
        page.injectJs(config.JQUERY);
        page.injectJs(config.HIGHCHARTS);
        page.injectJs(config.HIGHCHARTS_MORE);

        // load options from file
        if (input !== undefined) {
          optionsStr = fs.read(input);
        } else {
          console.log('No options file specified!');
          //phantom.exit();
        }

        // load callback from file
        if (callback !== undefined) {
          callbackStr = fs.read(callback);
        }

        // load chart in page and return svg height and width
        svg = page.evaluate(function (width, constr, optionsStr, callbackStr, pdfOutput) {

          var imagesLoadedMsg = 'Highcharts.imagesLoaded:7a7dfcb5df73aaa51e67c9f38c5b07cb', $container, chart,
            nodes, nodeIter, elem, opacity;

          // dynamic script insertion
          function loadScript(varStr, codeStr) {
            var $script = $('<script>').attr('type', 'text/javascript');
            $script.html('var ' + varStr + ' = ' + codeStr);
            document.getElementsByTagName("head")[0].appendChild($script[0]);
          }

          // are all images loaded in time?
          function logCounter(counter) {
            counter -= 1;
            if (counter < 1) {
              console.log(imagesLoadedMsg);
            }
          }

          function loadImages() {
            // are images loaded?
            var $images = $('svg image'), counter, i, img;

            if ($images.length > 0) {

              counter = $images.length;

              for (i = 0; i < $images.length; i += 1) {
                img = new Image();
                img.onload = logCounter(counter);
                /* force loading of images by setting the src attr.*/
                img.src = $images[i].getAttribute('href');
              }
            } else {
              // no images set property to all images
              // loaded
              console.log(imagesLoadedMsg);
            }
          }

          if (optionsStr !== 'undefined') {
            loadScript('options', optionsStr);
          }

          if (callbackStr !== 'undefined') {
            loadScript('callback', callbackStr);
          }

          $(document.body).css('margin', '0px');
          $container = $('<div>').appendTo(document.body);
          $container.attr('id', 'container');

          // disable animations
          Highcharts.SVGRenderer.prototype.Element.prototype.animate = Highcharts.SVGRenderer.prototype.Element.prototype.attr;

          if (!options.chart) {
            options.chart = {};
          }

          options.chart.renderTo = $container[0];

          // check if witdh is set. Order of precedence:
          // args.width, options.chart.width and 600px

          // OLD. options.chart.width = width || options.chart.width || 600;
          // Notice we don't use commandline parameter width here. Commandline parameter width is used for scaling.
          options.chart.width = (options.exporting && options.exporting.sourceWidth) || options.chart.width || 600;
          options.chart.height = (options.exporting && options.exporting.sourceHeight) || options.chart.height || 400;



          chart = new Highcharts[constr](options, callback);

          // ensure images are all loaded
          loadImages();

          if (pdfOutput) {
            /*
             * remove stroke-opacity paths, Qt shows
             * them as fully opaque in the PDF
             */
            nodes = document.querySelectorAll('*[stroke-opacity]');

            for (nodeIter = 0; nodeIter < nodes.length; nodeIter += 1) {
              elem = nodes[nodeIter];
              opacity = elem.getAttribute('stroke-opacity');
              elem.removeAttribute('stroke-opacity');
              elem.setAttribute('opacity', opacity);
            }
          }

          return {
            html: $container[0].firstChild.innerHTML,
            width: chart.chartWidth,
            height: chart.chartHeight
          };

        }, width, constr, optionsStr, callbackStr, pdfOutput);

        try {
          // save the SVG to output or convert to other formats
          if (outputExtension === 'svg') {
            svgFile = fs.open(output, "w");
            // set in xlink namespace for images.
            svgFile.write(svg.html.replace(/<svg /, '<svg xmlns:xlink="http://www.w3.org/1999/xlink" ').replace(/ href=/g, ' xlink:href='));
            svgFile.close();
           // phantom.exit();
          } else {
            // check every 50 ms if all images are loaded
            var createInt = window.setInterval(function () {
              if (!window.imagesLoaded) {
                console.log('loading images...');
              } else {
                console.log('done loading images');
                scaleAndClipPage(svg, pdfOutput);
                page.render(output);
                clearTimeout(timer);
                clearInterval(createInt);
                //phantom.exit();
              }
            }, 50);
            // we have a 1.5 second timeframe..
            timer = window.setTimeout(function () {
              //phantom.exit();
            }, 1500);
          }
        } catch (e) {
          console.log(e);
        }
      } else { /* render page directly from svg file */
        page.open(input, function (status) {
          var nodeIter, opacity, elem, svg;
          if (status !== 'success') {
            console.log('Unable to load the address!');
            //phantom.exit();
          } else {
            svg = page.evaluate(function (pdfOutput) {
              if (pdfOutput) {
                /*
                 * remove stroke-opacity paths, Qt shows them as
                 * fully opaque in the PDF, replace attributes with
                 * opacity
                 */
                var nodes = document.querySelectorAll('*[stroke-opacity]');

                for (nodeIter = 0; nodeIter < nodes.length; nodeIter += 1) {
                  elem = nodes[nodeIter];
                  opacity = elem.getAttribute('stroke-opacity');
                  elem.removeAttribute('stroke-opacity');
                  elem.setAttribute('opacity', opacity);
                }
              }

              svgElem = document.getElementsByTagName('svg')[0];
              return {
                width: svgElem.getAttribute("width"),
                height: svgElem.getAttribute("height")
              };
            }, pdfOutput);

            scaleAndClipPage(svg, pdfOutput);
            page.render(output);
            //phantom.exit();
          }
        });
      }
    }
  }());

  response.statusCode = 200;
  response.write('Chart written!')
  response.close();
});
