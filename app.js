var express = require('express')
, partials = require('express-partials')
, Session = express.session.Session
, connect = require('connect')
, http = require('http')
, https = require('https')
, OAuth = require('oauth').OAuth
, passport = require('passport')
, config = require('./config')
, models = require('./models')
, mongoose = require('mongoose')
, util = require('util')
, async = require('async')
, _ = require('underscore')._
, TwitterStrategy = require('passport-twitter').Strategy
, MongoStore = require('connect-mongo')(express)
, TWITTER_CONSUMER_KEY = config.twitter.consumerKey
, TWITTER_CONSUMER_SECRET = config.twitter.consumerSecret;

var ZAP_INITIAL_LOAD_MINUTES = 5;
var MESSAGES_PAGE_COUNT = 100;
// DBから設定を定期的に読みだす
var appSettings = {};
setInterval(function() {
    models.Setting.find({}, function(err, results) {
        if (err) {
            return console.error(err);
        }
        if (results.length === 0) {
            appSettings = {};
        } else {
            appSettings = results[0].value;
        }
    });
}, 5000);

var shortenUrl = (function() {
    var apiUrl = 'https://api-ssl.bitly.com/v3/shorten';
    var accessToken = encodeURIComponent(config.bitly.accessToken);
    
    return function(url, done) {
        url = encodeURIComponent(url);
        var accessUrl = [apiUrl, '?access_token=', accessToken, '&longUrl=', url].join('');
        https.get(accessUrl, function(res) {
            if (res.statusCode !== 200) {
                return done(new Error('Error status code:' + res.statusCode));
            }
            res.setEncoding('utf-8');
            res.on('data', function(body) {
                var result = JSON.parse(body);
                if (result.status_code !== 200) {
                    return done(new Error('Error status code:' + result.status_code));
                }
                done(null, result.data.url);
            });
        }).on('error', function(e) {
            done(e);
        });
    };
})();

var app = express();
var cookieParser = express.cookieParser('kakkoii.tv')
, sessionStore = new MongoStore({
    db: mongoose.connection.db
});
var SESSION_SECRET = 'kakkoii.tv';

app.locals.fmtDate = function(date) {
    return date ? date.toISOString() : '';
};

// configure Express
app.configure(function () {
    app.set('port', process.env.PORT || 3001);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.static(__dirname + '/public'));
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(cookieParser);
    app.use(express.session({
        store: sessionStore,
        secret: SESSION_SECRET,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7 // 7 days
        }
    }));
    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(function(req, res, next){
        res.locals.user = req.session.user || null;
        res.locals.messages = {};
        res.locals.appSettings = appSettings
        next();
    });
    app.use(partials());
    app.use(app.router);
});

app.configure('development', function () {
    app.use(express.errorHandler());
});


var URL = 'http://localhost:' + app.get('port');
(function() {
    var args = process.argv;
    if (args.length > 2) {
        for (var i = 0; i < args.length; i++) {
            if (args[i].match(/^\-\-url\=(.+)$/)) {
                URL = RegExp.$1;
                break;
            }
        }
    }
})();
console.log('URL: ' + URL);

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Twitter profile is serialized
//   and deserialized.
passport.serializeUser(function (user, done) {
    done(null, user._id);
});

passport.deserializeUser(function (id, done) {
    models.User.findById(id, done);
});


// Use the TwitterStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Twitter profile), and
//   invoke a callback with a user object.
passport.use(new TwitterStrategy({
    consumerKey: TWITTER_CONSUMER_KEY,
    consumerSecret: TWITTER_CONSUMER_SECRET,
    callbackURL: URL + "/auth/twitter/callback"
}, function (token, tokenSecret, profile, done) {
    // console.log(JSON.stringify(profile));
    var now = Date.now();
    return models.User.findOne({ number: profile.id }, function(err, original) {
        if (err) {
            return done(err);
        }
        var user = original;
        if (!original) {
            user = new models.User();
            user.created = now;
        }
        user.number = profile.id;
        user.name = profile.username;
        user.displayName = profile.displayName;
        user.photos = profile.photos.map(function (entry) {
            return entry.value;
        });
        user.lastLogin = now;
        user.updated = now;
        
        user.oauthTokens = {
            twitter: {
                token: token,
                tokenSecret: tokenSecret
            }
        };
        user.save(done);
    });
}));


