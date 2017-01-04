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

//取得所有店家
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
    		response.success(returnResults);
    		/*
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
			*/
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getFoodStore", "food store lookup failed."), error);
      	  	response.error(err);
    	}
  	});
});

//取得店家有上架的餐點
Parse.Cloud.define("getMealsOfFoodStore", function(request, response) {
	var FoodStore = Parse.Object.extend("HBFoodStore");
	var store = new FoodStore();
	store.id = request.params.storeId;
	
	var query = new Parse.Query("HBMealSet");
	query.equalTo("belongTo", store); 
	query.equalTo("online", true);
	query.include("foodImage"); 
	query.include("thumbnail");
	query.include("belongTo");
	query.ascending("displayOrder");
  	query.find({
		success: function(results) {
			response.success(results);
    	},
    	error: function(err) {
			console.error("meals lookup failed" + err.code + "," + err.message);
      	  	response.error(err);      	  	
    	}
  	});
});

//可一起點的店家
Parse.Cloud.define("getSameLocationStore", function(request, response) {
	
	if(request.params.cartMode != null && request.params.cartMode == "join") { //團購模式
		var query = new Parse.Query("HBProductivity");
		query.equalTo("serviceOpen", true);
		query.equalTo("sinceMidnight", request.params.sinceMidnight);
		query.include("store");
		query.include(["store.storeImage"]);
		query.find()
			.then(function(results) {
				var stores = [];
				console.log("時段符合的店家數:" + results.length);
				var currentMD = util.currentDate();
				var etaString = request.params.etaString; // formate: 8/8(四) 13:45
				console.log("送餐時間:" + etaString + ",區域:" + request.params.locationGroup);
	     		var idx = etaString.indexOf("(");
	     		var isToday = "No";
				if (currentMD == etaString.substring(0, idx)) {
					isToday = "Yes";
				}

		      	for (var i=0 ; i<results.length ; i++) {
		      		var storeObj = results[i].get("store");
		      		//exclude self
		      		if (storeObj.id == request.params.storeId) {
		      			console.log("自己不算:" + storeObj.get("storeName"));
		      			continue;	
		      		}
		      		
		      		//不同區，不能併單
		      		if (storeObj.get("locationGroup") != request.params.locationGroup) {
		      			console.log("不同區:" + storeObj.get("storeName"));
		      			continue;
		      		}
		      		
		      		if (isToday == "Yes") { //當日訂單
		      			//需提前一天預約，不能併單
		      			if (storeObj.get("reservationUnit") == "day") {
		      				console.log("需提前天預約:" + storeObj.get("storeName"));
			      			continue;
			      		}
			      		
			      		//需提前N分鐘
			      		if (storeObj.get("reservationUnit") == "minute") {
			      			//目前時間與訂單時間差距是否足夠
			      			var currentDate = new Date();
			      			var currentMinutesFromMidnight = (currentDate.getHours() + 8) * 60 + currentDate.getMinutes();
			      			var diff = request.params.sinceMidnight - currentMinutesFromMidnight; 
			      			if (diff < storeObj.get("reservation")) {
			      				console.log("需提前分鐘預約:" + storeObj.get("storeName"));
			      				continue;	
			      			}
			      		}
		      		}
		      		
		      		//休息中或尖峰時段的店家不能併單
		      		if (storeObj.get("onhold") == "breaking" || storeObj.get("onhold") == "busy" || storeObj.get("online") == false) {
		      			console.log("不提供營業:" + storeObj.get("storeName"));
		      			continue;
		      		}
		      		
		      		stores.push(storeObj);	
		      	}
	      		return Parse.Promise.as(stores);
	      	})
	    	.then(
	    		function(stores) {
	    			console.log("通過第一階段篩選條件，剩餘店家數:" + stores.length);
	    			var cweek = ["(日)","(一)","(二)","(三)","(四)","(五)","(六)"];
	    			var eweek = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
	    			var tempETA = request.params.etaString; // formate: 8/8(四) 13:45
		     		var tempDayOfWeek = "";
		     		var leftIdx = tempETA.indexOf("(");
		     		var rightIdx = tempETA.indexOf(")");
		     		var tempDay = tempETA.substring(leftIdx, rightIdx + 1);
					var dayOfWeek = eweek[cweek.indexOf(tempDay)];
	    			console.log("再找出:" + dayOfWeek + " 有營業的店家");
	    			var queryBiz = new Parse.Query("HBStoreBusinessDate");
					queryBiz.equalTo(dayOfWeek, true);
					queryBiz.include("store");
			      	queryBiz.find({
						success: function(bizFound) {
					  	  	var resultSet = [];
					  	  	for (var i=0 ; i<stores.length ; i++) {
					      		var outerStore = stores[i];
					      		for (var j=0 ; j<bizFound.length ; j++) {
						      		var innerStore = bizFound[j].get("store");
						      		if (outerStore.id == innerStore.id) {
						      			console.log("可一起點:" + outerStore.get("storeName"));
						      			resultSet.push(outerStore);
						      			break;
						      		}
						      	}
						    }
						    console.log("可一起點店家數:" + resultSet.length);
				      		response.success(resultSet);
				      	},
				      	error: function(err) {
							console.error("getSameLocationGroup lookup HBStoreBusinessDate failed" + err.code + "," + err.message);
				    	  	response.error(err);
						}
				    });
	    		},
	    		function(err) {
	    			console.error("getSameLocationGroup lookup store failed" + err.code + "," + err.message);
	    	  		response.error(err);
	    		}
	    	);
	} else {
		var query = new Parse.Query("HBFoodStore");
		query.equalTo("locationGroup", request.params.locationGroup);
		query.equalTo("online", true);
		//if(request.params.cartMode != null && request.params.cartMode == "join") { //團購模式, 先排除休息的店家
			query.notContainedIn("onhold", ["breaking"]);  	
		//}
		query.notEqualTo("objectId", request.params.storeId); //exclude self
		query.include("storeImage");
		query.find({
	      success: function(results) {
			response.success(results);
	      },
	      error: function(err) {
				console.error("getSameLocationGroup normal cart failed" + err.code + "," + err.message);
	    	  	response.error(err);
			}
	    });
	} 
});

