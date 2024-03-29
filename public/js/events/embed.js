$(function() {
    var zapper = new Zapper({ from: 1 }) // PCからの利用
    , currentEvent
    , zaps = []
    , messages = []
    , $messageInput = $('#message-input')
    , $zapButton = $('#zap-button')
    , $postMessageButton = $('#post-message-button')
    , $zapperIcons = $('#zapper-icons')
    , ZAP_CHART_REFRESH_INTERVAL = 1 //seconds
    , ZAP_CHART_REFRESH_INTERVAL_MILLIS = ZAP_CHART_REFRESH_INTERVAL * 1000 //seconds
    , ZAP_CHART_COUNT_OF_POINTS = 20
    , zapChart
    , chartRangeInMillis =  ZAP_CHART_COUNT_OF_POINTS * ZAP_CHART_REFRESH_INTERVAL_MILLIS
    , chartLabels = (function() {
        var labels = [];
        for (var i = 0; i < ZAP_CHART_COUNT_OF_POINTS; i++) {
            labels.push('');
        }
        return labels;
    })()
    , chart = document.getElementById('zap-chart')
    , chartCtx
    , zapChart
    , slidePlayer;


    (function() {
        // JSで無理やり位置合わせ・・・
        function layout() {
            var $messageArea = $('#message-area');
            
            var windowWidth = $(window).width();
            var windowHeight = $(window).innerHeight();

            var postFormHeight = $('#post-form').outerHeight();
            var buttonContainerHeight = $('#buttons').outerHeight();

            var logoutButtonPaddingTop = 16;
            var zapButtonPaddingTop = 8;
            var messageAreaPaddingBottom = 8;
            var postButtonPaddingTop = 8;
            var messageInputPaddingTop = 8;

            var messageAreaHeight = windowHeight - buttonContainerHeight - logoutButtonPaddingTop - zapButtonPaddingTop;
            
            $messageArea.css({
                height: messageAreaHeight
            });
            $('#messages').css({
                height: messageAreaHeight - postFormHeight - messageAreaPaddingBottom
            });
            var rightWidth = $('#right').outerWidth();
            var leftWidth = windowWidth - rightWidth;
            $('#left').css({
                width: leftWidth - 16
            });
            var chartContainerHeight = $('#chart-container').outerHeight();
            $('#zap-chart').css({
                width: leftWidth - 16,
                height: chartContainerHeight - 16
            });
            var embedPlayerContainerHeight = windowHeight - chartContainerHeight;
            $('#embedded-player-container').css({
                height: embedPlayerContainerHeight - 40
            });
        };
        layout();
        $(window).resize(layout);
    })();

    var renderChart = (function() {
        var CHART_HEIGHT_UNIT = 50;
        return function(counts) {
            var max = _.max(counts);
            var scaleStepWidth = 5;
            var scaleSteps = CHART_HEIGHT_UNIT / scaleStepWidth;
            if (max !== 0) {
                var chartHeight = Math.ceil(max / 20);
                scaleStepWidth = chartHeight * 5;
                scaleSteps = CHART_HEIGHT_UNIT * chartHeight / 5;
            }
            counts = _.map(counts, function(val) { return val + scaleStepWidth; });
            var data = {
                labels : chartLabels,
                datasets : [
                    {
                        fillColor : "rgba(235, 139, 140, .5)",
//                        fillColor: 'transparent',
                        strokeColor : "#e20215",
                        data : counts
                    }
                ]
            };
            zapChart.Line(data, {
                pointDot: false,
//                bezierCurve: false,
                scaleOverride : true,
                scaleSteps : scaleSteps,
                scaleStepWidth : scaleStepWidth,
                scaleStartValue : scaleStepWidth,
                animation: false
            });
        };
    })();

    var playAudio = (function() {
        var audioFiles = [
            'arrived.mp3'
        ];
        var audioElems = {
        };
        for (var i = 0; i < audioFiles.length; i++) {
            var audioFileName = audioFiles[i];
            var audio = new Audio();
            audio.src = '/media/' + audioFileName;
            audioElems[audioFileName] = audio;
        }
        return function(audioFileName) {
            var audioElem = audioElems[audioFileName];
            audioElem.play();
        };
    })();
    
    function init() {
        zapper.connect(function(err) {
            if (err) {
                console.log(err);
                alert('エラーが発生しました。' + err.message);
                return;
            }
            currentEvent = zapper.event(__lt_event__);
            currentEvent.onZapSent = function(zap) {
                $('#zap-button').removeAttr('disabled');
            };
            currentEvent.subscribe('zap', function(zap) {
                $zapButton.removeAttr('disabled');
                zaps.push(zap);
                playAudio('arrived.mp3');

                (function() {
                    var zapAuthor = zap.author;
                    var authorId = zapAuthor._id;
                    console.log(authorId);
                    var $listItems = $zapperIcons.children();
                    for (var i = 0, n = $listItems.length; i < n; i++) {
                        var $li = $($listItems[i]);
                        if ($li.data('author')._id === authorId) {
                            $li.remove();
                            break;
                        }
                    }
                    var $li = $(document.createElement('li'));
                    $li.data('author', zapAuthor);
                    $li.on('webkitAnimationEnd mozAnimationEnd oAnimationEnd msAnimationEnd animationend', function() {
                        $(this).remove();
                    });
                    var $img = $(document.createElement('img'));
                    $img.attr('src', zapAuthor.photo);
                    $img.addClass('icon').appendTo($li);
                    $zapperIcons.append($li);
                })();
            });
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                onMessageArrived(message);
            });
            currentEvent.subscribe('sync-slide', function(e) {
                if (slidePlayer)
                    slidePlayer.jumpTo(e.slide);
            });
            //            zaps = __lt_zaps__;
            messages = __lt_messages__;
            delete window.__lt_messages__;

            (function initChart() {
                // CSSでcanvasの幅を指定しているが、width属性とheight属性にも指定しておく
                var $chart = $(chart);
                $chart.attr($chart.css(['width', 'height']));
                // 外部スコープの変数に保存
                chartCtx = $chart[0].getContext('2d');
                zapChart = new Chart(chartCtx);
                
                // とりあえずオール0のデータで書きだしておく
                var dummyCounts = [];
                for (var i = 0; i < ZAP_CHART_COUNT_OF_POINTS; i++) {
                    dummyCounts.push(0);
                }
                renderChart(dummyCounts);
            })();
            // zapグラフを定期的にアップデート
            setInterval(renderZapsOnLive, ZAP_CHART_REFRESH_INTERVAL_MILLIS);

            // メッセージを初期表示
            (function renderMessages() {
                var buf = [];
                for (var i = 0, n = messages.length; i < n; i++) {
                    var message = messages[i];
                    buf.push(common.renderMessage(message));
                }
                $('#messages').html(buf.join(''));
            })();
        });
    }
    init();
    function hideControls() {
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
    }
    $('#login-button').click(function() {
        zapper.login(null, function(err, user) {
            if (err) {
                return;
            }
            location.reload(true);
        });
    });
    /*
    if (!zapper.loggedIn) {
        hideControls();
    }
    */
    var onMessageArrived = function(message) {
        var html = common.renderMessage(message);
        $('.message:first').before(html);
        playAudio('arrived.mp3');
    };
    
    $zapButton.click(function() {
        if (!zapper.loggedIn) {
            zapper.login(null, function(err, user) {
                if (err) {
                    return;
                }
                location.reload(true);
            });
            return;
        }
        var zap = currentEvent.zap();
        if (zap.count === zapper.maxZapCount) {
            $(this).attr('disabled', 'disabled');
        }
    });
    $postMessageButton.click(function() {
        if (!zapper.loggedIn) {
            zapper.login(null, function(err, user) {
                if (err) {
                    return;
                }
                location.reload(true);
            });
            return;
        }
        var message = $messageInput.val();
        if (message.length === 0) {
            alert('メッセージを入力して下さい');
            return;
        }
        currentEvent.sendMessage(message);
        $messageInput.val('');
        return false;
    });
    $('#logout-button').click(function() {
        if (!zapper.loggedIn) {
            return;
        }
        if (confirm('ログアウトしますか？')) {
            $.get('/logout', function() {
                location.reload();
            });
        }
    });
    var renderZapsOnLive = (function() {
        var $zapperIcons = $('#zapper-icons');
        return function() {
            if (zaps.length === 0) {
                return;
            }
            var slots = [];
            for (var i = 0; i < ZAP_CHART_COUNT_OF_POINTS; i++) {
                slots.push(0);
            }
            var now = new Date();
            var endTime = new Date(
                now.getFullYear(), now.getMonth(), now.getDate(),
                now.getHours(), now.getMinutes(), now.getSeconds() + 1).getTime();
            var startTime = new Date(endTime - chartRangeInMillis).getTime();

            var rendered = [];
            _.each(zaps, function(zap) {
                var timestamp = Date.parse(zap.timestamp);
                if (timestamp < startTime || timestamp > endTime) {
                    return;
                }
                // どこのスロットに入るかを計算する
                var delta = timestamp - startTime;
                var slotIdx = ZAP_CHART_COUNT_OF_POINTS - Math.floor(delta / ZAP_CHART_REFRESH_INTERVAL_MILLIS);
                slots[slotIdx] += zap.count;
                rendered.push(zap);
            });
            // 今回使用したzapで置き換える。
            // （使用しなかったzapは捨ててメモリを節約）
            zaps = rendered;
//            console.log(slots.join(','));
            renderChart(slots);
        };
    })();

    (function() {
        if ($('#showSlide').val() === 'true') {
            common.embedSlide({
                elemId: 'embedded-player',
                slideId: $('#slideId').val(),
                autoResize: true,
                onsuccess: function(elem) {
                    slidePlayer = elem;
                },
                onerror: function() {
                    alert('エラー');
                }
            });
        }
    })();
});
