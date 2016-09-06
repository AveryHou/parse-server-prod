require("cloud/promotion_function.js");
require("cloud/login_function.js");
require("cloud/google_service.js"); 
require("cloud/db_trigger.js");
require("cloud/job_function.js");
require("cloud/store_management_function.js");
require("cloud/web.js");
require("cloud/storeapp-demo.js");
require("cloud/customer_service_management_function.js");
require("cloud/call-bee.js");

var util = require("cloud/util.js");
var _ = require("underscore");
var logger = require("cloud/mail_service.js");
var Image = require("parse-image");
var prop = require("cloud/app_properties.js");

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
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