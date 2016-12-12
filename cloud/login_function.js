

/***
 * 登入相關
 **/

var logger = require("./mail_service.js");
var prop = require("./app_properties.js");

// Twillio 發簡訊
var sms = require("./sms.js");

function sendCodeSms(phoneNumber, code) {
	console.log("twillio sendCodeSms to [" + phoneNumber + "] " + code);
	var promise = new Parse.Promise();
	var msg =  "您的 Hungry Bee 登入認證碼為：" + code;
	//logger.send_notify("", "", phoneNumber + msg , code);
	return sms.send(phoneNumber,  msg) ? promise.resolve(): promise.reject("sms error");
}

//簡訊王 透過 email 發簡訊
function kotSendSmsMail(phoneNumber, code) {
	console.log("簡訊王 [" + phoneNumber + "] " + code);
	
	var msg =  "HungryBee passcode : " + code;
	var body = "id=" + prop.kotsms_account() + "\n";
	body += "pwd=" + prop.kotsms_pwd() + "\n";
	body += "num=" + phoneNumber;
	
	//logger.send_notify(prop.kotsms_mailer(), "app@hungrybee.net", msg , body);
	
	return true;
}



//簡訊王 發簡訊
Parse.Cloud.define("sendCodeKotsms", function(request, response) {
	var code = request.params.code;
	var phoneNumber = request.params.phoneNumber;
	console.log("kotsms sendCodeKotsms to [" + phoneNumber + "] " + code);
	
	var promise = new Parse.Promise();
	var sms_body = "HungryBee passcode : " + code;
	var subject = phoneNumber + " " + sms_body;
	Parse.Cloud.httpRequest({
		url: prop.kotsms_url(), 
		params: {
  			username: prop.kotsms_account(),
    		password: prop.kotsms_pwd(),
    		dstaddr: phoneNumber, 
    		smbody: sms_body
  		},
        success: function(httpResponse) {
        	console.log("httpResponse:" + httpResponse);
        	response.success(httpResponse);
        },
        error: function(httpResponse) {
            response.error(httpResponse);
        }
    });	
});



var secretPasswordToken = 'eebyrgnuh';

//取得認證碼
Parse.Cloud.define("getAuthCode", function(req, res) {
	
	Parse.Cloud.useMasterKey();
	var query = new Parse.Query(Parse.User);
	if (req.params.app == "driver") { //司機版
		query.equalTo('username', "driver-" + req.params.phoneNo);
	} else { // User 版
		query.equalTo('username', req.params.phoneNo);	
	}
	
	query.first().then(function(userFound) {
		//測試帳號
		var testAccount = ["0910000000", "0911000000", "0912000000", "0913000000", "0914000000", 
							"0915000000", "0916000000", "0917000000", "0918000000", "0919000000", "036230127"]; 
		
		var min = 100000; var max = 999999;
		var num = Math.floor(Math.random() * (max - min + 1)) + min;
		
		var isTestAccount = false;
		if (testAccount.indexOf(req.params.phoneNo) != -1) { // phoneNo is a test account
			num = "123456";
			isTestAccount = true;
		}
		
		if (userFound) {
			if (userFound.get("bypass")) { // 透過客服後台進行設定
				userFound.save(null,{
						success: function(userSaved) {
							logger.send_notify(prop.admin_mail(), "", req.params.phoneNo + " 透過後台客服給認證碼", userFound.getUsername());
							res.success(100);
						},
						error: function(err) {
							logger.send_error(logger.subject("getAuthCode", "bypass authcode") , err);
							res.error("save user error:" + err);
						}	
					});
			} else {
				var authCodeSent = parseInt(userFound.get("authCodeSent"));
				if (authCodeSent >= 3) { 
					res.success(200); //超過 3 次取簡訊但未登入,暫時鎖住
				} else {
					authCodeSent = authCodeSent + 1; //increase authCodeSent column
					userFound.setPassword(secretPasswordToken + num);
					if (!isTestAccount) {
						userFound.set("authCodeSent", authCodeSent); 
					}
					userFound.save(null,{
						success: function(userSaved) {
							if (!isTestAccount) { //test account does not need sms
								if (authCodeSent == 2) { //改使用twillio
									console.log("switch to twillio");
									sendCodeSms(req.params.phoneNo, num);
									logger.send_notify(prop.admin_mail(), "", req.params.phoneNo + " 使用 Twillio 取簡訊", num);
									res.success(100);
								} else {
									if (prop.sms_provider() == "twillio") {
										sendCodeSms(req.params.phoneNo, num);
										res.success(100);
									} else if (prop.sms_provider() == "kotsms") {
										Parse.Cloud.run("sendCodeKotsms", 
											{
											 	phoneNumber: req.params.phoneNo, 
											 	code: num
											 }, 
										 {
											success: function(result){
												//console.log("sendCodeByKotsms result" + result);
												//response.success(result);
												res.success(100);
										 	},
										 	error: function(error) {
										 		logger.send_error(logger.subject("getAuthCode", "sendCodeByKotsms error"), error);
												response.error(error);
											}
										});
									}
								}
							} else {
								res.success(100);	
							}
						},
						error: function(err) {
							logger.send_error(logger.subject("getAuthCode", "save authCodeSent") , err);
							res.error("save user error:" + err);
						}	
					});
				}	
			}
		} else {
			var userACL = new Parse.ACL();
			userACL.setPublicReadAccess(true);
			userACL.setRoleReadAccess("HungryBeeUser", true);
			var username;
			var qualify = true;
			if (req.params.app == "driver") {
				username = "driver-" + req.params.phoneNo;
				qualify = false;
			} else {
				username = req.params.phoneNo;
			}
			
			//create a User object
			var user = new Parse.User();
			user.set("qualify", qualify);
			user.set("authCodeSent", 1);
			user.setUsername(username);
			user.setPassword(secretPasswordToken + num);
			user.setACL(userACL);
			user.set("canPayCash", false);
			if (req.params.app == "driver") {
				user.set("mentorBee", false);
			}
			user.signUp(null, {   //see https://www.parse.com/docs/js/guide#users-signing-up
				success: function(user) {
					if (!isTestAccount) {
						if (prop.sms_provider() == "twillio") {
							sendCodeSms(req.params.phoneNo, num);
							res.success(100);
						} else if (prop.sms_provider() == "kotsms") {
							Parse.Cloud.run("sendCodeKotsms", 
								{
							 		phoneNumber: req.params.phoneNo, 
							 		code: num
							 	},{
							 		success: function(user) {
										res.success(100);	
									},
									error: function(user, error) {
										logger.send_error(logger.subject("getAuthCode", "call sendCodeKotsms") ,error);
										res.error(error);
									}
							 	});
							
						}
					} else {
						res.success(100);	
					}
				},
				error: function(user, error) {
					logger.send_error(logger.subject("getAuthCode", "signUp") ,error);
					res.error(error);
				}	
			});
		}
	}, function (err) {
		logger.send_error(err);
		res.error(err);
	});
});

