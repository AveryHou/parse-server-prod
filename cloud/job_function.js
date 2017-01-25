/***
 *
 **/

var logger = require("./mail_service.js");
var prop = require("./app_properties.js");

//set Role on system initializationtriggered by Parse Job once.
Parse.Cloud.job("shortenUrlForOrder", function(req, status) {
	var googleKey = "AIzaSyAOC2vryr8Bfu27LaG3RaZ7WeFBd5JPhx0";
	
	Parse.Cloud.httpRequest({
		url: 'https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyAOC2vryr8Bfu27LaG3RaZ7WeFBd5JPhx0', //use shorten url api
  		method: "POST",
	    headers: {
	        'Content-Type': 'application/json'
	    },
	    body : {
	    	longUrl: req.params.urlstring	
	    },
        success: function(httpResponse) {
        	var obj = JSON.parse(httpResponse.text);
        	console.log(httpResponse.text);
        	status.success("shortenUrlForOrder ok");  
        },
        error: function(httpResponse) {
        	console.error("http response:" + JSON.stringify(httpResponse));
            status.error("shortenUrlForOrder failed" + JSON.stringify(httpResponse));  
        }
    });
});

Parse.Cloud.job("testDataForFoodStore", function(req, status) {
	var acl = new Parse.ACL();
	acl.setPublicReadAccess(true);
		
	var stores = [];	
		
	var HBLob = Parse.Object.extend("HBLob");
	
			
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	var store = new HBFoodStore();
	var lob = new HBLob();	
	lob.id = "t82qALjWkR";	
	store.set("storeImage", lob);
	store.set("storeName", "大雄小吃店");
	store.set("address", "新竹市光復路1號");
	store.set("locationGroup", "group1");
	store.set("online", true);
	store.set("phone", "03-1111111");
	store.set("storeCode", "A1");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.804291, longitude:120.975241}));
	store.setACL(acl);
	stores.push(store);
	
	store = new HBFoodStore();
	lob = new HBLob();	
	lob.id = "tS7ih1ORVF";	
	store.set("storeImage", lob);
	store.set("storeName", "正宗日式拉麵");
	store.set("address", "新竹市光復路2號");
	store.set("locationGroup", "group1");
	store.set("online", true);
	store.set("phone", "03-2222222");
	store.set("storeCode", "A2");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.805817, longitude:120.98798}));
	store.setACL(acl);
	stores.push(store);
	
	store = new HBFoodStore();
	lob = new HBLob();	
	lob.id = "3clj3wpkHT";	
	store.set("storeImage", lob);
	store.set("storeName", "清清麵食館");
	store.set("address", "新竹市光復路3號");
	store.set("locationGroup", "group3");
	store.set("online", true);
	store.set("phone", "03-3333333");
	store.set("storeCode", "A3");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.778164, longitude:121.019907}));
	store.setACL(acl);
	stores.push(store);
	
	store = new HBFoodStore();
	lob = new HBLob();	
	lob.id = "7xqMYxxjjT";	
	store.set("storeImage", lob);
	store.set("storeName", "好吃泰式料理");
	store.set("address", "新竹市光復路4號");
	store.set("locationGroup", "group4");
	store.set("online", true);
	store.set("phone", "03-0000000");
	store.set("storeCode", "A4");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.775353, longitude:121.026557}));
	store.setACL(acl);
	stores.push(store);
	
	
	store = new HBFoodStore();
	lob = new HBLob();	
	lob.id = "uTqKvrkOxB";	
	store.set("storeImage", lob);
	store.set("storeName", "美味花園餐廳");
	store.set("address", "新竹市光復路5號");
	store.set("locationGroup", "group5");
	store.set("online", true);
	store.set("phone", "03-5555555");
	store.set("storeCode", "A5");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.777311, longitude:121.021368}));
	store.setACL(acl);
	stores.push(store);
	
	
	store = new HBFoodStore();
	lob = new HBLob();	
	lob.id = "x3XUm9rYAY";
	store.set("storeImage", lob);
	store.set("storeName", "超大排骨店");
	store.set("address", "新竹市光復路6號");
	store.set("locationGroup", "group6");
	store.set("online", true);
	store.set("phone", "03-6666666");
	store.set("storeCode", "A6");
	store.set("geoLocation", new Parse.GeoPoint({latitude:24.778233, longitude:121.019907}));
	store.setACL(acl);
	stores.push(store);
	
  	Parse.Cloud.useMasterKey();
	Parse.Object.saveAll(stores, {
        success: function(stores) {
            status.success("data init ok");  
        },
        error: function(error) { 
            status.error("data init error");		
        }
    });
});


