$(function() {
    'use strict';
    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var currentEvent
    , zapper = new Zapper()
    , user
    , messages
    , $buttonsContainer = $('#buttons-container');

    function switchScreen(next, callback) {
        setTimeout(function() {
            $('.screen:not([hidden])').attr('hidden', 'hidden').fadeOut(function() {
                $(next).removeAttr('hidden').fadeIn(callback);
            });
        }, 1000);
    }

    (function loginCheck() {
        if (!zapper.loggedIn) {
            switchScreen('#login-screen');
        } else {
            init();
        }
    })();
    $('#login-command').fastClick(function(){
        zapper.login(null, function(err, user) {
            if (err) {
                return;
            }
            init();
        });
    });


    function init() {
        switchScreen('#zapper-main');
        zapper.connect(function(err) {
            if (err) {
                return alert('サーバとの接続に失敗しました。アプリケーションはご利用頂けません。');
            }
            user = zapper.user;
            currentEvent = zapper.event(__lt_event__);
            $('#zapper-main h1:first').text(currentEvent.title);
            currentEvent.onZapSent = function(zap) {
                var backgroundUrl = 'url("/img/btnBg_00.png")';
                $buttonsContainer.css('backgroundImage', backgroundUrl);
                $('#zap-button').text('(いいね!)').removeAttr('disabled');
//                showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid, autoCloseSeconds: 3 });
            };
            /*
            currentEvent.subscribe('zap', function(zap) {
                zaps.push(zap);
            });
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                renderMessages([message]);
            });
            messages = __lt_messages__;
            delete window.__lt_messages__;

            renderMessages(messages);
            */
        });
    }
    (function preloadImages() {
        var imgNames = [
            'btnBg_00.png',
            'btnBg_01.png',
            'btnBg_02.png',
            'btnBg_03.png',
            'btnBg_04.png',
            'btnBg_05.png',
            'zapBtn_off.png',
            'zapBtn_on.png',
            'msg_on.png',
            'msg_off.png',
            'msgBtn_off.png',
            'msgBtn_on.png'
        ];
        var pathPrefix = '/img/';
        _.each(imgNames, function(imgName) {
            var img = new Image();
            img.src = pathPrefix + imgName;
            img.onload = function() {
                console.log('preload image:' + imgName);
            };
        });
    })();
    
    $('#zap-button').fastClick(function() {
        if (!zapper.loggedIn) {
            return alert('ログインしていません');
        }
        var zap = currentEvent.zap();
        var zapCount = zap.count;
        if (zapCount === currentEvent.maxZapCount) {
            $(this).attr('disabled', 'disabled');
        }
        var backgroundUrl = 'url("/img/btnBg_' + _.str.lpad(String(zapCount), 2, '0') + '.png")';
        $buttonsContainer.css('backgroundImage', backgroundUrl);
    });
});