//登入
Parse.Cloud.define("login", function(req, res) {
	if (req.params.phoneNo && req.params.authCode) {
		var loginUserName = "";
		if (req.params.app == "driver") {
			loginUserName = "driver-" + req.params.phoneNo;
		} else {
			loginUserName = req.params.phoneNo;
		}
		
		var pwd = secretPasswordToken + req.params.authCode;
		
		//find reference user.
		var queryUser = new Parse.Query(Parse.User);
		queryUser.equalTo('username', "driver-" + req.params.phoneOfReference);	
		queryUser.first().then(
			function(beeFound) {
				console.log("bee found-" + beeFound);
				
				Parse.User.logIn(loginUserName, pwd, {
					success: function(userLoggined) {
						Parse.Cloud.useMasterKey();
						userLoggined.set("authCodeSent", 0); //reset authCodeSent if login successfully
						userLoggined.increment("loginCount");
						if(typeof beeFound !== "undefined") {
							userLoggined.set("referenceBy", beeFound);
							if(beeFound.get("mentorBee")) {
								userLoggined.set("canPayCash", true);
							}
						}
						userLoggined.save(null, {
							success: function(user) {
								res.success(user.getSessionToken());
							},
							error: function(error) {
								logger.send_error(logger.subject("login", "save authCodeSent"), error);
								res.error(300); //update user info failed
							}	
						});
					},
					error: function(error) {
						logger.send_error(logger.subject("login", "auth code not match"), error);
						res.error(200); //auth code not match
					}
				});
			}, 
			function (err) {
				logger.send_error(logger.subject("login", "find bee error."), err);
				res.error(JSON.stringify(err));
			}
		);
		
	} else {
		res.error('Invalid parameters.');
	}
});

//更新installation與user對應
Parse.Cloud.define("updateInstallation", function(request, response) {
	Parse.Cloud.useMasterKey();
	var query = new Parse.Query(Parse.Installation);
	query.equalTo("installationId", request.params.installationId);
	query.find({
    	success: function(itemsFound) {
    		if(itemsFound.length > 0) {
    			var oneInstallation = itemsFound[0];
    			oneInstallation.set("owner", request.params.userId);
    			oneInstallation.save(null, {
			        success: function(dataUpdated) {
			        	response.success(true);
			        },
			        error: function(error) { 
			            logger.send_error(logger.subject("updateInstallation", "Installation update failed."), error);
						response.error(error);		
			        }
			    });
			    
    		} else {
    			response.success(true);
    		}   	 	
    	},
    	error: function(error) {
			logger.send_error(logger.subject("updateInstallation", "find updateInstallation error"), error);
      	  	response.error(error);
    	}
  	});
  	
});

