$(function() {
    var zapper = new Zapper()
    , currentEvent
    , zaps = []
    , messages = []
    , $messageInput = $('#message-input')
    , $zapButton = $('#zap-button')
    , $postMessageButton = $('#post-message-button')
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
    , zapChart;

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
                        fillColor : "transparent",
                        strokeColor : "#2add96",
                        data : counts
                    }
                ]
            };
            zapChart.Line(data, {
                pointDot: false,
                bezierCurve: true,
                scaleOverride : true,
                scaleSteps : scaleSteps,
                scaleStepWidth : scaleStepWidth,
                scaleStartValue : scaleStepWidth,
                animation: false
            });
        };
    })();

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
                $zapButton.removeAttr('disabled');
                zaps.push(zap);
            });
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                onMessageArrived(message);
            });
            //            zaps = __lt_zaps__;
            messages = __lt_messages__;
            delete window.__lt_messages__;

            (function initChart() {
                // CSSでcanvasの幅を指定しているが、width属性とheight属性にも指定しておく
                var $chart = $(chart);
                $chart.attr($chart.css(['width', 'height']));
                // 外部スコープの変数に保存
                chartCtx = $chart[0].getContext('2d')
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
                    message.ts = timestamp2Label(message.timestamp);
                    buf.push(messageTemplate(message));
                }
                $('.messages').html(buf.join(''));
            })();
        });
    }
    
    var onMessageArrived = function(message) {
        message.ts = timestamp2Label(message.timestamp);
        var html = messageTemplate(message);
        $('.message:first').before(html);
    };
    
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

    $zapButton.click(function() {
        var zap = currentEvent.zap();
        if (zap.count === zapper.maxZapCount) {
            $(this).attr('disabled', 'disabled');
        }
    });
    $postMessageButton.click(function() {
        var message = $messageInput.val();
        if (message.length === 0) {
            alert('メッセージを入力して下さい');
            return;
        }
        currentEvent.sendMessage(message);
        $messageInput.val('');
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

            var zappers = {};
            var rendered = [];
            _.each(zaps, function(zap) {
                var timestamp = Date.parse(zap.timestamp);
                if (timestamp < startTime || timestamp > endTime) {
                    return;
                }
                zappers[zap.author._id] = zap.author;
                // どこのスロットに入るかを計算する
                var delta = timestamp - startTime;
                var slotIdx = Math.floor(delta / ZAP_CHART_REFRESH_INTERVAL_MILLIS);
                slots[slotIdx] += zap.count;
                rendered.push(zap);
            });
            // 今回使用したzapで置き換える。
            // （使用しなかったzapは捨ててメモリを節約）
            zaps = rendered;
//            console.log(slots.join(','));
            renderChart(slots);
            $zapperIcons.empty();
            // アイコンを出す
            _.each(zappers, function(author) {
                var $li = $(document.createElement('li'));
                var $img = $(document.createElement('img'));
                $img.attr('src', author.photo);
                $img.addClass('icon').appendTo($li);
                $zapperIcons.append($li);
            });
        };
    })();
});
