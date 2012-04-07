var Bot = require('ttapi');
var Config = require('./config.js');
var DB = require('./db.js');
var currentPlayId;
var ttfm = new Bot(
    Config.BotAuth,
    Config.BotId,
    Config.BotRoom);
    
var activeDJs = {};

ttfm.on('add_dj', function(data) {
    if (data.success) {
        // update our active DJs list
        if (activeDJs && activeDJs.hasOwnProperty(data.user.userid)) {
            AFKDJUpdate(data.user.userid);
            //$ checks for rate limit, play limit and queue bypassing attempts will go here
        } else {
            AddActiveDJ(data.user.userid);
        }
    }
    AutoDJCheck();
});

ttfm.on('endsong', function() {
    if (Config.BoothEnforce) EnforceBooth();
});

ttfm.on('newsong', function(data) {
    currentPlayId = null;
    AutoDJCheck();
    AutoBopCheck();
    if (data.success) {
        PopulateCurrent(data);
        
        if (activeDJs.hasOwnProperty(data.room.metadata.current_dj)) {
            activeDJs[data.room.metadata.current_dj].plays++;
        }
    }
});

ttfm.on('nosong', function(data) {
    if (data.success) { currentPlayId = null; }
});

ttfm.on('ready', function() {
    AutoBopCheck();
    // populate active DJs
    ttfm.roomInfo(false, function(info) {
        if (info.success) {
            var djs = info.room.metadata.djs;
            for (i in djs) {
                AddActiveDJ(djs[i]);
            }
        }
    });
    AutoDJCheck();
});

ttfm.on('rem_dj', function(data) {
    if (data.success) {
        RemoveActiveDJ(data.user.userid);
    }
    AutoDJCheck();
});

ttfm.on('speak', function(data) {
    if (data) {
        AFKDJUpdate(data.userid);
        DB.DJ.IsAdmin(data.userid, function(err, admin) {
            LogError(err);
            if (data.userid == Config.AdminId || admin) {
                var result = data.text.match(/^\/(.*?)( .*)?$/);
                if (result) {
                    // break out the command and parameter if one exists
                    var command = result[1].trim().toLowerCase();
                    var param = '';
                    if (result.length == 3 && result[2]) {
                        param = result[2].trim().toLowerCase();
                    }
                    // handle valid commands
                    switch(command) {
                        // admins
                        case 'sa':
                        case 'setadmin':
                            SetAdmin(param);
                            break;
                        case 'da':
                        case 'deladmin':
                            DeleteAdmin(param);
                            break;

                        case 'autobop':
                            Config.AutoBop = !Config.AutoBop;
                            ttfm.speak('Auto-Bop set to ' + Config.AutoBop + '.');
                            break;
                        
                        case 'enforce':
                            Config.BoothEnforce = !Config.BoothEnforce;
                            ttfm.speak('Booth enforcement set to ' + Config.BoothEnforce + '.');
                            break;
                        
                        // djing
                        case 'autodj':
                            Config.AutoDJ = !Config.AutoDJ;
                            ttfm.speak('Auto-DJing set to ' + Config.AutoDJ + '.');
                            break;
                        case 'booth':
                            ttfm.addDj();
                            break;
                        case 'floor':
                            ttfm.remDj(Config.BotId);
                            break;
                        case 'skip':
                            ttfm.stopSong();
                            break;

                        // fans
                        case 'fan':
                            SetFan(param);
                            break;
                        case 'unfan':
                            DeleteFan(param);
                            break;

                        // queue
                        case 'snag':
                            //$ need to change this to add songs to end of queue instead of beginning
                            ttfm.roomInfo(function(data) {
                                if (data.room.metadata.current_song._id) {
                                    ttfm.playlistAdd(data.room.metadata.current_song._id, function(data) {
                                        if (data.success) {
                                            ttfm.speak('Song added to queue.');
                                        } else {
                                            LogError('Unable to add song to queue.');
                                        }
                                    });
                                } else {
                                    LogError('Unable to add song to queue.');
                                }
                            });
                            break;

                        // voting
                        case 'a':
                        case 'awesome':
                            ttfm.vote('up');
                            break;
                        case 'l':
                        case 'lame':
                            ttfm.vote('down');
                            break;
                    }
                }
            }
        });
    }
});

ttfm.on('update_votes', function(data) {
    if (data.success) {
        var votes = data.room.metadata.votelog;
        for (i in votes) {
            AFKDJUpdate(votes[i][0]);
        }        
    }
    // if we've already handled creating the necessary db entries, just update vote data
    if (currentPlayId && data.success) {
        DB.Play.UpdateVotes(
            currentPlayId,
            data.room.metadata.downvotes,
            data.room.metadata.listeners,
            data.room.metadata.upvotes,
            function(err) { LogError(err); }
        );
    // otherwise, make sure we have all valid db entries
    } else {
        ttfm.roomInfo(true, function(info) {
            if (info.success) { PopulateCurrent(info); }
        });
    }
});

function AddActiveDJ(userid) {
    if (userid) {
        activeDJs[userid] = {
            lastActive: new Date(),
            plays: 0,
            removed: null
        };
    }
}

