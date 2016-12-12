var prop = require("./app_properties.js");
var _ = require("underscore");
/*
Parse.Cloud.afterSave("setCheckoutTime", function(request) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		cartFound.set("checkoutLimit", request.params.checkoutAfter);
	  		var current = new Date();
			cartFound.set("checkoutLimitDate", eval(request.params.shippingFee));
 		    cartFound.set("lineModeEnable", true);
 		    cartFound.save()
			response.success(cartFound.get("checkoutLimitDate"));				
	 	},
	  	error: function(object, err) {
	    	console.error("setCheckoutTime failed" + err.code + "," + err.message);
			response.error("ShoppingCart failed." + err.code + "," + err.message);
	  	}
	});	
});
*/

// Installation
Parse.Cloud.beforeSave(Parse.Installation, function(request, response) {
	request.object.set("pushId", request.object.get("installationId"));
	response.success();
});


var mailFrom = "app@hungrybee.net";
var mailToAllMembers = "info@hungrybee.net";
var mailCC = "avery.hou@gmail.com";

//[外送小蜜蜂] 送出預約單
var mail = require("./mail_service.js");
Parse.Cloud.afterSave("HBTrainingBooking", function(request) {
	
	if (request.object.get("bookingSubmitted")) {  
		
		var queryUser = new Parse.Query(Parse.User)
		queryUser.get(request.object.get("user").id, {
			success: function(userFound) {
	    		
				var query = new Parse.Query("HBLob");
				query.equalTo("owner", userFound);
				query.containedIn("category", ["person", "motor", "drive_license", "permit_license_front", "permit_license_rear"]);
				query.find({
					success: function(results) {
						
						var htmlBody = "申請人:" + userFound.get("contact");
						htmlBody += "<BR>聯絡電話:" + userFound.get("phone");
						htmlBody += "<BR>email:" + userFound.getEmail();
						htmlBody += "<BR>車牌號碼:" + userFound.get("licenseNo");
						htmlBody += "<table border=1>";
						
						for(var i=0 ; i<results.length ; i++) {
							var onerow = results[i];
							var category = onerow.get("category");
							var urlLink = onerow.get("data").url();
							if (category == "person") {
								htmlBody += "<tr><td width=10%>大頭照</td><td>" + urlLink + "</td></tr>";
							}
							if (category == "motor") {
								htmlBody += "<tr><td>機車照片</td><td>" + urlLink + "</td></tr>";
							}
							if (category == "drive_license") {
								htmlBody += "<tr><td>機車駕照</td><td>" + urlLink + "</td></tr>";
							}
							if (category == "permit_license_front") {
								htmlBody += "<tr><td>行照正面</td><td>" + urlLink + "</td></tr>";
							}
							if (category == "permit_license_rear") {
								htmlBody += "<tr><td>行照反面</td><td>" + urlLink + "</td></tr>";
							}	
						}
						htmlBody += "</table>";
						console.log("htmlbody:" + htmlBody);
						
						var subject = "[小蜜蜂申請單]申請人:" + userFound.get("contact") + "(" + userFound.get("phone") + ")";
					  		
						mail.send_notify(prop.mail_cc(), prop.mail_cc(), subject, htmlBody);
						
						
					},
					error: function(err) {
						console.error("afterSave HBTrainingBooking failed" + JSON.stringify(err));
				  	  	mail.send_error(mail.subject("afterSave HBTrainingBooking", "hblob query failed"), err);
					}
				});
	    	},
	    	error: function(err) {
	    		console.error("afterSave user lookup failed" + JSON.stringify(err));
				mail.send_error(mail.subject("afterSave HBTrainingBooking", "user lookup failed"), err);
	      	}	
			
		});
	}
});

