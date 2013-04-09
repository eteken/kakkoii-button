$(function() {
    'use strict';
    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var currentEvent;
    var zapper = new Zapper();
    var user;
    var messages;

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
    $('#login-command').click(function(){
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
            /*
            currentEvent.onZapSent = function(zap) {
                $('#zap-button').text('(いいね!)').removeAttr('disabled');
                showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid, autoCloseSeconds: 3 });
            };
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

});
