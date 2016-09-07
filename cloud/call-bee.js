/***
 * 與店家呼叫小蜜蜂相關服務
 **/
 
var logger = require("./mail_service.js");
var prop = require("./app_properties.js");
var util = require("./util.js");


Parse.Cloud.define("callBee", function(request, response) {
	
	//var ParseUser = Parse.Object.extend(Parse.User);
    var owner = new Parse.User();
	owner.id = request.params.ownerId;
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
    var store = new HBFoodStore();
	store.id = request.params.storeId;
	
	var HBMealSet = Parse.Object.extend("HBMealSet");
    var meal = new HBMealSet();
	meal.id = request.params.mealId;
	
	//step1:建 HBStoreInCart
	var HBStoreInCart = Parse.Object.extend("HBStoreInCart");
	var sic = item = new HBStoreInCart();
    sic.set("cart", cart);
    sic.set("store", store);
    sic.set("foodTaken", false);
    sic.set("replied", false);
	sic.set("bags", 1);
	sic.set("bagSize", "L");
	sic.save({})
		.then(function(storeInCartCreated) {
			//step2: create shopping item
	      	var HBShoppingItem = Parse.Object.extend("HBShoppingItem");
	        var item = new HBShoppingItem();
	        item.set("shoppingCart", cart);
	        item.set("qty", 1);
	        item.set("bags", 1); 
	        item.set("unitPrice", 0);
	        item.set("subTotal", 0);
	        item.set("owner", owner);
	        item.set("store", store);
	        item.set("meal", meal);
	        item.set("addFrom", "self");
	        item.set("itemKey", request.params.mealId);
	        item.save({})
				.then(function(itemCreated) {
					//step4: update shopping cart 
					var query = new Parse.Query("HBShoppingCart");
					query.equalTo("objectId", request.params.cartId);	
					query.first().then(
						function(cartFound) {
							var etd = new Date(new Date().getFullYear() + "/" + request.params.etdDateString + " " + request.params.etdTimeString);
							etd.setMinutes(etd.getMinutes() - 480); // 轉換成 UTC 時間
							     	
						    var eta = new Date(new Date().getFullYear() + "/" + request.params.etdDateString + " " + request.params.etaTimeString);
							eta.setMinutes(eta.getMinutes() - 480); // 轉換成 UTC 時間
							 		
				     		Parse.Cloud.useMasterKey();
				     		cartFound.set("orderNo", request.params.cartId);
				     		cartFound.set("owner", owner);
						    
						    if(request.params.reserved == "Yes") { //指定小蜜蜂
						    	var bee = new Parse.User();
								bee.id = request.params.beeId;
								
						    	cartFound.set("bidCount", 99);
						    	cartFound.set("status", "ongoing");
						    	cartFound.set("bee", bee);
						    } else {
						    	cartFound.set("status", "onbid");
						    }
						    cartFound.set("shippingFee", 0);
						 	cartFound.set("discount", 0);
						 	cartFound.set("totalPrice", eval(request.params.totalPrice));
						 	cartFound.set("payToBee", eval(request.params.payToBee)); 
						 	cartFound.set("ETD", etd);
							cartFound.set("ETA", eta);
							//cartFound.set("sendTo", address);
					 		cartFound.set("deliveryOrder", true);
				 		    cartFound.set("submittedDate", new Date());
				 		    cartFound.set("paymentMethod", "cashForStore");
						 	return cartFound.save();
						})
						.then(function(cartUpdated) {
							//final step: create HBOrder
							var HBOrder = Parse.Object.extend("HBOrder");
							var order = new HBOrder();
							order.set("shoppingCart", cartUpdated);
							return Parse.Promise.when(order.save(), cartUpdated);
						})
						.then(function(orderCreated, cartUpdated) {
							var subject = "店家 [" + request.params.storeName + "] 呼叫小蜜蜂，訂單編號: " + request.params.cartId;
		        			var sDate = cartUpdated.get("submittedDate");
		        			
		        			var body = "";
		        			body += "訂單編號: " + request.params.cartId + "<BR>";
		        			body += "訂單產生時間: " + (sDate.getMonth() + 1) + "/" + sDate.getDate() + " " + (sDate.getHours()+8) + ":" + sDate.getMinutes() + "<BR><BR>";
		        			logger.send_notify(prop.admin_mail(), prop.mail_cc(), subject, body);
		        			return Parse.Promise.when(orderCreated, cartUpdated);
						})
						.then(
							function(orderCreated, cartUpdated){
								console.log("before assign bee");
								if(request.params.reserved == "Yes") { //指定小蜜蜂
									var query = new Parse.Query(Parse.User);
									query.equalTo("objectId", request.params.beeId);
									query.first().then(function(userFound) {
										Parse.Cloud.useMasterKey();
										userFound.set("delivering", true);
										userFound.save({}).then(
											function() {
												console.log("leave assign bee");
												response.success("OK");
											},
											function(error) {	
												response.error(error);
											}
										);
									});
								} else {
									response.success("OK");
								}
							},
							function(error) {
								response.error(error);
							}
						);
					
				});
		});
});


