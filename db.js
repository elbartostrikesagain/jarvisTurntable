var mongoose = require('mongoose');
var Schema = mongoose.Schema;

mongoose.connect('mongodb://localhost/ttfmbot');

var Artist = new Schema({
    display_name: String,
    identifying_names: [{ type: String }]
});

var DJ = new Schema({
    bot_admin: { type: Boolean, default: false },
    created: { type: Number, default: 0 },
    last_seen: { type: Date, default: Date.now },
    name: String
});

var Play = new Schema({
    dj: { type: Schema.ObjectId, ref: 'DJ' },
    downs: { type: Number, default: 0 },
    listeners: { type: Number, default: 0 },
    song: { type: Schema.ObjectId, ref: 'Song' },
    starttime: { type: Number, unique: true },
    ups: { type: Number, default: 0 }
});

var Song = new Schema({
    album: String,
    artist: { type: Schema.ObjectId, ref: 'Artist' },
    coverart: String,
    title: String
});

Artist.statics.Add = function(name, cb) {
    this.findOne({ identifying_names: name.toLowerCase() }, function(err, data) {
        if (err) {
            cb(err, null);
        } else if (data) {
            cb(err, data);
        } else {
            var instance = new ArtistModel({ display_name: name });
            instance.identifying_names.push(name.toLowerCase());
            instance.save(function(err) { cb(err, instance); });
        }
    });
};

DJ.statics.Add = function(id, name, created, admin, cb) {
    this.findOne({ _id: id }, function(err, data) {
        if (err) {
            cb(err, null);
        } else if (data) {
            data.bot_admin = admin;
            data.created = created;
            data.last_seen = new Date();
            data.name = name;
            data.save(function(err) { cb(err, data); });
        } else {
            var instance = new DJModel({
                _id: id,
                bot_admin: admin,
                created: created,
                last_seen: new Date(),
                name: name
            });
            instance.save(function(err) { cb(err, instance); });
        }
    });
};

DJ.statics.IsAdmin = function(id, cb) {
    this.findOne({ _id: id }, function(err, data) {
        if (err) {
            cb(err, false);
        } else if (data) {
            cb(err, data.bot_admin);
        } else {
            cb(err, false);
        }
    });
};

Play.statics.Add = function(dj, downs, listeners, song, starttime, ups, cb) {
    this.findOne({ starttime: starttime }, function(err, data) {
        if (err) {
            cb(err, null);
        } else if (data) {
            data.downs = downs;
            data.listeners = listeners;
            data.ups = ups;
            data.save(function(err) { cb(err, data); });
        } else {
            var instance = new PlayModel({
                dj: dj,
                downs: downs,
                listeners: listeners,
                song: song,
                starttime: starttime,
                ups: ups
            });
            instance.save(function(err) { cb(err, instance); });
        }
    });
};

Play.statics.UpdateVotes = function(id, downs, listeners, ups, cb) {
    this.findOne({ _id: id }, function(err, data) {
        if (data) {
            data.downs = downs;
            data.listeners = listeners;
            data.ups = ups;
            data.save(function(err) { cb(err); });
        } else {
            cb(err);
        }
    });
};

Song.statics.Add = function(album, artist, coverart, title, cb) {
    if (album) { album = album.trim(); }
    if (title) { title = title.trim(); }
    var albumLower = album;
    var titleLower = title;
    var albumExists = false;
    var titleExists = false;
    if (albumLower) {
        albumExists = true;
        albumLower = albumLower.toLowerCase();
    }
    if (titleLower) {
        titleExists = true;
        titleLower = titleLower.toLowerCase();
    }
    this.findOne(
        { $where: '((!this.album && !'
            + albumExists
            + ') || (this.album && this.album.toLowerCase() == "'
            + albumLower
            + '")) && this.artist._id == "'
            + artist._id
            + '" && ((!this.title && !'
            + titleExists
            + ') || (this.title && this.title.toLowerCase() == "'
            + titleLower
            + '"))' },
        function(err, data) {
            if (err) {
                cb(err, null);
            } else if (data) {
                cb(err, data);
            } else {
                var instance = new SongModel({
                    album: album,
                    artist: artist,
                    coverart: coverart,
                    title: title
                });
                instance.save(function(err) { cb(err, instance) });
            }
    });
};

var ArtistModel = mongoose.model('Artist', Artist);
var DJModel = mongoose.model('DJ', DJ);
var PlayModel = mongoose.model('Play', Play);
var SongModel = mongoose.model('Song', Song);

exports.Artist = ArtistModel;
exports.DJ = DJModel;
exports.Play = PlayModel;
exports.Song = SongModel;