app.get('/', function (req, res) {
    var eventId = req.param('eventId');
    if (!eventId) {
        //TODO
        res.send(404);
        return;
    }
    collectInitialData(eventId, function(err, result) {
        res.render('index', {
            event: result.event.toObject({getters: true}),
//            zaps: result.zaps,
            messages: result.messages,
            user: req.user
        });
    });
});

function collectInitialData(eventId, done) {
    async.waterfall([
        function(callback) {
            models.Event.findById(eventId).exec(callback);
        },
        function(event, callback) {
            if (!event) {
                return done(new Error('Event not found'));
            }
            async.parallel([
                // zapの取得（最新のN分ぶんのみ）
                /*
                function(callback) {
                    var to = Date.now();
                    var from = to - (ZAP_INITIAL_LOAD_MINUTES * 60 * 1000);
                    models.Zap.find(
                        {
                            eventId: event.id,
                            timestamp: {
                                $gt: from,
                                $lte: to
                            }
                        },
                        'count timestamp author',
                        { sort: 'timestamp' },
                        callback);
                },
                */
                // メッセージの取得（最新のN件のみ）
                function(callback) {
                    models.Message.find({ eventId: event._id })
                        .select('text timestamp author zap seq')
                        .sort('-seq')
                        .limit(MESSAGES_PAGE_COUNT)
                        .exec(callback);
                    
                }
            ], function(err, results) {
                if (err) {
                    done(err);
                } else {
                    done(null, {
                        event: event,
//                        zaps: results[0],
                        messages: results[0]
                    });
                }
            });
        }
    ]);
}
/*
  app.get('/account', ensureAuthenticated, function (req, res) {
  res.render('account', { user: req.user });
  });

  app.get('/login', function (req, res) {
  res.render('login', { user: req.user });
  });
*/
// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
app.get('/auth/twitter',
        passport.authenticate('twitter'),
        function (req, res) {
            // The request will be redirected to Twitter for authentication, so this
            // function will not be called.
        });

// GET /auth/twitter/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/twitter/callback',
        passport.authenticate('twitter', { failureRedirect: '/auth/failed' }),
        function(req, res) {
            req.session.user = req.user;
            console.log('User object is persisted to session:' + JSON.stringify(req.session.user));
            // セッション内のuserオブジェクトには、OAuthのトークン情報が含まれてしまっているので除去する
            var clone = _.clone(req.session.user);
            delete clone.oauthToken;
            var userStr = JSON.stringify(clone);
            res.end('<script>opener.__lt_oauth_succeeded__=true;' +
                    'opener.__lt_logged_in_user__=' + userStr + ';' +
                    'window.close();</script>');
        });
app.get('/auth/failed',
        function(req, res) {
            res.end('<script>opener.__lt_oauth_succeeded__=false;window.close();</script>');
        });

app.get('/logout', function (req, res) {
    req.session.destroy();
    req.logout();
    res.end('<!DOCTYPE html><meta charset="UTF-8"><title>ログアウトに成功しました</title><h1>ログアウトに成功しました。</h1>');
});

app.get('/*.html', function(req, res) {
    res.render(req.params[0]);
});

app.get('/events/latest', function(req, res) {
    var now = new Date();
    models.Event.findOne(
        {},
        {
            sort: '-start'
        },
        function(err, doc) {
            res.json(doc);
        });
});
app.all('/admin/*', express.basicAuth('admin', 'kakkoii.tv.0'));

app.get(/^\/admin\/$/, function(req, res) {
    res.redirect('/admin/index.html');
});

app.get('/admin/settings', function(req, res) {
    return res.render('admin/settings/index');
});
app.post('/admin/settings', function(req, res) {
    var done = function(err, result) {
        if (err) {
            return res.send(500, err);
        }
        appSettings = result.value;
        res.locals.appSettings = appSettings;
        addUserMessage(res, 'info', '設定を保存しました');
        return res.render('admin/settings/index');
    };
    models.Setting.findOne({}, function(err, result) {
        if (err) {
            return res.send(500, err);
        }
        if (!result) {
            models.Setting.create({
                value: req.body
            }, done);
        } else {
            result.value = req.body;
            result.updated = new Date();
            result.save(done);
        }
    });
});
app.get('/admin/events', function(req, res) {
    models.Event.find().sort('-start').exec(function(err, events) {
        if (err) {
            return res.send(500, err);
        }
        return res.render('admin/events/index', {
            events: events
        });
    });
});
app.get('/admin/events/create', function(req, res) {
    return res.render('admin/events/editor', {
        event: {}
    });
});
app.get('/admin/events/edit', function(req, res) {
    var eventId = req.param('id');
    models.Event.findById(eventId).exec(function(err, event) {
        if (err) {
            return res.send(500, err);
        }
        if (!event) {
            return res.send(404);
        }
        return res.render('admin/events/editor', {
            event: event
        });
    });
});