//取得店家可供餐的時間
Parse.Cloud.define("getStoreBusinessDateThisWeek", function(request, response) {
	
	var FoodStore = Parse.Object.extend("HBFoodStore");
	var store = new FoodStore();
	store.id = request.params.storeId;
	
	var query = new Parse.Query("HBStoreBusinessDate");
	query.equals("store", store);
	
	var query = new Parse.Query("HBProductivity");
	query.matchesQuery("timeSlot", subQuery);
	query.equals("store", store);	
	query.include("timeSlot");
	query.find({
    	success: function(slotFound) {
    		response.success(slotFound);
    	},
    	error: function(err) {
			console.error("getStoreTimeSlot failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//店家備餐時間區間設定值
Parse.Cloud.define("getStoreTimeSlot", function(request, response) {
	var currentTime = new Date();
	var subQuery = new Parse.Query("HBTimeSlot");
	subQuery.equals("enable", true);
	subQuery.greaterThan("sinceMidnight", currentTime.getHours() * 60);
	
	var FoodStore = Parse.Object.extend("HBFoodStore");
	var store = new FoodStore();
	store.id = request.params.storeId;
	
	
	var query = new Parse.Query("HBProductivity");
	query.matchesQuery("timeSlot", subQuery);
	query.equals("store", store);	
	query.include("timeSlot");
	query.find({
    	success: function(slotFound) {
    		response.success(slotFound);
    	},
    	error: function(err) {
			console.error("getStoreTimeSlot failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});


//取得個人購物車
Parse.Cloud.define("createShoppingCart", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("owner", request.user);
	query.equalTo("status", "in shopping"); 
  	query.find().then(
  		function(cartFound) {
  			if (cartFound.length == 0) { //
				Parse.Cloud.useMasterKey();
    			var ShoppingCart = Parse.Object.extend("HBShoppingCart");
    			var cart = new ShoppingCart();
    			cart.set("owner", request.user);
    			cart.set("status", "in shopping");
    			cart.set("cartType", request.params.cartType);
    			cart.save(null,{
					success: function(cartCreated){
						console.log("create shopping cart:" + cartCreated.id);
						
						//產生短網址，之後開啟 Line 團購模式會用到
						var originalUrl = prop.shorten_url() + "/agent.html?cart=" + cartCreated.id + "&owner=" + cartCreated.get("owner").id;
						//console.log("originalUrl:" + originalUrl);
										
						// generate shorten url
				    	Parse.Cloud.run("shortenUrlForOrder", {	longUrl: originalUrl }, {
							success: function(result){
								cartCreated.set("shortenUrl", result);
								cartCreated.set("etaString", "");
								cartCreated.save(null,{
									success: function(cartUpdated){
										response.success(cartUpdated);
								    },
									error: function(err) {
										logger.send_error(logger.subject("createShoppingCart", "save new cart"), err); 
										response.error(err);
									}		
								});
							},
						 	error: function(error) {
								response.error(error);
							}
						});
				    },
					error: function(err) {
						logger.send_error(logger.subject("createShoppingCart", "save new cart"), err); 
						response.error(err);
					}		
				});
				
    		} else { //
    			response.success(cartFound[0]); //in shopping狀態只會有一筆，所以取 idx[0]
    		}
  		},
  		function(err) {
  			logger.send_error(logger.subject("createShoppingCart", request.user.getUsername() + " find in shopping cart error"), err);  
			response.error(err);
  		}
  	);
});

//
Parse.Cloud.define("getShoppingCartContents", function(request, response) {
	
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	query.equalTo("owner", request.user);
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("shoppingCart");
	query.find().then(
  		function(itemsFound){
	        response.success(itemsFound);
  		},
  		function(err) {
  			console.error("getShoppingCartContents error:" + err.code + "," + err.message);
			response.error(err);
  		}
  	);
});

//購物車內容
Parse.Cloud.define("shoppingCartContentsGroupByStore", function(request, response) {
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	//query.equalTo("owner", request.user);
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("store,meal");
	
	query.find().then(
  		function(itemsFound) {
  			var results = shoppingItemGroupBy(itemsFound, request, "");
  			
  			var followerItem = new Array();
  			for (var i=0 ; i<itemsFound.length ; i++) {
				var oneItem = itemsFound[i];		
				if(oneItem.get("addFrom") == "self") continue;
				followerItem.push(oneItem);
			}
  			//console.log("addfrom:" + JSON.stringify(followerItem));
  			results[results.length] = followerItem;
  			
  			var cartFound = null;
  			for (var i=0 ; i<itemsFound.length ; i++) {
				var oneItem = itemsFound[i];		
				cartFound = oneItem.get("shoppingCart");
				break;
			}
  			results[results.length] = cartFound;
  			
  			response.success(results);
  		},
  		function(err) {
  			logger.send_error(logger.subject("shoppingCartContentsGroupByStore", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

// 
Parse.Cloud.define("getFoodStatistic", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
   
    var HBMealSet = Parse.Object.extend("HBMealSet");
	var meal = new HBMealSet();
	meal.id = request.params.foodId; 		
    			
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
    query.equalTo("meal", meal); 	
	query.equalTo("owner", request.user);
	query.find().then(
  		function(itemFound) {
  			if (itemFound.length > 0) {
  				response.success(itemFound[0].get("qty"));
  			} else {
  				response.success(itemFound.length);
  			}
  			
  		},
  		function(err) {
  			console.error("getFoodStatistic error:" + err.code + "," + err.message);
			response.error(err);
  		}
  	);
});

//.new 6/8 updated
Parse.Cloud.define("updateShoppingCartByFood", function(request, response) {
	Parse.Cloud.useMasterKey();
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var HBMealSet = Parse.Object.extend("HBMealSet");
	var meal = new HBMealSet();
	meal.id = request.params.foodId;
			
	//get food info
	var queryMeal = new Parse.Query("HBMealSet");		
	queryMeal.get(request.params.foodId)
		.then(function(mealFound) {
			var itemKey;
		    if (request.params.itemKey != null && request.params.itemKey != "") {
		    	itemKey = request.params.itemKey;
		    } else {
		    	itemKey = generateItemKey(request);
		    	if (itemKey == "") {
		    		itemKey = request.params.foodId;
		    	}
		    }
		    
		    var query = new Parse.Query("HBShoppingItem");
		    query.equalTo("shoppingCart", cart);
		    query.equalTo("meal", meal);
		    query.equalTo("owner", request.user);
		    query.equalTo("itemKey", itemKey);
			query.find({
		    	success: function(shoppingItemsFound) {
		     		if (request.params.qty > 0) {
		     			var qty = request.params.qty;
				    	var bags = request.params.bags;
				    	//var unitPrice = request.params.price;
				    	
				    	//影響價錢的4個屬性，改由後端計算
				    	var foodSizeSelected =  request.params.foodSize;
				    	var foodCupSelected =  request.params.cupSize;
				    	var additionSelected =  request.params.foodAdditions;
				    	var largeAdditionSelected =  request.params.largeFoodAdditions;
				    	
				    	var unitPrice = util.getTotalFoodPrice(mealFound, foodSizeSelected, foodCupSelected, additionSelected, largeAdditionSelected);
				    	console.log("unitPrice:" + unitPrice);
				    	
				    	if (shoppingItemsFound.length > 0) {
				    		if (request.params.fromTextField == "YES") { //從購物車手動輸入修改數量(待app approved後再更新)
				    			//do nothing
				    		} else {
				    			qty += shoppingItemsFound[0].get("qty"); //累加
				    		}
							shoppingItemsFound[0].set("qty", qty);
					        shoppingItemsFound[0].set("bags", eval(new Number(qty * bags).toFixed(2))); //取小數點二位
					        shoppingItemsFound[0].set("unitPrice", unitPrice);
					        shoppingItemsFound[0].set("subTotal", qty * unitPrice);
		     				shoppingItemsFound[0].save(null,{
					        	success: function(itemUpdated) {
					        		response.success(itemUpdated);	
					        	},
					        	error: function(err) {
					        		logger.send_error(logger.subject("updateShoppingCartByFood", "update HBShoppingItem") , err);
					        		response.error("update HBShoppingItem error:" + err);
					        	}	
					        });
					        
		     			} else {
		     				// create new record
				     		var HBFoodStore = Parse.Object.extend("HBFoodStore");
					    	var store = new HBFoodStore();
					    	store.id = request.params.storeId;
							
					    	var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
					        var item = new HBShoppingItem();
					        item.set("shoppingCart", cart);
					        item.set("qty", qty);
					        item.set("bags", eval(new Number(qty * bags).toFixed(2))); //取小數點二位
					        item.set("unitPrice", unitPrice);
					        item.set("subTotal", qty * unitPrice);
					        item.set("owner", request.user);
					        item.set("store", store);
					        item.set("meal", meal);
					        item.set("addFrom", (request.params.cartMode=="Normal") ? "self" : "line");
					        
					        var displayName = "";
					        if (request.params.foodSize != null && request.params.foodSize != "") {
					        	displayName += (request.params.foodSize == SMALL_FOOD) ? "小" : "大";
					        	displayName += ",";
					        	item.set("foodSize", request.params.foodSize);
					        }
					        
					        if (request.params.cupSize != null && request.params.cupSize != "") {
					        	displayName += request.params.cupSizeName + ",";
					        	item.set("cupSize", request.params.cupSize);
					        }
					        
					        if (request.params.coldHot != null && request.params.coldHot != "") {
					        	displayName += (request.params.coldHot == COLD_DRINK) ? "冷" : "熱";
					        	displayName += ",";
					        	item.set("coldHot", request.params.coldHot);
					        }
					        
					        if ((request.params.coldHot == "" || request.params.coldHot == COLD_DRINK) &&
					        	request.params.iceLevel != null && request.params.iceLevel != "") {
					        	if (request.params.iceLevel == ICE_NONE) {
					        		displayName += "去冰";
					        	} else if  (request.params.iceLevel == ICE_LITTLE) {
					        		displayName += "少冰";
					        	} else if  (request.params.iceLevel == ICE_NORMAL) {
					        		displayName += "正常冰";
					        	}
								displayName += ",";
								item.set("iceLevel", request.params.iceLevel);
					        }
					        
					        if (request.params.sugarLevel != null && request.params.sugarLevel != "") {
					        	if (request.params.sugarLevel == SUGAR_NONE) {
					        		displayName += "無糖";
					        	} else if  (request.params.sugarLevel == SUGAR_LITTLE) {
					        		displayName += "1/3糖";
					        	} else if  (request.params.sugarLevel == SUGAR_HALF) {
					        		displayName += "1/2糖";
					        	} else if  (request.params.sugarLevel == SUGAR_NORMAL) {
					        		displayName += "2/3糖";
					        	} else if  (request.params.sugarLevel == SUGAR_FULL) {
									displayName += "全糖";
					        	}
									displayName += ",";
									item.set("sugarLevel", request.params.sugarLevel);
					        }
					        
					        if (request.params.spicyLevel != null && request.params.spicyLevel != "") {
					        	if (request.params.spicyLevel == SPICY_NONE) {
					        		displayName += "不辣";
					        	} else if  (request.params.spicyLevel == SPICY_LITTLE) {
					        		displayName += "小辣";
					        	} else if  (request.params.spicyLevel == SPICY_HALF) {
					        		displayName += "中辣";
					        	} else if  (request.params.spicyLevel == SPICY_NORMAL) {
					        		displayName += "大辣";
					        	}	
								displayName += ",";
								item.set("spicyLevel", request.params.spicyLevel);
					        }
					        
					        if (request.params.needPepper != null && request.params.needPepper != "") {
					        	if (request.params.needPepper == PEPPER_NONE) {
					        		displayName += "不加胡椒";
					        	} else if  (request.params.needPepper == PEPPER_NORMAL) {
					        		displayName += "加胡椒";
					        	}
								displayName += ",";
								item.set("needPepper", request.params.needPepper);
					        }
					        
					        if (request.params.foodAdditions != null && request.params.foodAdditions != "") {
					        	displayName += concatDisplayName(request.params.foodAdditions);
					        	item.set("foodAdditions", request.params.foodAdditions);
					        }
					        
					        if (request.params.largeFoodAdditions != null && request.params.largeFoodAdditions != "") {
					        	displayName += concatDisplayName(request.params.largeFoodAdditions);
					        	item.set("foodAdditions", request.params.largeFoodAdditions);
					        }
					        if (request.params.other) {
					        	displayName += "\n" + request.params.other;
						        item.set("other", request.params.other);
						    }
						    
					        item.set("itemNameForDisplay", displayName);
					        item.set("itemKey", itemKey);
					        
					        item.save(null,{
					        	success: function(itemCreated) {
					        		response.success(itemCreated);	
					        	},
					        	error: function(err) {
					        		logger.send_error(logger.subject("updateShoppingCartByFood", "create HBShoppingItem") , err);
					        		response.error("create HBShoppingItem error:" + err);
					        	}	
					        });
		     			}
				    } else {
				    	//remove old record
			     		console.log("old item:" + shoppingItemsFound.length);
			     		if (shoppingItemsFound.length > 0) {
			     			Parse.Object.destroyAll(shoppingItemsFound,  { 
								success: function(success) {
									console.log("destroy old record done.");		
									response.success(true);			
					            }, 
					            error: function(error) {
									console.error("destroy old record error.");
									response.error(error);
								}
				        	});
			     		} else {
							response.success(true);
						}
				    }
		    	},
		    	error: function(error) {
					console.error("HBShoppingItem lookup failed:" + error.code + "," + error.message);
		      	  	response.error(error);
				}
		  	});
		});
});

//
Parse.Cloud.define("updateShoppingCart", function(request, response) {
	var HBMealSet = Parse.Object.extend("HBMealSet");
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
    var query = new Parse.Query("HBShoppingItem");
    query.equalTo("objectId", request.params.foodId); 
	query.equalTo("shoppingCart", cart);
	query.equalTo("owner", request.user);
	query.find({
    	success: function(shoppingItemsFound) {
     		//remove old item
     		if (shoppingItemsFound.length > 0) {
     			Parse.Object.destroyAll(shoppingItemsFound,  { 
					success: function(success) {
						console.log("destroy old success");					
		            }, 
		            error: function(error) {
						console.error("destroy old error");
						response.error(error);
		            }
	        	});
     		}
     		
     		// create new 
			var items = request.params.mealsInCart;        
		    var itemArray = [];
		    for (var i = 0; i < items.length; i++) { 
		    	var store = new HBFoodStore();
		    	store.id = items[i].storeId;
				
				var meal = new HBMealSet();
				meal.id = items[i].mealId;
				
		    	var qty = items[i].qty;
		    	var bags = items[i].bags;
		    	var unitPrice = items[i].price;
				var mealName = items[i].mealName;
				var storeName = items[i].storeName;
				
				var item = new HBShoppingItem();
		        item.set("shoppingCart", cart);
		        item.set("qty", qty);
		        item.set("unitPrice", unitPrice);
		        item.set("subTotal", qty * unitPrice);
		        item.set("owner", request.user);
		        item.set("store", store);
		        item.set("meal", meal);
				item.set("addFrom", "self");
				item.set("bags", eval(new Number(qty * bags).toFixed(2))); //取小數點二位
		        itemArray.push(item);
		    }
		
		    Parse.Object.saveAll(itemArray, {
		        success: function(itemArray) {
		            response.success(itemArray.length);  
		        },
		        error: function(error) { 
		            logger.send_error(logger.subject("updateShoppingCart", "save HBShoppingItem"), error);
					response.error(error);		
		        }
			});
    	},
    	error: function(error) {
			console.error("HBShoppingItem lookup failed:" + error.code + "," + error.message);
      	  	response.error(error);
    	}
  	});
});

//todo
//
Parse.Cloud.define("removeShoppingItem", function(request, response) {
	response.success(true); 
});

//todo
//
//Parse.Cloud.define("updateShoppingItemQty", function(request, response) {
//	response.success(true); 
//});

Parse.Cloud.define("createMenu", function(request, response) {
	response.success(true); 
});


//Line
/*
Parse.Cloud.define("updateShoppingCartFromLine", function(request, response) {
	console.log("user:" + request.user.get("contactName"));
	
	var HBMealSet = Parse.Object.extend("HBMealSet");
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
	// create new 
	var items = request.params.mealsInCart;        
    var itemArray = [];
    for (var i = 0; i < items.length; i++) { 
    	var store = new HBFoodStore();
    	store.id = items[i].storeId;
		
		var meal = new HBMealSet();
		meal.id = items[i].mealId;
		
    	var qty = items[i].qty;
    	var unitPrice = items[i].price;
		var mealName = items[i].mealName;
		var storeName = items[i].storeName;
		
        var item = new HBShoppingItem();
        item.set("shoppingCart", cart);
        item.set("qty", qty);
        item.set("unitPrice", unitPrice);
        item.set("subTotal", qty * unitPrice);
        item.set("owner", request.user);
        item.set("store", store);
        item.set("meal", meal);
		item.set("addFrom", "line");
        itemArray.push(item);
    }

    Parse.Object.saveAll(itemArray, {
        success: function(itemArray) {
            response.success(itemArray.length);  
        },
        error: function(error) { 
            console.error("updateShoppingCart failed:" + error.code + "," + error.message);
			response.error(error);		
        }
    });
});
*/

//離開團購
Parse.Cloud.define("quitGroupBuy", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
    query.equalTo("owner", request.user);
	query.equalTo("addFrom", "line");
	query.find({
    	success: function(shoppingItemsFound) {
     		//remove old record
     		if (shoppingItemsFound.length > 0) {
     			Parse.Cloud.useMasterKey();
     			Parse.Object.destroyAll(shoppingItemsFound,  { 
					success: function(success) {
						console.log("destroy old record done.");
						response.success(true);					
		            }, 
		            error: function(error) {
						console.error("destroy old record error.");
						response.error(error);
		            }
	        	});
     		} else {
     			response.success(true);	
     		}
    	},
    	error: function(error) {
			logger.send_error(logger.subject("quitGroupBuy", "HBShoppingItem lookup failed"), error);
			response.error(error);
		}
  	});
});

//確定如入團購
Parse.Cloud.define("didJoinGroupBuy", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
    query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		cartFound.addUnique("participants", request.user);
	  		cartFound.save(null,{
				success: function(cartSaved){
					response.success(true);
			    },
				error: function(err) {
					logger.send_error(logger.subject("didJoinGroupBuy", "save cart"), err); 
					response.error(err);
				}		
			});
	 	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("didJoinGroupBuy", "query shopping cart error."), err);
			response.error(err);
	  	}
	});
});

//
Parse.Cloud.define("getGroupBuyFollowers", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var query = new Parse.Query("HBShoppingItem");
    Parse.Cloud.useMasterKey();
    query.equalTo("shoppingCart", cart);
    query.include("owner");
    query.include("store");
    query.include("meal");
    query.include("shoppingCart");
    query.descending("addFrom"); //owner放第一個
    query.find({
    	success: function(itemsFound) {
    		var results = shoppingItemGroupByFollower(itemsFound);
    		
    		//results[0]: 跟團人員
    		//results[1]: 每個跟團人員的購買項目
    		
    		
    		
    		
    		
    		response.success(results);  	   	 	
    	},
    	error: function(error) {
			logger.send_error(logger.subject("getGroupBuyFollowers", "find cart"), error);
      	  	response.error(error);
    	}
  	});
});

//
Parse.Cloud.define("getStoreId", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
    var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
    query.include("store");
    query.include("shoppingCart");
    query.include(["shoppingCart.owner"]);
    query.find({
    	success: function(itemsFound) {
     		response.success(itemsFound[0]);  	   	 	
    	},
    	error: function(error) {
			console.error("getStoreId failed:" + error.code + "," + error.message);
      	  	response.error(error);
    	}
  	});
});

//團購是否關閉
Parse.Cloud.define("isGroupBuyClosed", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
    query.equalTo("objectId", request.params.cartId);
    query.equalTo("lineModeEnable", false);
    query.find({
    	success: function(cartFound) {
    		if (cartFound.length == 1) {
     			response.success(true);  
     		} else {
     			response.success(false);  
     		}
    	},
    	error: function(error) {
			console.error("isGroupBuyClosed failed:" + error.code + "," + error.message);
      	  	response.error(error);
    	}
  	});
});

//計算運費
Parse.Cloud.define("getShippingFee", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
    var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
    query.include("store");
    query.find({
    	success: function(itemsFound) {
    		var storeId = [];
    		var totalFoodPrice = 0; //全部餐費
    		for(var i=0 ; i<itemsFound.length ; i++) {
    			var oneItem = itemsFound[i];
    			var store = oneItem.get("store").id;
    			if (storeId.indexOf(store) == -1) {
    				storeId.push(store);
    			}
    			totalFoodPrice += itemsFound[i].get("subTotal");
    		}
    		//var userPay = util.calShippingFee(totalFoodPrice, storeId.length);
    		var userPay = util.calShippingFee_new(itemsFound, storeId.length);
    		response.success(userPay);
    		
    		/*
    		var subTotal = request.params.currentSubTotal;
		    Parse.Config.get().then(function(config) {
		  		var shippingFee = config.get("shipping_fee");
		  		//if (storeId.length > 1) {
		  		//	shippingFee += 20 * (storeId.length - 1); //每多一個店家，運費多 $20(暫不上線)
		  		//}
		  		
		  		if (eval(subTotal) >= 888) {
		  			response.success(80);  			
		  		} else {
		  			response.success(shippingFee);
		  		}
			}, 
			function(err) {
				logger.send_error(logger.subject("getShippingFee", "calculate shipping fee") , err);
		  		response.error("getShippingFee failed." + err.code + "," + err.message);
			});
    		*/
    		
    	},
    	error: function(error) {
			logger.send_error(logger.subject("getShippingFee", "query shoppingitem") , err);
      	  	response.error(error);
    	}
  	});
});

//取得折扣金額
Parse.Cloud.define("getCouponPrice", function(request, response) {
	if (request.params.couponId != null && request.params.couponId.toLowerCase() == "newbee") {
		response.success(0);
	} else {
		var query = new Parse.Query("HBCoupon");
		query.notEqualTo("used", true);
		query.get(request.params.couponId, {
		  	success: function(couponFound) {
		  		response.success(couponFound.get("discount"));
		 	},
		  	error: function(object, err) {
		  		//coupon not found
		    	response.success(0);
		  	}
		});
	}
});

//取得折扣
Parse.Cloud.define("getCoupons", function(request, response) {
	var query = new Parse.Query("HBCoupon");
	query.notEqualTo("used", true);
	query.equalTo("owner", request.user);
	query.find({
	    	success: function(couponFound) {
	    		response.success(couponFound);
	    	},
	    	error: function(err) {
				logger.send_error(logger.subject("getCoupons", "query coupon") , err);
	      	  	response.error(err);
	    	}
	  	});
});


//送出購物車
//送出後，再產生QRCode. see submitQRCode
Parse.Cloud.define("submitShoppingCart", function(request, response) {
	if(request.params.allPayNo == "" && request.params.paymentMethod == "") {
		response.error(err);
	} else {
		var query = new Parse.Query("HBShoppingCart");
		query.get(request.params.cartId, {
		  	success: function(cartFound) {
		  		var query = new Parse.Query("HBShoppingItem");
				query.equalTo("shoppingCart", cartFound);
				query.include("store");
				query.find({
			    	success: function(itemsFound) {
			    		var orderNoPrefix = [];
			    		var subTotalPrice = 0;
			    		var totalQty = 0;
			    		
			    		//產生訂單編號及小計
			    		var storeObjArray = [];
			    		var storeIdArray = [];
			    		var storeBags = [];
			    		for(var i=0 ; i<itemsFound.length ; i++) {
			     			var itemObj = itemsFound[i];	
			     			var storeObj = itemObj.get("store");
			     			var storeFoundAt = storeIdArray.indexOf(storeObj.id);
			     			if (storeFoundAt == -1) {
			     				storeObjArray.push(storeObj);
			     				storeIdArray.push(storeObj.id);
			     				storeBags.push(itemObj.get("bags"));
			     			}  else {
				 				var currentBags = storeBags[storeFoundAt];
				 				currentBags = currentBags + itemObj.get("bags");
				 				storeBags[storeFoundAt] = currentBags;
				 			}
			     			
			     			var storeCode = storeObj.get("storeCode");
			     			if (orderNoPrefix.indexOf(storeCode) == -1) { // not found
			     				orderNoPrefix.push(storeCode);
			     			}		     			
			     			subTotalPrice += eval(itemObj.get("subTotal"));
			     			totalQty += eval(itemObj.get("qty"));
			     		}
			     		
			     		if (request.params.sendToId != null) {
				     		var HBUserAddressBook = Parse.Object.extend("HBUserAddressBook");
						    var address = new HBUserAddressBook();
							address.id = request.params.sendToId;
				     	}
			     	
			     		var tempETA = request.params.ETA; // formate: 8/8(四) 13:45
			     		if (tempETA != null && tempETA != "") {
			     			var tempDay = tempETA.substring(0, tempETA.indexOf("("));
							var tempSlot = tempETA.substring(tempETA.indexOf(" ") + 1);
							var eta = new Date(new Date().getFullYear() + "/" + tempDay + " " + tempSlot);
							eta.setMinutes(eta.getMinutes() - 480); // 轉換成 UTC 時間
									
							var etd = new Date(eta);
							//送達時間前30分鐘設為取餐時間，每多一個店家多5分鐘
							etd.setMinutes(eta.getMinutes() - 30 - ((orderNoPrefix.length-1) * 5));
			     		}
			     		
			     		
			     		Parse.Cloud.useMasterKey();
			     		var orderNo = orderNoPrefix.join("") + "-" + request.params.cartId;
			     		cartFound.set("orderNo", orderNo);
			     		cartFound.set("status", request.params.status);
			     		cartFound.set("shippingFee", eval(request.params.shippingFee));
			 		    cartFound.set("discount", eval(request.params.discount));
			 		    cartFound.set("totalPrice", subTotalPrice + eval(request.params.shippingFee)+eval(request.params.discount));
			 		    cartFound.set("couponNo", request.params.couponNo);
			 		    cartFound.set("needTaxId", request.params.needTaxId);
			 		    cartFound.set("taxId", request.params.taxId);
			 		    cartFound.set("payToBee", 130+((orderNoPrefix.length-1) * 15)); //130 起跳
			 		    cartFound.set("addressNote", request.params.addressNote); 
			 		    
			 		    if (request.params.userEmail != "") {
			 		    	cartFound.set("userEmail", request.params.userEmail);
			 			}
			 			if (request.params.phone != "") {
			 		    	cartFound.set("contactPhone", request.params.phone);
			 			}
			 			if (request.params.contact != "") {
			 		    	cartFound.set("contactPerson", request.params.contact);
			 			}
			 			
			 		    if (request.params.deliveryOrder == true) {
				 		    cartFound.set("ETD", etd);
				 		    cartFound.set("ETA", eta);
				 		}
			 		    cartFound.set("allPayNo", request.params.allPayNo);
			 		    if (request.params.sendToId != null) {
				 		    cartFound.set("sendTo", address);
				 		}
			 		    cartFound.set("deliveryOrder", request.params.deliveryOrder);
			 		    cartFound.set("submittedDate", new Date());
			 		    cartFound.set("lineModeEnable", false);
			 		    if (request.params.installationId) {
			 		    	cartFound.set("installation", request.params.installationId);	
			 		    }
			 		    if (request.params.sinceMidnight) {
			 		    	cartFound.set("etaSinceMidnight", request.params.sinceMidnight);	
			 		    }
			 		    
			 		    if (request.params.paymentMethod) {
			 		    	//司機版會受影響，暫時不更新此柵位
			 		    	//cartFound.set("paymentMethod", request.params.paymentMethod);
			 		    	
			 		    	if(request.params.paymentMethod == "userPayCash") { //貨到付款
			 		    		cartFound.set("allPayNo", "userPayCash");
			 		    	}
			 		    }
			 		    
			 		    cartFound.save({})
			 		    	.then(function(cartUpdated) {
			 		    		var queryAddr = new Parse.Query("HBUserAddressBook");
								queryAddr.equalTo("objectId", cartUpdated.get("sendTo").id);
			 		    		return Parse.Promise.when( queryAddr.find(), cartUpdated);
			 		    	})
			 		    	.then(function(addrFound, cartUpdated) {
			 		    		var HBCustomerInCart = Parse.Object.extend("HBCustomerInCart");
					        	var customerInCart = new HBCustomerInCart();
					        	customerInCart.set("address", addrFound[0].get("address"));
					        	customerInCart.set("location", addrFound[0].get("geoLocation"));
					        	customerInCart.set("contact", request.params.contact);
			 					customerInCart.set("phone", request.params.phone);
					        	customerInCart.set("addressNote", request.params.addressNote); 
					        	customerInCart.set("cart", cartUpdated); 
					        	customerInCart.set("delivered", false); 
					        	customerInCart.set("ETA", cartUpdated.get("ETA")); 
					        	return Parse.Promise.when( customerInCart.save(), cartUpdated);
			 		    	})
			 		    	.then(function(customerInCart, cartFound) {
			 		    		// create new 
					        	var HBStoreInCart = Parse.Object.extend("HBStoreInCart");
								var itemArray = [];
								for (var i= 0 ; i<storeObjArray.length ; i++) {
							    	var item = new HBStoreInCart();
							        item.set("cart", cartFound);
							        item.set("store", storeObjArray[i]);
							        item.set("foodTaken", false);
							        item.set("replied", false);
							        item.set("bags", Math.ceil(storeBags[i])); //無條件進位
			        
							        //todo. 之後再依實際載具運算, Avery . 160621
							        var bagSize = "S";
							        if (Math.ceil(storeBags[i]) > 5) {
							        	bagSize = "L";
							        }
							        item.set("bagSize", bagSize);
							        itemArray.push(item);
							    }
							
							    Parse.Object.saveAll(itemArray, {
							        success: function(dataCreated) {
							            //update user info according to order's user info
							        	var currentUser = request.user;
							        	currentUser.set("phone", request.params.phone);
							        	currentUser.set("contact", request.params.contact);
							        	currentUser.set("userEmail", request.params.userEmail);
							        	
							        	if(request.params.rememberCreditCart == "YES") {
							 		    	currentUser.set("rememberCardNo", true);
							 		    	currentUser.set("cardNo", request.params.cardNo);
							 		    	currentUser.set("cardValidMonth", request.params.cardValidMM);
							 		    	currentUser.set("cardValidYear", request.params.cardValidYY);
							 		    } else {
							 		    	currentUser.set("rememberCardNo", false);
							 		    }
							 		    
							 		    currentUser.save(null, {
							        		success: function(userUpdated) {
							        			var subject = userUpdated.get("contact") + " 送出新訂單: " + cartFound.id;
							        			var sDate = cartFound.get("submittedDate");
							        			
							        			var body = "訂購人: " + userUpdated.get("contact") + ", " + userUpdated.get("phone") + "<BR>";
							        			body += "email: " + userUpdated.get("userEmail") + "<BR><BR>";
							        			body += "訂單編號: " + cartFound.id + "<BR>";
							        			body += "訂單產生時間: " + (sDate.getMonth() + 1) + "/" + sDate.getDate() + " " + (sDate.getHours()+8) + ":" + sDate.getMinutes() + "<BR><BR>";
							        			
							        			body += "餐點預計送達時間: " + tempETA + "<BR>";
							        			body += "送餐地址: " + request.params.address + "<BR>";
							        			body += "送餐備註: " + request.params.addressNote + "<BR><BR>";
							        			
							        			body += "餐費: $" + subTotalPrice + "<BR>";
							        			body += "運費: $" + cartFound.get("shippingFee") + "<BR>";
							        			
							        			if (cartFound.get("couponNo") != "") {
							        				body += "折價金額: $" + cartFound.get("discount") + " (折價卷: " + cartFound.get("couponNo") + ")<BR>";
							        			} else {
							        				body += "折價金額: $0 (未使用折價卷)<BR>";
							        			}
							        			
							        			body += "刷卡金額: <font color=blue>$" + cartFound.get("totalPrice") + "</font><BR>";
							        			body += "歐付寶交易序號: " + cartFound.get("allPayNo") + "<BR><BR>";
							        			body += prop.order_info() + "?objectId=" + cartFound.id;
							        			
							        			logger.send_notify(prop.admin_mail(), prop.mail_cc(), subject, body);
							        			
							        			//計算出較精準的到店取餐時間
							        			Parse.Cloud.run("calculateETD", 
							        							{cartId: cartFound.id}, 
							        							{
									                            	success: function (result) {
									                            		response.success(cartFound.id);
									                        		}, error: function (error) {
									                        			logger.send_error(logger.subject("submitShoppingCart", "call calculateETD failed."), error);
																		response.error(error);
									                        		}
									                            });
							        			
							        		},
							        		error: function(error) { 
							        			logger.send_error(logger.subject("submitShoppingCart", "currentUser update failed."), error);
												response.error(error);
							        		}
							        	});
							        },
							        error: function(error) { 
							            logger.send_error(logger.subject("updateShoppingCart", "save HBShoppingItem"), error);
										response.error(error);		
							        }
								});
			 		    	});
					},
			    	error: function(err) {
						logger.send_error(logger.subject("submitShoppingCart", "find shopping item error."), err);
			      	  	//response.error(err);
			    	}
			  	});
		 	},
		  	error: function(object, err) {
				logger.send_error(logger.subject("submitShoppingCart", "query shopping cart error."), err);
				response.error("submitShoppingCart failed." + err.code + "," + err.message);
		  	}
		});
	}
});

// Line state
Parse.Cloud.define("updateLineState", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		//console.log("cartFound:" + cartFound.id);
	  		Parse.Cloud.useMasterKey();
	  		if (request.params.lineMode == false) {
	  			cartFound.set("canCheckoutAt", null);	
	  		}	
	  		cartFound.set("lineModeEnable", request.params.lineMode);
 		    cartFound.save();
 		    response.success(true);
 		    
 		    /*
 		    null,{
					success: function(cartUpdated){
				    	response.success(cartUpdated.id);
					},
					error: function(err) {
						console.error("save cart line enabled error:" + err.code + "," + err.message);
						response.error(err);
					}		
				});
				*/
	 	},
	  	error: function(err) {
	    	console.error("updateLineState failed" + err.code + "," + err.message);
			response.error("updateLineState failed." + err.code + "," + err.message);
	  	}
	});
});

//
Parse.Cloud.define("getOnBidToday", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("status", "onbid");
	query.include();
	query.find({
	    	success: function(ordersFound) {
	    		response.success(ordersFound);
	    	},
	    	error: function(err) {
				console.error("getOnBidToday failed" + err.code + "," + err.message);
	      	  	response.error(err);
	    	}
	  	});
});


//
Parse.Cloud.define("getCartByStatus", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("deliveryOrder", true); //只取外送單
	query.containedIn("status", request.params.status);
	if (request.params.scope == "private") {
		query.equalTo("bee", request.user);
	}
	
	var queryItem = new Parse.Query("HBShoppingItem");
	queryItem.matchesQuery("shoppingCart", query);
	queryItem.include("shoppingCart");
	queryItem.include("shoppingCart.owner");
	queryItem.include("shoppingCart.sendTo");
	queryItem.include("store");
	queryItem.find({
	    	success: function(itemsFound) {
	    		response.success(itemsFound);
	    	},
	    	error: function(err) {
				console.error("getOnBidToday failed" + err.code + "," + err.message);
	      	  	response.error(err);
	    	}
	  	});
});

