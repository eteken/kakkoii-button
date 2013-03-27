var config = require('./config');
var mongoose = require('mongoose');
var db = mongoose.connect(config.database.url);

var Cool = new mongoose.Schema({
    count: { type: Number, required: true },
    message: String,
    created: { type: Date, 'default': Date.now, index: true },
    updated: { type: Date, 'default': Date.now },
    eventId: { type: String, index: true, required: true },
    userId: { type: String, index: true, required: true },
    uuid: { type: String, index: { unique: true }, required: true }
}, {
    'autoIndex': false
});

var Event = new mongoose.Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    created: { type: Date, 'default': Date.now },
    updated: { type: Date, 'default': Date.now },
}, {
    'autoIndex': false
});

var Guest = new mongoose.Schema({
    name: { type: String, required: true },
    eventId: { type: String, required: true }
}, {
    'autoIndex': false
});
var User = new mongoose.Schema({
    number: { type: Number, index: { unique: true }, required: true },
    name: { type: String, required: true },
    displayName: { type: String, required: true },
    lastLogin: { type: Date, 'default': Date.now },
    created: { type: Date, 'default': Date.now, index: true },
    updated: { type: Date, 'default': Date.now },
    photos: [String]
}, {
    'autoIndex': false
});

var OAuthTokens = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    serviceId_userId: { type: String, required: true, index: { unique: true }},
    token: { type: String, required: true },
    tokenSecret: { type: String, required: true },
    updated: { type: Date, 'default': Date.now }
});

module.exports = {
    Cool: db.model('Cool', Cool),
    Event: db.model('Event', Event),
    OAuthTokens: db.model('OAuthTokens', OAuthTokens),
    User: db.model('User', User)
};
