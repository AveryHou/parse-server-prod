/**
	 log service
*/

var prop = require("cloud/app_properties.js");

exports.subject = function(funcName, errBrief) {
	return "[CloudCode Error][" + funcName + "] " + errBrief;	
}

//send exception message
exports.send_error = function (subject, err) {
	
	if (!subject) subject = "no subject from hungrybee cloud mail service.";
	
	var errorCode = "<tr><td>code</td><td>" + err.code + "</td></tr>";
	var errorMsg = "<tr><td>message</td><td>" + err.message + "</td></tr>";
	var msgBody = "<tr><td>error object</td><td>" + JSON.stringify(err) + "</td></tr>";
	
	send(prop.error_admin(), "", subject, "<table>" + errorCode + errorMsg + msgBody + "</table>");
}

//send exception message
exports.card_transaction_error = function (subject, body) {
	send(prop.error_admin(), prop.error_admin(), subject, body);
}



//send normal message
exports.send_notify = function (mailTo, mailCc, subject, body) {
	if (mailTo == null || mailTo == "") mailTo = prop.admin_mail();
	
	//if (mailCc == null || mailCc == "") mailCc = prop.admin_mail();
	
	send(mailTo, mailCc, subject, body);
}

//send normal message with order link
exports.send_info = function (mailTo, mailCc, subject, body, orderId) {
	var orderInfo = prop.order_info() + "?objectId=" + orderId;
	if (mailTo == null || mailTo == "") mailTo = prop.admin_mail();
	
	body = body + "<BR><BR>可按此查看訂單資訊:<BR>" + orderInfo;
	
	send(mailTo, mailCc, subject, body);
}

var Mailgun = require('mailgun');
Mailgun.initialize(prop.mailgun_domain(), prop.mailgun_key());

function send(mailto, mailCc, subject, body) {
	console.log("mailto:" + mailto);
	console.log("subject:" + "[" + prop.env() + "]"+ subject);
	console.log("body:" + body);
	console.log("from:" + prop.admin_mail());
	
	if (mailCc == null || mailCc == "") {
		Mailgun.sendEmail({
			to: mailto, 
	  		from: prop.admin_mail() ,
	  		subject: "[" + prop.env() + "] " + subject,
	  		html: body
	  	}, 
	  	{
			success: function() {
		  		console.log("send mail to " + mailto  + " successfully");
		  	},
		  	error: function(err) {
		    	console.error("send mail failed." + JSON.stringify(err));
		    }
		});
	} else {
		console.log("mailCc:" + mailCc);
		Mailgun.sendEmail({
			to: mailto, 
	  		from: prop.admin_mail() ,
	  		cc: mailCc,
	  		subject: "[" + prop.env() + "] " + subject,
	  		html: body
	  	}, 
	  	{
			success: function() {
		  		console.log("send mail to " + mailto  + " successfully");
		  	},
		  	error: function(err) {
		    	console.error("send mail failed." + JSON.stringify(err));
		  	}
		});
	}
	
}

