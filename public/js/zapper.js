(function(_global) {
    var sock;
    /*
    var sock = io.connect(serverUrl);
    sock.on('connect', function() {
        console.log('connected');
    });
    sock.on('disconnect', function() {
        console.log('disconnected');
    });
    */
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

            if (self._currentZapCount === self.maxZapCount) {
                self._currentZapUUID = undefined;
                self._currentZapCount = 0;
                throw new Error('Zap count must be less than ' + self.maxZapCount);
            }
            var uuid = self._currentZapUUID;
            if (!uuid) {
                uuid = self._currentZapUUID = genUuid();
            }
            self._currentZapCount++;
            self._zapEndWatcher = setTimeout(function() {
                var zap = {
                    eventId: self._id,
                    count: self._currentZapCount,
                    uuid: uuid
                };
                sock.emit('zap', zap);
                if (typeof self.onZapSent === 'function') {
                    self.onZapSent(zap);
                }
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
            sock.emit('message', {
                eventId: self._id,
                text: message,
                relatedZapUUID: relatedZapUUID
            });
        },
        subscribe: function(name, callback) {
            sock.on(name, callback);
        }
    };

    var Zapper = function() {
        this._prepareAuthInfo();
    };
    Zapper.prototype = {
        connect: function(callback) {
            var self = this;
            if (!sock || !sock.connected) {
                console.log('Socket.IO disconnected. Try connecting...');
                sock = io.connect(serverUrl);
                sock.on('connect', function() {
                    console.log('connected');
                    self.initialized = true;
                    callback();
                });
                sock.on('disconnect', function() {
                    console.log('disconnected');
                });
                sock.on('error', function(err) {
                    alert('Socket.IO Error:' + err.message);
                    console.error(err);
                });
            } else {
                self.connected = true;
                callback();
            }
        },
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
//                    self.init(options, callback);
                } else {
                    callback(new Error('auth error'));
                }
            }, watchInterval);
        },
        logout: function() {
            this.loggedIn = false;
            this.user = null;
            delete window.__lt_oauth_succeeded__;
            delete window.__lt_logged_in_user__;
        },
        getLatestEvent: function(callback) {
            var self = this;
            $.ajax({
                dataType: 'json',
                url: '/events/latest'
            }).done(function(result) {
                callback(null, self.event(result));
            }).fail(function(error) {
                callback(error);
            });
        },
        getEvent: function(id, callback) {
            $.ajax({
                dataType: 'json',
                url: '/events/' + encodeURI(id)
            }).done(function(result) {
                callback(null, self.event(result));
            }).fail(function(error) {
                callback(error);
            });
        },
        event: function(eventObj) {
            return new zEvent(this, eventObj);
        }
    };
    _global.Zapper = Zapper;
})(this);
