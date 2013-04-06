$(function() {
    var zapper = new Zapper()
    , currentEvent
    , zaps = []
    , messages = []
    , ZAP_CHART_REFRESH_INTERVAL_MILLIS = 1000;

    // テンプレート設定
    _.templateSettings = {
        evaluate: /\{\{(.+?)\}\}/g,
        interpolate : /\{\{=(.+?)\}\}/g,
        escape: /\{\{-(.+?)\}\}/g
    };
    var messageTemplate = _.template($('#message-template').html());

    if (!zapper.loggedIn) {
        var controlPanel = $('#control-panel');
        var pos = controlPanel.offset();
        var width = controlPanel.outerWidth();
        var height = controlPanel.outerHeight();
        $('#login-button-container').css({
            width: width + 'px',
            height: height + 'px',
            left: pos.left + 'px',
            top: pos.top + 'px',
            display: 'block'
        });
        $('#login-button').click(function() {
            zapper.login(null, function(err, user) {
                if (err) {
                    return;
                }
                $('#login-button-container').hide();
//                $('#control-panel :disabled').removeAttr('disabled');
                init();
            });
        });
    } else {
        init();
    }

    function init() {
        zapper.init(function(err) {
            if (err) {
                console.log(err);
                alert('エラーが発生しました。' + err.message);
                return;
            }
            currentEvent = zapper.event(__lt_event__);
            currentEvent.onZapSent = function(zap) {
                $('#zap-button').removeAttr('disabled');
//                showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid, autoCloseSeconds: 3 });
            };
            currentEvent.subscribe('zap', function(zap) {
                zaps.push(zap);
            });
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                renderMessages([message]);
            });
//            zaps = __lt_zaps__;
            messages = __lt_messages__;
            delete window.__lt_messages__;

//            setInterval(renderZapsOnLive, ZAP_CHART_REFRESH_INTERVAL_MILLIS);
            // メッセージを初期表示
            (function renderMessages() {
                var buf = [];
                for (var i = 0, n = messages.length; i < n; i++) {
                    var message = messages[i];
                    message.ts = timestamp2Label(message.timestamp);
                    buf.push(messageTemplate(message));
                }
                $('.messages').html(buf.join(''));
            })();
        });
    }
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
            console.log(isoString);
            var timestamp = Date.parse(isoString);
            var date = new Date();
            date.setTime(timestamp);
            return date.getHours() + ':' + date.getMinutes();
        };
    })();

    $('#zap-button').click(function() {

    });
});
