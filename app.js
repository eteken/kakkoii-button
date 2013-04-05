var express = require('express')
, partials = require('express-partials')
, Session = express.session.Session
, connect = require('connect')
, http = require('http')
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

var URL = 'http://localhost:3000';
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
    app.set('port', process.env.PORT || 3000);
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
        next();
    });
    app.use(partials());
    app.use(app.router);
//    app.use(require('less-middleware')({ src: __dirname + '/public' }));
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

app.get('/', function (req, res) {
    var eventId = req.param('eventId');
    console.log('eventId:' + eventId);
    if (!eventId) {
        //TODO
        res.send(404);
        return;
    }
    async.waterfall([
        function(callback) {
            models.Event.findById(eventId).exec(callback);
        },
        function(event, callback) {
            if (!event) {
                res.send(404);
                return;
            }
            async.parallel([
                // zapの取得（最新のN分ぶんのみ）
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
                    throw err;
                }
                res.render('index', {
                    event: event.toObject({getters: true}),
                    zaps: results[0],
                    messages: results[1],
                    user: req.user
                });
            });
        }
    ]);
});
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
    saveEvent(req.body, eventId,  function(err, event) {
        if (err) {
            return res.send(500, err);
        }
        addUserMessage(res, 'info', 'イベントの更新に成功しました');
        res.render('admin/events/editor', {
            event: event
        });
    });
});
app.put('/admin/events', function(req, res) {
    saveEvent(req.body, null, function(err, event) {
        if (err) {
            return res.send(500, err);
        }
        addUserMessage(res, 'info', 'イベントの作成に成功しました');
        res.render('admin/events/editor', {
            event: event
        });
    });
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

function saveEvent(params, id, done) {
    var now = new Date();
    if (id) {
        models.Event.findOneAndUpdate({_id: id}, params, done);
    } else {
        models.Event.create(params, done);
    }    
}

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
    var session = socket.handshake.session;
    // セッションがない場合は、どうする？接続切りたいが
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

    socket.on('zap', function (z) {
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
//            postToTwitter(user, oauthToken, message.text);
        });
    });
    socket.on('disconnect', function () {
        socket.broadcast.emit('leave', socket.id);
    });
});

function postToTwitter(user, oauthToken, message) {
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
        {status: message}, // post_body,
        null, // post_content_type,
        function(error, data, response) { //callback
            if (error)
                console.log('status:' + error.statusCode);
            console.log('data:' + data);
        }
    );
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
