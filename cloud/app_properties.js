
exports.env = function() {
	return "Prod";	
}
exports.push_env = function() {
	return "";	
}

exports.booking_manager = function () {
	return 	"emma_wang@hungrybee.net";
}

exports.mail_cc = function () {
	return "info@hungrybee.net";
}

exports.admin_mail = function() {
	return "order@hungrybee.net";
}

exports.error_admin = function() {
	return "avery_hou@hungrybee.net";
}

exports.order_url = function() {
	return "http://hungrybee.net/hungrybee/index.php";
}

exports.shorten_url = function() {
	return "https://hungrybeeprod.herokuapp.com/public"; //Heroku
}

exports.order_info = function() {
	return "http://hungrybee.net/customerservice/orderInfo.html";
}

exports.mock_mode = function() {
	return false;
}

// kotsms or twillio
exports.sms_provider = function() {
	return "kotsms";
}

////////////////////////////////////////////////////
/////////  ///////////////

exports.kotsms_account = function() {
	return "hungrybee";
}
exports.kotsms_pwd = function() {
	return "hungrybee999";
}
exports.kotsms_url = function() {
	//return "http://202.39.48.216/kotsmsapi-1.php";
	return "http://api.kotsms.com.tw/kotsmsapi-1.php";
}
exports.kotsms_mailer = function() {
	return "mail2sms@kotsms.com.tw";
}

////////////////////////////////////////////////////
///////// mail service using MailGun ///////////////
// use Mailgun instead of building internal mail server 
// Mailgun can send up to 12,000 mails/month for free.
////////////////////////////////////////////////////

var mailgun_domain = "hungrybee.club";
var mailgun_key = "key-f43e26f64176e2545eb358dd39066bf9";

exports.mailgun_domain = function() {
	return mailgun_domain;
}
exports.mailgun_key = function() {
	return mailgun_key;
}



//////////////////////////////////////////////////
///////// sms service using Twilio ///////////////
//////////////////////////////////////////////////

var twilio_sid = "AC1370654db51cd3864a16dcd2706d9d9b";
var twilio_token = "bdd8ba5b503baa1074e7dbd4aa269a62";
var twilio_phoneNo = '+19293365888'; 

exports.twilio_sid = function () {
	return twilio_sid;	
}
exports.twilio_token = function () {
	return twilio_token;	
}
exports.twilio_phone_no = function () {
	return twilio_phoneNo;	
}