function RemoveActiveDJ(userid) {
    if (activeDJs && userid && activeDJs.hasOwnProperty(userid)) {
        activeDJs[userid].removed = new Date();
    }
}

function AFKDJUpdate(userid) {
    if (activeDJs && userid && activeDJs.hasOwnProperty(userid)) {
        activeDJs[userid].lastActive = new Date();
    }
}

function AutoBopCheck() {
    if (Config.AutoBop) { ttfm.vote('up'); }
}

function AutoDJCheck() {
    ttfm.roomInfo(false, function(data) {
        if (data.success) {
            // hop in the booth if we're auto-djing and requirements have been met
            if (Config.AutoDJ
                && data.room.metadata.djcount <= Config.AutoDJMin
                && (!data.room.metadata.djs || data.room.metadata.djs.indexOf(Config.BotId) < 0)) {
                if (Config.AutoDJEnterMessage) { ttfm.speak(Config.AutoDJEnterMessage); }
                ttfm.addDj();
            // otherwise, hop out if we're not currently playing a song and requirements have been met
            } else if (data.room.metadata.current_dj
                && data.room.metadata.current_dj != Config.BotId
                && data.room.metadata.djs
                && data.room.metadata.djs.indexOf(Config.BotId) != -1
                && data.room.metadata.djcount >= Config.AutoDJMax) {
                if (Config.AutoDJExitMessage) { ttfm.speak(Config.AutoDJExitMessage); }                
                ttfm.remDj(Config.BotId);
            }
        }
    });
}

function EnforceBooth() {
    if (Config.BoothIdleLimit > 0) {
        // convert idle time to milliseconds
        var limit = Config.BoothIdleLimit * 60000;
        var now = new Date();
        for (var i in activeDJs) {            
            if ((now - activeDJs[i].lastActive) > limit) {
                activeDJs[i].removed = now;
                ttfm.remDj(i);
                if (Config.BoothIdleLimitMessage) ttfm.speak(Config.BoothIdleLimitMessage);
            }
        }
    }
    if (Config.BoothSongLimit > 0) {
        for (var i in activeDJs) {
            if (activeDJs[i].plays >= Config.BoothSongLimit) {
                activeDJs[i].removed = now;
                ttfm.remDj(i);
                if (Config.BoothSongLimitMessage) ttfm.speak(Config.BoothSongLimitMessage);
            }
        }
    }
}

function PopulateCurrent(data) {
    ttfm.getProfile(data.room.metadata.current_dj, function(profile) {
        if (profile) {
            var isAdmin = false;
            if (profile.userid == Config.AdminId) { isAdmin = true; }
            // try to add or retrieve dj info
            DB.DJ.Add(profile.userid, profile.name, profile.created, isAdmin, function(err, dj) {
                LogError(err);
                var songTT = data.room.metadata.current_song;
                // try to add or retrieve artist info
                DB.Artist.Add(songTT.metadata.artist, function(err, artist) {
                    LogError(err);
                    if (artist) {
                        // if we were able to get the artist, try to add or get the song
                        DB.Song.Add(
                            songTT.metadata.album,
                            artist,
                            songTT.metadata.coverart,
                            songTT.metadata.song,
                            function(err, song) {
                                LogError(err);
                                // if we successfully added or retrieved dj and song entries
                                // then add the play entry
                                if (dj && song) {
                                    DB.Play.Add(
                                        dj,
                                        data.room.metadata.downvotes,
                                        data.room.metadata.listeners,
                                        song,
                                        songTT.starttime,
                                        data.room.metadata.upvotes,
                                        function(err, play) {
                                            LogError(err);
                                            currentPlayId = play._id;
                                        }
                                    );
                                }
                            }
                        );
                    }
                });
            });
        }
    });
}

function DeleteAdmin(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    DB.DJ.Add(u.userid, u.name, u.created, false, function(err, dj) {
                        if (err) {
                            LogError(err);
                        } else {
                            ttfm.speak(u.name + ' is no longer an admin.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function SetAdmin(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    DB.DJ.Add(u.userid, u.name, u.created, true, function(err, dj) {
                        if (err) {
                            LogError(err);
                        } else {
                            ttfm.speak(u.name + ' added as an admin.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function DeleteFan(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    ttfm.removeFan(u.userid, function(data) {
                        if (data.success) {
                            ttfm.speak('/me is no longer a fan of ' + u.name + '.');
                        } else {
                            LogError('Unable to unfan ' + u.name + '.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function SetFan(name) {
    ttfm.roomInfo(true, function(info) {
        if (info.users) {
            for (i in info.users) {
                var u = info.users[i];
                if (u.name.toLowerCase() == name) {
                    ttfm.becomeFan(u.userid, function(data) {
                        if (data.success) {
                            ttfm.speak('/me became a fan of ' + u.name + '.');
                        } else {
                            LogError('Unable to become a fan of ' + u.name + '.');
                        }
                    });
                    return;
                }
            }
        }
        LogError('Unable to locate user Id for ' + name + '.');
    });
}

function LogError(err) {
    if (err) { ttfm.speak(err); }
}