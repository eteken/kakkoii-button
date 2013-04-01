(function(_global) {
    var _socket;
    function getSocket(callback) {
        if (!_socket) {
            _socket = io.connect(serverUrl);
            _socket.on('connect', function() {
                callback(_socket);
            });
        }
        setTimeout(function() {
            callback(_socket);
        }, 0);
    }
    var genUuid = (function(){
        var S4 = function() {
            return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
        }   
        return function() {
            return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4() +S4());
        };
    })();
    var ZAP_REPEAT_MAX_INTERVAL = 400;
    
    var serverUrl = location.protocol + '//' + location.host;
    
    var zEvent = function(zapper, data) {
        this.zapper = zapper;
        _.extend(this, data);
        this._zapCallbacks = {};
    };
    zEvent.prototype = {
        maxZapCount: 5,
        _currentZapCount: 0,
        zap: function() {
            var self = this;
            clearInterval(self._zapEndWatcher);

            if (self._currentZapCount + 1 === self.maxZapCount) {
                throw new Error('Zap count must be less than ' + self.maxZapCount);
            }
            var uuid = self._currentZapUUID;
            if (!uuid) {
                uuid = self._currentZapUUID = genUuid();
            }
            self._currentZapCount++;
            self._zapEndWatcher = setTimeout(function() {
                getSocket(function(sock) {
                    var zap = {
                        eventId: self._id,
                        count: self._currentZapCount,
                        uuid: uuid
                    };
                    sock.emit('zap', zap);
                    if (typeof self.onZapSent === 'function') {
                        self.onZapSent(zap);
                    }
                });
                self._currentZapUUID = undefined;
                self._currentZapCount = 0;
            }, ZAP_REPEAT_MAX_INTERVAL);
            return {
                uuid: uuid,
                count: self._currentZapCount
            };
        },
        sendMessage: function(message, relatedZapUUID) {
            var self = this;
            getSocket(function(sock) {
                sock.emit('message', {
                    eventId: self._id,
                    text: message,
                    relatedZapUUID: relatedZapUUID
                });
            });
        },
        subscribe: function(name, callback) {
            getSocket(function(sock) {
                sock.on(name, callback);
            });
        }
    };

    var Zapper = function() {
        this._prepareAuthInfo();
    };
    Zapper.prototype = {
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
                    callback(null, self.user);
                } else {
                    callback(new Error('auth error'));
                }
            }, watchInterval);
        },
        getLatestEvent: function(callback) {
            var self = this;
            $.ajax({
                dataType: 'json',
                url: '/events/latest'
            }).done(function(result) {
                callback(null, new zEvent(self, result));
            }).fail(function(error) {
                callback(error);
            });
        },
        getEvent: function(id, callback) {
            $.ajax({
                dataType: 'json',
                url: '/events/' + encodeURI(id)
            }).done(function(result) {
                callback(null, new zEvent(self, result));
            }).fail(function(error) {
                callback(error);
            });
        }
    };
    _global.Zapper = Zapper;
})(this);