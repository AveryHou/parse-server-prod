require("./promotion_function.js");
//require("./login_function.js");

var prop = require("./app_properties.js");
var Mailgun = require('mailgun');
//Mailgun.initialize(prop.mailgun_domain(), prop.mailgun_key());

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hello heroku');
});

//
Parse.Cloud.define("getFoodStore", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.equalTo("online", true);
	query.ascending("stickyTop");
	query.include("storeImage");
	query.find({
    	success: function(results) {
    		var returnResults = [];
    		for(var i=0 ; i<results.length ; i++) {
    			var obj = results[i];
    			//obj.set("imageSource", "image1");
    			returnResults.push(obj);
    		}
    		
    		var query2 = new Parse.Query("HBFoodStore");
			query2.equalTo("online", true);
			query2.notEqualTo("stickyTop", 1);
			query2.include("storeImage2");
			query2.find({
				success: function(results2) {
					for(var i=0 ; i<results2.length ; i++) {
						var obj = results2[i];
		    			//obj.set("imageSource", "image2");
    					returnResults.push(obj);
		    		}
		    		
					response.success(returnResults);
		    	},
		    	error: function(err) {
					logger.send_error(logger.subject("getFoodStore", "food store 2 lookup failed."), error);
		      	  	response.error(err);
		    	}
			});
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getFoodStore", "food store lookup failed."), error);
      	  	response.error(err);
    	}
  	});
});