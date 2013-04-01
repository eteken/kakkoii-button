$(function() {
    _.templateSettings = {
        evaluate: /\{\{(.+?)\}\}/g,
        interpolate : /\{\{=(.+?)\}\}/g,
        escape: /\{\{-(.+?)\}\}/g
    };
    var messageListItemTemplate = _.template($('#message-listitem-template').html());

    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var currentEvent;
    var zapper = new Zapper();
    var user;
    var messages;
    var zaps;
    var ZAP_CHART_REFRESH_INTERVAL = 2; //seconds
    var ZAP_CHART_REFRESH_INTERVAL_MILLIS = ZAP_CHART_REFRESH_INTERVAL * 1000; //seconds
    var ZAP_CHART_COUNT_OF_POINTS = 10;
    
    function init(done) {
        console.log('init');
        currentEvent = zapper.event(__lt_event__);
        currentEvent.onZapSent = function(zap) {
            showMessageDialog('#zap-button', { relatedZapUUID: zap.uuid });
        };
        currentEvent.subscribe('zap', function(zap) {
            zaps.push(zap);
            console.log(zap);
        });
        currentEvent.subscribe('message', function(message) {
            messages.push(message);
            renderMessages([message]);
        });
        zaps = __lt_zaps__;
        messages = __lt_messages__;
        delete window.__lt_zaps__;
        delete window.__lt_messages__;

        // ライブ中は頻繁に更新、チャートはどんどん流れていく
//      if (currentEvent.isLive) {
            setInterval(renderZapsOnLive, ZAP_CHART_REFRESH_INTERVAL_MILLIS);
//        }
        // それ以外の時は、チャートはmessageイベントが到着した時しか更新しない。
        // チャートは、全体表示。
//        else {
//            renderZaps();
//        }
        renderMessages(messages);
        done();
    }
    function adjustChartSize() {
        var chartWidth = $(window).width();
        var chartHeight = Math.floor(chartWidth * 3 / 4);
        $('#zap-chart').attr({
            width: chartWidth,
            height: chartHeight
        }).css({
            width: chartWidth,
            height: chartHeight
        });
    }
    $(window).resize(adjustChartSize);
    adjustChartSize();

    var chartCanvas = document.getElementById('zap-chart');
    var chartCtx = chartCanvas.getContext('2d');
    var chart = new Chart(chartCtx);

    var chartRangeInMillis =  ZAP_CHART_COUNT_OF_POINTS * ZAP_CHART_REFRESH_INTERVAL_MILLIS;
    var labels = new Array(ZAP_CHART_COUNT_OF_POINTS).map(function() { return '' });
    
    function renderZapsOnLive() {
        var now = new Date();
        var endTime = new Date(
            now.getFullYear(), now.getMonth(), now.getDate(),
            now.getHours(), now.getMinutes(), now.getSeconds()).getTime();
        var startTime = new Date(endTime - chartRangeInMillis).getTime();
        var i, j, k = zaps.length - 1;
        var counts = [];
        for (i = endTime; i >= startTime; i -= ZAP_CHART_REFRESH_INTERVAL_MILLIS) {
            var count = 0;
            for (j = k; j >= 0; j--) {
                var zap = zaps[j];
                var timestamp = Date.parse(zap.timestamp);
                if (i >= timestamp && i - timestamp < ZAP_CHART_REFRESH_INTERVAL_MILLIS) {
                    count += zap.count;
                } else {
                    // 次のループの開始位置を進めておく
                    k = j;
                    break;
                }
            }
            counts.push(count);
        }
        // この時点で、jにはグラフに描画した最も古いzapのインデックスが入っている。
        // メモリリークを防ぐために、配列を切り詰める
        zaps = zaps.slice(j);
        var data = {
            labels : labels,
            fillColor : "rgba(220,220,220,0.5)",
            strokeColor : "rgba(220,220,220,1)",
            pointColor : "rgba(220,220,220,1)",
            pointStrokeColor : "#fff",
            datasets : [
                {
                    fillColor : "rgba(220,220,220,0.5)",
                    strokeColor : "rgba(220,220,220,1)",
                    data : counts
                }
            ]
        };
        chart.Bar(data, {
//            bezierCurve: false,
//            scaleOverride : true,
            scaleSteps : 1,
            scaleStepWidth : 100,
            scaleStartValue : 1,
            animation: false
        });
    }
    /*
    function renderZaps() {
        // n秒刻み
        var intervalSeconds = 10;

        var intervalMillis = intervalSeconds * 1000;
        
        // イベントの最初から最後まで
        var start = Date.parse(currentEvent.start);
        var end = Date.parse(currentEvent.end);
        var counts = [];
        
        for (var i = start; i < end; i += intervalMillis) {
            var count = 0;
            var range = i + intervalMillis;
            for (var j = 0, n = zaps.length; j < n; j++) {
                var zap = zaps[j];
                var timestamp = Date.parse(zap.timestamp);
                
                if (i <= timestamp && timestamp < range) {
                    console.log('timestamp:' + timestamp + ' i:'+ i + ' range:' + range);
                    count += zap.count;
                }
            }
            counts.push(count);
        }
        console.log(counts);
        var labels = counts.map(function() { return ''; });
        var data = {
            labels : labels,
            datasets : [
                {
                    fillColor : "rgba(220,220,220,0.5)",
                    strokeColor : "rgba(220,220,220,1)",
                    data : counts
                }
            ]
        };
        chart.Bar(data);
    }
    */
    function renderMessages(messages) {
        var buf = [];
        for (var i = 0, n = messages.length; i < n; i++) {
            buf.push(messageListItemTemplate(messages[i]));
        }
        var msgList = $('.zap-messages');
        msgList.html(buf.join('') + msgList.html());
/*
        var listItemHtml = 
        var listItem = $.parseHTML(listItemHtml);
        var lastMessage = $('.zap-message-listitem:first');
        if (lastMessage.length > 0) {
            lastMessage.before(listItem);
        } else {
            $('.zap-messages').append(listItem);
        }*/
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
//                        $('#zap-chart').fadeIn(500);
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
        var zap = currentEvent.zap();

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

        currentEvent.sendMessage(message, options.relatedZapUUID);
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