//送出購物車
Parse.Cloud.afterSave("HBShoppingCart", function(request, response) {
	
	console.log("============= db_trigger.js afterSave HBShoppingCart =============");
	console.log("status:" + request.object.get("status"));
	console.log("qrcode:" + (request.object.get("qrcode") !=null));
	console.log("bee is undefined:" + ( (typeof request.object.get("bee")) === 'undefined'));
	
	if (request.object.get("status") == "onbid" && 
		request.object.get("deliveryOrder") && 
		//request.object.get("qrcode") != null && 
		(typeof request.object.get("bee")) === 'undefined' && 
		(typeof request.object.get("bidCount")) === 'undefined') { //競標中 and 外送單 and 已產生  QRCode 但尚未有人搶標
									  
		console.log("bidCount:" + request.object.get("bidCount"));
		
	    var currentTime1 = new Date();
	    var currentTime2 = new Date();
	    currentTime2.setHours ( currentTime1.getHours() + 8 );
		var printMsg = currentTime2.getFullYear() + "/" + (currentTime2.getMonth() + 1) + "/" + currentTime2.getDate() + " " + 
	    				currentTime2.getHours() + ":" + currentTime2.getMinutes() + ":" + currentTime2.getSeconds();
		var etd = request.object.get("ETD");
		var eta = request.object.get("ETA");
		
		var body = "<Html><body>產生時間: " + printMsg + "<BR>";
		body += "訂單總金額: $" + request.object.get("totalPrice") + "<BR><BR>";
		body += "取餐時間: " + (etd.getMonth() + 1) + "/" + etd.getDate() + " " + (etd.getHours()+8) + ":" + etd.getMinutes() + "<BR>";
		body += "送餐時間: " + (eta.getMonth() + 1) + "/" + eta.getDate() + " " + (eta.getHours()+8) + ":" + eta.getMinutes() + "<BR>";
		body += "<h1><a href='" + prop.order_url() + "?cartId=" + request.object.id + "'>按此列印訂單(如果未自動送出的話)</a></h1>";
		body += prop.order_url() + "</body></html>";
		
	  	var subject = "有一筆新訂單可手動列印，訂單編號 " + request.object.id;
	  	mail.send_notify(prop.admin_mail(), "", subject, body);
    	
		//update HBCoupon
		var queryCoupon = new Parse.Query("HBCoupon");
		queryCoupon.equalTo("objectId", request.object.get("couponNo"));
		queryCoupon.find({
	    	success: function(results) {
	    		if (results.length > 0) {
	    			Parse.Cloud.useMasterKey();
	    			var oneCoupon = results[0];
	    			oneCoupon.set("used", true);
			    	oneCoupon.set("shoppingCart", request.object);
			    	oneCoupon.save();	
	    		} 
	    		
	    		var currentTime = new Date();
				var formattedTime = (currentTime.getMonth() + 1) + "/" + currentTime.getDate() + " " + (currentTime.getHours()+8)+ ":" + currentTime.getMinutes();
				
				//取餐時間少於半小時，直接push
				//大於半小時，設成取餐時間前半小時push
				var diff = new Date(etd).getTime() - currentTime.getTime(); // This will give difference in milliseconds
				var diffInMinutes = Math.round(diff / 60000);
				
				var pushSent;
				console.log("取餐時間與目前時間相差: " + diffInMinutes + "分鐘");
				//if (diffInMinutes > 30) {
				//	pushSent = new Date(etd.getTime() - 1000 * 60 * 30); //取餐時間前 30 分鐘設為 push 發送時間
				//	console.log("預約推播:" + pushSent);
				//} else {
					pushSent = new Date(currentTime.getTime() + 3000); 
				//	console.log("立即推播:" + pushSent);
				//}
				
				//send push to bees
				Parse.Push.send({
					channels: [ "bee" ],
					push_time: pushSent,
				  	data: {
					  	title: "外送小蜜蜂",
					  	alert: prop.push_env() + "HungryBee 有一筆新訂單，訂單編號:" + request.object.id + "。產生時間:" + formattedTime,
					    sound: "default",
						badge: "Increment",
						cartId: request.object.id
				  	},
				},
				{
				 	success: function() {
				    	// Push was successful
				    	console.log("Push was successful");
				    },
				  	error: function(error) {
				    	console.error(JSON.stringify(error));
				    	mail.send_error(mail.subject("afterSave HBShoppingCart", "send push failed"), error);
				  	},
				  	useMasterKey: true
				});
	    	},
	    	error: function(err) {
				mail.send_error(mail.subject("afterSave HBShoppingCart", "get HBCoupon") , err);
	      	  	response.error(err);
	    	}
	  	});
	} else if (request.object.get("status") == "ongoing" && request.object.get("deliveryOrder") && (request.object.get("bee") != null)) {
		var etd = request.object.get("ETD");
		var etdString =  (etd.getHours() + 8) + ":" + etd.getMinutes();
		var eta = request.object.get("ETA");
		var etaString =  (eta.getHours() + 8) + ":" + eta.getMinutes();
		
		var msg = "";
		if(request.object.get("bidCount") == 1 && request.object.get("beeTakeoff") != true) { //小蜜蜂尚未出發
			msg = "您好，您的訂單:" + request.object.id + "已安排外送人員，預計在" + etdString + "出發取餐，" + etaString + "將餐點送達。";
		} else if (request.object.get("beeTakeoff") == true) {
			//msg = "您好，您的訂單:" + request.object.id + "外送人員已出發取餐，預計在" + etaString + "將餐點送達。可至訂購紀錄查看外送人員的位置哦!";
		}
		
		if (msg != "") {
			var query = new Parse.Query(Parse.Installation);
			query.equalTo("objectId", request.object.get("installation"));
			Parse.Push.send({
					where: query, 
					data: {
					  	title: "HungryBee美食外送",
					    alert: msg,
					    sound: "default",
						badge: "Increment"
				  	},
				},{
						success: function() {
					    },
					  	error: function(error) {
					    },
					  	useMasterKey: true
					  });
		}
	}
	console.log("============= END db_trigger.js afterSave HBShoppingCart =============");
});

	/*
Parse.Cloud.beforeSave("HBShoppingCart", function(request, response) {

	var shoppingCart = request.object;
	console.log("before save hbshoppingcart:" + shoppingCart.existed());
	//if (shoppingCart.existed() && request.user != null) {	
	if (shoppingCart.existed() ) {
		console.log("beforeSave shoppingCart's status:" + shoppingCart.get("status"));
		
		//主要設定 Line 開啟後，可以結帳的時間
		if ((shoppingCart.get("status") == "in shopping") && (shoppingCart.get("checkoutLimit") != null) && (shoppingCart.get("lineModeEnable"))) {
			var checkoutLimit = shoppingCart.get("checkoutLimit");
			var current = new Date();
			var canCheckoutAt = new Date(current.getTime() + eval(checkoutLimit)*60000); 
			
			Parse.Cloud.useMasterKey();
			shoppingCart.set("canCheckoutAt", canCheckoutAt);
			console.log("set canCheckoutAt-" + canCheckoutAt);
		}
		response.success();	
		
	} else {
		console.log("leave before save hbshopping cart");
		response.success();	
	}
});
*/

