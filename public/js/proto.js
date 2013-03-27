$(function() {
    if (typeof window.setImmediate !== 'function') {
        window.setImmediate = async.setImmediate = async.nextTick = function(callback) {
            setTimeout(callback, 0);
        };
    }
    var liveEvent;
    var liveTerminal = new LiveTerminal();

    if (!liveTerminal.loggedIn) {
        switchScreen('#splash-screen', '#login-screen');
    } else {
        switchScreen('#splash-screen', '#main-screen', main);
    }
    
    $('#login-command').click(function(){
        liveTerminal.login(null, function(err, user) {
            if (err) {
                return;
            }
            async.waterfall([
                // イベントデータの取得
                function(callback) {
                    LiveTerminal.Event.live(function(err, event) {
                        liveEvent = event;
                        callback(null, event)
                    });
                },
                function(event, callback) {
                    LiveTerminal.Zap.subscribe(event._id, function(zap) {
                        console.log(zap);
                    });
                    switchScreen('#login-screen', '#main-screen', main);
                    callback();
                }
            ], function(err) {
                if (err) {
                    alert('エラーが発生しました:' + err.message);
                }
            });
            
        });
    });
    function main() {
        
    }
    function switchScreen(prev, next, callback) {
        setTimeout(function() {
            $(prev).fadeOut(function() {
                $(next).fadeIn(callback);
            });
        }, 1000);
    }
});
