$(function() {
    'use strict';
    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var zapper = new Zapper()
    , currentEvent = zapper.event(__lt_event__)
    , user
    , messages
    , messagesShown
    , messageCount = 0
    , $zapButton = $('#zap-button')
    , $messageCount = $('#msg-notifier .msg-count')
    , $messageNotifyIcon = $('#msg-notifier .icon')
    , $messages = $('#messages')
    , $messageDialog = $('#message-dialog')
    , $messageInput = $messageDialog.find('.message-input')
    , $autoCloseCount = $messageDialog.find('.count')
    , $buttonsContainer = $('#buttons-container')
    , buttonsContainerWidth = $buttonsContainer.outerWidth();

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
    (function hideAddressbar() {
        setTimeout(function(){window.scrollTo(0,1);}, 100);
    })();
    $('#login-command').fastClick(function(){
        zapper.login({
            mobileAuth: true,
            eventId: currentEvent._id,
        }, function(err, user) {
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
            $('#user-icon img').attr('src', user.photos[0]);
            $('#zapper-main h1:first').text(currentEvent.title);
            currentEvent.onZapSent = function(zap) {
                var zapCount = zap.count;
                (function decrementZapCount() {
                    var pos = -(buttonsContainerWidth * zapCount);
                    $buttonsContainer.css('backgroundPosition',  pos + 'px 0');
                    zapCount--;
                    if (zapCount >= 0) {
                        setTimeout(decrementZapCount, 40);
                    }
                })();
                

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
                if (messagesShown) {
                    var html = common.renderMessage(message);
                    $messages.find(':first').before(html);
                } else {
                    messageCount++;
                    updateMessageCount();
                }
            });
            // メッセージをタイムスタンプの昇順に並べ替える
            messages = __lt_messages__.reverse();
            messageCount = messages.length;
            updateMessageCount();
        });
    }
    function updateMessageCount() {
        if (!messageCount) {
            $messageCount.text('').hide();
            $messageNotifyIcon.removeClass('active');
        } else {
            $messageCount.text(messageCount).show();
            $messageNotifyIcon.addClass('active');
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

    
    function onZapButtonClicked() {
        if (!zapper.loggedIn) {
            return alert('ログインしていません');
        }
        var zap = currentEvent.zap();
        var zapCount = zap.count;
        if (zapCount === currentEvent.maxZapCount) {
            $(this).attr('disabled', 'disabled');
        }
        var position = -buttonsContainerWidth * zapCount;
        $buttonsContainer.css('backgroundPosition', position + 'px 0');
//        zapButtonWidth
//        var backgroundUrl = 'url("/img/btnBg_' + _.str.lpad(String(zapCount), 2, '0') + '.png")';
//        $buttonsContainer.css('backgroundImage', backgroundUrl);
    }
    $zapButton.fastClick(onZapButtonClicked);
    /*
    $(window).on('shake', function() {
        shaked = true;
        onZapButtonClicked();
    });
    */
    $('#msg-notifier').fastClick(function() {
        if (messagesShown) {
            hideMessages();
        } else {
            showMessages();
        }
        updateMessageCount();
        messagesShown = !messagesShown;
    });
    function showMessages() {
        // メッセージを初期表示
        var buf = [];
        for (var i = messages.length - 1; i >= 0; i--) {
            var message = messages[i];
            buf.push(common.renderMessage(message));
        }
        $messages.html(buf.join('')).show();
        messageCount = 0;
    }
    function hideMessages() {
        $messages.empty().hide();
    }
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
        clearTimeout(autoCloseTimer);
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
            }
        })();
    }
    $messageInput.on('focus', function() {
        clearTimeout(autoCloseTimer);
        $autoCloseCount.text('');
    });
    $('#msg-button').fastClick(function() {
        showMessageDialog(this);
    });
    $('#logout-button').fastClick(function() {
        if (confirm('ログアウトしますか?')) {
            $.get('/logout', function() {
                location.reload();
            });
        }
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
