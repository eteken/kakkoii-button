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
    , messageCount = 0
    , $messageCount = $('#msg-notifier .msg-count')
    , $messageDialog = $('#message-dialog')
    , $messageInput = $messageDialog.find('.message-input')
    , $autoCloseCount = $messageDialog.find('.count')
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
            $('#user-icon img').attr('src', user.photos[0]);
            $('#zapper-main h1:first').text(currentEvent.title);
            currentEvent.onZapSent = function(zap) {
                var backgroundUrl = 'url("/img/btnBg_00.png")';
                $buttonsContainer.css('backgroundImage', backgroundUrl);
                $('#zap-button').text('(いいね!)').removeAttr('disabled');
                showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid, autoCloseSeconds: 3 });
            };
            /*
            currentEvent.subscribe('zap', function(zap) {
                zaps.push(zap);
            });
            */
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                messageCount++;
                updateMessageCount();
//                renderMessages([message]);
            });
            messages = __lt_messages__;
            messageCount = messages.length;
            updateMessageCount();
            delete window.__lt_messages__;

//            renderMessages(messages);
        });
    }
    function updateMessageCount() {
        if (!messageCount) {
            $messageCount.text('').hide();
        } else {
            $messageCount.text(messageCount).show();
        }
        
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



    $('#message-dialog .send-message-button').fastClick(function() {
        if (!zapper.loggedIn) {
            return alert('ログインしていません');
        }
        var dialog = $('#message-dialog');
        var input = dialog.find('.message-input');
        var message = input.val();
        if (message.length === 0) {
            return;
        }
        var options = dialog.data('options') || {};

        currentEvent.sendMessage(message, options.relatedZapUUID);
        input.val('');
        hideMessageDialog();
    });
    $('#message-dialog .cancel-button').fastClick(function() {
        hideMessageDialog();
    });
    var autoCloseTimer;
    function autoCloseMessageDialog(seconds) {
        var start = Date.now();
        
        (function updateCount() {
            var now = Date.now();
            var elapsedTime = now - start;
            if (elapsedTime > seconds * 1000) {
                hideMessageDialog();
            } else {
                var elapsedSeconds = Math.floor(elapsedTime / 1000);
                $autoCloseCount.text(seconds - elapsedSeconds);
                autoCloseTimer = setTimeout(updateCount, 200);
                console.log(autoCloseTimer);
            }
        })();
    }
    $messageInput.on('focus', function() {
        console.log(autoCloseTimer);
        clearTimeout(autoCloseTimer);
        $autoCloseCount.text('');
    });
    $('#msg-button').fastClick(function() {
        showMessageDialog(this);
    });
    $('#logout-button').fastClick(function() {
        $.get('/logout', function() {
            location.reload();
        });
    });
    function showMessageDialog(target, options) {
        $messageDialog.addClass('active');
        options = options || {};
        $messageDialog.data('options', options);
        $messageInput.val('');
        $autoCloseCount.text('');
        $messageDialog.show();
        // メッセージボタンを直接クリックされた
        if (!options.relatedZapUUID) {
            // テキストエリアにフォーカスする
            setTimeout(function() {
                $messageInput.focus();
            }, 0);
        }
        // ダイアログを自動で閉じる
        if (options.autoCloseSeconds > 0) {
            var seconds = options.autoCloseSeconds;
            autoCloseMessageDialog(seconds);
        }
    }
    function hideMessageDialog() {
        $messageDialog
            .removeData('options')
            .removeClass('active');
    }
});
