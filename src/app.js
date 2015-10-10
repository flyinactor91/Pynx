var UI = require('ui');
var ajax = require('ajax');
var Settings = require('settings');

var lynxBaseURL = "http://lynxbustracker.com/bustime/wireless/html/";
var i;

var mainMenuData = [];
mainMenuData.push({title:'New Route',subtitle:null,url:'home.jsp'});
var favorites = Settings.data('favorites');
if (typeof favorites != 'undefined') {
  for (i=0;i<favorites.length;i++) { mainMenuData.push(favorites[i]); }
} else {
  favorites = [];
}

//Remove whitespace from both sides of text
function strip(text) {
  return text.replace(/^\s+|\s+$/g, '');
}

//Request html for given url and call function based on number of vars in API call
function callLynxAPI(suburl , sectionTitle) {
  var menu;
  var url = lynxBaseURL + suburl;
  console.log(url);
  ajax( { url: url , type: 'text'},
    function(data, status, request) {
      console.log('I just fetched some data');
      //console.log(data);
      if ((request.status == 200)) {
        //console.log((url.match(/=/g) || []).length);
        if ((url.match(/=/g) || []).length >= 3) {
          menu = buildDestinationMenu(data , suburl);
          menu.show();
        } else {
          menu = buildSelectionMenu(data , sectionTitle);
          menu.show();
        }
      } else {
        console.log(request.status);
        var errorCard = new UI.Card({
          title: 'Fetch Error',
          text: request.status
        });
        errorCard.show();
      }
    },
    function(error, status, request) {
      console.log('The ajax request failed: ' + status.toString());
    }
  );
  return menu;
}

//Makes and shows a generic menu for given data that make ajax calls when selected
function makeMenu(uiData , sectionTitle) {
  var menu = new UI.Menu({
    sections: [{
      title: sectionTitle,
      items: uiData
    }],
    backgroundColor: 'white',
    textColor: 'fashionMagenta',
    highlightBackgroundColor: 'fashionMagenta',
    highlightTextColor: 'white'
  });
  menu.on('select' , function(e) {
    callLynxAPI(e.item.url , e.item.title);
  });
  return menu;
}

//Extract li text and links from html page and returns ui data
function extractSelectionElements(http) {
  var retList = [];
  while (http.indexOf('href="') !== -1) {
    var item = {};
    http = http.substring(http.indexOf('href="') + 6);
    //console.log(http.substring(0 , http.indexOf('"')));
    item.url = http.substring(0 , http.indexOf('"'));
    http = http.substring(http.indexOf('>') + 2);
    var text = strip(http.substring(0 , http.indexOf('<')));
    if (text.indexOf(' + ') != -1) {
      item.title = text.substring(0 , text.indexOf(' + '));
      item.subtitle = text.substring(text.indexOf(' + ')+3);
    } else {
      item.title = text;
      item.subtitle = null;
    }
    retList.push(item);
  }
  return retList;
}

//Used to build the menu when in the middle of selecting a route
function buildSelectionMenu(http , sectionTitle) {
  console.log('Building Selection');
  http = http.substring(http.indexOf('<ul>'));
  http = http.substring(0 , http.indexOf('-&nbsp;'));
  var menu = makeMenu(extractSelectionElements(http) , sectionTitle);
  //menu.show();
  return menu;
}

function extractDestinationElements(http) {
  var retDict = {};
  var route = strip(http.substring(0 , http.indexOf('\n')));
  console.log(route);
  http = http.substring(http.indexOf('Selected Direction')+20);
  var direction = strip(http.substring(0 , http.indexOf('\n')));
  console.log(direction);
  http = http.substring(http.indexOf('Selected Stop #')+17);
  var stop = strip(http.substring(0 , http.indexOf('\n')));
  console.log(stop);
  retDict.title = route + ' - ' + stop;
  retDict.favsubtitle = direction;
  //if (http.indexOf('No arrival times available') != -1) {
  if ((http.indexOf('<b>No ') != -1) || (http.indexOf('No arrival') != -1)) {
    retDict.items = [{
      title: 'Nothing Nearby'
    }];
  } else {
    retDict.items = [];
    while (http.indexOf('&nbsp;(') != -1) {
      http = http.substring(http.indexOf('font>')+5);
      var toDir = strip(http.substring(0 , http.indexOf('&nbsp;')));
      http = http.substring(http.indexOf('<b>')+3);
      var timeDue = http.substring(0 , http.indexOf('<')).replace('&nbsp;' , ' ');
      http = http.substring(http.indexOf('&nbsp;(')+7);
      var bus = http.substring(0 , http.indexOf(')'));
      http = http.substring(http.indexOf('<font ')+6);
      retDict.items.push({
        title: timeDue + ' - ' + bus,
        subtitle: toDir
      });
    }
  }
  console.log(JSON.stringify(retDict));
  return retDict;
}

//Returns the index of favorite item with match url, else -1
function urlInFavorites(target) {
  for (i=0;i<favorites.length;i++) {
    if (favorites[i].url == target) { return i; }
  }
  return -1;
}

function makeRouteOptions(target) {
  var retList = [];
  if (urlInFavorites(target) == -1) {
    retList.push({title:'Favorite'});
  } else {
    retList.push({title:'Unfavorite'});
  }
  retList.push({title:'Refresh'});
  //retList.push({title:'Exit App'});
  return retList;
}

//Used to build and  the final menu for bus times and route options
function buildDestinationMenu(http , url) {
  console.log('Building Destination');
  http = http.substring(http.indexOf('Selected Route')+16);
  http = http.substring(0 , http.indexOf('- <a'));
  var data = extractDestinationElements(http);
  var menu = new UI.Menu({
    sections: [{
      title: data.title,
      items: data.items
    }, {
      title: 'Options',
      items: makeRouteOptions(url)
    }],
    backgroundColor: 'white',
    textColor: 'fashionMagenta',
    highlightBackgroundColor: 'fashionMagenta',
    highlightTextColor: 'white'
  });
  var card = new UI.Card({
    backgroundColor: 'white',
    textColor: 'fashionMagenta'
  });
  menu.on('select' , function(e) {
    console.log(e.item.title);
    if (e.item.title == 'Refresh') {
      callLynxAPI(url , 'refresh');
      setTimeout(function(){menu.hide();} , 1000);
    } else if (e.item.title == 'Favorite') {
      if (urlInFavorites(url) == -1) {
        favorites.push({
          title: data.title,
          subtitle: data.favsubtitle,
          url: url
        });
        Settings.data('favorites' , favorites);
        card.body('Route has been added to favorites');
      } else {
        card.body('Route has already been added');
      }
      card.show();
      
    } else if (e.item.title == 'Unfavorite') {
      var favIndex = urlInFavorites(url);
      if (favIndex != -1) {
        favorites.splice(favIndex , 1);
        Settings.data('favorites' , favorites);
        card.body('Route has been removed from favorites');
      } else {
        card.body('Route has already been removed');
      }
      card.show();
    }
  });
  //menu.show();
  return menu;
}

/*var splash = new UI.Card({banner: 'images/splash.png'});
splash.show();*/
var main = makeMenu(mainMenuData , 'Pynx for Lynx');
/*setTimeout(function() {
  main.show();
  splash.hide();
} , 800);*/
main.show();