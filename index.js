// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

/*
var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://hbdev:123123@ds139725.mlab.com:39725/hungrybee-dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'oVYLOizsuLXxCRucXmrgWF6q0OjlXc9d1fXfBDmU',
  masterKey: process.env.MASTER_KEY || 'IdnvI0MJAOVh2m96HVyzprD1mieHYUH2viIoSDaw', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://hbdevtest01.herokuapp.com/parse',  // Don't forget to change to https if needed
  fileKey: "3ccf8d1a-7407-4832-86cc-4ab5fab42f1c",
  push: {
  	  android: {
        senderId: '639572456535',
        apiKey: 'AIzaSyD4sU7lQqqbcXx9UZ-HprKmJ3LIGXwSSwI'
      },
      ios: [
	      {
	        pfx: __dirname + '/push-key/HBDriver-Dev-Certificate.p12',
	        bundleId: 'net.hungrybee.HungryBeeDriver',
	        production: false
	      },
	      {
	        pfx: __dirname + '/push-key/HB-Dev-Certificate.p12',
	        bundleId: 'net.hungrybee.HungryBee',
	        production: false
	      }
	    ]
    },
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  }
});
*/
var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://heroku:hb6230127@ds035676-a0.mlab.com:35676,ds035676-a1.mlab.com:35676/hungrybeedb?replicaSet=rs-ds035676',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || '9O3uQHctMnz86F6m3lifIlwKrMGONwlUjO2OL4uf',
  masterKey: process.env.MASTER_KEY || 'gevC48VkzGHGrWrRJpz8Dt7SRl4BdJ0ycszsQX9k', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://hungrybeeprod.herokuapp.com/parse',  // Don't forget to change to https if needed
  fileKey: "25d04708-179e-4e34-b4da-85a058093cfc",
  push: {
  	  android: {
        senderId: '639572456535',
        apiKey: 'AIzaSyD4sU7lQqqbcXx9UZ-HprKmJ3LIGXwSSwI'
      },
      ios: [
	      {
	        pfx: __dirname + '/push-key/HungryBeeDriver-Prod-20171207.p12',
	        bundleId: 'net.hungrybee.HungryBeeDriver',
	        production: true
	      },
	      {
	        pfx: __dirname + '/push-key/HungryBee-Certificates.p12',
	        bundleId: 'net.hungrybee.HungryBee',
	        production: true
	      }
	    ]
    },
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  }
});

// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
