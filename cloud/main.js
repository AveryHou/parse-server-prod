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
  res.success('Hello heroku');
});

//
Parse.Cloud.define("getFoodStore", function(request, response) {
	response.success ("food store")
});