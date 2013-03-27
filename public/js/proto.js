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
            var liveEvent = liveTerminal.getLiveEvent(function(err, event) {
                if (err) {
                    alert('エラーが発生しました:' + err.message);
                    return;
                }
                liveEvent = event;
                event.subscrive('zap', function(zap) {
                    console.log(zap);
                });
                switchScreen('#login-screen', '#main-screen', main);
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
