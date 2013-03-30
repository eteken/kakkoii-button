$(function() {
    _.templateSettings = {
        evaluate: /\{\{(.+?)\}\}/g,
        interpolate : /\{\{=(.+?)\}\}/g,
        escape: /\{\{-(.+?)\}\}/g
    };
    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var liveEvent;
    var zapper = new Zapper();
    var user;

    function init(done) {
        zapper.getLiveEvent(function(err, event) {
            if (err) {
                alert('エラーが発生しました:' + err.message);
                return;
            }
            liveEvent = event;
            liveEvent.onZapSent = function(zap) {
                showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid });
            };
            event.subscribe('zap', function(zap) {
                console.log(zap);
            });
            event.subscribe('message', function(message) {
                console.log(message);
                var listItemHtml = messageListItemTemplate(message);
                var listItem = $.parseHTML(listItemHtml);
                var lastMessage = $('.zap-message-listitem:first');
                if (lastMessage.length > 0) {
                    lastMessage.before(listItem);
                } else {
                    $('.zap-messages').append(listItem);
                }
            });
            done();
        });
    }
    if (!zapper.loggedIn) {
        switchScreen('#splash-screen', '#login-screen');
    } else {
        init(function(err) {
            if (err) {
                alert('エラーが発生しました');
            }
            switchScreen('#splash-screen', '#main-screen', main);
        });
    }
    var messageListItemTemplate = _.template($('#message-listitem-template').html());
    $('#login-command').click(function(){
        zapper.login(null, function(err, user) {
            if (err) {
                return;
            }
            init(function(err) {
                if (err) {
                    alert('エラーが発生しました');
                }
                switchScreen('#login-screen', '#main-screen', main);
            });
        });
    });

    function main() {
        user = zapper.user;
        $('.user-thumbnail').attr('src', user.photos[0]);
//        $('.user-name').text(user.displayName);

        $('#command-area').fadeIn(1000, function() {
            setTimeout(function() {
//                $('.user-name').fadeOut(750, function() {
//                    $('.user-name').remove();
                    $('.command-button').fadeIn(750, function() {
                        $('.zap-chart').fadeIn(500);
                    });
//                });
            }, 600);
        });
    }
    function switchScreen(prev, next, callback) {
        setTimeout(function() {
            $(prev).fadeOut(function() {
                $(next).fadeIn(callback);
            });
        }, 1000);
    }

    $('#display-messages').change(function() {
        $('.zap-messages').toggle(this.checked);
    });

    $('#zap-button').click(function() {
        var zap = liveEvent.zap();

        console.log('zapId:' + zap.id);
        console.log('zapCount:' + zap.count);
        if (zap.count === zapper.maxZapCount) {
            console.log('もういっぱいです');
        }
    });
    $('#tweet-button').click(function() {
        showMessageDialog(this);
    })
    $('#message-dialog .send-message-button').click(function() {
        var dialog = $('#message-dialog');
        var input = dialog.find('.message-input');
        var message = input.val();
        if (message.length === 0) {
            return;
        }
        var options = dialog.data('options') || {};

        liveEvent.sendMessage(message, options.relatedZapUUID);
        input.val('');
        hideMessageDialog();
    });
    $('#message-dialog .cancel-button').click(function() {
        hideMessageDialog();
    });
    
    function showMessageDialog(target, options) {
        var dialog = $('#message-dialog');
        dialog.addClass('active');
        var width = dialog.outerWidth();
        var height = dialog.outerHeight();
        var left = ($(window).width() - width) / 2;
        dialog.css('left', left + 'px');

        var buttonPos = $(target).offset();
        dialog.css('top', buttonPos.top - height);
//        var bottom = buttonPos.top;

//        $('#message-dialog-inner:before').css('left', buttonPos.left);
//        $('#message-dialog-inner:after').css('left', buttonPos.left);
        options = options || {};
        dialog.data('options', options);
        dialog.show();
        if (!options.relatedZapUUID) {
            setTimeout(function() {
                dialog.find('.message-input').focus();
            }, 0);
        }
    }
    function hideMessageDialog() {
        $('#message-dialog')
            .removeData('options')
            .hide();
    }
});
