/**
 * This is an example of how you can keep the last activity timestamp of
 * everyone in the room. (AFK time)
 */

var Bot    = require('../index');
var AUTH   = 'auth+live+';
var USERID = '';
var ROOMID = '';
var $ = require('jquery');

var bot = new Bot(AUTH, USERID, ROOMID);
//bot.debug = true;

var usersList = { };
var djs      = [];
var blackList = [];

// Add everyone in the users list.
bot.on('roomChanged',  function (data) {
    djs = data.room.metadata.djs;
   usersList = { };
   for (var i=0; i<data.users.length; i++) {
      var user = data.users[i];
      user.lastActivity = new Date();
      usersList[user.userid] = user;
   }
});

// Someone enter the room, add him.
bot.on('registered',   function (data) {
   var user = data.user[0];
   user.lastActivity = new Date();
   usersList[user.userid] = user;
   //Boot Blacklisted users
   var user = data.user[0];
   for (var i=0; i<blackList.length; i++) {
      if (user.userid == blackList[i]) {
         bot.bootUser(user.userid, 'You are on the blacklist.');
         break;
      }
   }
});

// Someone left, remove him from the users list.
bot.on('deregistered', function (data) {
   delete usersList[data.user[0].userid];
});

// Someone talk, update his timestamp.
bot.on('speak', function (data) {
   usersList[data.userid].lastActivity = new Date();
   // Get the data
   var name = data.name;
   var text = data.text;
   // Respond to "/hello" command
   if (text.match(/^\/botup$/)) {
      bot.speak('You cant do this yet');
   }
   if (text.match(/^\/botdown$/)) {
      bot.speak('You cant do this yet');
   }
   if (text.match(/^\/ban .*$/)) {
      var userToBanStr = text.substring(4, text.length);
      var userToBan = findByName(userToBanStr);
	  if(userToBan == null){
		bot.speak('User not found:' + userToBanStr);
		return;
	  }
	  
	  bot.bootUser(userToBan.userid, 'You have been banned.');
	  blackList.push(userToBan.userid);
	  bot.speak('Banned user' + userToBan);
   }
   if (text.match(/^\/kick .*$/)) {
      var userToBanStr = text.substring(4, text.length);
      var userToBan = findByName(userToBanStr);
	  if(userToBan == null){
		bot.speak('User not found:' + userToBanStr);
		return;
	  }
	  
	  bot.bootUser(userToBan.userid, 'You have been kicked. You can come back soon. ~10 min?');
	  bot.speak('Kicked user' + userToBan);
   }
   if(text.match(/^\/skip$/)){
      bot.roomInfo(function(data){
         if(data.room.metadata.djs[0] == keys.USERID ||
            data.room.metadata.djs[1] == keys.USERID ||
            data.room.metadata.djs[2] == keys.USERID ||
            data.room.metadata.djs[3] == keys.USERID ||
            data.room.metadata.djs[4] == keys.USERID){
	    bot.skip(function (dummy){
	       bot.speak("Skipping song.");
	    });
         }
      });
   }
});

// Someone vote, update his timestamp.
bot.on('update_votes', function (data) {
   var votelog = data.room.metadata.votelog;
   for (var i=0; i<votelog.length; i++) {
      var userid = votelog[i][0];
      usersList[userid].lastActivity = new Date();
   }
});

// Someone step up, update his timestamp.
bot.on('add_dj', function (data) {
   var user = data.user[0];
   usersList[user.userid].lastActivity = new Date();
   djs.push(data.user[0].userid);
});

// Someone step down, update his timestamp.
bot.on('rem_dj', function (data) {
   var user = data.user[0];
   usersList[user.userid].lastActivity = new Date();
   djs.splice(djs.indexOf(data.user[0].userid), 1);
});

// Someone add the surrent song to his playlist.
bot.on('snagged', function (data) {
   var userid = data.userid;
   usersList[userid].lastActivity = new Date();
});

isAfk = function (userId, num) {
   var last = usersList[userId];
   var age_ms = Date.now() - last;
   var age_m = Math.floor(age_ms / 1000 / 60);
   if (age_m >= num) {
      return true;
   };
   return false;
};

// Check for afk djs if the stage is full
afkCheck = function () {
   if (djs.length == 5) {
   var afkLimit = 10; //An Afk Limit of 10 minutes.
   for (i = 0; i < djs.length; i++) {
      dj = djs[i]; //Pick a DJ
      if (isAfk(dj, afkLimit)) { //if Dj is afk then
         bot.remDj(dj); //remove them
      }; 
   };
   };
};

//Run on load
setInterval(afkCheck, 5000) //This repeats the check every five seconds.

function findByName(name,i){
	var user = null;
	console.log("name" + name);
	console.log("usersList " + xinspect(usersList));
	for(var i in usersList){
		console.log(usersList[i]["name"]);
		console.log($.trim(usersList[i]["name"]) == $.trim(name));
		console.log("usersList:" + typeof usersList[i]["name"]);
		console.log("name:" + typeof name);
		console.log("n " + name + "    ul " + usersList[i]["name"]);
		if($.trim(usersList[i]["name"]) == $.trim(name)){
			console.log("usersList[i] " + usersList[i]);
			return usersList[i];
		}
	}
}

//HELPER(S)

function xinspect(o,i){
    if(typeof i=='undefined')i='';
    if(i.length>50)return '[MAX ITERATIONS]';
    var r=[];
    for(var p in o){
        var t=typeof o[p];
        r.push(i+'"'+p+'" ('+t+') => '+(t=='object' ? 'object:'+xinspect(o[p],i+'  ') : o[p]+''));
    }
    return r.join(i+'\n');
}