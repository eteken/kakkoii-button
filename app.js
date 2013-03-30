var express = require('express')
, connect = require('connect')
, http = require('http')
, OAuth = require('oauth').OAuth
, passport = require('passport')
, config = require('./config')
, models = require('./models')
, mongoose = require('mongoose')
, routes = require('./routes')
, util = require('util')
, _ = require('underscore')._
, TwitterStrategy = require('passport-twitter').Strategy
, MongoStore = require('connect-mongo')(express)
, TWITTER_CONSUMER_KEY = config.twitter.consumerKey
, TWITTER_CONSUMER_SECRET = config.twitter.consumerSecret;


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
    callbackURL: "http://localhost:3000/auth/twitter/callback"
},
                                 function (token, tokenSecret, profile, done) {
                                     // console.log(JSON.stringify(profile));
                                     var now = Date.now();
                                     models.User.findOne({ number: profile.id }, function(err, original) {
                                         if (err) {
                                             done(err);
                                             return;
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
                                         done(err, user);
                                         user.save(function(err, result) {
                                             done(err, result);

                                         });
                                     });
                                 }
                                ));


var app = express();
var cookieParser = express.cookieParser('kakkoii.tv')
, sessionStore = new MongoStore({
    db: mongoose.connection.db
});

// configure Express
app.configure(function () {
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(cookieParser);
    app.use(express.session({
        store: sessionStore,
        secret: 'kakkoii.tv',
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
        next();
    });
    app.use(app.router);
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function () {
    app.use(express.errorHandler());
});

app.get('/', function (req, res) {
    console.log(JSON.stringify(req.user));
    res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function (req, res) {
    res.render('account', { user: req.user });
});

app.get('/login', function (req, res) {
    res.render('login', { user: req.user });
});

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
        passport.authenticate('twitter', { failureRedirect: '/login' }),
        function (req, res) {
            req.session.user = req.user;
            // セッション内のuserオブジェクトには、OAuthのトークン情報が含まれてしまっているので除去する
            var clone = _.clone(req.user);
            delete clone.oauthToken;
            var userStr = JSON.stringify(clone);
            
            res.end('<script>opener.__lt_oauth_succeeded__=true;' +
                    'opener.__lt_logged_in_user__=' + userStr + ';' +
                    'window.close();</script>');
            //        res.redirect('/');
        });

app.get('/logout', function (req, res) {
    req.logout();
    res.redirect('/');
});

app.get('/*.html', function(req, res) {
    res.render(req.params[0]);
});

app.get('/events/live', function(req, res) {
    var now = new Date();
    models.Event.findOne(
        { start: { $lte: now }, end: { $gte: now } },
        function(err, doc) {
            res.json(doc);
        });
});

app.post('/events', function(req, res) {
    var now = new Date();
    var event = new models.Event();
    var reqBody = req.body;
    event.title = reqBody.title;
    event.start = new Date(reqBody.start);
    event.end = new Date(reqBody.end);
    event.created = now;
    event.updated = now;
    event.save(function(err, result) {
        if (err) {
            res.status(500);
            return;
        }
        res.render('events/create', {
            messages: ['作成に成功しました'],
            event: event
        });
    });
});

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
var SessionSockets = require('session.socket.io')
, sessionSockets = new SessionSockets(io, sessionStore, cookieParser);

sessionSockets.on('connection', function (err, socket, session) {
    var user = session.user;
    var oauthToken = user.oauthTokens.twitter;

    socket.on('zap', function (z) {
        var now = Date.now();
        var zap = new models.Zap(z);
        zap.created = now;
        zap.updated = now;
        zap.author = {
            _id: user._id,
            name: user.name,
            displayName: user.displayName,
            photo: user.photos[0]
        };
        zap.save(function (err) {
            socket.broadcast.emit('zap', zap);
            socket.emit('zap', zap);
        });
    });
    socket.on('message', function(msg) {
        var now = Date.now();
        var message = new models.Message(msg);
        message.userId = user._id;
        message.created = now;
        message.updated = now;
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
            socket.broadcast.emit('message', message);
            socket.emit('message', message);

//            postToTwitter(user, oauthToken, message.text);
        });
    });
    socket.on('disconnect', function () {
        //        session.destroy();
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