Parse.Cloud.afterSave("HBUserComments", function(request, response) {
	var cartId = request.object.get("shoppingCart").id;
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var query = new Parse.Query(HBShoppingCart);
	query.get(cartId)
	.then(function(cart) {
	    cart.set("provideSurvey", true);
	    cart.save();
	}, 
	function(error) {
		console.error(JSON.stringify(error));
	    mail.send_error(mail.subject("afterSave HBUserComments", "update shopping cart"), error);
	});
});

//雲端列印新訂單
Parse.Cloud.afterSave("HBOrder", function(request) {
	console.log("afterSave HBOrder");
	
	//通知店家
	var query = new Parse.Query("HBStoreInCart");
	query.equalTo("cart", request.object.get("shoppingCart"));
	query.include("store");
	query.include("cart");
	query.each(function(storeInCart){
		var storeObj = storeInCart.get("store");
	    var cartObj = storeInCart.get("cart");
	    console.log("store:" + storeObj.get("storeName") + ", cart status:" + cartObj.get("status"));
	    if(cartObj.get("status") == "ongoing") { //接單後才通知店家
	    	var promise = Parse.Promise.as();
		    promise = promise.then(function() {
		        var queryUser = new Parse.Query(Parse.User);
				queryUser.equalTo("memberOfStore", storeObj);
			    queryUser.each(function(user){
			    	
			    	var etd = cartObj.get("ETD");
			    	var dateOfEtd = etd.getFullYear() + "/" + (etd.getMonth() + 1) + "/" + etd.getDate();
			    	
					var queryInstallation = new Parse.Query(Parse.Installation);
	    			queryInstallation.equalTo("owner", user.id);
	    			Parse.Push.send({
		    			where: queryInstallation, 
						data: {
						  	title: "店家小蜜蜂",
						    alert: storeObj.get("storeName") + "-新訂單通知",
						    sound: "default",
							badge: "Increment",
							type: "newOrder",
							etd: dateOfEtd,
							cartId: request.object.get("shoppingCart").id
					  	},
					}, 
					{
					 	success: function() {
					    	// Push was successful
					    	console.log("Push was successful send to " + user.id + ", members Of " + storeObj.get("storeName"));
					    	//response.success(true);
					    },
					  	error: function(error) {
					    	console.error(JSON.stringify(error));
					    	//mail.send_error(mail.subject("afterSave HBShoppingCart", "send push failed"), error);
					    	//response.error(error);
					  	},
					  	useMasterKey: true
					});
			    });
		    });	
	    }
	});
	
	/*
	//列印訂單
	Parse.Cloud.httpRequest({
        url: prop.order_url(), 
        params: {
        	cartId:request.object.get("shoppingCart").id ,
        	seq: new Date().getMilliseconds()	//加一個變動的參數,避免 php cache
        },
  		success: function(httpResponse) {
  			console.log(httpResponse.text);
        	httpResponse.success(true);
        },
        error: function(httpResponse) {
        	console.log(JSON.stringify(httpResponse));
            console.error('Request failed with response code ' + httpResponse.status);
            //httpResponse.error('Request failed with response code ' + httpResponse.status);
        }
    });
    */
});

