var config = require('./config');
var mongoose = require('mongoose');
var dbUrl = 'mongodb://' + config.database.host + '/' + config.database.name;
var db = mongoose.connect(dbUrl);

var Zap = new mongoose.Schema({
    count: { type: Number, required: true },
    timestamp: { type: Date, 'default': Date.now, index: true },
    eventId: { type: String, index: true, required: true },
    author: {
        _id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true },
        displayName: { type: String, required: true },
        photo: { type: String, required: true }
    },
    uuid: { type: String, index: { unique: true }, required: true },
    from: { type: Number, required: true, 'default': 0 }
}, {
    'autoIndex': false
});
var Message = new mongoose.Schema({
    text: { type: String, required: true },
    timestamp: { type: Date, 'default': Date.now, index: true },
    eventId: { type: String, index: true, required: true },
    author: {
        _id: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true },
        displayName: { type: String, required: true },
        photo: { type: String, required: true }
    },
    relatedZapUUID: { type: String, index: true },
    seq: { type: Number, index: { unique: true }, 'default': 1 },
    from: { type: Number, required: true, 'default': 0 }
}, {
    'autoIndex': false
});
Message.plugin(function(schema, options) {
    schema.pre('save', function(next) {
        var self = this;
        models.Sequence.next('message', function(err, seq) {
            if (err) {
                next(err);
                return;
            }
            self.seq = seq;
            next();
        });
    });
});

var Event = new mongoose.Schema({
    title: { type: String, required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    hashtag: { type: String },
    link: { type: String },
    shortLink: { type: String },
    created: { type: Date, 'default': Date.now },
    updated: { type: Date, 'default': Date.now },
}, {
    'autoIndex': false
});

Event.virtual('isLive').get(function() {
    var now = Date.now();
    return this.start.getTime() <= now && now <= this.end.getTime();
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
    photos: [String],
    oauthTokens: mongoose.Schema.Types.Mixed
}, {
    'autoIndex': false
});
var Sequence = new mongoose.Schema({
    name: { type: String, index: { unique: true }, required: true },
    seq: { type: Number, required: true }
});

Sequence.static('next', function(name, callback) {
    var retry = 3;
    (function getNext() {
        models.Sequence.findOneAndUpdate(
            { name: name },
            { $inc: { seq: 1 } },
            { new: true, upsert: true },
            function(err, doc) {
                if (err) {
                    if (retry > 0) {
                        retry--;
                        // recursive call
                        getNext();
                    } else {
                        callback(err);
                    }
                } else {
                    callback(undefined, doc.seq);
                }
            });
    })();
});

var Setting = new mongoose.Schema({
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    updated: { type: Date, 'default': Date.now }
});

module.exports = models = {
    Zap: db.model('Zap', Zap),
    Message: db.model('Message', Message),
    Event: db.model('Event', Event),
    User: db.model('User', User),
    Sequence: db.model('Sequence', Sequence),
    Setting: db.model('Setting', Setting)
};
