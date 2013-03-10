var config = require('./config');
var mongoose = require('mongoose');
var db = mongoose.connect(config.database.url);

console.log(config.database.url);

var Cool = new mongoose.Schema({
    count: Number,
    message: String,
    created: { type: Date, 'default': Date.now, index: true },
    updated: { type: Date, 'default': Date.now },
    eventId: { type: String, index: true },
    userId: { type: String, index: true }
}, {
    'autoIndex': false
});

var Event = new mongoose.Schema({
    title: String
}, {
    'autoIndex': false
});

var User = new mongoose.Schema({
    number: { type: Number, index: { unique: true } },
    name: String,
    displayName: String,
    lastLogin: { type: Date, 'default': Date.now },
    created: { type: Date, 'default': Date.now, index: true },
    updated: { type: Date, 'default': Date.now },
    photos: [String]
}, {
    'autoIndex': false
});


module.exports = {
    Cool: db.model('Cool', Cool),
    Event: db.model('Event', Event),
    User: db.model('User', User)
};
