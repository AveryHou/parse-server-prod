/*!
  Pinto jQuery Plugin
  @name jquery.pinto.js
  @description a jQuery plugin for creating a pinterest like responsive grid layout
  @version 1.5.0
  @copyright (c) 2015 Max Lawrence (http://www.avirtum.com)
  @license Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php) license.
*/
(function($) {
    "use strict";
    
    var Util = (
        function() {
            function Util() {
            }
            
            Util.prototype.css2json = function(css) {
                var s = {};
                if (!css) return s;
                if (css instanceof CSSStyleDeclaration) {
                    for (var i in css) {
                        if ((css[i]).toLowerCase) {
                            s[(css[i]).toLowerCase()] = (css[css[i]]);
                        }
                    }
                } else if (typeof css == "string") {
                    css = css.split(";");
                    for (var i in css) {
                        var l = css[i].split(":");
                        if(l.length == 2) {
                            s[l[0].toLowerCase().trim()] = (l[1].trim());
                        }
                    }
                }
                return s;
            };
            
            return Util;
        }()
    );
    
    var WeakMap = window.WeakMap || window.MozWeakMap || (
        WeakMap = (
        function() {
            function WeakMap() {
                this.keys = [];
                this.values = [];
            }

            WeakMap.prototype.get = function(key) {
                var i, item, j, len, ref;
                ref = this.keys;
                for (i = j = 0, len = ref.length; j < len; i = ++j) {
                    item = ref[i];
                    if (item === key) {
                        return this.values[i];
                    }
                }
            };

            WeakMap.prototype.set = function(key, value) {
                var i, item, j, len, ref;
                ref = this.keys;
                for (i = j = 0, len = ref.length; j < len; i = ++j) {
                    item = ref[i];
                    if (item === key) {
                        this.values[i] = value;
                        return;
                    }
                }
                this.keys.push(key);
                return this.values.push(value);
            };

            return WeakMap;
        })()
    );
    
    var ITEM_DATA_NAME = "pinto";
    var _counter = 0;
    
    function Pinto(container, config) {
        this.container = null;
        this.items = null;
        this.config = null;
        this.containerStyleCache = null;
        this.styleCache = null;
        this.timer = null;
        
        this.id = ++_counter;
        this.init(container, config);
    };
    
    Pinto.prototype = {
        //=============================================
        // Properties (is shared for all instances)
        //=============================================
        defaults : {
            itemClass: "pinto", // a class of items that will be layout
            itemSkipClass: "pintoskip", // a class of items that will be skip and not layout
            itemWidth: 220, // the width of one grid block in pixels
            gapX: 10, // the width spacing between blocks in pixels
            gapY: 10, // the height spacing between blocks in pixels
            align: "left", // a blocks alignment ("left", "right", "center")
            fitWidth: true, // adjust the block width to create optimal layout based on container size
            autoResize: true, // update layout after browser is resized
            resizeDelay: 50, // time in milliseconds between browser resize and layout update
            onItemLayout: function(el, column, position) {}, // fire after item layout complete
        },
        
        
        
        //=============================================
        // Methods
        //=============================================
        init: function(container, config) {
            this.destroy();
            this.container = container;
            this.config = config;
            this.styleCache = new WeakMap();
            this.build();
            this.layout();
        },
        
        applyHandlers: function() {
            if (this.config.autoResize) {
                $(window).on("resize.pinto" + this.id, $.proxy(this.onResizeHandler, this));
            }
            this.container.on("remove", $.proxy(this.resetHandlers, this));
        },
        
        resetHandlers: function() {
            $(window).off("resize.pinto" + this.id, $.proxy(this.onResizeHandler, this));
            clearTimeout(this.timer);
        },
        
        onResizeHandler: function() {
            clearTimeout(this.timer);
            this.timer = setTimeout($.proxy(this.layout, this), this.config.resizeDelay);
        },
        
        build: function() {
            this.applyHandlers();
            
            this.containerStyleCache = this.util().css2json(this.container.attr("style"));
            
            this.items = this.container.find("." + this.config.itemClass);
            if (this.items.length) {
                this.items.each($.proxy(function(index, item) {
                    this.cacheStyle(item);
                }, this));
            }
            
            if (this.container.css("position") == "static") {
                this.container.css("position", "relative");
            }
        },
        
        layout: function () {
            if (!this.container.is(":visible")) {
                return;
            }
            
            var width = this.container.innerWidth(),
            itemWidth = this.config.itemWidth,
            gapX = parseInt(this.config.gapX || 0),
            gapY = parseInt(this.config.gapY || 0),
            offset = 0,
            colsCount = 0;
            
            while(width > offset) {
                offset += itemWidth;
                if(width >= offset) {
                    colsCount++;
                } else {
                    break;
                }
                offset += gapX;
            };
            colsCount = Math.max(colsCount, 1);
            
            var cols = [], 
            colsH = [],
            i = colsCount;
            while(i--) { 
                cols.push(0);
                colsH.push(0);
            }
            
            offset = 0;
            var gap = (colsCount-1) * gapX;
            if (this.config.fitWidth) {
                itemWidth += Math.floor(0.5 + (width - gap - colsCount * itemWidth) / colsCount);
            } else {
                // calculate the offset based on the alignment of columns to the parent container
                if (this.config.align === "center") {
                    offset += Math.floor(0.5 + (width - gap - colsCount * itemWidth) >> 1);
                } else if (this.config.align === "right") {
                    offset += Math.floor(0.5 + (width - gap - colsCount * itemWidth));
                };
            };
            
            this.items.each($.proxy(function(index, item) {
                var $item = $(item);
                if (!$item.is(":visible") || $item.hasClass(this.itemSkipClass)) {
                    return;
                }
                
                var i = this.getSmallestIndex(colsH);
                $item.css({
                    position: "absolute",
                    top: colsH[i] + "px",
                    left: (itemWidth + gapX) * i + offset + "px",
                    width: itemWidth
                });
                
                colsH[i] += $item.outerHeight() + gapY;
                
                 if (typeof this.config.onItemLayout == "function") { // make sure the callback is a function
                    this.config.onItemLayout.call(this, item, i, cols[i]); // brings the scope to the callback
                }
                
                cols[i]++;
            }, this));
            
            var height=0;
            i = colsCount;
            while(i--) if(colsH[i]>height) height = colsH[i];
            this.container.css({height:height});
        },
         
        destroy: function () {
            this.resetHandlers();
            
            if(this.containerStyleCache) {
                this.container.removeAttr("style").css(this.containerStyleCache);
            }
            
            if(this.items) {
                this.items.each($.proxy(function(index, item) {
                    this.resetStyle(item);
                }, this));
            }
            
            this.items = null;
            this.config = null;
            this.containerStyleCache = null,
            this.styleCache = null;
            this.timer = null;
        },
        
        sync: function() {
            if(this.items) {
                this.items.each($.proxy(function(index, item) {
                    this.resetStyle(item);
                }, this));
            }
            
            this.items = $("." + this.config.itemClass);
            
            if (this.items.length) {
                this.items.each($.proxy(function(index, item) {
                    this.cacheStyle(item);
                }, this));
            }
            
            this.layout();
        },
        
        cacheStyle: function(item) {
            return this.styleCache.set(item, this.util().css2json($(item).attr("style")));
        },
        
        resetStyle: function(item) {
            $(item).removeAttr("style").css(this.styleCache.get(item));
        },
        
        getSmallestIndex: function (a) {
            var index = 0;
            for (var i = 1, len = a.length; i < len; i++) {
                if (a[i] < a[index]) index = i;
            }
            return index;
        },
        
        util: function() {
            return this._util != null ? this._util : this._util = new Util();
        },
    }
    
    //=============================================
    // Init jQuery Plugin
    //=============================================
    /**
     * @param CfgOrCmd - config object or command name
     * you may use .pinto("layout") to call the layout function
     * you may use .pinto("destroy") to call the destroy function
     * @param CmdArgs - some commands may require an argument
     */
    $.fn.pinto = function(CfgOrCmd, CmdArgs) {
        return this.each(function() {
            var container = $(this),
            instance = container.data(ITEM_DATA_NAME),
            options = $.isPlainObject(CfgOrCmd) ? CfgOrCmd : {};
            
            if (CfgOrCmd == "layout") {
                if (!instance) {
                    throw Error("Calling 'layout' method on not initialized instance is forbidden");
                }
                
                instance.layout();
                
                return;
            }
            
            if (CfgOrCmd == "sync") {
                if (!instance) {
                    throw Error("Calling 'sync' method on not initialized instance is forbidden");
                }
                
                instance.sync();
                
                return;
            }
            
            if (CfgOrCmd == "destroy") {
                if (!instance) {
                    throw Error("Calling 'destroy' method on not initialized instance is forbidden");
                }
                
                container.removeData(ITEM_DATA_NAME);
                instance.destroy();
                
                return;
            }
            
            if (instance) {
                var config = $.extend({}, instance.config, options);
                instance.init(container, config);
            } else {
                var config = $.extend({}, Pinto.prototype.defaults, options);
                instance = new Pinto(container, config);
                container.data(ITEM_DATA_NAME, instance);
            }
        });
    }
})(window.jQuery);