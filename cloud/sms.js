/**
	封裝 sms service
*/

var prop = require("./app_properties.js");

var twilio = require('twilio')(prop.twilio_sid(), prop.twilio_token());
exports.send = function(phoneNoTo, msg) {
	console.log("send sms to [" + phoneNoTo + "] " + msg);
	
	//twilio.sendSms({
	twilio.sendMessage({
		to: '+886' + phoneNoTo,
		from: prop.twilio_phone_no(),
		body: msg
	}, function(err, responseData) {
		if (err) {
			console.log("twilio send error:" + JSON.stringify(err));
			return false;
		} else {
			console.log("twilio send success:" + responseData.body);
			return true;
		}
	});
}