require("./promotion_function.js");
require("./login_function.js");
require("./google_service.js"); 
require("./db_trigger.js");
//require("./job_function.js");
require("./store_management_function.js");
require("./web.js");
require("./storeapp-demo.js");
require("./customer_service_management_function.js");
require("./call-bee.js");

var util = require("./util.js");
var _ = require("underscore");
var logger = require("./mail_service.js");
//var Image = require("parse-image");
var prop = require("./app_properties.js");




Parse.Cloud.define('hello', function(req, res) {
  res.success('Hello heroku');
});

Parse.Cloud.define('testmail', function(req, res) {
	var body = "<p>mail sent!!!</p>";
	body += prop.order_info();
	logger.send_notify(prop.admin_mail(), prop.mail_cc(), "hello mailgun", body);
	res.success('Hello mail');
});

Parse.Cloud.define('testsms', function(req, res) {
	sms.send("0919188224",  "I'm from heroku...");
	res.success('Hello twilio');
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