//設定店家尖峰
Parse.Cloud.afterSave("HBRushHour", function(request) {
	console.log("afterSave HBRushHour");
	
	var startTime = request.object.get("startTime");
	var now = new Date();
	
	if (now > startTime) {
		console.log("set store busy now." + request.object.get("storeId").id);	
	   	var query = new Parse.Query("HBFoodStore");
		query.get(request.object.get("storeId").id, {
		  	success: function(storeFound) {
		  		storeFound.set("onhold", "busy");
		  		storeFound.save(null,{
					success: function(storeSaved){
						console.log(request.object.get("storeId").id + " store saved:");
					},
					error: function(err) {
						mail.send_error(mail.subject("afterSave HBRushHour", "set store onhold failed."), err); 
					}		
				});
		 	},
		  	error: function(object, err) {
				mail.send_error(mail.subject("afterSave HBRushHour", "query store error."), err);
			}
		});
	} else {
		console.log("set by schedule job");	
	}
});

//小蜜蜂取餐後，後端push通知店家
Parse.Cloud.afterSave("HBStoreInCart", function(request) {
	console.log("afterSave HBStoreInCart:" + request.object.get("foodTaken") );
	if(request.object.get("foodTaken")) {
		var query = new Parse.Query(Parse.User);
		query.equalTo("memberOfStore", request.object.get("store"));
		query.include("memberOfStore");
		
		var queryStore = new Parse.Query("HBFoodStore");
		var queryCart = new Parse.Query("HBShoppingCart");
		Parse.Promise.when(queryStore.get(request.object.get("store").id), query.find(), queryCart.get(request.object.get("cart").id))
			.then(function(storeFound, usersFound, cartFound){
				var userIdArray = [];
				_.each(usersFound, function(user) {
					userIdArray.push(user.id);
				});
				
				var storeName = storeFound.get("storeName");
				
				var installationId = cartFound.get("installation");
				return Parse.Promise.when(Parse.Promise.as(userIdArray), Parse.Promise.as(storeName), Parse.Promise.as(installationId));
			})
			.then(function(userIdArray, storeName, installationId){
				var queryInstallation = new Parse.Query(Parse.Installation);
				queryInstallation.containedIn("owner", userIdArray);
				var p1 = Parse.Push.send({
						where: queryInstallation, 
						data: {
						  	title: "店家小蜜蜂",
						    alert: storeName + "-已取餐通知",
						    sound: "default",
							badge: "Increment",
							type: "foodTaken",
							cartId: request.object.get("cart").id
					  	},
					},
					{
					 	success: function() {
					    },
					  	error: function(error) {
					    },
					  	useMasterKey: true
					});
					
				var queryInstallation1 = new Parse.Query(Parse.Installation);
				queryInstallation1.equalTo("objectId", installationId);	
				var p2 = Parse.Push.send({
						where: queryInstallation1, 
						data: {
						  	title: "HungryBee美食外送",
						    alert: storeName + "-已取餐通知。訂單:" + request.object.get("cart").id,
						    sound: "default",
							badge: "Increment"
					  	},
					},
					{
					 	success: function() {
					    },
					  	error: function(error) {
					    },
					  	useMasterKey: true
					});
				return Parse.Promise.when(p1, p2);	
			})
			.then(
				function() {
					console.log("Push was successful" );
				}, 
				function(error) {
					console.log("Push was failed");
				}
			);
	}
});

// User
////第一次登入，給一張coupon
Parse.Cloud.afterSave(Parse.User, function(request) {
	console.log("login count:" + request.object.get("loginCount"));
	if(request.object.get("loginCount") == 1) { //第一次登入
		if(request.object.getUsername().indexOf("driver-") != -1 || request.object.getUsername().indexOf("store-") != -1 ) {
			//小蜜蜂及店家不用給優惠券
		} else {
			var query = new Parse.Query("HBCoupon");
			query.equalTo("owner", request.object);
			query.equalTo("remark", "first login");
			query.find().then(
		  		function(couponFound) {
		  			if (couponFound.length == 0) { //沒給過coupon
						Parse.Cloud.useMasterKey();
						var HBCoupon = Parse.Object.extend("HBCoupon");
						var coupon = new HBCoupon();
						coupon.set("owner", request.object);
						coupon.set("discount", -50);
						coupon.set("remark", "first login");
						coupon.save(null,{
							success: function(couponCreated){
								console.log("coupon created");
							},
							error: function(err) {
								mail.send_error(mail.subject("afterSave User", "create coupon"), err); 
							}		
						});
		    		} else { //
		    			console.log("not first time login");
		    		}
		  		},
		  		function(err) {
		  			mail.send_error(mail.subject("afterSave User", "find coupon"), err);
				}
	  		);
	  	}
  	}	
});