//取得個人運送中的訂單
Parse.Cloud.define("getTodoToday", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("status", "ongoing");
	query.equalTo("bee", request.user);
	query.find({
	    	success: function(ordersFound) {
	    		response.success(ordersFound);
	    	},
	    	error: function(err) {
				console.error("getTodoToday failed" + err.code + "," + err.message);
	      	  	response.error(err);
	    	}
	  	});
});

//
Parse.Cloud.define("getShoppingItemByLine", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var shoppingCart = new HBShoppingCart();
	shoppingCart.id = request.params.cartId;	
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", shoppingCart);
	query.equalTo("addFrom", request.params.addFrom);
	query.find({
	    	success: function(itemsFound) {
	    		var sumOfQty = 0;
			var sumOfSubTotal = 0;			
	 		for (var i = 0 ; i<itemsFound.length ; i++) {
 				var oneMeal = itemsFound[i];
				var qty = oneMeal.get("qty");
				var subTotal = oneMeal.get("subTotal");
				sumOfQty += qty;
				sumOfSubTotal += subTotal;
 			}
	 		response.success([sumOfQty,sumOfSubTotal]);   
	    	},
	    	error: function(err) {
				console.error("getShoppingItemByLine failed" + err.code + "," + err.message);
	      	  	response.error(err);
	    	}
  	});
});

//
Parse.Cloud.define("getGroupBuying", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var shoppingCart = new HBShoppingCart();
	shoppingCart.id = request.params.cartId;	
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", shoppingCart);
	query.equalTo("addFrom", request.params.addFrom);
	query.include("owner");
	query.include("meal");
	query.include("store");
	query.find({
	    	success: function(itemsFound) {
	    		var ownerArray = [];
	    		var mealByOwnerArray = [];
	    		var mealQtyArray = []; 
	    		var mealSubTotalArray = []; 
	    		
	    		var ownerIdArray = [];
	 		for (var i = 0 ; i<itemsFound.length ; i++) {
 				var oneItem = itemsFound[i];
 				var oneOwner = oneItem.get("owner");
 				var oneMeal = oneItem.get("meal");
 				var oneStore = oneItem.get("store");
 				
 				var user = {};
 				user.username = oneOwner.get("username");
				user.email = oneOwner.get("email");
				
 				var itemBoughtByUser = {};
 				itemBoughtByUser.storeName = oneStore.get("storeName");
				itemBoughtByUser.foodName = oneMeal.get("mealName");
				itemBoughtByUser.qty = oneItem.get("qty");
				itemBoughtByUser.unitPrice = oneItem.get("unitPrice");
				itemBoughtByUser.priceToPay = oneItem.get("subTotal");
 				
 				var mealSubArray;
 				var idx = ownerIdArray.indexOf(oneOwner.id); 				 				
 				if (idx == -1) { //user not in array yet
 					ownerIdArray.push(oneOwner.id);
 					ownerArray.push(user);				
 					
 					mealSubArray = [];
 					mealSubArray.push(itemBoughtByUser);
 					mealByOwnerArray.push(mealSubArray);
 				} else {
 					mealSubArray = mealByOwnerArray[idx];
 					mealSubArray.push(itemBoughtByUser);
 					mealByOwnerArray[idx] = mealSubArray;
 				}
 			}
			response.success([ownerArray, mealByOwnerArray]);   
	    	},
	    	error: function(err) {
				console.error("getGroupBuying failed" + err.code + "," + err.message);
	      	  	response.error(err);
	    	}
  	});
});