Parse.Cloud.define("lookingForBee", function(request, response) {
	var query = new Parse.Query(Parse.User);
	query.equalTo('username', "driver-" + request.params.phoneOfBee);	
	query.first()
		.then(function(userFound) {
			if(userFound) {
				response.success(userFound);
			} else {
				response.error("bee not found");
			}
			
		}, function (err) {
			logger.send_error(err);
			response.error("bee not found");
		});
});

//取得有啟用外送服務的店家
Parse.Cloud.define("loadEnableCallBeeStore", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.equalTo("enableCallBee", true);	
	query.find()
		.then(function(results) {
			response.success(results);
		}, function (err) {
			logger.send_error(err);
			response.error(err);
		});
});

//取得有啟用外送服務的店家
Parse.Cloud.define("loadCustomerInCart", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var query = new Parse.Query("HBCustomerInCart");
	query.equalTo("cart", cart);
	query.ascending("createAt");
	query.find()
		.then(function(results) {
			response.success(results);
		}, function (err) {
			logger.send_error(err);
			response.error(err);
		});
});

//新增CustomerInCart
Parse.Cloud.define("newCustomerInCart", function(request, response) {
	var eta = new Date(new Date().getFullYear() + "/" + request.params.etaDateString + " " + request.params.etaTimeString);
	eta.setMinutes(eta.getMinutes() - 60*8); // 轉換成 UTC 時間,+8小時
		    
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var HBCustomerInCart = Parse.Object.extend("HBCustomerInCart");
	var cic = new HBCustomerInCart();
	cic.set("address", request.params.address);
	cic.set("addressNote", request.params.addressNote);
	cic.set("contact", request.params.contact);
	cic.set("phone", request.params.phone);
	cic.set("cart", cart);
	cic.set("delivered", false);
	cic.set("ETA", eta);
	if(request.params.lat) {
		var point = new Parse.GeoPoint({latitude: eval(request.params.lat), 
										longitude: eval(request.params.lng)});
		cic.set("location", point);
	}
	if(request.params.cash) {
		cic.set("cash", eval(request.params.cash));
	}
	
	cic.save(null,{
		success: function(cicCreated){
			response.success(true);
	    },
		error: function(err) {
			logger.send_error(logger.subject("newCustomerInCart", "save HBCustomerInCart"), err); 
			response.error(err);
		}		
	});
});

//刪除送餐資訊
Parse.Cloud.define("deleteCIC", function(request, response) {
	var query = new Parse.Query("HBCustomerInCart");
	query.get(request.params.cicId, {
	  	success: function(cicFound) {
	   		Parse.Cloud.useMasterKey();
	   		cicFound.destroy({
  				success: function(cicDestory) {
			    	response.success(true);
				},
				error: function(err) {
				    logger.send_error(logger.subject("deleteCIC", "delete HBCustomerInCart") , err);
      	  			response.error(err);
				}
			});
	  	},
	  	error: function(err) {
	    	logger.send_error(logger.subject("deleteCIC", "find HBCustomerInCart") , err);
      	  	response.error(err);
	  	}
	});
});