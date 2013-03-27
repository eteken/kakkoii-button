(function(_global) {
    var _socket;
    function socket() {
        if (!_socket) {
            _socket = io.connect(serverUrl);
        }
        return _socket;
    }
    
    var serverUrl = location.protocol + '//' + location.host;
    
    var LTEvent = function(data) {
        _.extend(this, data);
    };
    LTEvent.prototype = {
        subscribe: function(name, callback) {
            var sock = socket();
            sock.on(name, fn);
        }
    };

    var LiveTerminal = function() {
        this._prepareAuthInfo();
    };
    LiveTerminal.prototype = {
        _prepareAuthInfo: function() {
            if (window.__lt_oauth_succeeded__) {
                this.loggedIn = true;
                this.user = window.__lt_logged_in_user__;
                delete window.__lt_oauth_succeeded__;
                delete window.__lt_logged_in_user__;
            }
        },
        login: function(options, callback) {
            var self = this;
            options = options || {};
            var windowOptions = options.windowOptions || 'location=0,status=0,width=600,height=400';
            var windowName = options.windowName || 'OAuthPopupWindow';
            var watchInterval = options.watchInterval || 500;
            var win = window.open('/auth/twitter', windowName, windowOptions);
            var watch = setInterval(function() {
                if (!win.closed) {
                    return;
                }
                clearInterval(watch);
                if (window.__lt_oauth_succeeded__) {
                    self._prepareAuthInfo();
                    callback(null, user);
                } else {
                    callback(new Error('auth error'));
                }
            }, watchInterval);
        },
        getLiveEvent: function(callback) {
            $.ajax({
                dataType: 'json',
                url: '/events/live'
            }).done(function(result) {
                callback(null, new LTEvent(result));
            }).fail(function(error) {
                callback(error);
            });
        },
        getEvent: function(id, callback) {
            $.ajax({
                dataType: 'json',
                url: '/events/' + encodeURI(id)
            }).done(function(result) {
                callback(null, new LTEvent(result));
            }).fail(function(error) {
                callback(error);
            });
        }
    };
    _global.LiveTerminal = LiveTerminal;
})(this);