//set Role on system initializationtriggered by Parse Job once.
Parse.Cloud.job("createRole", function(req, status) {
	
  	Parse.Cloud.useMasterKey();
	var roleACL = new Parse.ACL();
	if (req.params.read) {
		roleACL.setPublicReadAccess(true);
	}
	if (req.params.write) {
		roleACL.setPublicWriteAccess(true);
	}
	var role = new Parse.Role(req.params.roleName, roleACL);
	role.save(null,{
		success: function(roleCreated){
	    	status.success(roleCreated.id);
		},
		error: function(err) {
			console.error("createRole error:" + err.code + "," + err.message);
			status.error(err);
		}		
	});
});



Parse.Cloud.job("ePrintTesting", function(request, status) {
	console.log("http://coderer.net/dev/index.php?cartId=" + request.params.cartId);
	
	
	Parse.Cloud.httpRequest({
	  url: 'http://coderer.net/dev/index.php?cartId=' + request.params.cartId
	  //url: 'http://www.google.com'
	}).then(function(httpResponse) {
	  // success
	  //response.success(httpResponse.text);
	  status.success("ok");
	  console.log(httpResponse.text);
	},function(httpResponse) {
	  // error
	  //response.error("createUserAddressBook failed." + err);
	  status.error("error:" + JSON.stringify(httpResponse));
	  console.error('Request failed with response code ' + httpResponse.status);
	});
});


var currentTime = new Date();
	
	
//for test	
Parse.Cloud.job("queryTimeSlot", function(req, status) {
	
  	//目前的時間+30分鐘訂為可開始取件時間
	var minSlot = (currentTime.getHours() + 8) * 60 + currentTime.getMinutes() + 30;
	console.log(currentTime + ", minSlot:" + minSlot);
	
	var query = new Parse.Query("HBTimeSlot");
	query.greaterThan("sinceMidnight", minSlot);
	query.find({
    			success: function(dataFound) {
    				console.log("dataFound:" + dataFound.length);
    				status.success("ok");
    				
    			},
    			error: function(err) {
					console.error("job queryTimeSlot failed" + err.code + "," + err.message);
		      	  	status.error(err);
		    	}
		    });
	
	
	
});


