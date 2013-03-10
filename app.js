var express = require('express'),
http = require('http'),
passport = require('passport'),
config = require('./config'),
models = require('./models'),
routes = require('./routes'),
util = require('util')

, TwitterStrategy = require('passport-twitter').Strategy;

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Twitter profile is serialized
//   and deserialized.
passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(obj, done) {
    done(null, obj);
});


// Use the TwitterStrategy within Passport.
//   Strategies in passport require a `verify` function, which accept
//   credentials (in this case, a token, tokenSecret, and Twitter profile), and
//   invoke a callback with a user object.
passport.use(new TwitterStrategy({
    consumerKey: config.twitter.consumerKey,
    consumerSecret: config.twitter.consumerSecret,
    callbackURL: "http://127.0.0.1:3000/auth/twitter/callback"
},
                                 function(token, tokenSecret, profile, done) {
                                     // console.log(JSON.stringify(profile));
                                     var now = Date.now();
                                     models.User.findOneAndUpdate(
                                         { number: profile.id },
                                         {
                                             number: profile.id,
                                             name: profile.username,
                                             displayName: profile.displayName,
                                             photos: profile.photos.map(function(entry) { return entry.value; }),
                                             lastLogin: now,
                                             updated: now
                                         },
                                         {
                                             upsert: true
                                         },
                                         done);
                                 }
                                ));




var app = express();

// configure Express
app.configure(function(){
    app.set('port', process.env.PORT || 3000);
    app.set('views', __dirname + '/views');
    app.set('view engine', 'ejs');
    app.use(express.favicon());
    app.use(express.logger('dev'));
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(express.cookieParser('your secret here'));
    app.use(express.session());
    // Initialize Passport!  Also use passport.session() middleware, to support
    // persistent login sessions (recommended).
    app.use(passport.initialize());
    app.use(passport.session());
    app.use(app.router);
    app.use(require('less-middleware')({ src: __dirname + '/public' }));
    app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
    app.use(express.errorHandler());
});

app.get('/', routes.index);

app.get('/', function(req, res){
    res.render('index', { user: req.user });
});

app.get('/account', ensureAuthenticated, function(req, res){
    res.render('account', { user: req.user });
});

app.get('/login', function(req, res){
    res.render('login', { user: req.user });
});

// GET /auth/twitter
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in Twitter authentication will involve redirecting
//   the user to twitter.com.  After authorization, the Twitter will redirect
//   the user back to this application at /auth/twitter/callback
app.get('/auth/twitter',
        passport.authenticate('twitter'),
        function(req, res){
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
        function(req, res) {
            res.redirect('/');
        });

app.get('/logout', function(req, res){
    req.logout();
    res.redirect('/');
});

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

server.listen(app.get('port'), function(){
    console.log("Express server listening on port " + app.get('port'));
});


// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) { return next(); }
    res.redirect('/login')
}