//
Parse.Cloud.define("listMyAddressBook", function(request, response) {
	
	var query = new Parse.Query("HBUserAddressBook");
	query.equalTo("user", request.user);
  	query.find({
    	success: function(results) {
     		var addressBook = [];
	 		for (var i = 0; i < results.length; i++) { 
	       	 	addressBook.push(results[i]);
	   	 	}
	   	 	response.success(addressBook);
    	},
    	error: function(err) {
			console.error("user address lookup failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//
Parse.Cloud.define("deleteUserAddressBook", function(request, response) {
	var query = new Parse.Query("HBUserAddressBook");
	query.get(request.params.addressBookId, {
	  	success: function(addressFound) {
	   		console.log("address found:" + addressFound.id);
	   		Parse.Cloud.useMasterKey();
	   		addressFound.destroy({
  				success: function(addressDestroy) {
			    	console.log("addressDestroy:" + addressDestroy.id);
			    	response.success(true);
				},
				error: function(myObject, err) {
				    logger.send_error(logger.subject("deleteUserAddressBook", "delete AddressBook") , err);
      	  			response.error(err);
				}
			});
	  	},
	  	error: function(object, err) {
	    	logger.send_error(logger.subject("deleteUserAddressBook", "find AddressBook") , err);
      	  	response.error(err);
	  	}
	});
});

//依訂單狀態取訂單
Parse.Cloud.define("getOrderByStatus", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.containedIn("status", request.params.status);
	query.include("sendTo");
	query.include("owner");
	query.find({
    	success: function(results) {
     		response.success(results);
    	},
    	error: function(err) {
			console.error("getOrderByStatus failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//取得待標訂單
Parse.Cloud.define("getOrderOnBid", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.containedIn("status", "onbid");
	query.include("sendTo");
	query.include("owner");
	query.find({
    	success: function(results) {
     		var orders = [];
	 		for (var i = 0; i < results.length; i++) { 
	 			orders.push(results[i]);
	   	 	}
	   	 	response.success(results);
    	},
    	error: function(err) {
			console.error("getOrderOnBid failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

// user
Parse.Cloud.define("getMyOrder", function(request, response) {
	
	var query = new Parse.Query("HBShoppingCart");
	query.containedIn("status", request.params.status);
	if(request.params.userId) {
		var user = new Parse.User();
		user.id = request.params.userId;
		query.equalTo("owner", user);
	} else {
		query.equalTo("owner", request.user);
	}
	query.include("sendTo");
	query.include("owner");
	query.include("bee");
	query.descending("updatedAt");
	query.find({
    	success: function(results) {
    		console.log("getMyOrder-" + request.params.status + ":" + results.length);
    		response.success(results);
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getMyOrder", "get order:" + request.params.status), err);  
      	  	response.error(err);
    	}
  	});
});

Parse.Cloud.define("getMyCompleteOrder", function(request, response) {
	Parse.Cloud.run("getMyOrder", 
		{
		 	status: request.params.status,
		 	userId: request.user.id
		 }, 
		 {
			success: function(result){
				response.success(result);  
		 	},
		 	error: function(error) {
				response.error(error);
			}
		});
});

//todo
// 
Parse.Cloud.define("copyMyOrder", function(request, response) {
	response.success("ok"); 
});


// 取得訂單明細, 回傳 ShoppingItem, client 要自行處理 UI 呈現
Parse.Cloud.define("getOrderDetail", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.orderId;
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.include("owner");
	query.include("shoppingCart");
	query.include("meal");
	query.include("store");
	query.ascending("store");
	query.find({
    	success: function(itemsFound) {
     		response.success(itemsFound);
     	},
    	error: function(err) {
			console.error("getOrderDetail failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

// 取得訂單明細,用店家group by
Parse.Cloud.define("getOrderDetailOrderByStore", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.orderId;
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	
	if (request.params.storeId != null) {
		var HBFoodStore = Parse.Object.extend("HBFoodStore");
		var store = new HBFoodStore();
		store.id = request.params.storeId;	
		query.equalTo("store", store);
	}
	
	
	//if (request.params.viewMode == "groupbuy") {
	//	query.equalTo("owner", request.user);
	//	query.equalTo("addFrom", "line");
	//}
	query.include("owner");
	query.include("shoppingCart");
	query.include("shoppingCart.owner");
	
	query.include("meal");
	query.include("store");
	query.ascending("store");
	query.find({
    	success: function(itemsFound) {
    		//console.log("itemsFound:" + itemsFound.length);
    		
    		var viewMode = request.params.viewMode
    		  		
    		var results = shoppingItemGroupBy(itemsFound, request, viewMode);
  			response.success(results);
     	},
    	error: function(err) {
			console.error("getOrderDetail failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//回傳小蜜蜂目前位置
Parse.Cloud.define("updateBeeLocation", function(request, response) {
	if (request.params.orderId != null) {
		var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
		var cart = new HBShoppingCart();
		cart.id = request.params.orderId;
		
		var point = new Parse.GeoPoint({latitude:request.params.lat, longitude:request.params.lng});
		
		Parse.Cloud.useMasterKey();
		var HBBeeLocation = Parse.Object.extend("HBBeeLocation");
		var loc = new HBBeeLocation();
		loc.set("bee", request.user);
		loc.set("location", point);
		loc.set("cart", cart);
		loc.set("device",  request.params.deviceId);
		if(request.params.accuracy) {
			loc.set("accuracy", request.params.accuracy);
			loc.set("currentDate", request.params.currentDate);
		}
		if(request.params.provider) {
			loc.set("provider", request.params.provider);
		}
		loc.save(null,{
			success: function(locationCreated){
		    	response.success(locationCreated.id);
			},
			error: function(err) {
				console.error("updateBeeLocation error:" + err.code + "," + err.message);
				response.error(err);
			}		
		});
	} else {
		response.success("skip update");
	}
		
});

//
Parse.Cloud.define("getSenderLocation", function(request, response) {
	var query = new Parse.Query("HBBeeLocation");
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	query.equalTo("cart", cart);
	query.descending("createdAt");
	query.find({
    	success: function(locationFound) {
    		if (locationFound.length > 0) {
     			var beeLocation = locationFound[0];
	     		var locationObj = beeLocation.get("location");
	     		response.success([locationObj["latitude"], locationObj["longitude"]]);
     		} else {
     			response.success("not found yet");
     		};
    	},
    	error: function(err) {
			console.error("getSenderLocation failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//
Parse.Cloud.define("getOrderByBee", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.containedIn("status", request.params.status);
	query.equalTo("bee", request.user);
	//query.include("sendTo");
	//query.include("owner");
	query.find({
    	success: function(results) {
     		response.success(results);
    	},
    	error: function(err) {
			console.error("getOrderByStatus failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//
//Parse.Cloud.define("getDeliveryInformation", function(request, response) {
Parse.Cloud.define("getOrderOnBidDetail", function(request, response) {
	var ShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new ShoppingCart();
	cart.id = request.params.orderNo;
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.include(["shoppingCart.sendTo"]);
	query.include(["shoppingCart.owner"]);
	query.include("shoppingCart");
	query.include("store");
	query.find({
    	success: function(itemsFound) {
    		response.success(itemsFound);
    	},
    	error: function(err) {
			console.error("getOrderOnBidDetail failed" + err.code + "," + err.message);
      	  	response.error(error);
    	}
  	});
});

//下標
Parse.Cloud.define("bidOnOrder", function(request, response) {
	
	var query = new Parse.Query("HBShoppingCart");
	
	var tempCartId = request.params.orderNo;
	if (tempCartId.indexOf("-") != -1) {
		cartId = tempCartId.substring(tempCartId.indexOf("-") + 1);
	} else {
		cartId = tempCartId;
	}
	
	query.get(cartId, {
	  	success: function(cartFound) {
	  		console.log("main.js user:" + request.user.getUsername() + " bidOnOrder at " + new Date());
	  		
	  		cartFound.increment("bidCount");
	     	cartFound.save(null,{
	     		success: function(cartUpdated) {
	     			console.log("main.js after save bidCount increment:" + cartUpdated.get("bidCount"));
	     			
	     			if (cartUpdated.get("bidCount") == 1) {
	     				cartUpdated.set("status", "ongoing");
	     				cartUpdated.set("bee", request.user);
	     				cartUpdated.save();
	     				console.log("main.js save status to ongoing");
	     				
	     				//update hborder
	     				var queryOrder = new Parse.Query("HBOrder");
						queryOrder.equalTo("shoppingCart", cartUpdated);
	     				queryOrder.find({
					    	success: function(results) {
					    		if(results.length > 0) {
					    			var currentOrder = results[0];
					    			currentOrder.set("status", "notify store");
					    			currentOrder.save(null,{
										success: function(currentOrderUpdated){
											//update user's delivering state
											var queryUser = new Parse.Query(Parse.User);
											queryUser.equalTo('username', request.user.getUsername());	
											queryUser.first().then(
												function(userFound) {
													if (userFound) {
														userFound.set("delivering", true);
														userFound.save();
														logger.send_notify(prop.mail_cc(), "", "[搶標成功]" + request.user.getUsername() + " " + request.user.get("contact"), "訂單:" + cartUpdated.id);
											
														response.success("Yes");	
													} else {
														logger.send_error(logger.subject("bidOnOrder", "driver not found."), err);
														response.error("driver not found");
													}
												}, 
												function (err) {
													logger.send_error(logger.subject("bidOnOrder", "get user error."), err);
													response.error(JSON.stringify(err));
												}
											);
									    },
										error: function(err) {
											logger.send_error(logger.subject("createShoppingCart", "save new cart"), err); 
											response.error(err);
										}		
									});
					    			
					    		}
					    	},
					    	error: function(err) {
								logger.send_error(mail.subject("afterSave HBShoppingCart", "get HBCoupon") , err);
					      	  	response.error(err);
					    	}
					  	});
	     			} else {
	     				logger.send_notify(prop.mail_cc(), "", "[搶標失敗]" + request.user.getUsername() + " " + request.user.get("contact"), "訂單:" + cartUpdated.id);
						response.success("Too Late");
	     			}
				},
				error: function(err) {
					logger.send_error(logger.subject("bidOnOrder", "save cart error."), err);
					response.error(JSON.stringify(err));
				}
			});
	 	},
	  	error: function(object, err) {
	    	logger.send_error(logger.subject("bidOnOrder", "find cart error."), err);
			response.error("bidOnOrder find cart error." + err.code + "," + err.message);
	  	}
	});
});

//更新購物車狀態為送餐中
Parse.Cloud.define("setOrderShipping", function(request, response) {
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	var store = new HBFoodStore();
	store.id = request.params.storeId;
	
	var queryStoreInCart = new Parse.Query("HBStoreInCart");
	queryStoreInCart.equalTo("cart", cart);
	queryStoreInCart.equalTo("store", store);
	queryStoreInCart.include("store");
	queryStoreInCart.include("cart");
	
	var queryNotTaken = new Parse.Query("HBStoreInCart");
	queryNotTaken.equalTo("cart", cart);
	queryNotTaken.equalTo("foodTaken", false);
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.notEqualTo("foodTaken", true);
	query.include("store");
	query.find()
	.then(function(itemsFound) { //update HBShoppingItem
		console.log("update HBShoppingItem");
		var promise = Parse.Promise.as();
		_.each(itemsFound, function(oneItem) {
			var storeId = oneItem.get("store").id;
			if (storeId == request.params.storeId) {
				oneItem.set("foodTaken", true);
				promise = promise.then(function() {
			    	return oneItem.save();
			    });
			}
		}); //~end each
		return promise;
	})
	.then(function() {
		return queryStoreInCart.find();
	})
	.then(function(dataFound) { 
		console.log("update StoreInCart:" + dataFound[0].get("store").get("storeName"));
		dataFound[0].set("foodTaken", true);
		
		var msgsubject = "[完成取餐掃描]";
		if(request.user != null) {
			msgsubject += request.user.getUsername() + " " + request.user.get("contact") + "," + dataFound[0].get("store").get("storeName");
		} else {
			msgsubject += " by 客服";
		}
		
		logger.send_notify("", prop.mail_cc(), msgsubject, "訂單:" + request.params.cartId);
		return Parse.Promise.when(dataFound[0].save());
	})
	.then(function (storeInCartUpdated){
		return Parse.Promise.when(queryNotTaken.find(), storeInCartUpdated);
	})
	.then(function(results, storeInCartUpdated) {
			console.log("未取餐數:" + results.length + "家");
			if(results.length == 0) { //全取
				logger.send_info(prop.admin_mail(), prop.mail_cc(), "[所有餐點取餐完畢]:" + request.params.cartId, "小蜜蜂進行運送", request.params.cartId);
				
				var cart = storeInCartUpdated.get("cart");
				cart.set("status", "shipping");
				return cart.save();
			} else {
				return Parse.Promise.as(results.length);
			}
	}).
	then(function(result) {
			console.log("typeof result:" + (typeof result));
			if(typeof result === 'object') {
				var currentTime = new Date();
				var pushSent = new Date(currentTime.getTime() + 1000 * 30); 
				var cart = result;
				var queryInstallation = new Parse.Query(Parse.Installation);
				queryInstallation.equalTo("objectId", cart.get("installation"));	
				var p2 = Parse.Push.send({
						where: queryInstallation,
						push_time: pushSent,
						data: {
						  	title: "HungryBee美食外送",
						    alert: "所有餐點取餐完畢，外送人員前往目的地中。訂單:" + cart.id,
						    sound: "default",
							badge: "Increment"
					  	},
					}, {
						success: function() {
					    },
					  	error: function(error) {
					    },
					  	useMasterKey: true
					  });
				response.success(0);
			} else {
				response.success(result);
			}
		}, 
		function(error) {
			response.error(error);
		});
});

//
Parse.Cloud.define("setOrderComplete", function(request, response) {
	
	//call another cloud code named setOrderStatus
	Parse.Cloud.run("setOrderStatus", 
		{
		 	status: "complete", 
		 	cartId: request.params.cartId,
		 	lobId: request.params.lobId
		 }, 
		 {
			success: function(result){
				var query = new Parse.Query(Parse.User);
				query.equalTo('username', request.user.getUsername());	
				query.first()
					.then(function(userFound) {
						userFound.set("delivering", false);
						return userFound.save();
					})
					.then(
						function(userUpdated){
							response.success(result);
						},
						function(err) {
							logger.send_error(logger.subject("setOrderComplete", "update user's delivering error"), err);
							response.error(err);
						}
					);
		 	},
		 	error: function(error) {
		 		logger.send_error(logger.subject("setOrderComplete", "setOrderStatus error, cart:" + request.params.cartId), error);
				response.error(error);
			}
		});
});

//update order status
Parse.Cloud.define("setOrderStatus", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("objectId", request.params.cartId);	
	query.first().then(
		function(cartFound) {
			if (cartFound) {
				Parse.Cloud.useMasterKey();
				if (request.params.status == "complete") {
					if (cartFound.get("status") != "shipping") {
						response.error("not pickup yet"); //
					} else {
						cartFound.set("status", request.params.status);
						cartFound.set("completeDate", new Date());
						cartFound.save(null,{
							success: function(cartUpdated){
								logger.send_notify("", prop.mail_cc(), "[已完成送餐] 訂單:" + request.params.cartId, "good job.");
								var HBCustomerInCart = Parse.Object.extend("HBCustomerInCart");
				                var customerInCartQuery = new Parse.Query(HBCustomerInCart);
				                customerInCartQuery.equalTo('cart', Parse.Object.extend("HBShoppingCart").createWithoutData(request.params.cartId));
				                customerInCartQuery.find({
				                    success: function (customerInCarts) {
				                        customerInCarts.forEach(function (customerInCart, index, array) {
				                            customerInCart.set("delivered", true);
				                            if(request.params.lobId != null) {
				                            	customerInCart.set("signoffImage", Parse.Object.extend("HBLob").createWithoutData(request.params.lobId));
				                            }
				                            customerInCart.save();
				                        });
										response.success(cartUpdated);	
				                    }, error: function (e) {
				                        console.log("error: " + e);
				                    }
				                });
							},
							error: function(err) {
								logger.send_error(logger.subject("setOrderStatus", "update HBShoppingCart to " + request.params.status + "error"), err);
								response.error(err);
							}		
						});
					}
				} else {
					cartFound.set("status", request.params.status);
					cartFound.save(null,{
						success: function(cartUpdated){
							logger.send_notify("", prop.mail_cc(), "[進行運送中]" + request.user.getUsername() + " " + request.user.get("contact") + "," + request.params.storeName, "訂單:" + cartUpdated.id);
							response.success(cartUpdated);
						},
						error: function(err) {
							logger.send_error(logger.subject("setOrderStatus", "update HBShoppingCart to " + request.params.status + "error"), err);
								
							response.error(err);
						}		
					});	
				}				
			} else {
				response.error("car not found" + request.params.cartId);
			}
		}, 
		function (err) {
			console.log("err here:" + err.code + "," + err.message);
			response.error(err);
		});
});

Parse.Cloud.define("createOrderItem", function(request, response) {
	var User = Parse.Object.extend("User");
  	var Order = Parse.Object.extend("Order");
	var OrderItem = Parse.Object.extend("OrderItem");
	
	var createdBy = new User();
  	createdBy.id = request.params.owner;	
	
    var currentOrder = new Order();
	currentOrder.id = request.params.orderId;
    
	var items = request.params.meals;        
    var orderItemArray = [];
    for (var i = 0; i < items.length; i++) {   
        var qty = request.params.meals[i].qty;
        var unitPrice = request.params.meals[i].unitPrice;

        var orderItem = new OrderItem();
        orderItem.set("order", currentOrder);
        orderItem.set("qty", qty);
        orderItem.set("unitPrice", unitPrice);
        orderItem.set("total", qty * unitPrice);
        orderItem.set("createdBy", user);
        orderItemArray.push(item);
    }

    Parse.Object.saveAll(orderItemArray, {
        success: function(orderItems) {
            response.success(orderItems.length);  //return new order's id
        },
        error: function(err) { 
            console.error("createOrderItem failed" + err.code + "," + err.message);
			response.error(err);		
        }
    });
});

//Order status:
//Init
//InCart
//Paid
Parse.Cloud.define("saveShoppingCart", function(request, response) {
    // if order exist, update orderitem
	var Order = Parse.Object.extend("Order");
	var OrderItem = Parse.Object.extend("OrderItem");
	var User = Parse.Object.extend("User");
    
    var user = new User();
    user.id = request.params.owner;
	
	var query = new Parse.Query("Order");  
	query.equalTo("objectId", request.params.orderId);
	query.find()
		.then(
			function(order) { //find seccess
				console.log("find order:" + request.params.orderId + "=>" + order.length);
				if (order.length > 0) { //update orderitem
					var order = new Order();
			        order.id = request.params.orderId;
					
					var query1 = new Parse.Query("OrderItem"); 
			        query1.equalTo("order", order);
					query1.equalTo("bookedBy", user);
			        query1.find().then(function(orderItems) {
						
						console.log("find orderItems:" + orderItems.length);
			            Parse.Object.destroyAll(orderItems).then(
			            	function(success) {
			               	 	console.log("orderItems deleted ok");
							    
						        var items = request.params.meals;
        				        var orderItemArray = [];
						        for (var i = 0; i < items.length; i++) {   
						            var qty = request.params.meals[i].qty;
						            var unitPrice = request.params.meals[i].unitPrice;

						            var item = new OrderItem();
						            item.set("order", order);
						            item.set("qty", qty);
						            item.set("unitPrice", unitPrice);
						            item.set("total", qty * unitPrice);
						            item.set("bookedBy", user);
						            orderItemArray.push(item);
						        }
						        Parse.Object.saveAll(orderItemArray, {
						            success: function(objs) {
						                var orderItem = objs[0];
						                response.success(orderItem.get("order").id);  //return new order's id
						            },
						            error: function(err) { 
						                response.error("saveShoppingCart  failed." + err.code + "," + err.message);
						            }
						        });
								
			            	}, 
							function(error) {
			              	  	console.error("Oops! delete orderItems went wrong: " + error.message + " (" + error.code + ")");
			              	  	response.error(error);
			            	}
						);
			        });
					
				} else {
				   
					//create order & orderitem
			        var order = new Order();
			        order.set("owner", user);
			        order.set("status", "Init");  


			        var items = request.params.meals;        
			        var orderItemArray = [];
			        for (var i = 0; i < items.length; i++) {   
			            var qty = request.params.meals[i].qty;
			            var unitPrice = request.params.meals[i].unitPrice;

			            var item = new OrderItem();
			            item.set("order", order);
			            item.set("qty", qty);
			            item.set("unitPrice", unitPrice);
			            item.set("total", qty * unitPrice);
			            item.set("bookedBy", user);
			            orderItemArray.push(item);
			        }

			        // save all the newly created objects
			        Parse.Object.saveAll(orderItemArray, {
			            success: function(objs) {
			                var orderItem = objs[0];
			                response.success(orderItem.get("order").id);  //return new order's id
			            },
			            error: function(err) { 
			                response.error("saveShoppingCart  failed." + err.code + "," + err.message);
			            }
			        });
				}                
            },
            function(err) { 
				console.error("order lookup failed." + err.code + "," + err.message);
                response.error("order lookup failed." + err.code + "," + err.message);
            }
        )
});


//取得教育練時程
Parse.Cloud.define("getTrainingSchedule", function(request, response) {
	var query = new Parse.Query("HBTrainingSchedule");
	query.equalTo("enable", true);
	query.find({
    	success: function(results) {
    		response.success(results);
    	},
    	error: function(err) {
			console.error("getTrainingSchedule lookup failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

//儲存預約
Parse.Cloud.define("saveBookingInfo", function(request, response) {
	var query = new Parse.Query(Parse.User);
	query.equalTo('username', "driver-" + request.params.phoneNo);	
	query.first().then(
		function(userFound) {
			if (userFound) {
				Parse.Cloud.useMasterKey();
				userFound.set("phone", request.params.phoneNo);
				userFound.set("contact", request.params.contactName);
				userFound.set("delivering", false);
				userFound.set("qualify", false);
				userFound.set("licenseNo", request.params.licenseNo + ""); //加空字串避免全數字，造成 save error.
				userFound.set("email", request.params.email);
				userFound.set("applyBee", "applying");	
				userFound.save(null,{
					success: function(userUpdated){
						var queryBooking = new Parse.Query("HBTrainingBooking");
						queryBooking.equalTo("user", userUpdated);
						queryBooking.find({
							success: function(bookingFound) {
								
								if (bookingFound.length == 0) { //create one
									var HBTrainingBooking = Parse.Object.extend("HBTrainingBooking");
						     		var booking = new HBTrainingBooking();
						     		booking.set("user", userUpdated);
						     		booking.set("installationId", request.params.installationId);
						     		booking.set("bookingSubmitted", false);
						     		booking.save(null,{
										success: function(bookingCreated){
											response.success(bookingCreated.id);
										},
										error: function(err) {
											logger.send_error(logger.subject("saveBookingInfo", "create HBTrainingBooking error"), err);
											response.error(err);
										}		
									});		
								}  else {
									response.success(bookingFound[0].id);
								}
								
								
								/*
								// delete
					    		Parse.Object.destroyAll(bookingFound,  { 
									success: function(success) {
										console.log("success destroy old booking record.");					
						            }, 
						            error: function(error) {
										console.error("error destroy old booking record error");
										response.error(error);
						            }
					        	});
					        	
					        	var HBTrainingBooking = Parse.Object.extend("HBTrainingBooking");
					     		var booking = new HBTrainingBooking();
					     		booking.set("user", userUpdated);
					     		booking.set("installationId", request.params.installationId);
					     		booking.set("bookingSubmitted", false);
					     		booking.save(null,{
									success: function(bookingCreated){
										
								    	response.success(bookingCreated.id);
									},
									error: function(err) {
										logger.send_error(logger.subject("saveBookingInfo", "create HBTrainingBooking error"), err);
										response.error(err);
									}		
								});
								*/
					        	
							},
							error: function(err) {
								console.error();
						  	  	response.error(err);
							}
						});
					},
					error: function(err) {
						logger.send_error(logger.subject("saveBookingInfo", "save _User error"), err);
						response.error(err);
					}   	
				});	 //end userFound.save()		
			} else {
				response.error("driver not login yet");
			}
		}, function (err) {
			logger.send_error(logger.subject("saveBookingInfo", "query User error"), err);
			response.error(err);
		});
	
});

//送出小蜜蜂預約單
Parse.Cloud.define("submitBooking", function(request, response) {
	var query = new Parse.Query("HBTrainingBooking");
	query.equalTo("objectId", request.params.bookingId);
	//query.include("user");	
	query.first().then(
		function(bookingFound) {
			if (bookingFound) {
				var user = bookingFound.get("user");
				user.set("applyBee", "applied"); //狀態從 applying 變成 applied
				user.set("beePoints", 10);
				user.save();
				
				Parse.Cloud.useMasterKey();
				bookingFound.set("bookingSubmitted", true);
				bookingFound.save(null,{
					success: function(bookingUpdated){
						response.success(true);
					},
					error: function(err) {
						logger.send_error(logger.subject("submitBooking", "save bookingSubmitted error"), err);
						response.error(err);
					}		
				});
			} else {
				response.error("booking not found");
			}
		}, function (err) {
			logger.send_error(logger.subject("submitBooking", "query HBTrainingBooking error"), err);
			response.error(err);
		});
});

//取得小蜜蜂照片資料
Parse.Cloud.define("getDriverInfoPhoto", function(request, response) {
	var query = new Parse.Query("HBLob");
	query.containedIn("category", request.params.category);
	query.equalTo("owner", request.user);
	query.find({
    	success: function(itemsFound) {
    		response.success(itemsFound);
    	},
    	error: function(err) {
			console.error("getDriverInfoPhoto failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});

Parse.Cloud.define("Logger", function(request, response) {
  console.log(request.params);
  response.success();
});


//取得送達時段
//回傳 [日期, 可選時段, 今日可選時段]
Parse.Cloud.define("getDeliveryTimeSlot", function(request, response) {
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var itemQuery = new Parse.Query("HBShoppingItem");
	itemQuery.equalTo("shoppingCart", cart);
	itemQuery.include("store");
	itemQuery.find({
		success:function(itemFound) {
			var itemObj = itemFound[0]; //只取其中一家店
			var storeObj = itemObj.get("store");
			
			//find biz date
			var HBFoodStore = Parse.Object.extend("HBFoodStore");
			var store = new HBFoodStore();
			store.id = storeObj.id;
			
			
			var currentTime = new Date();
	
			//目前的時間+60分鐘訂為可開始訂餐時間
			var minSlot = (currentTime.getHours() + 8) * 60 + currentTime.getMinutes() + 60;
			if (currentTime.getHours() + 8 > 18) {
				minSlot = (currentTime.getHours() + 8) * 60 + currentTime.getMinutes() + 75;
			}
			console.log(currentTime + ", minSlot:" + minSlot);
			
			var subQuery = new Parse.Query("HBTimeSlot");
			subQuery.equalTo("enable", true);
			
			var query = new Parse.Query("HBProductivity");
			query.equalTo("store", store);
			query.matchesQuery("timeSlot", subQuery);
			query.include("timeSlot");
			query.include("store");
			query.ascending("sinceMidnight");
			query.find({
		    	success: function(dataFound) {
		    				
		    		var bizDateQuery = new Parse.Query("HBStoreBusinessDate");
					bizDateQuery.equalTo("store", store);			
					bizDateQuery.find({
		    			success: function(bizDateFound) {
		    				var bizDate = [];
		    				/*
		    				var bizDateObj = bizDateFound[0];
		    				bizDate.push(bizDateObj.get("Sun"));
		    				bizDate.push(bizDateObj.get("Mon")); 
		    				bizDate.push(bizDateObj.get("Tue"));
		    				bizDate.push(bizDateObj.get("Wed"));
		    				bizDate.push(bizDateObj.get("Thu"));
		    				bizDate.push(bizDateObj.get("Fri"));
		    				bizDate.push(bizDateObj.get("Sat"));
		    				*/
		    				
		    				//暫時將 Sat, Sun 都設為不營業
		    				bizDate.push(false);	//"Sun"
		    				bizDate.push(true);     //"Mon"
		    				bizDate.push(true);     //"Tue"
		    				bizDate.push(true);     //"Wed"
		    				bizDate.push(true);     //"Thu"
		    				bizDate.push(true);     //"Fri"
		    				bizDate.push(false);    //"Sat"
		    				
		    				var availableDate = availableBizDate(bizDate);
		    				var availableSlotForToday = [];
		    				for(var i=0 ; i<dataFound.length ; i++) {
		    					var obj = dataFound[i];
		    					var reservationUnit = obj.get("store").get("reservationUnit");
		    					if(reservationUnit == "day") { //只能提前一天預約的店家，不顯示今日的時段選項
		    						break;
		    					} else if(reservationUnit == "minute") { //只能提前N小時預約的店家
		    						var slotExtend = obj.get("store").get("reservation");
		    						if (obj.get("sinceMidnight") > minSlot + slotExtend) {
			    						availableSlotForToday.push(obj);
			    					}
		    					} else {
		    						if (obj.get("sinceMidnight") > minSlot) {
			    						availableSlotForToday.push(obj);
			    					}
		    					}
		    				}
		    				
		    				
		    				response.success([availableDate, dataFound, availableSlotForToday]);
		    			},
		    			error: function(err) {
							console.error("query HBStoreBusinessDate failed" + err.code + "," + err.message);
				      	  	response.error(err);
				    	}
				    });
		    	},
		    	error: function(err) {
					console.error("query HBProductivity failed" + err.code + "," + err.message);
		      	  	response.error(err);
		    	}
		  	});
			
			
		},
		error:function(error) {
			response.error(error);
		}	
	});
	
});

//
//開放預約單，送達時間能顯示未來的日期
//暫時先取4天
function availableBizDate(bizDate) {
	var weekstring = ["(日)","(一)","(二)","(三)","(四)","(五)","(六)"];
	//var bizDate = [true, true, true, false, true, true, false]; 
	var availableDate = [];
	
	var currentTime = new Date() ;
	var counter = 0;
	while(true) {
		var futureTime = new Date(currentTime);
		futureTime.setDate(futureTime.getDate() + counter); //累加一天
		if (bizDate[futureTime.getDay()]) { //有營業才取
			availableDate.push((futureTime.getMonth()+1) + "/" + futureTime.getDate() + weekstring[futureTime.getDay()]);
		}
		if (availableDate.length == 4) break; //先取4天
		counter++;
	}
	return availableDate;
}

//
//平台營業日
//開放預約單，送達時間能顯示未來的日期
//暫時先取4天
//
Parse.Cloud.define("availableBizDateOption", function(request, response) {
	var bizDate = [];
	bizDate.push(true);	//"Sun"
	bizDate.push(true);     //"Mon"
	bizDate.push(true);     //"Tue"
	bizDate.push(true);     //"Wed"
	bizDate.push(true);     //"Thu"
	bizDate.push(true);     //"Fri"
	bizDate.push(true);    //"Sat"
	
	var weekstring = ["(日)","(一)","(二)","(三)","(四)","(五)","(六)"];
	var e_weekstring = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
	var availableDate = [];
	var availableDayOfWeek = [];
	
	var currentTime = new Date() ;
	var counter = 0;
	while(true) {
		var futureTime = new Date(currentTime);
		futureTime.setDate(futureTime.getDate() + counter); //累加一天
		if (bizDate[futureTime.getDay()]) { //有營業才取
			var dateObj = {};
			dateObj.c_value = (futureTime.getMonth()+1) + "/" + futureTime.getDate() + weekstring[futureTime.getDay()];
			dateObj.e_value = e_weekstring[futureTime.getDay()];
			
			availableDate.push(dateObj);
			//availableDate.push((futureTime.getMonth()+1) + "/" + futureTime.getDate() + weekstring[futureTime.getDay()]);
		}
		if (availableDate.length == 4) break; //先取4天
		counter++;
	}
	response.success(availableDate);
});

//設定可結帳時間
Parse.Cloud.define("saveCheckoutLimit", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		Parse.Cloud.useMasterKey();
	  		cartFound.set("lineModeEnable", true);
	  		cartFound.set("groupbuy", true);
	  		cartFound.set("checkoutLimit", eval(request.params.checkoutLimit));
	  		
	  		var current = new Date();
			var canCheckoutAt = new Date(current.getTime() + eval(request.params.checkoutLimit)*60000); 
			cartFound.set("canCheckoutAt", canCheckoutAt);
	  		
 		    cartFound.save(null,{
					success: function(cartUpdated){
				    	response.success(cartUpdated);
					},
					error: function(err) {
						logger.send_error(logger.subject("saveCheckoutLimit", "save checkoutLimit error"), err);
						response.error(err);
					}		
				});
						
	 	},
	  	error: function(object, err) {
	    	logger.send_error(logger.subject("saveCheckoutLimit", "find cart error"), err);
			response.error("saveCheckoutLimit failed." + err.code + "," + err.message);
	  	}
	});
});

//儲存 QRCode
Parse.Cloud.define("submitQRCode", function(request, response) {
	Parse.Cloud.useMasterKey();
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		if (cartFound.get("status") == "onbid") {
	  			var HBLob = Parse.Object.extend("HBLob");
				var fileObj = new HBLob();
				fileObj.id = request.params.qrcode;
		  		cartFound.set("qrcode", fileObj);
	 		    cartFound.save(null,{
					success: function(objSaved) {
						console.log("qrcode saved:" + objSaved.id);
						
						//create HBOrder
						var HBOrder = Parse.Object.extend("HBOrder");
						var order = new HBOrder();
						order.set("shoppingCart", cartFound);
						order.save();
						response.success(cartFound.id);
						
						
						/*
						//完成訂單送出後，透過雲端列印出訂單
						Parse.Cloud.run("cloudPrintOrder", 
						{
						 	cartId: request.params.cartId
						 }, 
						 {
							success: function(result){
								response.success(request.params.cartId);
						 	},
						 	error: function(error) {
								logger.send_error(logger.subject("submitQRCode", "exec cloudPrintOrder failed."), error);
								response.error(error);
							}
						});
						*/
						//response.success(true);
					},
					error: function(err) {
						console.error("save HBShoppingItem error:" + err.code + "," + err.message);
						response.error("save HBShoppingItem error:" + err);
					}	
				});
	  		} else {
	  			response.success(true);
	  		}
	 	},
	  	error: function(object, err) {
	    	console.error("submitQRCode failed:" + err.code + "," + err.message );
			response.error("submitQRCode failed." + err.code + "," + err.message);
	  	}
	});
});

//小蜜蜂對帳單
Parse.Cloud.define("beeBilling", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("status", "complete");
	query.equalTo("bee", request.user);
	query.descending("completeDate");
	query.find({
		success: function(cartsFound) {
			/*
			for(var i=0 ; i<cartsFound.length ; i++) {
				console.log(cartsFound[i].get("completeDate"));	
			}
			*/
			response.success(cartsFound);
		},
		error: function(err) {
			console.error("beeBilling failed" + err.code + "," + err.message);
	  	  	response.error(err);
		}
	});
});

//信用卡交易失敗紀錄
Parse.Cloud.define("creditCardPaymentError", function(request, response) {
	logger.card_transaction_error(request.params.subject, request.params.mailBody);
	response.success(true);
});


// 取得飲料加料名
function concatDisplayName(foodAdditions)
{
	var displayName = "加";
	if (foodAdditions.indexOf(ADDITION_PEARL) != -1) {
		displayName += " 珍珠";
	}
	if (foodAdditions.indexOf(ADDITION_COCOA) != -1) {
		displayName += " 椰果";
	}
	if (foodAdditions.indexOf(ADDITION_QQ) != -1) {
		displayName += " QQ";
	}
	displayName += ",";
	return displayName;
}

var SMALL_CUP = "0";
var LARGE_CUP = "10";

var SMALL_FOOD = "0";
var LARGE_FOOD = "10";

var COLD_DRINK = "0";
var HOT_DRINK = "10";

var ICE_NONE = "0";
var ICE_LITTLE = "5";
var ICE_NORMAL = "10";

var SUGAR_NONE = "0";
var SUGAR_LITTLE = "3";
var SUGAR_HALF = "5";
var SUGAR_NORMAL = "10";
var SUGAR_FULL = "11";

var SPICY_NONE = "0";
var SPICY_LITTLE = "3";
var SPICY_HALF = "5";
var SPICY_NORMAL = "10";

var PEPPER_NONE = "0";
var PEPPER_NORMAL = "10";

var ADDITION_PEARL = "1";
var ADDITION_COCOA = "2";
var ADDITION_QQ = "3";

function generateItemKey(request)
{
	var itemKey = "";
	
	//食物大小
    if (request.params.foodSize != null && request.params.foodSize != "") {
    	itemKey += "FoodSize" + request.params.foodSize + ",";
    }
    
    //飲料大小
	if (request.params.cupSize != null && request.params.cupSize != "") {
    	itemKey += "CupSize" + request.params.cupSize + ",";
    }
    
	//冷熱
    if (request.params.coldHot != null && request.params.coldHot != "") {
    	if (request.params.coldHot == COLD_DRINK) {
    		itemKey += "ColdDrink,";
    	} else {
    		itemKey += "HotDrink,";
    	}
    }
    
    //冰塊
    if (request.params.coldHot == "" || request.params.coldHot == COLD_DRINK) {
    	if (request.params.iceLevel != null && request.params.iceLevel != "") {
	    	itemKey += "Ice" + request.params.iceLevel + ",";	  
	    }      	
    }
    
    //甜度
    if (request.params.sugarLevel != null && request.params.sugarLevel != "") {
    	itemKey += "Sugar" + request.params.sugarLevel + ",";        	
    }
    
    //辣度
    if (request.params.spicyLevel != null && request.params.spicyLevel != "") {
    	itemKey += "Spicy" + request.params.spicyLevel + ",";	        	
    }
    
    //胡椒
    if (request.params.needPepper != null && request.params.needPepper != "") {
    	itemKey += "Pepper" + request.params.needPepper + ",";
    }
    
    //加料
    if (request.params.cupSize != null) {
    	if (request.params.cupSize == SMALL_CUP) {
    		if (request.params.foodAdditions != null && request.params.foodAdditions != "") {
		    	itemKey += "Addition" + request.params.foodAdditions + ",";
		    }
    	} else {
    		if (request.params.largeFoodAdditions != null && request.params.largeFoodAdditions != "") {
		    	itemKey += "LargeAddition" + request.params.largeFoodAdditions + ",";
		    }
    	}
   	} else { 
	   	if (request.params.largeFoodAdditions != null && request.params.largeFoodAdditions != "") {
	    	itemKey += "LargeAddition" + request.params.largeFoodAdditions + ",";
	    }
	}
    if (request.params.other) {
    	itemKey += request.params.other;
    }
    return itemKey;
}

//將購物項目依店家分類
function shoppingItemGroupBy(itemsFound,request, viewMode)
{
	var storeIdArray = [];
	var storeObjArray = []; // of HBFoodStore
	var storeItemArray = []; // of HBShoppingItem
	var shoppingCart = null;
	for (var i=0 ; i<itemsFound.length ; i++) {
		var oneItem = itemsFound[i];
		/*
		if(viewMode == "groupbuy") {
			//query all	
			if(i==0) {
				shoppingCart = oneItem.get("shoppingCart");	
			}
			
			if(shoppingCart.get("owner").id == request.user.id) { //團主顯示所有購買項目
				//query all
				console.log("團主");
			} else { //跟團者只顯示自己的購買項目
				console.log("跟團者:" + oneItem.get("owner").id + " vs " + request.user.id);
				if(oneItem.get("owner").id != request.user.id) {
					console.log("不取");
					continue;
				}
			}
			
		} else {
			//只取自己訂購的項目
			if(oneItem.get("owner").id != request.user.id) continue;
		}
		*/
		
		var storeId	= oneItem.get("store").id; //HBFoodStore.objectId
		
		var idx = storeIdArray.indexOf(storeId);
		console.log("oneItem:" + oneItem.id + ",storeId:" + storeId + ",idx:" + idx);
		var itemsArray = [];
		if (idx == -1) {
			storeIdArray[storeIdArray.length] = storeId;
			storeObjArray[storeObjArray.length] = oneItem.get("store");
		
			itemsArray[itemsArray.length] = oneItem;
			storeItemArray[storeItemArray.length] = itemsArray;
		} else {
			itemsArray = storeItemArray[idx];
			itemsArray[itemsArray.length] = oneItem;
			storeItemArray[idx] = itemsArray;
		}
	}
	
	var results = [];
	results[0] = storeObjArray;
	results[1] = storeItemArray;
	return results;
}

//將購物項目依跟團人員分類
function shoppingItemGroupByFollower(itemsFound)
{
	var followerIdArray = [];
	var followerObjArray = []; // of PFUser
	var followerItemArray = []; // of HBShoppingItem
	for (var i=0 ; i<itemsFound.length ; i++) {
		var oneItem = itemsFound[i];
		var cart = oneItem.get("shoppingCart");
		if((typeof cart.get("groupbuy") === 'undefined') || cart.get("groupbuy") == false) break;
		var ownerId	= oneItem.get("owner").id; //PFUser.objectId
		
		var idx = followerIdArray.indexOf(ownerId);
		var itemsArray = [];
		if (idx == -1) {
			followerIdArray[followerIdArray.length] = ownerId;
			followerObjArray[followerObjArray.length] = oneItem.get("owner");
		
			itemsArray[itemsArray.length] = oneItem;
			followerItemArray[followerItemArray.length] = itemsArray;
		} else {
			itemsArray = followerItemArray[idx];
			itemsArray[itemsArray.length] = oneItem;
			followerItemArray[idx] = itemsArray;
		}
	}
	
	var results = [];
	results[0] = followerObjArray;
	results[1] = followerItemArray;
	return results;
}

//問卷表
Parse.Cloud.define("submitSurveyForm", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var query1  = new Parse.Query("HBSurveyDefinition");
	query1.equalTo("serviceType", "attitude");
	query1.equalTo("point", request.params.serviceAttitude);
	
	var query2  = new Parse.Query("HBSurveyDefinition");
	query2.equalTo("serviceType", "sop");
	query2.equalTo("point", request.params.serviceSOP);
	
	var query3  = new Parse.Query("HBSurveyDefinition");
	query3.equalTo("serviceType", "food_condition");
	query3.equalTo("point", request.params.foodCondition);
	
	var mainQuery = Parse.Query.or(query1, query2, query3);
	mainQuery.find({
		success:function(definitionFound) {
			var attitudeDesc = "";
			var sopDesc = "";
			var foodConditionDesc = "";
			
			for(var i=0 ; i<definitionFound.length ; i++) {
				var oneDefinition = definitionFound[i];
				var serviceType = oneDefinition.get("serviceType");
				var pointDesc = oneDefinition.get("pointDesc");
				if (serviceType == "attitude") {
					attitudeDesc = pointDesc;
				}
				if (serviceType == "sop") {
					sopDesc = pointDesc;
				}
				if (serviceType == "food_condition") {
					foodConditionDesc = pointDesc;
				}
			}
			
			var HBUserComments = Parse.Object.extend("HBUserComments");
		    var comment = new HBUserComments();
			comment.set("serviceAttitudePoint", request.params.serviceAttitude);
			comment.set("serviceSOPPoint", request.params.serviceSOP);
			comment.set("foodConditionPoint", request.params.foodCondition);
			comment.set("comments", request.params.userComments);
			comment.set("shoppingCart", cart);
			comment.save(null,{
				success: function(commentSaved) {
					var subject = "[消費者評分問券] 訂單:" + request.params.cartId;
					var body = "回覆者:" + request.user.get("contact") + ", " + request.user.get("phone") + "<BR>";
					body += "外送小蜜蜂: " + request.params.beeName + ", " + request.params.beePhone + "<BR>";
					body += "此次評分: " + (eval(request.params.serviceAttitude) + eval(request.params.serviceSOP) + eval(request.params.foodCondition)) + "<BR><BR>";
					
					body += "問卷結果:<BR>";
					body += "外送小蜜蜂服務態度: <font color=blue>" + attitudeDesc + "(" + request.params.serviceAttitude + ")</font><BR>";
					body += "外送小蜜蜂服務流程: <font color=blue>" + sopDesc + "(" + request.params.serviceSOP + ")</font><BR>";
					body += "餐點送達時的狀況: <font color=blue>" + foodConditionDesc + "(" + request.params.foodCondition + ")</font><BR>";
					body += "建議: " + request.params.userComments + "<BR>";
					 
					logger.send_notify(prop.admin_mail(), prop.mail_cc(), subject, body);
					response.success(commentSaved.id);
				},
				error: function(err) {
					logger.send_error(logger.subject("submitSurveyForm", "save HBUserComments error"), err);  
					response.error(err);
				}	
			});	
		},
		error:function(error) {
			response.error(error);
		}	
	});	
});

//更新運送狀態
Parse.Cloud.define("updateBeeDeliverStatus", function (request, response) {
    var query = new Parse.Query(Parse.User);
    query.get(request.params.userId, {
        success: function (userFound) {
            Parse.Cloud.useMasterKey();

            var delivering = request.params.delivering != null ? request.params.delivering : false;
            userFound.set("delivering", delivering);
            userFound.save(null, {
                success: function (userUpdated) {
                    response.success(true);
                },
                error: function (err) {
                    logger.send_error(logger.subject("updateBeeStatus", "save user"), err);
                    response.error(err);
                }
            });
        },
        error: function (object, err) {
            logger.send_error(logger.subject("updateBeeStatus", "find user"), err);
            response.success(0);
        }
    });
});

//檢查目前APP是否為最新版
Parse.Cloud.define("isLatestBuild", function(request, response) {
	
	Parse.Config.get().then(function(config) {
		var deviceType = request.params.deviceType;
    	var versionCode = request.params.versionCode;
    
		var latestVersion;
		if (deviceType == "android") {
			latestVersion = config.get("android_latest");
		} else {
			latestVersion = config.get("iOS_latest");
		}
		
		if (latestVersion != versionCode) {
			response.success(false);
		} else {
			response.success(true);
		}
	}, 
	function(err) {
		logger.send_error(logger.subject("isLatestBuild", "query app's latest build") , err);
  		response.error("isLatestBuild failed." + err.code + "," + err.message);
	});	
});

//刪除跟團者訂購項目
Parse.Cloud.define("deleteFollower", function(request, response) {
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var follower = new Parse.User();
    follower.id = request.params.followerId;
    
    var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
    var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
	query.equalTo("owner", follower);
	query.equalTo("addFrom", "line");
	query.find({
    	success: function(shoppingItemsFound) {
     		if (shoppingItemsFound.length > 0) {
     			Parse.Object.destroyAll(shoppingItemsFound,  { 
					success: function(success) {
						//update participants
						
						response.success(true);  				
		            }, 
		            error: function(error) {
						logger.send_error(logger.subject("deleteFollower", "delete shopping item") , error);
						response.error(error);
		            }
	        	});
     		} else {
     			response.success(true); 
     		}
    	},
    	error: function(error) {
			logger.send_error(logger.subject("deleteFollower", "query shopping item") , error);
			response.error(error);
    	}
  	});
});

/// test cURL


Parse.Cloud.define("setServiceOpen", function(request, response) {
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
    var store = new HBFoodStore();
	store.id = request.params.storeId;
	
	var store1 = new HBFoodStore();
	store1.id = request.params.storeId1;
	
	var store2 = new HBFoodStore();
	store2.id = request.params.storeId2;
	
	var query = new Parse.Query("HBProductivity");
	query.containedIn("store", [store, store1, store2]);
	//query.equalTo("store", store);
	query.find()
		.then(function(results){
			console.log("found:" + results.length);
			var data = [];
			for(var i=0 ; i<results.length ; i++) {
				var obj = results[i];
				obj.set("serviceOpen", true);
				data.push(obj);
			}
			
			Parse.Cloud.useMasterKey();
			Parse.Object.saveAll(data, {
			    success: function(list) {
			      	response.success(list.length);  
			    },
			    error: function(error) {
			      	console.error("setServiceOpen failed:" + error.code + "," + error.message);
					response.error(error);
			    },
			  });
		});
});

//我的購物車內容(依店家分類顯示)
Parse.Cloud.define("getMyCart", function(request, response) {
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	//query.equalTo("owner", request.user);
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("store,meal");
	
	query.find().then(
  		function(itemsFound) {
  			console.log(itemsFound.length + " shopping items found");
  			var results = []; // of ItemInStore
  			var storeIdArray = [];
  			var sumOfFollowers = 0;
  			var cartObj = null;
  			for(var i=0 ; i<itemsFound.length ; i++) {
  				var item = itemsFound[i];
  				
  				if (cartObj == null) {
					cartObj = item.get("shoppingCart");
				}
				
				var itemJSObj = util.formattedItem(item, cartObj);
				
  				if (item.get("addFrom") == "self") {
  					var store = item.get("store");
  					var idx = storeIdArray.indexOf(store.id);
	  				if(idx == -1) {
	  					storeIdArray.push(store.id);
	  					var storeJSObj = util.initJSStore(store, item, itemJSObj);
	  					results.push(storeJSObj);
	  				} else {
	  					var storeJSObj = results[idx];
	  					storeJSObj = util.updateJSStore(storeJSObj, item, itemJSObj);
	  					results[idx] = storeJSObj;	//replace obj content
	  				}
  				} else {
  					var subTotal = item.get("subTotal");
  					sumOfFollowers += subTotal;
  				}
  			}
  			
  			return response.success([results, sumOfFollowers]); //回傳個人購買項目及跟團金額
  		},
  		function(err) {
  			logger.send_error(logger.subject("getMyJoinCart", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//跟團-我的購物車內容(依店家分類顯示)
Parse.Cloud.define("getMyJoinItems", function(request, response) {
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	query.equalTo("owner", request.user);
	query.equalTo("addFrom", "line");
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("store,meal");
	
	query.find().then(
  		function(itemsFound) {
  			console.log(itemsFound.length + " shopping items found");
  			var results = []; // of ItemInStore
  			var storeIdArray = [];
  			var dummy = 0;
  			var cartObj = null;
  			for(var i=0 ; i<itemsFound.length ; i++) {
  				var item = itemsFound[i];
  				
  				if (cartObj == null) {
					cartObj = item.get("shoppingCart");
				}
				
				var itemJSObj = util.formattedItem(item, cartObj);
				
				var store = item.get("store");
				var idx = storeIdArray.indexOf(store.id);
  				if(idx == -1) {
  					storeIdArray.push(store.id);
  					var storeJSObj = util.initJSStore(store, item, itemJSObj);
  					results.push(storeJSObj);
  				} else {
  					var storeJSObj = results[idx];
  					storeJSObj = util.updateJSStore(storeJSObj, item, itemJSObj);
  					results[idx] = storeJSObj;	//replace obj content
  				}
  			}
  			
  			return response.success([results, dummy]); //回傳個人購買項目, 另回傳dummy，是為了ios UI共用畫面，讓程式好處理
  		},
  		function(err) {
  			logger.send_error(logger.subject("getMyJoinCart", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//我的購物車內容
Parse.Cloud.define("getMyJoinCart", function(request, response) {
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	query.equalTo("owner", request.user);
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("store,meal");
	
	query.find().then(
  		function(itemsFound) {
  			console.log(itemsFound.length + " shopping items found");
  			var results = [];
  			var storeIdArray = [];
  			for(var i=0 ; i<itemsFound.length ; i++) {
  				var item = itemsFound[i];
  				
  				var store = item.get("store");
  				
  				var food = item.get("meal");
  				var itemObj = {};
				itemObj.foodName = food.get("mealName");
				itemObj.unitPrice = item.get("unitPrice");
				itemObj.qty = item.get("qty");
				itemObj.subTotal = item.get("subTotal");
				itemObj.foodDesc = item.get("itemNameForDisplay");
				itemObj.itemKey = item.get("itemKey");
				itemObj.itemId = item.id;
				
				var itemKeyArray = item.get("itemKey").split(",");
				var displayNameArray = item.get("itemNameForDisplay").split(",");
				var attributedArray = [];
				for(var k=0 ; k<itemKeyArray.length ; k++) {
					if(itemKeyArray[k] == "") continue;
					
					var colorObj = {};
					colorObj.keyName = itemKeyArray[k];
					colorObj.valueName = displayNameArray[k];
					attributedArray.push(colorObj);
				}
				itemObj.coloredDesc = attributedArray;
				
				
  					
  				var idx = storeIdArray.indexOf(store.id);
  				if(idx == -1) {
  					storeIdArray.push(store.id);
  					
  					var storeObj = {};
  					storeObj.store = JSON.parse(JSON.stringify(store));
  					storeObj.sumOfStore = item.get("subTotal");
  					storeObj.shoppingItems = [itemObj];
  					//storeObj.lineModeEnable = store.get("lineModeEnable");
  					//storeObj.canCheckoutAt = store.get("canCheckoutAt");
  					//storeObj.checkoutLimit = store.get("checkoutLimit"); 
  					
  					results.push(storeObj);
  				} else {
  					var storeObj = results[idx];
  					var currentSum = storeObj.sumOfStore;
  					storeObj.sumOfStore = currentSum + item.get("subTotal");
  					storeObj.shoppingItems.push(itemObj);
  					results[idx] = storeObj;
  				}
  			}
  			
  			return response.success(results);
  		},
  		function(err) {
  			logger.send_error(logger.subject("getMyJoinCart", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//取最新消息
Parse.Cloud.define("getAnnouncement", function(request, response) {
	var query = new Parse.Query("HBAnnouncement");
	query.containedIn("device", ["ios&android", request.params.deviceType]);
	query.equalTo("target", request.params.channels);
	query.equalTo("enable", true);
	query.descending("weight");
	query.find().then(
  		function(dataFound) {
  			return response.success(dataFound);
  		},
  		function(err) {
  			logger.send_error(logger.subject("getAnnouncement", "query announcement"), err); 
			response.error(err);
  		}
  	);
});

//加入團購時，先清空自己的購物車
Parse.Cloud.define("clearMyOwnCart", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("status", "in shopping");
	query.equalTo("owner", request.user);
	query.find().then(
  		function(dataFound) {
  			if(dataFound.length > 0) {
  				var queryItem = new Parse.Query("HBShoppingItem");
				queryItem.equalTo("shoppingCart", dataFound[0]);
				queryItem.find().then(
					function(itemsFound) {
			  			Parse.Object.destroyAll(itemsFound,  { 
							success: function(success) {
								console.log("clear my shoppingcart item.");		
								response.success(true);			
				            }, 
				            error: function(error) {
								logger.send_error(logger.subject("clearMyOwnCart", "delete HBShoppingItem"), error); 
								response.error(error);
							}
			        	});
			  		},
			  		function(error) {
			  			logger.send_error(logger.subject("clearMyOwnCart", "query HBShoppingItem"), error); 
						response.error(error);
			  		}
				);
  			} else {
  				response.success(true);
  			}
  		},
  		function(error) {
  			logger.send_error(logger.subject("clearMyOwnCart", "query HBShoppingCart"), error); 
			response.error(error);
  		}
  	);
});

//司機版使用
//取得取餐及送資訊
Parse.Cloud.define("getOrderInfo", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var queryStore = new Parse.Query("HBStoreInCart");
	queryStore.equalTo("cart", cart);
	queryStore.include("store");
	queryStore.include("cart");
	
	var queryCus = new Parse.Query("HBCustomerInCart");
	queryCus.equalTo("cart", cart);
	
	Parse.Promise.when(queryStore.find(), queryCus.find())
		.then(
			function(storeInCart, customerInCart) {
				return response.success([storeInCart, customerInCart, storeInCart[0].get("cart")]); 	
			},
			function (error) {
				logger.send_error(logger.subject("getOrderInfo", "query HBStoreInCart HBCustomerInCart"), error); 
				response.error(error); 
			}
		);
});

Parse.Cloud.define("getDeliveringInfoByBee", function(request, response) {
	var queryCart = new Parse.Query("HBShoppingCart");
	queryCart.equalTo("bee", request.user);
	queryCart.containedIn("status", ["ongoing", "shipping"]);
	queryCart.find().then(
		function(cartFound) {
			var cart = cartFound[0]; //一個小蜜蜂同時間只能接一個單
			
			var queryStore = new Parse.Query("HBStoreInCart");
			queryStore.equalTo("cart", cart);
			queryStore.include("store");
			queryStore.include("cart");
			queryStore.ascending("ETD");
			
			var queryCus = new Parse.Query("HBCustomerInCart");
			queryCus.equalTo("cart", cart);
			queryCus.include("cart");
			queryCus.ascending("ETA");
			Parse.Promise.when(queryStore.find(), queryCus.find())
				.then(
					function(storeInCart, customerInCart) {
						return response.success([storeInCart, customerInCart, cart]); 	
					},
					function (error) {
						logger.send_error(logger.subject("getDeliveringInfoByBee", "query HBStoreInCart HBCustomerInCart"), error); 
						response.error(error); 
					}
				);
		},
		function (error) {
			logger.send_error(logger.subject("getDeliveringInfoByBee", "query HBStoreInCart "), error); 
			response.error(error); 
		}
	);
	
});

//小蜜蜂出發通知
Parse.Cloud.define("beeTakeoffNotify", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cartFound) {
	  		cartFound.set("beeTakeoff", true);
	  		cartFound.set("takeoffTime", new Date());
	  		cartFound.save(null,{
				success: function(cartSaved){
					logger.send_info(prop.admin_mail(), prop.mail_cc(), "小蜜蜂出發通知，訂單編號:" + cartSaved.id, "小蜜蜂已出發", cartSaved.id);
					response.success(true);
			    },
				error: function(err) {
					logger.send_error(logger.subject("notifyBeeTakeoff", "save cart"), err); 
					response.error(err);
				}		
			});
	 	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("notifyBeeTakeoff", "query shopping cart error."), err);
			response.error(err);
	  	}
	});
});

//店家叫外送-店家盤點簽收
Parse.Cloud.define("storeDidSignOff", function(request, response) {
	var query = new Parse.Query("HBStoreInCart");
	query.include("cart");
	query.get(request.params.sicId, {
	  	success: function(sicFound) {
	  		var HBLob = Parse.Object.extend("HBLob");
		    var lob = new HBLob();
			lob.id = request.params.lobId;
			
	  		sicFound.set("beeArrival", request.params.beeArrival);
	  		sicFound.set("signoffImage", lob);
	  		sicFound.set("foodTaken", true);
	  		sicFound.save(null,{
					success: function(sicSave){
						logger.send_info(prop.admin_mail(), 
										prop.mail_cc(), 
										"店家盤點完畢並簽收，訂單編號: " + sicSave.get("cart").id, 
										"小蜜蜂是否準時到店:" + request.params.beeArrival, 
										sicSave.get("cart").id);
										
						var cart = sicSave.get("cart");
						cart.set("status", "shipping");			
						cart.save(null,{
							success: function(sicSave){
								response.success(true);
						    },
							error: function(err) {
								logger.send_error(logger.subject("storeDidSignOff", "set status shipping"), err); 
								response.error(err);
							}		
						});
				    },
					error: function(err) {
						logger.send_error(logger.subject("storeDidSignOff", "save HBStoreInCart"), err); 
						response.error(err);
					}		
				});
	 	},
	  	error: function(object, err) {
	  		logger.send_error(logger.subject("storeDidSignOff", "query HBStoreInCart error."), err);
	    	response.error(err);
	  	}
	});
});

//店家叫外送-小蜜蜂盤點簽收
Parse.Cloud.define("customerDidSignOff", function(request, response) {
	var query = new Parse.Query("HBCustomerInCart");
	query.equalTo("objectId", request.params.cicId);
	query.find()
		.then(function(cicFound) {
			var HBLob = Parse.Object.extend("HBLob");
		    var lob = new HBLob();
			lob.id = request.params.lobId;
			
			var cic = cicFound[0]; 
			cic.set("delivered", true);
			cic.set("deliveredAt", new Date());
			cic.set("signoffImage", lob);
			cic.set("beeArrival", request.params.beeArrival);
			return cic.save();
		})
		.then(function(cicSaved) {
			var cart = cicSaved.get("cart");
			var cicQuery = new Parse.Query("HBCustomerInCart");
			cicQuery.equalTo("cart", cart);
			cicQuery.include("cart");
			cicQuery.notEqualTo("delivered", true);
			
			logger.send_info(prop.admin_mail(), 
										prop.mail_cc(), 
										"客人盤點完畢並簽收，訂單編號: " + cicSaved.get("cart").id, 
										"已送至:" + cicSaved.get("address") + "<BR>" + cicSaved.get("addressNote"), 
										cicSaved.get("cart").id);
										
			return Parse.Promise.when(cicQuery.find(), cicSaved);
		})
		.then(
			function(cicFound, cicSaved) {
				if(cicFound.length == 0) { //都已送達
					var shppingCart = cicSaved.get("cart");
					shppingCart.set("status", "complete");
					shppingCart.set("completeDate", new Date());
					shppingCart.save(null,{
						success: function(cartSaved){
							logger.send_info(prop.admin_mail(), 
										prop.mail_cc(), 
										"[訂單完成]:" + cartSaved.id, 
										"good job.", 
										cartSaved.id);
										
							var queryUser = new Parse.Query(Parse.User);
							queryUser.equalTo('username', request.user.getUsername());	
							queryUser.first()
								.then(function(userFound) {
									Parse.Cloud.useMasterKey();
									userFound.set("delivering", false);
									return userFound.save();
								})
								.then(
									function(userUpdated){
										response.success("complete");
									},
									function(err) {
										logger.send_error(logger.subject("customerDidSignOff", "update user's delivering error"), err);
										response.error(err);
									}
								);
					    },
						error: function(error) {
							logger.send_error(logger.subject("customerDidSignOff", "update cart complete"), error); 
							response.error(error);
						}		
					});
					 
				} else {
					return response.success("signed"); 
				}
			},
			function(error) {
				logger.send_error(logger.subject("customerDidSignOff", "query HBCustomerInCart "), error); 
				response.error(error); 
			}
		);
	
});

Parse.Cloud.define("logUserActivity", function(request, response) {
	var oneInstall = new Parse.Installation();
	oneInstall.id = request.params.installationId;
	
	
	var HBActiveUser = Parse.Object.extend("HBActiveUser");
	var userAction = new HBActiveUser();
	userAction.set("action", request.params.userAction);
	userAction.set("appName", request.params.appName);
	userAction.set("appVersion", request.params.appVersion);
	userAction.set("device", request.params.device);
	userAction.set("installation",  oneInstall);
	userAction.set("owner", request.user);
	userAction.set("remark", request.params.remark);
	userAction.save(null,{
		success: function(cartCreated){
			response.success(true);
	    },
		error: function(err) {
			logger.send_error(logger.subject("logUserActivity", "save action"), err); 
			response.error(err);
		}		
	});
});


Parse.Cloud.define("callPushbots", function(request, response) {
	Parse.Cloud.httpRequest({
		url: 'https://api.pushbots.com/push/one', //use shorten url api
  		method: "POST",
	    headers: {
	        'Content-Type': 'application/json',
	        "x-pushbots-appid": "57835de64a9efaa25b8b4567",
			"x-pushbots-secret": "f6bb56ab6e5a48c8a21d51056fd22afa"
	    },
	    body : {
	    	"platform" : 0 ,  
	    	"token" : "cef6cc71ba97f48793b1883687731a2f78a44f2c31d2759247bca3c0ae22e1b2" ,  
	    	"msg" : "hello pushbots from cloud code" ,  
	    	"sound" : "default"
	    },
        success: function(httpResponse) {
        	response.success(httpResponse);
        },
        error: function(httpResponse) {
            response.error(httpResponse.status);
        }
    });
});

//重新 trigger push
Parse.Cloud.define("notifyNewOrder", function(request, response) {
	if(request.params.notify == "bee") { 
		var query = new Parse.Query("HBShoppingCart");
	    query.get(request.params.cartId)
	    	.then(function(cartFound) {
	    		if(cartFound.get("status") == "onbid") {
	    			cartFound.set("status", "onbid");
		  			return cartFound.save();
	    		} else {
	    			cartFound.set("status", cartFound.get("status"));
		  			return cartFound.save();
	    		}
	    	})
	    	.then(
	    		function(cartSaved){
					response.success(true);
			    },
				function(err) {
					logger.send_error(logger.subject("notifyNewOrder", "save HBShoppingCart"), err); 
					response.error(err);
				}
	    	);
	    	
	} else if (request.params.notify == "store") {
		var query = new Parse.Query("HBOrder");
		query.equalTo("shoppingCart", Parse.Object.extend("HBShoppingCart").createWithoutData(request.params.cartId));
	    query.find()
	    	.then(function(orderFound) {
	    		var order = orderFound[0];
	    		order.set("status", "pushed");
		  		return order.save();
	    	})
	    	.then(
	    		function(orderSaved){
					response.success(true);
			    },
				function(err) {
					logger.send_error(logger.subject("notifyNewOrder", "save HBOrder"), err); 
					response.error(err);
				}
	    	);
	}
});

//
Parse.Cloud.define("getETADateOptions", function(request, response) {
	var dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	var bizDate = [];
	bizDate.push(false);	//"Sun"
	bizDate.push(true);     //"Mon"
	bizDate.push(true);     //"Tue"
	bizDate.push(true);     //"Wed"
	bizDate.push(true);     //"Thu"
	bizDate.push(true);     //"Fri"
	bizDate.push(false);    //"Sat"
	
	var weekstring = ["(日)","(一)","(二)","(三)","(四)","(五)","(六)"];
	var availableDate = [];
	var availableDayOfWeek = [];
	var currentTime = new Date() ;
	var counter = 0;
	while(true) {
		var futureTime = new Date(currentTime);
		futureTime.setDate(futureTime.getDate() + counter); //累加一天
		if (bizDate[futureTime.getDay()]) { //有營業才取
			availableDate.push((futureTime.getMonth()+1) + "/" + futureTime.getDate() + "\n" + weekstring[futureTime.getDay()]);
			availableDayOfWeek.push(dayOfWeek[futureTime.getDay()]);
		}
		if (availableDate.length == 4) break; //先取4天
		counter++;
	}
	response.success(availableDate, availableDayOfWeek);
});

//
Parse.Cloud.define("getTimeSlotByDate", function(request, response) {
	var currentTime = new Date();
	console.log("greater:" + ((currentTime.getHours()+8) * 60 + currentTime.getMinutes() + 60));
	var querySlot = new Parse.Query("HBTimeSlot");
	querySlot.equalTo("enable", true);
	if (request.params.isToday == "Yes") {
		querySlot.greaterThan("sinceMidnight", (currentTime.getHours()+8) * 60 + currentTime.getMinutes() + 60);
	}
	querySlot.ascending("sinceMidnight");
	
    var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", Parse.Object.extend("HBShoppingCart").createWithoutData(request.params.cartId));
	query.include("store");
	query.find()
		.then(function (itemsFound) {
			var storeIdArray = [];
			var storeObjArray = [];
    		for(var i=0 ; i<itemsFound.length ; i++) {
    			var oneItem = itemsFound[i];
    			var storeId = oneItem.get("store").id;
    			if (storeIdArray.indexOf(storeId) == -1) {
    				storeIdArray.push(storeId);
    				
    				var tempStore = Parse.Object.extend("HBFoodStore").createWithoutData(storeId);
    				storeObjArray.push(tempStore);
    			}
    		}
    		
    		var queryStoreSlot = new Parse.Query("HBProductivity");
    		queryStoreSlot.containedIn("store", storeObjArray);
    		queryStoreSlot.include("store");
    		queryStoreSlot.include("timeSlot");
    		
    		var queryStoreBizDate = new Parse.Query("HBStoreBusinessDate");
    		queryStoreBizDate.containedIn("store", storeObjArray);
    		queryStoreBizDate.include("store");
    		
    		return Parse.Promise.when(queryStoreSlot.find(), querySlot.find(), queryStoreBizDate.find());
		})
		.then(
			function(storeSlotsFound, availableSlotFound, storeBizDateFound){
				
				//店家公休日
				var storeBizDateSetting = [];
				var storeIdInBizDate = [];
				for(var i=0 ; i<storeBizDateFound.length ; i++) {
					var bizDate = storeBizDateFound[i];
					var storeObj = bizDate.get("store");
					
					var bizDateObj = {};
					bizDateObj.storeId = storeObj.id;
					bizDateObj.Sun = bizDate.get("Sun");
					bizDateObj.Mon = bizDate.get("Mon");
					bizDateObj.Tue = bizDate.get("Tue");
					bizDateObj.Wed = bizDate.get("Wed");
					bizDateObj.Thu = bizDate.get("Thu");
					bizDateObj.Fri = bizDate.get("Fri");
					bizDateObj.Sat = bizDate.get("Sat");
					
					storeIdInBizDate.push(storeObj.id);
					console.log("bizDateObj:" + JSON.stringify(bizDateObj));
					storeBizDateSetting.push(bizDateObj);
				}
				
				var storeIdArray = [];
				var storeObjArray = [];
				var storeDataArray = [];
				console.log("availableSlotFound:" + availableSlotFound.length);
				console.log("storeSlotsFound:" + storeSlotsFound.length);
				
				for(var i=0 ; i<storeSlotsFound.length ; i++) {
					var storeSlot = storeSlotsFound[i];
					var storeObj = storeSlot.get("store");
					var storeId = storeObj.id;
					var idx = storeIdArray.indexOf(storeId);
					if (idx == -1) {
						storeIdArray.push(storeId);
						storeObjArray.push(storeObj);
						storeDataArray.push([storeSlot]);
					} else {
						var temp = storeDataArray[idx];
						temp.push(storeSlot);
						storeDataArray[idx] = temp;
					}
				}
				
				console.log("storeDataArray:" + storeDataArray.length);
				var reasonsForAllStore = []; //此時段不可選的原因
				for (var i=0 ; i<availableSlotFound.length ; i++) {
					var reasonsForEachStore = [];
						
					for(var j=0 ; j<storeDataArray.length ; j++) { // loop each store
						var slotsOfStore = storeDataArray[j];
						
						for(var k=0 ; k<slotsOfStore.length ; k++) { //loop each setting of store
							var p = slotsOfStore[k];
							var storeObj = p.get("store");
							if (availableSlotFound[i].id == p.get("timeSlot").id) {
								
								if (request.params.isToday == "Yes") {
									if (storeObj.get("reservationUnit") == "day") {
										reasonsForEachStore.push(storeObj.get("storeName") + "-需提前" + storeObj.get("reservation") + "天訂購");
									
									} else if (storeObj.get("reservationUnit") == "minute") {
										
										if (p.get("sinceMidnight") < (((currentTime.getHours()+8) * 60 ) + currentTime.getMinutes() + storeObj.get("reservation"))) {
											reasonsForEachStore.push(storeObj.get("storeName") + "-需提前" + storeObj.get("reservation") + "分鐘訂購");
										} else {
											reasonsForEachStore.push("OK");
										}
									
									} else {
										var storeSettingObj = storeBizDateSetting[storeIdInBizDate.indexOf(storeObj.id)];
										var storeOpenOnDay = storeSettingObj[request.params.dayOfWeek];
										
										if (!storeOpenOnDay) {
											reasonsForEachStore.push(storeObj.get("storeName") + "-公休");
										} else {
											if (!p.get("serviceOpen")) {
												reasonsForEachStore.push(storeObj.get("storeName") + "-休息時段");
											} else {
												reasonsForEachStore.push("OK");
											}
										}
									}
								} else {
									var storeSettingObj = storeBizDateSetting[storeIdInBizDate.indexOf(storeObj.id)];
									var storeOpenOnDay = storeSettingObj[request.params.dayOfWeek];
									
									if (!storeOpenOnDay) {
										reasonsForEachStore.push(storeObj.get("storeName") + "-公休");
									} else {
										if (!p.get("serviceOpen")) {
											reasonsForEachStore.push(storeObj.get("storeName") + "-休息時段");
										} else {
											reasonsForEachStore.push("OK");
										}
									}
								}
								break;
							}
						}
						//console.log(storeObjArray[j].get("storeName") + " " + availableSlotFound[i].get("interval") + " " + slotIsAvailableForThisStore);
						
						
					}
					//console.log("slot:" + i + "-reasons:" + reasonsForEachStore);
					reasonsForAllStore.push(reasonsForEachStore);
				}
				//console.log("reasonsForEachStore:" + reasonsForAllStore);
				response.success([availableSlotFound, reasonsForAllStore]);
			}, 
			function(error) {
				response.error(error);
			});
	
});

Parse.Cloud.define("updateCartETA", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId)
		.then(function(cartFound) {
	  		var tempETA = request.params.ETA; // formate: 8/8(四) 13:45
     		var eta = null;
     		if (tempETA != null && tempETA != "") {
     			var tempDay = tempETA.substring(0, tempETA.indexOf("("));
				var tempSlot = tempETA.substring(tempETA.indexOf(" ") + 1);
				eta = new Date(new Date().getFullYear() + "/" + tempDay + " " + tempSlot);
				eta.setMinutes(eta.getMinutes() - 480); // 轉換成 UTC 時間
			}
     		
	  		Parse.Cloud.useMasterKey();
	  		cartFound.set("ETA", eta);
	  		cartFound.set("etaSinceMidnight", request.params.sinceMidnight);
	  		cartFound.set("etaString", request.params.ETA);
 		    return cartFound.save();
	 	})
	 	.then(
	 		function() {
	 			response.success(true);	
	 		},
	  		function(err) {
		    	console.error("updateCartETA failed" + err.code + "," + err.message);
				response.error("updateCartETA failed." + err.code + "," + err.message);
	  		}
	  	);
});

//取餐碼
Parse.Cloud.define("getPickupCode", function(request, response) {
	var code = util.foodPickupCode(request.params.cartId);
	console.log(request.params.cartId + " 取餐碼:" + code);
	response.success(code);	 
});

//////////////////////////////////////////
/////// 愛心便當
///////

//取得店家資料讓愛心便當平台當店家註冊帳號用
Parse.Cloud.define("getStores", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.equalTo("online", true);
	query.find({
    	success: function(results) {
    		var returnResults = [];
    		for(var i=0 ; i<results.length ; i++) {
    			var obj = results[i];
    			if (obj.get("storeName") == "app promotion") continue;
    			var storeObj = {};
    			storeObj.id = obj.id;
    			storeObj.storeName = obj.get("storeName");
    			storeObj.address = obj.get("address");
    			storeObj.phone = obj.get("phone");
    			returnResults.push(storeObj);
    		}
    		response.success(returnResults);
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getStores", "food store lookup failed."), error);
      	  	response.error(err);
    	}
  	});
});


//新增路況，提供運送中的小蜜蜂即時資訊
Parse.Cloud.define("addTrafficReport", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.containedIn("status", ["ongoing", "shipping"]);
	query.find({
    	success: function(results) {
    		var lat = eval(request.params.lat);
            var lng = eval(request.params.lng);
            var geoLocation = new Parse.GeoPoint({latitude: lat, longitude: lng});
            
    		var HBTrafficAlarmInCart = Parse.Object.extend("HBTrafficAlarmInCart");
			var itemArray = [];
			for (var i= 0 ; i<results.length ; i++) {
				
		    	var item = new HBTrafficAlarmInCart();
		        item.set("cart", results[i]);
		        item.set("trafficType", request.params.reasons);
		        item.set("atLocation", geoLocation);
		        itemArray.push(item);
		    }
						
		    Parse.Object.saveAll(itemArray, {
		        success: function(dataCreated) {
		            response.success(true);
		        },
		        error: function(error) { 
		            logger.send_error(logger.subject("addTrafficReport", "save HBTrafficAlarmInCart error."), error);
					response.error(error);		
		        }
			});
    	},
    	error: function(err) {
			logger.send_error(logger.subject("addTrafficReport", "find cart failed."), error);
      	  	response.error(err);
    	}
  	});
});