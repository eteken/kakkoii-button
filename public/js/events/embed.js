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
                    buf.push(messageTemplate(messages[i]));
                }
                $('.messages').html(buf.join(''));
            })();
        });
    }

    $('#zap-button').click(function() {

    });
});
