'use strict';

;var booksy = booksy || {};

(function () {

    var version = '1.0.1';

    var scriptRegex = /.*booksy.*\/.*widget\/code.js/;
    var script = currentScriptElement(scriptRegex);

    if (!script) errorBreak('cannot locate current script');

    var config = parseScriptConfig(script.src);

    console.log("booksy.widget | config: ", config);

    config.mode = config.mode || 'dialog';

    config.theme = config.theme || 'default';

    config.iframeSrc = config.baseUrl + 'index.html?id=' + config.id + '&lang=' + config.lang + '&country=' + config.country + '&mode=' + config.mode + '&theme=' + config.theme;

    if (!(config.langauge && config.country)) errorBreak('uncomplete configuration', config);

    var widgetContainer = createWidgetContainer(script, config);

    if (!booksy.widgetCss) {
        booksy.widgetCss = loadWidgetStyle(config.baseUrl);
    };

    if (config.mode == 'dialog') {
        var button = createWidgetButton(widgetContainer);

        button.addEventListener('click', function () {
            getOS() === 'other' ? dialogOpen(config.iframeSrc) : createDeepLink(config);
        });

        return;
    };

    if (config.mode == "inline") {
        createIframe(widgetContainer, config.iframeSrc);
        return;
    };

    errorBreak('unexpected widget mode', config.mode);

    /**
     * 
     * Functions
     * 
     */

    function errorBreak() {
        var args = Array.prototype.slice.call(arguments);
        try {
            console.log.apply(console, args.unshift('[Booksy][widget][error]'));
        } catch (e) {};
        return;
    }

    function currentScriptElement(scriptRegex) {
        var scripts = document.getElementsByTagName('script');

        for (var i = scripts.length - 1; i > -1; i--) {

            if (scripts[i].src.search(scriptRegex) > -1) {
                var selected = scripts[i];
                if (!booksy.codejs) {
                    booksy.codejs = [selected.src];
                    return selected;
                } else {
                    if (booksy.codejs.indexOf(selected.src) === -1) {
                        booksy.codejs.push(selected.src);
                        return selected;
                    }
                }
            }
        }
    };

    function parseScriptConfig(src) {

        var config = {
            baseUrl: src.replace(/\/code\.js.*/, '\/').replace(/https:\/\/w\.booksy.(com|net)\/.._..\//, 'https://booksy.com/').replace(/https:\/\/widget-..\.booksy.(com|net)\/.._..\//, 'https://booksy.com/').replace(/https:\/\/booksy.net\//, 'https://booksy.com/')
        };

        var params = src.split('code.js?')[1];
        if (params) {
            var params = params.split('&');

            for (var i = params.length - 1; i > -1; i--) {
                var kv = params[i].split('=');
                config[kv[0]] = kv[1];
            }
        }

        // old format fallback
        if (!config.lang) {
            var match = src.match(/https?:\/\/[^\/]*\/([a-z][a-z])[_\-]([a-zA-Z][a-zA-Z])\/widget/);
            if (match) {
                config.lang = match[1];
                config.country = match[2];
            }
        }

        return config;
    }

    function createWidgetContainer(script, config) {
        var cls = 'booksy-widget-container';
        var containerClass = [cls, cls + '-' + config.mode, cls + '-' + config.theme, cls + '-' + config.lang].join(' ');

        // widget container element (placed before script element)
        var div = document.createElement('div');
        //div.setAttribute( 'id', widget.containerId );
        div.setAttribute('class', containerClass);
        script.parentNode.insertBefore(div, script);

        return div;
    }

    function createWidgetButton(container) {
        var button = document.createElement('div');
        button.setAttribute('class', 'booksy-widget-button');
        container.appendChild(button);
        return button;
    };

    function loadWidgetStyle(baseUrl) {
        document.head.insertAdjacentHTML('beforeend', '\n            <link rel="stylesheet" type="text/css" href="' + baseUrl + 'widget.css">\n        ');
        return true;
    }

    function generateUniqueId(pattern) {
        pattern = pattern || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
        return pattern.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : r & 0x3 | 0x8;
            return v.toString(16);
        });
    };

    function iframeFactory(options) {

        var opts = options || {};
        // inject unique identifier into iframe source address
        opts.src += (opts.src.indexOf('?') > -1 ? '&' : '?') + 'uniqueId=' + opts.uniqueId;

        var container = opts.container || document.body;
        var iframeId = undefined;

        return {
            create: create,
            element: function element() {
                return container.querySelector('iframe');
            }
        };

        function create() {
            if (iframeId) return;
            iframeId = generateUniqueId('iframe-xxxx');

            container.insertAdjacentHTML('beforeend', '\n                <iframe \n                    width="' + (opts.width || 476) + '" \n                    height="' + (opts.height || 660) + '"\n                    src="' + opts.src + '"\n                    style="border: 0">\n            ');

            // register "message" handler
            window.addEventListener('message', messageHandler, true);
        };

        function messageHandler(event) {
            var data = event.data;

            /**
             * data : {
             *     uniqueId : ...,
             *     events   : {
             *         name => { ... },
             *         ...
             *     }
             * }
             */

            // ignore message, if response unique identifier doesn't
            // match iframe src unique identifier
            if (data.uniqueId != opts.uniqueId || !data.events) return;

            var events = ['resize', 'close'];

            for (var i = events.length - 1; i > -1; i--) {
                var name = events[i];

                if (data.events[name]) {
                    // "close" => "onClose"
                    var callback = opts["on" + name.charAt(0).toUpperCase() + name.substr(1)];

                    // shortcut
                    if (typeof callback !== "function") continue;

                    try {
                        callback(data.events[name]);
                    } catch (e) {};
                }
            }
        }
    }

    function getOS() {

        return 'other';

        var ua = navigator.userAgent || navigator.vendor || window.opera;
        var os = 'other';

        if (ua.match(/iPad/i) || ua.match(/iPhone/i) || ua.match(/iPod/i)) {
            os = 'ios';
        } else if (ua.match(/Android/i)) {
            os = 'android';
        }

        return os;
    }

    function dialogOpen(src) {
        var overlay = document.createElement('div');
        overlay.setAttribute('class', 'booksy-widget-overlay');
        document.body.appendChild(overlay);

        var dialog = document.createElement('div');
        dialog.setAttribute('class', 'booksy-widget-dialog');
        document.body.appendChild(dialog);

        createIframe(dialog, src, overlay);

        scrollToElement(dialog);
    }

    function createIframe(container, src, overlay) {
        var iframe = iframeFactory({
            uniqueId: generateUniqueId('xxxxxxxxxx'),
            src: src,
            // width  : 650,
            // height : 800,
            container: container,
            onResize: function onResize(params) {
                window.setTimeout(function () {
                    iframe.element().style.height = params.height + 15 + 'px';
                }, 50);
            },
            onClose: function onClose() {
                container.remove();
                if (overlay) overlay.remove();
            }
        });

        return iframe.create();
    }

    function createDeepLink(config) {

        var cls = 'booksy-widget-mobile-overlay';
        var containerId = generateUniqueId('dl-xxxx');
        var skipId = generateUniqueId('skip-xxxx');

        document.body.insertAdjacentHTML('afterbegin', '\n            <div id="' + containerId + '" class="' + cls + ' ' + cls + '-' + config.lang + '">\n                <div class="' + cls + '-container">\n                    <a href="' + config.mobileOverlayUrl + '" class="' + cls + '-dl"></a>\n                    <a id="' + skipId + '" href="#skip" class="' + cls + '-skip">Skip</a>\n                </div>\n            </div>\n        ');

        document.getElementById(skipId).addEventListener('click', function () {
            document.getElementById(containerId).remove();
            dialogOpen(config.iframeSrc);
            return false;
        });
    }

    function scrollToElement(element) {
        window.scroll(0, findPosition(element));
    }

    function findPosition(element) {
        var current = 0;
        if (element.offsetParent) {
            do {
                current += element.offsetTop;
            } while (element = element.offsetParent);
            return [current];
        }
    }
})();