app.post('/admin/events/:id', function(req, res) {
    var eventId = req.param('id');
    var params = req.body;
    var done = function(err, event) {
        if (err) {
            return res.send(500, err);
        }
        addUserMessage(res, 'info', 'イベントの作成に成功しました');
        res.render('admin/events/editor', {
            event: event
        });
    };
    async.waterfall([
        function(callback) {
            models.Event.findById(eventId, callback);
        },
        function(event, callback) {
            var linkUpdated = params.link && params.link !== event.link;
            _.extend(event, params);
            if (linkUpdated) {
                async.waterfall([
                    function(callback) {
                        shortenUrl(params.link, callback);
                    },
                    function(shortUrl, callback) {
                        event.shortLink = shortUrl;
                        event.save(callback);
                    }
                ], function(err, results) {
                    if (err) {
                        callback(err);
                    } else {
                        if (results instanceof Array) {
                            callback(null, results[0]);
                        } else {
                            callback(null, results);
                        }
                    }
                });
            } else {
                event.save(callback);
            }
        }
    ], done);
});
app.put('/admin/events', function(req, res) {
    var done = function(err, event) {
        if (err) {
            return res.send(500, err);
        }
        addUserMessage(res, 'info', 'イベントの作成に成功しました');
        res.render('admin/events/editor', {
            event: event
        });
    };
    var params = req.body;
    if (params.link) {
        async.waterfall([
            function(callback) {
                shortenUrl(params.link, callback);
            },
            function(shortUrl, callback) {
                params.shortLink = shortUrl;
                models.Event.create(params, done);
            }
        ], function(err, results) {
            if (err) {
                done(err);
            } else {
                if (results instanceof Array) {
                    callback(null, results[0]);
                } else {
                    callback(null, results);
                }
            }
        });
    } else {
        models.Event.create(params, done);
    }
});
app.delete('/admin/events/:id', function(req, res) {
    var eventId = req.param('id');
    models.Event.findByIdAndRemove(eventId, function(err) {
        if (err) {
            return res.send(500, err);
        }
        addUserMessage(res, 'info', 'イベントの削除に成功しました');
        res.redirect('/admin/events');
    });
});

function addUserMessage(res, type, msg) {
    var messages = res.locals.messages;
    if (!messages) {
        res.local.messages = messages = {};
    }
    var arr = messages[type];
    if (!arr) {
        messages[type] = arr = [];
    }
    arr.push(msg);
}

app.get('/events/:id/messages', function(req, res) {
    models.Message.find(
        { eventId: req.param('id') },
        null,
        { timestamp: 0 },
        function(err, messages) {
            if (err) {
                throw err;
            }
            res.json(messages);
        });
});
app.get('/events/embed', function(req, res) {
    var eventId = req.param('id');
    if (!eventId) {
        res.send(404);
        return;
    }
    var showSlide = req.param('slide') === '1';
    collectInitialData(eventId, function(err, result) {
        res.render('events/embed', {
            event: result.event.toObject({getters: true}),
//            zaps: result.zaps,
            messages: result.messages,
            user: req.user,
            showSlide: showSlide
        });
    });
});

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

server.listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});

io.set('authorization', function(handshakeData, callback) {
    var cookie = handshakeData.headers.cookie;
    if (!cookie) {
        return callback(new Error('Cannot find cookie'), false);
    }
    cookie = require('cookie').parse(decodeURIComponent(cookie));
    cookie = connect.utils.parseSignedCookies(cookie, SESSION_SECRET);
    var sessionID = cookie['connect.sid'];
    if (!sessionID) {
        return callback(new Error('Cannot obtain sessionID'));
    }
    sessionStore.get(sessionID, function(err, session) {
        if (err) {
            callback('Cannot get session: ' + err.message, false);
        } else if (!session) {
            console.log('session not found');
            callback('session not found', false);
        } else {
            console.log('Session found! ' + JSON.stringify(session));
            handshakeData.cookie = cookie;
            handshakeData.sessionID = sessionID;
            handshakeData.sessionStore = sessionStore;
            handshakeData.session = new Session(handshakeData, session);
            callback(null, true);
        }
    });
});

