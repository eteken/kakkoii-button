/**
 * Date.parse with progressive enhancement for ISO 8601 <https://github.com/csnover/js-iso8601>
 * © 2011 Colin Snover <http://zetafleet.com>
 * Released under MIT license.
 */
(function (Date, undefined) {
    var origParse = Date.parse, numericKeys = [ 1, 4, 5, 6, 7, 10, 11 ];
    Date.parse = function (date) {
        var timestamp, struct, minutesOffset = 0;

        // ES5 §15.9.4.2 states that the string should attempt to be parsed as a Date Time String Format string
        // before falling back to any implementation-specific date parsing, so that’s what we do, even if native
        // implementations could be faster
        //              1 YYYY                2 MM       3 DD           4 HH    5 mm       6 ss        7 msec        8 Z 9 ±    10 tzHH    11 tzmm
        if ((struct = /^(\d{4}|[+\-]\d{6})(?:-(\d{2})(?:-(\d{2}))?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{3}))?)?(?:(Z)|([+\-])(\d{2})(?::(\d{2}))?)?)?$/.exec(date))) {
            // avoid NaN timestamps caused by “undefined” values being passed to Date.UTC
            for (var i = 0, k; (k = numericKeys[i]); ++i) {
                struct[k] = +struct[k] || 0;
            }

            // allow undefined days and months
            struct[2] = (+struct[2] || 1) - 1;
            struct[3] = +struct[3] || 1;

            if (struct[8] !== 'Z' && struct[9] !== undefined) {
                minutesOffset = struct[10] * 60 + struct[11];

                if (struct[9] === '+') {
                    minutesOffset = 0 - minutesOffset;
                }
            }

            timestamp = Date.UTC(struct[1], struct[2], struct[3], struct[4], struct[5] + minutesOffset, struct[6], struct[7]);
        }
        else {
            timestamp = origParse ? origParse(date) : NaN;
        }

        return timestamp;
    };
}(Date));

var common = (function() {
    // テンプレート設定
    _.templateSettings = {
        evaluate: /\{\{(.+?)\}\}/g,
        interpolate : /\{\{=(.+?)\}\}/g,
        escape: /\{\{-(.+?)\}\}/g
    };
    var messageTemplate;
    var timestamp2Label = (function() {
        /*
          var ONE_SECOND = 1000;
          var ONE_MINUTE = ONE_SECOND * 60;
          var ONE_HOUR = ONE_MINUTE * 60;
          var ONE_DAY = ONE_HOUR * 24;
          return function(isoString) {
          var timestamp = Date.parse(isoString);
          var now = Date.now();
          var delta = now - timestamp;

          if (delta < ONE_SECOND) {
          return 'たった今';
          } else if (delta < ONE_MINUTE) {
          return Math.floor(delta / ONE_SECOND) + '秒前';
          } else if (delta < ONE_HOUR) {
          return Math.floor(delta / ONE_MINUTE) + '分前';
          } else if (delta < ONE_DAY) {
          return Math.floor(delta / ONE_HOUR) + '時間前';
          } else {
          return Math.floor(delta / ONE_DAY) + '日前';
          }
          };
        */
        return function(isoString) {
            var timestamp = Date.parse(isoString);
            var date = new Date();
            date.setTime(timestamp);
            return _.str.lpad(String(date.getHours()), 2, '0') + ':' + _.str.lpad(String(date.getMinutes()), 2, '0');
        };
    })();

    var renderMessage = function(message) {
        if (!messageTemplate) {
            messageTemplate = _.template($('#message-template').html());
        }
        message.ts = timestamp2Label(message.timestamp);
        return messageTemplate(message);
    };



    function embedSlide(options) {
        options = _.extend({
            elemId: null,
            slideId: null,
            width: '400',
            height: '300',
            startSlide: 1,
            rel: 0
        }, options);
        var params = { allowScriptAccess: "always" };
        var atts = { id: options.elemId };

        //doc: The path of the file to be used
        //startSlide: The number of the slide to start from
        //rel: Whether to show a screen with related slideshows at the end or not. 0 means false and 1 is true..
        var flashvars = { doc : options.slideId, startSlide : options.startSlide, rel : options.rel };

        //Generate the embed SWF file
        swfobject.embedSWF(
            "http://static.slidesharecdn.com/swf/ssplayer2.swf",
            options.elemId,
            options.width,
            options.height,
            "8",
            null,
            flashvars,
            params,
            atts,
            function(e) {
                if (e.success) {
                    options.onsuccess(e.ref);
                } else {
                    options.onerror();
                }
            });
        
    }

    return {
        renderMessage: renderMessage,
        embedSlide: embedSlide
    };
})();