//for test
Parse.Cloud.job("createStoreProductivity", function(req, status) {
	
  	var query = new Parse.Query("HBTimeSlot");
  	if(req.params.sinceMidnight) {
  		query.greaterThan("sinceMidnight", req.params.sinceMidnight);
  	}
	query.find({
		success: function(slotFound) {
			
			//find biz date
			var HBFoodStore = Parse.Object.extend("HBFoodStore");
			var store = new HBFoodStore();
			store.id = req.params.storeId;
			
			var counter = slotFound.length;
			var dataToCreate = [];
			var HBProductivity = Parse.Object.extend("HBProductivity");
			for (var i=0 ; i<counter ; i++) {
				var slotObj = slotFound[i];
				var prod = new HBProductivity();
		        prod.set("quota", 50);
		        prod.set("store", store);
		        prod.set("timeSlot", slotObj);
		        prod.set("sinceMidnight",slotObj.get("sinceMidnight") );//for sorting
		        if(slotObj.get("sinceMidnight") <= req.params.openUntil) {
		        	prod.set("serviceOpen", true);
		        } else {
		        	prod.set("serviceOpen", false);
		        }
		        
		        dataToCreate.push(prod);
		        
			}
			console.log("dataToCreate:" + dataToCreate);
			Parse.Cloud.useMasterKey();
			Parse.Object.saveAll(dataToCreate, {
		        success: function(results) {
		            status.success("init ok");
		        },
		        error: function(error) { 
		            console.error("save HBProductivity failed:" + error.code + "," + error.message);
					status.error(error.message);	
		        }
		    });
			
		},
		error: function(err) {
			console.error("job queryTimeSlot failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});


//統計預約人員
Parse.Cloud.job("getBookingUser", function(req, status) {
	
	var currentDate = new Date();
	var today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0,0,0); 
	
	if (req.params.diff) {
		currentDate.setDate(currentDate.getDate() - req.params.diff); //取N天前至今的申請資料
	} else {
		currentDate.setDate(currentDate.getDate() - 1); //取昨天至今的申請資料
	}
	
	var everSince = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0,0,0); 
	
	var dateString = everSince.getFullYear() + "/" + (everSince.getMonth() + 1) + "/" + everSince.getDate();
	console.log("base date:" + dateString);
	
	var query = new Parse.Query("HBTrainingBooking");
	query.greaterThanOrEqualTo("createdAt", everSince);
	query.lessThan("createdAt", today);
	query.include("user");
	query.find({
		success: function(bookingsFound) {
			var validateBookings = [];
			var bookingsNeedVerify = [];
			var bookingsObjNeedVerify = [];
			
			for(var i=0 ; i<bookingsFound.length ; i++) {
				var submmited = bookingsFound[i].get("bookingSubmitted");
				var user = bookingsFound[i].get("user");
				if(submmited && !user.get("qualify")) {
					validateBookings.push(bookingsFound[i]);
				} else {
					bookingsNeedVerify.push(bookingsFound[i].get("installationId"));
					bookingsObjNeedVerify.push(bookingsFound[i]);
				}
			}
			
			Parse.Cloud.useMasterKey();
			var query1 = new Parse.Query(Parse.Installation);
			query1.containedIn("installationId", bookingsNeedVerify);
			query1.find({
				success: function(installationsFound) {
					console.log("bookings Need Verify:" + installationsFound.length);
					for (var i=0 ; i<installationsFound.length ; i++) {
						var oneInstallation = installationsFound[i];
						if (oneInstallation.get("deviceType") == "android" && oneInstallation.get("appVersion") != "1.2.6") {
							for(var j=0 ; j<bookingsNeedVerify.length ; j++) {
								if (oneInstallation.get("installationId") == bookingsNeedVerify[j]){
									validateBookings.push(bookingsObjNeedVerify[j]);
									console.log("andriod accepted. " +  oneInstallation.get("installationId"));
									break;	
								}
							}	
						} else {
							console.log("ios. " + oneInstallation.id);		
						}
					}
					
					//send mail
					send_nofity_mail(validateBookings, dateString);
					
					console.log("validateBookings:" + JSON.stringify(validateBookings));
					status.success("ok");
					
				},
				error: function(err) {
					status.error(err);
				}
			});
			
		},
		error: function(err) {
			console.error("job queryTimeSlot failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
    
});

var prop = require("./app_properties.js");
var mail = require("./mail_service.js");

function send_nofity_mail(validateBookings, dateString) {
	
	var promise = new Parse.Promise();
	var data = "<table border=0>";
	for(var j=0 ; j<validateBookings.length ; j++) {
		var booking =  validateBookings[j];
		var user = booking.get("user");
		var email = user.getEmail();
		var contact = user.get("contact");
		var phone = user.get("phone");
		data += "<tr><td>" + user.id + "</td>";
		data += "<td>" + contact + "</td>";
		data += "<td>" + phone + "</td>";
		var createAt = new Date(booking.createdAt);
		data += "<td>" + createAt.getFullYear() + "/" + (createAt.getMonth() + 1) + "/" + createAt.getDate() + "</td>";
		data += "<td>&nbsp;</td>";
		data += "<td>" + email + "</td>";
		data += "<td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>";
		data += "<td>" + booking.get("installationId") + "</td></tr>";
	}
	data += "</table>";
	
	
	var subject = dateString + " 外送小蜜蜂申請單統計，共" + validateBookings.length + "人";
	mail.send_notify(prop.booking_manager(), prop.mail_cc(), subject, data);
	
	
}

// app 初始資料
Parse.Cloud.job("createStoreBizDate", function(req, status) {
	var query = new Parse.Query("HBFoodStore");
	query.find({
		success: function(storeFound) {
			var HBStoreBusinessDate = Parse.Object.extend("HBStoreBusinessDate");
			for (var i=0 ; i<storeFound.length ; i++) {
				if (storeFound[i].get("storeCode") != "A0") {
					
					var biz = new HBStoreBusinessDate();
					biz.set("Mon", true);
					biz.set("Tue", true);
					biz.set("Wed", true);
					biz.set("Thu", true);
					biz.set("Fri", true);
					biz.set("Sat", true);
					biz.set("Sun", true);
					biz.set("store", storeFound[i]);
					biz.save();
					
				}
			}
			
		},
		error: function(err) {
			console.error("find store failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});

//產生coupon
Parse.Cloud.job("printCoupon", function(req, status) {
	
	var currentDate = new Date();
	console.log("today:" + currentDate);
	var today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0,0,0); 
	
	if (req.params.diff) {
		currentDate.setDate(currentDate.getDate() - req.params.diff); //取N天前至今的申請資料
	} else {
		currentDate.setDate(currentDate.getDate() - 2); //取昨天至今的申請資料
		console.log("query base:" + currentDate);
	}
	
	var everSince = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0,0,0); 
	console.log("everSince:" + everSince);
	var dateString = everSince.getFullYear() + "/" + (everSince.getMonth() + 1) + "/" + everSince.getDate();
	console.log("base date:" + dateString);
	
	var query = new Parse.Query("HBCoupon");
	//query.greaterThanOrEqualTo("createdAt", everSince);
	//query.lessThan("createdAt", today);
	//query.include("user");
	query.find({
		success: function(couponsFound) {
			console.log("couponsFound:" + couponsFound.length);
			status.success("ok");
			//send_nofity_mail(validateBookings, dateString);
			
		},
		error: function(err) {
			console.error("job printCoupon failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
    
});

//18:00 關閉所有店家
Parse.Cloud.job("setAllStoreBreaking", function(req, status) {
	var query = new Parse.Query("HBFoodStore");
	query.find({
		success: function(storeFound) {
			console.log("found:" + storeFound.length);
			var stores = [];
			Parse.Cloud.useMasterKey();
			for (var i=0 ; i<storeFound.length ; i++) {
				if (storeFound[i].get("storeCode") != "A0") {
					var oneStore = storeFound[i];
					oneStore.set("onhold", "breaking");
					oneStore.set("resume", "明天");
					stores.push(oneStore);
				}
			}
			
			Parse.Object.saveAll(stores, {
		        success: function(results) {
		            status.success("stores saved ok");
		        },
		        error: function(error) { 
		            console.error("save HBStore failed:" + error.code + "," + error.message);
					status.error(error.message);	
		        }
		    });
			
		},
		error: function(err) {
			console.error("find store failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});

//09:20 執行,開啟店家
Parse.Cloud.job("setAllStoreOpen", function(req, status) {
	var currentTime = new Date() ;
	var dayOfWeek = currentTime.getDay();
	console.log("今天星期" + dayOfWeek);
	if (dayOfWeek == "6" || dayOfWeek == "0" ) { 
		 status.success("星期六,日 平台不開");
	} else {
		var query = new Parse.Query("HBFoodStore");
		query.find({
			success: function(storesFound) {
				var stores = [];
				Parse.Cloud.useMasterKey();
				console.log("setAllStoreOpen:" + storesFound.length);
				for (var i=0 ; i<storesFound.length ; i++) {
					var storeCode = storesFound[i].get("storeCode");
					var oneStore = storesFound[i];
					if (storeCode == "R12" || storeCode == "R10") { //雞排下午再開啟
						oneStore.set("resume", "15:00");
						stores.push(oneStore);
					} else {
						oneStore.set("onhold", null);
						stores.push(oneStore);
					}
				}
				
				Parse.Object.saveAll(stores, {
			        success: function(results) {
			            status.success("stores saved ok");
			        },
			        error: function(error) { 
			            console.error("save HBStore failed:" + error.code + "," + error.message);
						status.error(error.message);	
			        }
			    });
			},
			error: function(err) {
				console.error("find store failed" + err.code + "," + err.message);
	      	  	status.error(err);
	    	}
	    });	
	}
	
});

//14:30 執行
Parse.Cloud.job("enableFriedChecken", function(req, status) {
	var query = new Parse.Query("HBFoodStore");
	query.find({
		success: function(storesFound) {
			var stores = [];
			Parse.Cloud.useMasterKey();
			for (var i=0 ; i<storesFound.length ; i++) {
				var storeCode = storesFound[i].get("storeCode");
				var oneStore = storesFound[i];
				if (storeCode == "R12" || storeCode == "R10") {
					oneStore.set("onhold", null);
					stores.push(oneStore);
				}
			}
			
			Parse.Object.saveAll(stores, {
		        success: function(results) {
		            status.success("stores saved ok");
		        },
		        error: function(error) { 
		            console.error("save HBStore failed:" + error.code + "," + error.message);
					status.error(error.message);	
		        }
		    });
		},
		error: function(err) {
			console.error("find store failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});

//09:21 設公休
Parse.Cloud.job("setRoutineBreaking", function(req, status) {
	var query = new Parse.Query("HBFoodStore");
	query.containedIn("objectId", req.params.storeId);
	query.find({
		success: function(storesFound) {
			console.log("setRoutineBreaking:" + storesFound.length);
			var stores = [];
			Parse.Cloud.useMasterKey();
			for (var i=0 ; i<storesFound.length ; i++) {
				var oneStore = storesFound[i];
				oneStore.set("onhold", "breaking");
				stores.push(oneStore);
			}
			
			Parse.Object.saveAll(stores, {
		        success: function(results) {
		            status.success("stores saved ok");
		        },
		        error: function(error) { 
		            console.error("save HBStore failed:" + error.code + "," + error.message);
					status.error(error.message);	
		        }
		    });
		},
		error: function(err) {
			console.error("find store failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});

//exec every 1 hr
//批次設尖蜂
Parse.Cloud.job("updateStoreOnholdState", function(req, status) {
	var now = new Date();
	var currentDate = now.getFullYear() + "/" + (now.getMonth() + 1) + "/" + now.getDate();
	
	var query = new Parse.Query("HBRushHour");
	query.equalTo("setupDate", currentDate);
	query.equalTo("cancelled", false);
	query.include("storeId");
    query.find({
	  	success: function(dataFound) {
	  		console.log("今天 " + currentDate + " 有尖蜂設定值:" + dataFound.length + " 店家");
	  		var busyStore = [];
	  		var normalStore = [];
	  		
	  		for(var i=0 ; i<dataFound.length ; i++) {
	  			var storeSetting = dataFound[i];
	  			var storeObj = storeSetting.get("storeId");
	  			if (now > storeSetting.get("startTime") && now < storeSetting.get("endTime")) {
	  				if(storeObj.get("onhold") != "busy") {
		  				storeObj.set("onhold", "busy");
		  				busyStore.push(storeObj);
	  				}
	  			} else {
	  				if(storeObj.get("onhold") == "busy") {
	  					storeObj.set("onhold", null);
	  					normalStore.push(storeObj);
	  				}
	  			}
	  		}
	  		
	  		Parse.Object.saveAll(busyStore, {
		        success: function(busyStoreUpdate) {
		        	console.log("設尖蜂:" + busyStoreUpdate.length + " 店家");
		        	if(busyStoreUpdate.length > 0) {
		        		logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[批次設尖蜂]" + busyStoreUpdate.length + " 家店", JSON.stringify(busyStoreUpdate)); 
					}
		            
		            Parse.Object.saveAll(normalStore, {
		        		success: function(normalStoreUpdate) {
				        	console.log("取消尖蜂:" + normalStoreUpdate.length + " 店家");
				        	if(normalStoreUpdate.length > 0) {
				        		logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[批次取消尖蜂]" + normalStoreUpdate.length + " 家店", JSON.stringify(normalStoreUpdate)); 
							}
				            response.success(true);  
				        },
				        error: function(error) { 
				            logger.send_error(logger.subject("setStoreBusy", "restore store busy state failed."), error); 
							response.error(error);		
				        }
				    });
		            
		        },
		        error: function(error) { 
		            logger.send_error(logger.subject("setStoreBusy", "setStoreBusy failed."), error);
					response.error(error);		
		        }
		    });
	  		
	 	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("replyBusyStatus", "query rush hour failed."), err);
			response.error(err);
	  	}
	});	
});

//通知店家回覆今日是否公休
//每天執行一次
Parse.Cloud.job("storeBreakingNotify", function(req, status) {
	var today = new Date();
	var dataString = (today.getMonth() + 1) + "/" + today.getDate();
	var queryInstallation = new Parse.Query(Parse.Installation);
	
	var query = new Parse.Query(Parse.User);
	query.include("memberOfStore");
	query.exists("memberOfStore");
	query.find()
		.then(function(usersFound) {
			
			var promises = [];
			for(var i=0 ; i<usersFound.length ; i++) {
				var store = usersFound[i].get("memberOfStore");
				var routineBreak = store.get("routineBreak"); //店家公休日
				
				var userIdArray = [];
				//for(var i=0 ; i<usersFound.length ; i++) {
					if (routineBreak.indexOf(today.getDay()) == -1) { //今天不在店家公休日才需發push
						userIdArray.push(usersFound[i].id);
					}
				//}; 
				
				console.log("storeBreakingNotify Push will sent to :" + userIdArray );
				queryInstallation.containedIn("owner", userIdArray);
				var promise =  Parse.Push.send({
						where: queryInstallation, 
						data: {
						  	title: "店家小蜜蜂",
						    alert: dataString + " 開店詢問-" + store.get("storeName"),
						    sound: "default",
							badge: "Increment",
							type: "openStore"
					  	},
					});
				promises.push(promise);	
				logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[開店詢問]" + store.get("storeName"), userIdArray); 
			}	
			return promises;
			
		})
		.then(
			function(sendOK) {
				console.log("storeBreakingNotify Push was successful" );
				status.success("storeBreakingNotify ok");
			}, 
			function(error) {
				console.log("storeBreakingNotify Push was failed");
				status.error(error.message);	
			}
		);
});

//店家版開通前的開店通知測試
Parse.Cloud.job("storeBreakingNotifyForTest", function(req, status) {
	var today = new Date();
	var dataString = (today.getMonth() + 1) + "/" + today.getDate();
	var queryInstallation = new Parse.Query(Parse.Installation);
	
	var query = new Parse.Query(Parse.User);
	query.include("memberOfStore");
	query.exists("memberOfStore");
	query.find()
		.then(function(usersFound) {
			
			var promises = [];
			for(var i=0 ; i<usersFound.length ; i++) {
				console.log("user:" + usersFound[i].id);
				if(req.params.userIds.indexOf(usersFound[i].id) == -1) continue;
				console.log("notified");
				
				var store = usersFound[i].get("memberOfStore");
				var routineBreak = store.get("routineBreak"); //店家公休日
				
				var userIdArray = [];
				//for(var i=0 ; i<usersFound.length ; i++) {
					if (routineBreak.indexOf(today.getDay()) == -1) { //今天不在店家公休日才需發push
						userIdArray.push(usersFound[i].id);
					}
				//}; 
				
				/*
				console.log("storeBreakingNotify Push will sent to :" + userIdArray );
				queryInstallation.containedIn("owner", userIdArray);
				var promise =  Parse.Push.send({
						where: queryInstallation, 
						data: {
						  	title: "店家小蜜蜂",
						    alert: dataString + " 開店詢問-" + store.get("storeName"),
						    sound: "default",
							badge: "Increment",
							type: "openStore"
					  	},
					});
				promises.push(promise);	
					*/
				
				logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[測試開店詢問]" + store.get("storeName"), userIdArray); 
			}	
			return promises;
			
		})
		.then(
			function(sendOK) {
				console.log("storeBreakingNotify Push was successful" );
				status.success("storeBreakingNotify ok");
			}, 
			function(error) {
				console.log("storeBreakingNotify Push was failed");
				status.error(error.message);	
			}
		);
});

//產生coupon
Parse.Cloud.job("createCoupon", function(req, status) {
	//find biz date
	var HBCoupon = Parse.Object.extend("HBCoupon");
	
	var discount = req.params.discount;
	var qty = eval(req.params.qty);
	
	var User =  Parse.Object.extend(Parse.User);
	var owner = new User();
	owner.id = req.params.owner;
	
	var coupons = [];
	for (var i=0 ; i<qty ; i++) {
		var oneCoupon = new HBCoupon();
        oneCoupon.set("discount", eval(discount));
        oneCoupon.set("owner", owner);
        coupons.push(oneCoupon);
        
	}
	
	Parse.Cloud.useMasterKey();
	Parse.Object.saveAll(coupons, {
        success: function(results) {
            status.success("create coupon ok");
        },
        error: function(error) { 
            console.error("save createCoupon failed:" + error.code + "," + error.message);
			status.error(error.message);	
        }
    });
});


Parse.Cloud.job("setStoreBizDate", function(request, status) {
	var query = new Parse.Query("HBStoreBusinessDate");
	query.find().then(
  		function(dataFound) {
  			var objArray = [];
  			for(var i=0 ; i<dataFound.length ; i++) {
  				var obj = dataFound[i];
  				obj.set(request.params.dateString, request.params.isOpen);
  				objArray.push(obj);
  			}
  			Parse.Object.saveAll(objArray, {
		        success: function(objArray) {
		            response.success(objArray.length);  
		        },
		        error: function(error) { 
		            logger.send_error(logger.subject("setStoreBizDate", "save HBStoreBusinessDate"), error);
					response.error(error);		
		        }
			});
  		},
  		function(error) {
  			logger.send_error(logger.subject("setStoreBizDate", "query HBStoreBusinessDate"), error); 
			response.error(error);
  		}
  	);
});

//09:21 設公休
Parse.Cloud.job("updateStoreBizStatus", function(req, status) {
	var query = new Parse.Query("HBStoreBusinessDate");
	query.find({
		success: function(dataFound) {
			var data = [];
			
			for (var i=0 ; i<dataFound.length ; i++) {
				var biz = dataFound[i];
				biz.set(req.params.dayOfWeek, req.params.isOpen);
				data.push(biz);
			}
			
			Parse.Cloud.useMasterKey();
			Parse.Object.saveAll(data, {
		        success: function(results) {
		            status.success(" saved ok");
		        },
		        error: function(error) { 
		            console.error("save  failed:" + error.code + "," + error.message);
					status.error(error.message);	
		        }
		    });
		},
		error: function(err) {
			console.error("find store failed" + err.code + "," + err.message);
      	  	status.error(err);
    	}
    });
});