io.sockets.on('connection', function(socket) {
    console.log('connected');
    // セッションが存在しない場合、
    // この接続は読み取り専用のセッションとなる。
    var loggedIn = false;
    var session = socket.handshake.session;
    var user, oauthToken;
    if (session) {
        user = session.user;
        if (user) {
            oauthToken = user.oauthTokens.twitter;
            loggedIn = true;
        }
    }
    /*
    if (!session) {
        console.log('Session not found. Disconnect:' + socket.id);
        socket.disconnect(true);
        return;
    }
    console.log('Session found. Keep connection.');
    var user = session.user;
    if (!user) {
        console.log('User not found in session. Session ID: ' + session.id);
        socket.disconnect(true);
        return;
    }
    var oauthToken = user.oauthTokens.twitter;
    */

    socket.on('zap', function (z) {
        if (!loggedIn) {
            console.warn('Zapped on unauthorized connection.ID:' + socket.id);
            return;
        }
        var now = Date.now();
        var zap = new models.Zap(z);
        zap.timestamp = now;
        zap.author = {
            _id: user._id,
            name: user.name,
            displayName: user.displayName,
            photo: user.photos[0]
        };
        zap.save(function (err) {
            if (err) {
                throw err;
            }
            io.sockets.json.emit('zap', zap);
        });
    });
    socket.on('message', function(msg) {
        if (!loggedIn) {
            console.warn('Sent message on unauthorized connection.ID:' + socket.id);
            return;
        }
        var now = Date.now();
        var message = new models.Message(msg);
        message.userId = user._id;
        message.timestamp = now;
        message.author = {
            _id: user._id,
            name: user.name,
            displayName: user.displayName,
            photo: user.photos[0]
        };
        message.save(function(err) {
            if (err) {
                throw err;
            }
            io.sockets.json.emit('message', message);
            postToTwitter(user, oauthToken, message);
        });
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('leave', socket.id);
    });
});

function postToTwitter(user, oauthToken, message) {
    if (!appSettings.tweetWithMessage) {
        return;
    }
    models.Event.findById(message.eventId, function(err, event) {
        if (err) {
            return console.error(err);
        }
        if (!event) {
            return console.log('Cannot find event. ID:' + message.eventId);
        }
        var footer = [];
        var footerLen = 0;
        if (event.hashtag) {
            var hashtag = '#' + event.hashtag;
            footer.push(hashtag);
            footerLen += hashtag.length;
            footerLen += 1; // space
        }
        if (event.shortLink) {
            var shortLink = event.shortLink;
            footer.push(shortLink);
            var twitterShortUrlLength;
            if (shortLink.indexOf('https') === 0) {
                twitterShortUrlLength = 23; // Twitterの短縮URLはHTTP:22文字、HTTPS:23文字
            } else {
                twitterShortUrlLength = 22;
            }
            footerLen += (shortLink.length < twitterShortUrlLength ? twitterShortUrlLength : shortLink.length);
            footerLen += 1; // space
        }
        footer = footer.join(' ');
        var maxMessageLen = 140 - footerLen;
        var messageText = message.text;
        if (messageText.length > maxMessageLen) {
            messageText = messageText.substring(0, maxMessageLen - 1) + '…';
        }
        messageText += ' ' + footer;
        console.log('maxMessageLen:' + maxMessageLen);
        console.log(messageText);
        var oauth = new OAuth(
            null, // requestUrl,
            null, // accessUrl
            TWITTER_CONSUMER_KEY, // consumerKey,
            TWITTER_CONSUMER_SECRET, // consumerSecret
            '1.0', // version
            null, // authorize_callback
            'HMAC-SHA1', // signatureMethod
            null, // nonceSize
            null // customHeaders
        );
        oauth.post(
            'https://api.twitter.com/1.1/statuses/update.json', // url,
            oauthToken.token, // oauth_token,
            oauthToken.tokenSecret, // oauth_token_secret,
            {status: messageText}, // post_body,
            null, // post_content_type,
            function(error, data, response) { //callback
                if (error)
                    console.log('status:' + error.statusCode);
                console.log('data:' + data);
            }
        );
        
    });
}

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login')
}


// Coolの新規作成、更新（カウントを1増やす、メッセージを追加する）。ツイッターに投稿
// 全クライアントにそれを通知（ツイッターのアイコンのために、ユーザー情報も）
// イベントの新規作成、更新、削除
