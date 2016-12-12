/***
 * for web app only 
 **/
 
var logger = require("./mail_service.js");
var prop = require("./app_properties.js");
var util = require("./util.js");
var _ = require("underscore");

Parse.Cloud.define("getFoodDetail", function(request, response) {
	var query = new Parse.Query("HBMealSet");
	query.include("foodImage");
	query.include("belongTo");
	query.get(request.params.foodId, {
	  	success: function(foodFound) {
	  		response.success(foodFound);
	  	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("getFoodImage", "get food image error."), err);
			response.error(err);
	  	}
	});
});

var createObjectById = function (className, id) {
    return Parse.Object.extend(className).createWithoutData(id);
}

//
// 確認是否能加入購物車
// return OK: 可
// return 200: 此店家不能與現有購物車裡的店家併單 
// return 100: 合併訂購最多只能選三個店家
//
Parse.Cloud.define("canAddToCart", function(request, response) {

	var cart = createObjectById("HBShoppingCart", request.params.cartId);
	
	var queryItem = new Parse.Query("HBShoppingItem");
	queryItem.equalTo("shoppingCart", cart);
	queryItem.include("store");
	
	var queryStore = new Parse.Query("HBFoodStore");
	
	var p1 = new Parse.Promise();
	p1 = queryStore.get(request.params.storeId);
	
	var p2 = new Parse.Promise();
	p2 = queryItem.find();
	
	Parse.Promise.when(p1, p2)
		.then(
			function(storeWantAddToCart, items) {
			
				var sameLocationGroup = true;
				var storeIdArray = [];
				_.each(items, function(oneItem) {
					var storeObj = oneItem.get("store");
					if(storeWantAddToCart.get("locationGroup") != storeObj.get("locationGroup")) {
						sameLocationGroup = false;
					}
					
					if(storeIdArray.indexOf(storeObj.id) == -1) {
						storeIdArray.push(storeObj.id);
					}
					
				}); //~each
				
				if(!sameLocationGroup) {
					response.success("200"); 
				} else {
					if(storeIdArray.indexOf(storeWantAddToCart.id) == -1 ) { //店家尚未在購物車裡出現
						if (storeIdArray.length < 3) {
							console.log("only " + storeIdArray.length + " stores in cart");
							response.success("OK");
						} else {
							console.log("already " + storeIdArray.length + " stores in cart");
							response.success("100"); 
						}
					} else {
						console.log("store:" + storeWantAddToCart.id + " already in cart");
						response.success("OK");
					}
				}
			},
			function (error) {
				response.error(error); 
			}
		);
});

//取得購物車內容
Parse.Cloud.define("shoppingCartContents", function(request, response) {
	var subQuery = new Parse.Query("HBShoppingCart");
	subQuery.equalTo("objectId",  request.params.cartId);
	subQuery.containedIn("status", request.params.status);
	
	var query = new Parse.Query("HBShoppingItem");
	query.matchesQuery("shoppingCart", subQuery);
	query.include("meal");
	query.include("store");
	query.include("shoppingCart");
	query.ascending("store,meal");
	query.find().then(
  		function(itemsFound) {
  			var results = shoppingItemGroupBy(itemsFound, request, "");
  			response.success(results);
  		},
  		function(err) {
  			logger.send_error(logger.subject("shoppingCartContents", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//以店家顯示購買項目
function shoppingItemGroupBy(itemsFound,request, viewMode)
{
	var storeIdArray = [];
	var storeObjArray = []; // of HBFoodStore
	var storeItemArray = []; // of HBShoppingItem
	var shoppingCart = null;
	for (var i=0 ; i<itemsFound.length ; i++) {
		var oneItem = itemsFound[i];
		
		if(oneItem.get("owner").id != request.user.id) continue; //
		
		
		var storeId	= oneItem.get("store").id; //HBFoodStore.objectId
		var idx = storeIdArray.indexOf(storeId);
		console.log("oneItem:" + oneItem.id + ",storeId:" + storeId + ",idx:" + idx);
		var itemsArray = [];
		if (idx == -1) {
			storeIdArray[storeIdArray.length] = storeId;
			
			var obj = {};
			obj.storeName = oneItem.get("store").get("storeName");
			obj.storeSubTotal = oneItem.get("subTotal");
			storeObjArray.push(obj);
		
			itemsArray[itemsArray.length] = oneItem;
			storeItemArray[storeItemArray.length] = itemsArray;
		} else {
			itemsArray = storeItemArray[idx];
			itemsArray[itemsArray.length] = oneItem;
			storeItemArray[idx] = itemsArray;
			
			var obj = storeObjArray[idx];
			var currentSubTotal = obj.storeSubTotal;
			obj.storeSubTotal = currentSubTotal + oneItem.get("subTotal");
			storeObjArray[idx] = obj;
			
		}
	}
	
	var results = [];
	results[0] = storeObjArray;
	results[1] = storeItemArray;
	return results;
}

//更新購買項目的數量
Parse.Cloud.define("updateShoppingItemQty", function(request, response) {
	var query = new Parse.Query("HBShoppingItem");
	query.include("meal");
	query.get(request.params.shoppingItemId)
	.then(
		function (itemFound) {
			var qty = request.params.qty
			if(qty == 0) {
				return itemFound.destroy();	
			} else {
				var unitPrice = request.params.unitPrice;
				var bags = itemFound.get("meal").get("bags");
				itemFound.set("qty", qty);
				itemFound.set("bags", bags * qty);
				itemFound.set("unitPrice", unitPrice);
				itemFound.set("subTotal", unitPrice * qty);
				return itemFound.save();
			}
		}	
	)
	.then(
		function (itemUpdated) {
			response.success(itemUpdated.id);
		},
		function (error) {
			logger.send_error(logger.subject("updateShoppingItemQty", "updateShoppingItemQty error."), error);
			response.error(error);
		}
	) ;
});

//將購物車設為搶標狀態
Parse.Cloud.define("setCartOnBid", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.equalTo("allPayStamp",  request.params.stamp);
	query.include("owner");
	query.include("sendTo");
	query.find()
		.then(function(cartsFound) {	//update shopping cart
			var cartObj = cartsFound[0];
			if(cartsFound[0].get("status") == "in shopping") {
				cartsFound[0].set("submittedDate", new Date());
				cartsFound[0].set("status", "onbid");	
				cartsFound[0].set("allPayNo", request.params.allPayNo);
				return cartsFound[0].save()
					.then(function(cartSaved) {
						console.log("setCartOnBid cartSaved:" + cartSaved.id);
						//query shopping item
						var queryItem = new Parse.Query("HBShoppingItem");
						queryItem.equalTo("shoppingCart", cartSaved);
						queryItem.include("store");
						
						var querySIC = new Parse.Query("HBStoreInCart");
					    querySIC.equalTo("cart", cartSaved);
					    
						return Parse.Promise.when(cartSaved, queryItem.find(), querySIC.find());
					})
					.then(function(cartSaved, itemsFound, sicFound) {
						console.log("shoppingcart item::" + itemsFound.length);
						console.log("querySIC:" + sicFound.length);
						if(sicFound.length > 0) { //刪舊資料
							Parse.Object.destroyAll(sicFound,  { 
								success: function(success) {
									console.log("delete sic:");
								}, 
					            error: function(error) {
									response.error(error);
								}
				        	});
				        	return Parse.Promise.when(cartSaved, itemsFound);
						} else {
							return Parse.Promise.when(cartSaved, itemsFound);
						}
					}).
					then(function(cartSaved, itemsFound) { //create HBStoreInCart
						var orderNoPrefix = [];
						var totalFoodPrice = 0;
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
				 			} else {
				 				var currentBags = storeBags[storeFoundAt];
				 				currentBags = currentBags + itemObj.get("bags");
				 				storeBags[storeFoundAt] = currentBags;
				 			}
				 			
				 			var storeCode = storeObj.get("storeCode");
				 			if (orderNoPrefix.indexOf(storeCode) == -1) { // not found
				 				orderNoPrefix.push(storeCode);
				 			}
				 			totalFoodPrice += itemObj.get("subTotal");
				 		}
				 		
				 		var HBStoreInCart = Parse.Object.extend("HBStoreInCart");
				 		var promises = [];
				 		console.log("stores in cart:" + storeObjArray.length);
						for (var i= 0 ; i<storeObjArray.length ; i++) { 
					    	var item = new HBStoreInCart();
					        item.set("cart", cartSaved);
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
					        promises.push(item.save());
						}
						return Parse.Promise.when(cartSaved, promises);
					})
					.then(function(cartSaved, sicSaved) {
						var queryAddr = new Parse.Query("HBUserAddressBook");
						queryAddr.equalTo("objectId", cartSaved.get("sendTo").id);
						
						var queryCIC = new Parse.Query("HBCustomerInCart");
						queryCIC.equalTo("cart", cartSaved);
						return Parse.Promise.when(cartSaved, queryAddr.find(), queryCIC.find());
					})
					.then(function(cartSaved, addrFound, cicFound) {
						console.log("cic found:" + cicFound.length);
						console.log("addrFound 2:" + addrFound);
						if(cicFound.length > 0) {
							Parse.Object.destroyAll(cicFound,  { 
								success: function(success) {
									console.log("delete cic:" + addrFound);
								}, 
					            error: function(error) {
									response.error(error);
								}
				        	});
				        	return Parse.Promise.when(cartSaved, addrFound);
						} else {
							return Parse.Promise.when(cartSaved, addrFound);
						}
					})
					.then(function(cartSaved, addrFound) { //create HBCustomerInCart
						var HBCustomerInCart = Parse.Object.extend("HBCustomerInCart");
				    	var customerInCart = new HBCustomerInCart();
				    	customerInCart.set("address", addrFound[0].get("address"));
				    	customerInCart.set("location", addrFound[0].get("geoLocation"));
				    	customerInCart.set("contact", cartSaved.get("contactPerson"));
						customerInCart.set("phone", cartSaved.get("contactPhone"));
				    	customerInCart.set("addressNote", cartSaved.get("addressNote")); 
				    	customerInCart.set("cart", cartSaved);
				    	customerInCart.set("delivered", false);
				    	customerInCart.set("ETA", cartSaved.get("ETA"));
				    	return Parse.Promise.when(cartSaved, customerInCart.save());
					})	
					.then(function(cartSaved, cicSaved) {
						
						var addressBook = cartSaved.get("sendTo");
						var owner = cartSaved.get("owner");
						var subject = owner.get("contact") + " 送出新訂單: " + cartSaved.id;
						var sDate = cartSaved.get("submittedDate");
						
						var total = cartSaved.get("totalPrice");
						var shipping = cartSaved.get("shippingFee");
						var discount = cartSaved.get("discount");
						var foodPrice = total - shipping - discount;
						
						var localETD = cartSaved.get("ETA");
						
						
						var body = "訂購人: " + owner.get("contact") + ", " + owner.get("phone") + "<BR>";
						body += "email: " + owner.get("userEmail") + "<BR><BR>";
						body += "訂單編號: " + cartSaved.id + "<BR>";
						body += "訂單產生時間: " + (sDate.getMonth() + 1) + "/" + sDate.getDate() + " " + (sDate.getHours()+8) + ":" + sDate.getMinutes() + "<BR><BR>";
						
						body += "餐點預計送達時間: " + (localETD.getMonth() + 1) + "/" + localETD.getDate() + " " + (localETD.getHours()+8) + ":" + localETD.getMinutes() + "<BR>";
						body += "送餐地址: " + addressBook.get("address") + "<BR>";
						body += "送餐備註: " + addressBook.get("addressNote") + "<BR><BR>";
						
						body += "餐費: $" + foodPrice  + "<BR>";
						body += "運費: $" + shipping + "<BR>";
						
						if (cartSaved.get("couponNo") != "") {
							body += "折價金額: $" + discount + " (折價卷: " + cartSaved.get("couponNo") + ")<BR>";
						} else {
							body += "折價金額: $0 (未使用折價卷)<BR>";
						}
						
						body += "刷卡金額: <font color=blue>$" + total + "</font><BR>";
						body += "歐付寶交易序號: " + cartSaved.get("allPayNo") + "<BR>";
						body += prop.order_info() + "?objectId=" + cartSaved.id;
						
						logger.send_notify(prop.admin_mail(), prop.mail_cc(), subject, body);
						
						var queryOrder = new Parse.Query("HBOrder");
						queryOrder.equalTo("shoppingCart", cartSaved);
						
						return Parse.Promise.when(cartSaved, queryOrder.find());
					}).
					then(function(cartSaved, orderFound) {
						if(orderFound.length > 0) {
							Parse.Object.destroyAll(orderFound,  { 
								success: function(success) {
									console.log("delete order");
								}, 
					            error: function(error) {
									response.error(error);
								}
				        	});
				        	return Parse.Promise.when(cartSaved);
						} else {
							return Parse.Promise.when(cartSaved);
						}
					})
					.then(function(cartSaved){	
						
						//create HBOrder
						var HBOrder = Parse.Object.extend("HBOrder");
						var order = new HBOrder();
						order.set("shoppingCart", cartSaved);
						return Parse.Promise.when(order.save(), cartSaved);
					})
					.then(
						function (orderSaved, cartSaved) {
							//計算出較精準的到店取餐時間
							Parse.Cloud.run("calculateETD", 
									{cartId: cartSaved.id}, 
									{
			                        	success: function (result) {
			                        		response.success(true);
			                    		}, error: function (error) {
			                    			logger.send_error(logger.subject("setCartOnBid", "call calculateETD failed."), error);
											response.error(error);
			                    		}
			                        });
						},
						function (error) {
							logger.send_error(logger.subject("setCartOnBid", "update cart error."), error);
							response.error(error);
						}
					);
			} else {
				//已送出的單
				console.log("已送出的單");
				response.success(true);
			}
		});
		
});

//android 結帳前的資料儲存
Parse.Cloud.define("stageShoppingCart", function (request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.cartId;	
	
	var queryItem = new Parse.Query("HBShoppingItem");
	queryItem.equalTo("shoppingCart", cart);
	queryItem.include("store");
	
	var queryCart = new Parse.Query("HBShoppingCart");
	queryCart.include("owner");
	
	var p1 = queryCart.get(request.params.cartId);
	
	queryItem.find()
		.then(function(itemsFound) { //先取得餐費加總
			var orderNoPrefix = [];
			var totalFoodPrice = 0;
			var storeObjArray = [];
			var storeIdArray = [];
			for(var i=0 ; i<itemsFound.length ; i++) {
	 			var itemObj = itemsFound[i];	
	 			var storeObj = itemObj.get("store");
	 			
	 			if (storeIdArray.indexOf(storeObj.id) == -1) {
	 				storeObjArray.push(storeObj);
	 				storeIdArray.push(storeObj.id);
	 			}
	 			
	 			var storeCode = storeObj.get("storeCode");
	 			if (orderNoPrefix.indexOf(storeCode) == -1) { // not found
	 				orderNoPrefix.push(storeCode);
	 			}
	 			totalFoodPrice += itemObj.get("subTotal");
	 		}
	 		
	 		var	p3 = new Parse.Promise.as(orderNoPrefix);
			var p4 = new Parse.Promise.as(totalFoodPrice);
			return Parse.Promise.when(p1, p3, p4);
		})
		.then(function(cartFound, orderNoPrefix, totalFoodPrice) { //update shopping cart
			var HBUserAddressBook = Parse.Object.extend("HBUserAddressBook");
		    var address = new HBUserAddressBook();
			address.id = request.params.sendToId;
	 	
	 		var tempETA = request.params.ETA; // formate: 8/8(四) 13:45
	 		var etd = null;
	 		var eta = null;
	 		if (tempETA != null && tempETA != "") {
	 			var tempDay = tempETA.substring(0, tempETA.indexOf("("));
				var tempSlot = tempETA.substring(tempETA.indexOf(" ") + 1);
				eta = new Date(new Date().getFullYear() + "/" + tempDay + " " + tempSlot);
				eta.setMinutes(eta.getMinutes() - 480); // 轉換成 UTC 時間
						
				etd = new Date(eta);
				//送達時間前30分鐘設為取餐時間，每多一個店家多5分鐘
				etd.setMinutes(eta.getMinutes() - 30 - ((orderNoPrefix.length -1) * 5));
	 		}
			
			//cartFound.set("status", "");
			cartFound.set("orderNo", orderNoPrefix.join("") + "-" + cartFound.id);
			cartFound.set("shippingFee", eval(request.params.shippingFee));
			cartFound.set("discount", eval(request.params.discount));
			cartFound.set("totalPrice", totalFoodPrice + eval(request.params.shippingFee)+eval(request.params.discount));
			cartFound.set("couponNo", request.params.couponNo);
			cartFound.set("needTaxId", request.params.needTaxId);
			cartFound.set("taxId", request.params.taxId);
			cartFound.set("payToBee", 130+((orderNoPrefix.length-1) * 15)); //運費 $130 起跳
			cartFound.set("addressNote", request.params.addressNote); 
			if (request.params.userEmail != "") {
				cartFound.set("userEmail", request.params.userEmail);
			}
			cartFound.set("contactPhone", request.params.phone);
			cartFound.set("contactPerson", request.params.contact);		    	
			cartFound.set("deliveryOrder", true);
			cartFound.set("ETD", etd);
			cartFound.set("ETA", eta);
			cartFound.set("sendTo", address);
			cartFound.set("allPayStamp", request.params.stamp);
			cartFound.set("lineModeEnable", false);
			if (request.params.installationId) {
 		    	cartFound.set("installation", request.params.installationId);	
 		    }
 		    if (request.params.sinceMidnight) {
 		    	cartFound.set("etaSinceMidnight", request.params.sinceMidnight);	
 		    }
 		    //if (request.params.paymentMethod) {
 		    //	cartFound.set("paymentMethod", request.params.paymentMethod);
 		    //}
			console.log("update shopping cart");
			return cartFound.save();	 
		})
		.then(function(cartSaved) { //update user info
			Parse.Cloud.useMasterKey();
			var currentUser = cartSaved.get("owner");
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
		    console.log("update user info");
			return currentUser.save();
		})
		.then(
			function(ownerUpdated) {
				response.success(true); 
			},
			function(error) {
				logger.send_error(logger.subject("saveShoppingCart", "save cart error."), error);
				response.error(error);
			}
		);
});

//檢查送餐地點是否超出30分車程
Parse.Cloud.define("addressCanDeliver", function (request, response) {
	// get cuurent store.
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var cart = new HBShoppingCart();
	cart.id = request.params.cartId;	
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.include("store");
	
	query.find()
		.then(function(itemsFound) {
			var storeObjArray = [];
			var storeIdArray = [];
			var storeLocation = [];
			for(var i=0 ; i<itemsFound.length ; i++) {
	 			var itemObj = itemsFound[i];	
	 			var storeObj = itemObj.get("store");
	 			
	 			if (storeIdArray.indexOf(storeObj.id) == -1) {
	 				storeLocation.push(storeObj.get("geoLocation").latitude + "," + storeObj.get("geoLocation").longitude);
	 				storeIdArray.push(storeObj.id);
	 			}
	 		}
	 		
	 		var allStoreLocationInfo = storeLocation.join("|");
	 		console.log("allStoreLocationInfo:" + allStoreLocationInfo);
	 		return new Parse.Promise.as(allStoreLocationInfo);
		})
		.then(function(destinations) {
			Parse.Cloud.run("isDeliveryAddressInRange", {
				cartId:  request.params.cartId,
			 	destinations: destinations,
			 	origin:  request.params.point
			}, {
				success: function(canShip){
					console.log("isDeliveryAddressInRange result:" + canShip);
					response.success(canShip);
			 	},
			 	error: function(error) {
			 		logger.send_error(logger.subject("isDeliveryAddressInRange", "error:" + request.params.cartId), error);
					response.error(error);
				}
			});	
		
		});
});

//問卷表
Parse.Cloud.define("submitSurveyWebForm", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var queryCart  = new Parse.Query("HBShoppingCart");
	queryCart.include("bee");
	
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
					
					queryCart.get(request.params.cartId, {
					  	success: function(cartFound) {
					  		var subject = "[消費者評分問券] 訂單:" + request.params.cartId;
							var body = "回覆者:" + request.user.get("contact") + ", " + request.user.get("phone") + "<BR>";
							body += "外送小蜜蜂: " + cartFound.get("bee").get("contact") + ", " + cartFound.get("bee").get("phone") + "<BR>";
							body += "此次評分: " + (eval(request.params.serviceAttitude) + eval(request.params.serviceSOP) + eval(request.params.foodCondition)) + "<BR><BR>";
							
							body += "問卷結果:<BR>";
							body += "外送小蜜蜂服務態度: <font color=blue>" + attitudeDesc + "(" + request.params.serviceAttitude + ")</font><BR>";
							body += "外送小蜜蜂服務流程: <font color=blue>" + sopDesc + "(" + request.params.serviceSOP + ")</font><BR>";
							body += "餐點送達時的狀況: <font color=blue>" + foodConditionDesc + "(" + request.params.foodCondition + ")</font><BR>";
							body += "建議: " + request.params.userComments + "<BR>";
							 
							logger.send_notify(prop.admin_mail(), prop.mail_cc(), subject, body);
							response.success(commentSaved.id);
					 	},
					  	error: function(object, err) {
					  		logger.send_error(logger.subject("submitSurveyWebForm", "find user"), err); 
					    	response.success(0);
					  	}
					});
					
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

//取得所有店家
Parse.Cloud.define("getFoodStoreForCMS", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.equalTo("online", true);
	query.descending("createdAt");
	query.find({
    	success: function(results) {
    		var returnResults = [];
    		for(var i=0 ; i<results.length ; i++) {
    			var obj = results[i];
    			if(obj.get("storeName") == "app promotion") continue;
    			returnResults.push(obj);
    		}
    		response.success(returnResults);
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getFoodStoreForCMS", "food store lookup failed."), error);
      	  	response.error(err);
    	}
  	});
});

//確認訂單是否已送出
Parse.Cloud.define("isSubmitted", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId, {
	  	success: function(cart) {
	  		if(cart.get("status") == "onbid" || cart.get("status") == "ongoing") {
    			response.success(true);
    		} else {
    			response.success(false);
    		}
	  	},
	  	error: function(error) {
	  		console.log("error:" + JSON.stringify(error));
			logger.send_error(logger.subject("isSubmitted", "get cart failed."), error);
	      	response.error(false);
	  	}
	});
	
});

//檢查送達時間是否可行
Parse.Cloud.define("isEtaAvailableForAllStore", function(request, response) {
	var weeks = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
	
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	
    
	var queryBizDate = new Parse.Query("HBStoreBusinessDate"); //營業日設定
	queryBizDate.equalTo(request.params.dateTitle, true);
	var p2 = queryBizDate.find();
	
	var queryProd = new Parse.Query("HBProductivity"); //營業時間設定
	queryProd.equalTo("sinceMidnight", request.params.sinceMidnight);
	queryProd.equalTo("serviceOpen", true);
	var p3 = queryProd.find();
	
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
    query.include("store");
    query.find()
		.then(function(itemsFound) { //找出此訂單包含幾個店家
			var storeIdArray = [];
			var storeObjArray = [];
			for(var i=0 ; i<itemsFound.length ; i++) {
				var store = itemsFound[i].get("store");
				if(storeIdArray.indexOf(store.id) == -1) {
					storeIdArray.push(store.id);
					storeObjArray.push(store);
				}
			}
			
			var p1 = new Parse.Promise.as(storeObjArray);
			return Parse.Promise.when(p1, p2);
		})
		.then(function(storeArray, results) { //判斷使用者所選[日期]是否有店家不營業
			console.log("判斷使用者所選[日期]是否有店家不營業");
			var fail = [];
			for(var i=0 ; i<storeArray.length ; i++) {
				var storeServiceOpen = false;
				var storeName = storeArray[i].get("storeName");
				for(var j=0 ; j<results.length ; j++) {
					var bizDateObj = results[j];
					var storeObj = bizDateObj.get("store");
					if(storeArray[i].id == storeObj.id) {
						storeServiceOpen = true;
						break;
					}
				}
				if(!storeServiceOpen) {
					fail.push({"storeName": storeName, "error" : "100"});
				}
			}
			if (fail.length > 0) {
				console.log("error 100:" + fail);
				return Parse.Promise.error(fail);	
			}
			
			return Parse.Promise.when(Parse.Promise.as(storeArray), p3);
		})
		.then(function(storeArray, results) { //判斷使用者所選[時段]是否有店家不營業
			console.log("判斷使用者所選[時段]是否有店家不營業");
			var fail = [];
			for(var i=0 ; i<storeArray.length ; i++) {
				var storeServiceOpen = false;
				var storeName = storeArray[i].get("storeName");
				for(var j=0 ; j<results.length ; j++) {
					var prodObj = results[j];
					var storeObj = prodObj.get("store");
					if(storeArray[i].id == storeObj.id) {
						storeServiceOpen = true;
						break;
					}
				}
				if(!storeServiceOpen) {
					fail.push({"storeName": storeName, "error" : "200"});
				}
			}
			
			if (fail.length > 0) {
				console.log("error 200:" + fail);
				return Parse.Promise.error(fail);	
			}
			
			return Parse.Promise.as(storeArray);
		})
		.then(function(storeArray) { //
			console.log("判斷是否有店家是要提前預訂");
			
			var currentMD = util.currentDate();
			var etaString = request.params.etaString; // formate: 8/8(四) 13:45
     		var idx = etaString.indexOf("(");
     		var isToday = "No";
			if (currentMD == etaString.substring(0, idx)) {
				isToday = "Yes";
			}
			console.log("isToday:" + isToday);
			var fail = [];
			for(var i=0 ; i<storeArray.length ; i++) {
				var storeServiceOpen = false;
				var storeNeedReservation = false;
				
				var storeName = storeArray[i].get("storeName");
				var reservationUnit = storeArray[i].get("reservationUnit");
				
				if(isToday == "Yes") {
					if (reservationUnit == "day") {
						storeNeedReservation = true;
					}
					
		      		if (reservationUnit == "minute") {
		      			//目前時間與訂單時間差距是否足夠
		      			var currentDate = new Date();
		      			var currentMinutesFromMidnight = (currentDate.getHours() + 8) * 60 + currentDate.getMinutes();
		      			var diff = request.params.sinceMidnight - currentMinutesFromMidnight; 
		      			if (diff < storeArray[i].get("reservation")) {
		      				storeNeedReservation = true;	
		      			}
		      		}
				}
				
				if(storeNeedReservation) {
					fail.push({"storeName": storeName, "error" : "300"});
				}
			}
			
			if (fail.length > 0) {
				console.log("error 300:" + fail);
				return Parse.Promise.error(fail);	
			}
			
			return Parse.Promise.as("true");
		})
		.then( //日期比對pass後，再進行時間比對
			function(result) {
				response.success(result);
			},
			function(error) {
				response.success(error); //return error message
			}	
		);
});

//取得目前運費及分攤人數
Parse.Cloud.define("currentShippingFee", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
	
	var query = new Parse.Query("HBShoppingItem");
    query.equalTo("shoppingCart", cart);
    query.include("store");
    query.include("owner");
    query.find()
		.then(
			function(itemsFound) {
				var totalFoodPrice = 0; //全部餐費
				
				//找出此訂單包含幾個店家 
				var storeIdArray = [];
				for(var i=0 ; i<itemsFound.length ; i++) {
					var store = itemsFound[i].get("store");
					if(storeIdArray.indexOf(store.id) == -1) {
						storeIdArray.push(store.id);
					}
					totalFoodPrice += itemsFound[i].get("subTotal");
				}
				
				//var userPay = util.calShippingFee(totalFoodPrice, storeIdArray.length);
				var userPay = util.calShippingFee_new(itemsFound, storeIdArray.length)
				
				//找出此訂單有幾個人參與
				var ownerIdArray = [];
				for(var i=0 ; i<itemsFound.length ; i++) {
					var owner = itemsFound[i].get("owner");
					if(ownerIdArray.indexOf(owner.id) == -1) {
						ownerIdArray.push(owner.id);
					}
				}
				
				var feeForEach = Math.ceil(userPay / ownerIdArray.length); //無條件進位
				
				return response.success([feeForEach, ownerIdArray.length, userPay, totalFoodPrice]);
			},
			function(error) {
				response.error(error);
			}
		);
});

//查看目前購物車
Parse.Cloud.define("currentCart", function(request, response) {
	
	var query = new Parse.Query("HBShoppingCart");
    query.get(request.params.cartId)
		.then(function(cart) { 
				response.success(cart);
			},
			function(error) {
				response.error(error);
			}	
		);
});

// 我的跟團
Parse.Cloud.define("getMyJoinOrder", function(request, response) {
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("addFrom", "line");
	query.equalTo("owner", request.user);
	query.include("shoppingCart");
	query.include(["shoppingCart.owner"]);
	query.descending("updatedAt");
	query.find({
    	success: function(results) {
    		var cartIdArray = [];
    		var cartArray = [];
    		for(var i=0 ; i<results.length ; i++) {
    			var cart = results[i].get("shoppingCart");
    			if (cart != null) {
    				if(cartIdArray.indexOf(cart.id) == -1) {
	    				cartIdArray.push(cart.id);	
	    				cartArray.push(cart);
	    			}
    			}
    		}
    		response.success(cartArray);
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getMyJoinOrder", "getMyJoinOrder"), err);  
      	  	response.error(err);
    	}
  	});
});

//以訂購人為分類，顯示購買項目
Parse.Cloud.define("displayCartItemsByOwner", function(request, response) {
	Parse.Cloud.run("getCartItems", { //先取得購物車所有項目
	 	cartId: request.params.cartId
	}, 
	{
		success: function(itemsFound){ //再依訂購人進行分類
			var ownerIdArray = [];
			var OwnerObjArray = []; // of PFUser
			var cartObj = null;
			var totalFoodPrice = 0;
			for (var i=0 ; i<itemsFound.length ; i++) {
				var oneItem = itemsFound[i];
				if (cartObj == null) {
					cartObj = oneItem.get("shoppingCart");
				}
				var itemObj = util.formattedItem(oneItem, cartObj);
				var subTotal = oneItem.get("subTotal");
				totalFoodPrice += subTotal;
				var owner = oneItem.get("owner");
				var identity = "";
				if (cartObj.get("owner").id == owner.id) { //團主
					identity = "starter";
				} else {
					identity = "follower";	
				}
				
				var idx = ownerIdArray.indexOf(owner.id);
				if (idx == -1) { //訂購人尚未存在陣列裡
					ownerIdArray.push(owner.id);
					
					var obj = {};
					obj.cartStatus = cartObj.get("status");
					obj.cartOwner = cartObj.get("owner").id;
					obj.cartUrl = cartObj.get("shortenUrl");
					obj.itemOwner = itemObj.owner; 
					obj.identity = identity;
					obj.contact = owner.get("contact");
					obj.phone = owner.get("phone");
					obj.subTotalForOwner = subTotal; //訂購人的餐費合計
					obj.itemsForOwner = [itemObj];
					obj.itemsObjForOwner = [oneItem]; //for ios ui display
					OwnerObjArray.push(obj);
				} else {
					var existedOwner = OwnerObjArray[idx];
					existedOwner.itemsForOwner.push(itemObj);
					existedOwner.itemsObjForOwner.push(oneItem);
					
					var currentSubTotal = existedOwner.subTotalForOwner;
					existedOwner.subTotalForOwner = currentSubTotal + subTotal;
				}
			}
			
			
			
			//var shippingFee = cartObj.get("shippingFee");
			
			var storeIdArray = [];
			var storeObjArray = []; // of HBFoodStore
			for (var i=0 ; i<itemsFound.length ; i++) {
				var oneItem = itemsFound[i];
				var store = oneItem.get("store");
				var idx = storeIdArray.indexOf(store.id);
				if (idx == -1) { 
					storeIdArray.push(store.id);
				}
			}
			
			
			//var shippingFee = util.calShippingFee(totalFoodPrice, storeIdArray.length)
			var shippingFee = util.calShippingFee_new(itemsFound, storeIdArray.length)
			
			var sharedPerson = OwnerObjArray.length;
			for (var i=0 ; i<OwnerObjArray.length ; i++) {
				var obj = OwnerObjArray[i];
				obj.sharedShippingFee = Math.ceil(shippingFee / sharedPerson); //無條件進位
				obj.shouldPay = obj.sharedShippingFee + obj.subTotalForOwner;
				obj.sharedPerson = sharedPerson;
			}
			
  			response.success([OwnerObjArray, cartObj]);
  		},
	 	error: function(error) {
	 		logger.send_error(logger.subject("displayCartItemsByOwner", "get cart failed."), error);
			response.error(error);
		}
	});
});

//以訂購人為分類，顯示購買項目
//todo
Parse.Cloud.define("getJoinCartSummary", function(request, response) {
	
	Parse.Cloud.run("currentShippingFee", 
	{
	 	cartId: request.params.cartId
	 }, 
	 {
		success: function(data){
			
			var sharedShippingFee = data[0];
			
			
			var subQuery = new Parse.Query("HBShoppingCart");
			subQuery.equalTo("objectId",  request.params.cartId);
			subQuery.containedIn("status", request.params.status);
			
			var query = new Parse.Query("HBShoppingItem");
			query.matchesQuery("shoppingCart", subQuery);
			query.include("meal");
			query.include("store");
			query.include("shoppingCart");
			query.include("[shoppingCart.owner]");
			query.include("owner");
			query.ascending("addFrom");
			query.find().then(
		  		function(itemsFound) {
		  			console.log(itemsFound.length + " shopping items found");
		  			
		  			var results = {};
		  			
		  			//先取發起人的購買項目
		  			var counter = 0 ;
		  			var ownerObj = {};
		  			ownerObj.sumOfOwner = 0;
		  			ownerObj.shoppingItems = [];
		  			ownerObj.sharedShippingFee = sharedShippingFee;
		  			var cartObj = null;
		  			for(var i=0 ; i<itemsFound.length ; i++) {
		  				var item = itemsFound[i];
		  				var currentCart = item.get("shoppingCart");
		  				if(cartObj == null) {
		  					cartObj = currentCart;
		  				}
		  				
		  				var itemOwner = item.get("owner");
		  				console.log("item owner:" + itemOwner.id + "#" + currentCart.get("owner").id);
		  				if(itemOwner.id != currentCart.get("owner").id) {
		  					continue;
		  				}
		  				
		  				if (counter == 0) {
		  					ownerObj.contact = itemOwner.get("contact");
						}
						
						var currentSum = ownerObj.sumOfOwner;
		  				ownerObj.sumOfOwner = currentSum + item.get("subTotal");
		  				ownerObj.shoppingItems.push(util.formattedItem(item, cartObj));
						counter++;
		  			}
		  			ownerObj.shouldPay = sharedShippingFee + ownerObj.sumOfOwner;
		  			results.starter = ownerObj;
		  			
		  			//再取跟團人的購買項目
		  			var followerData = [];
		  			var ownerIdArray = [];
		  			for(var i=0 ; i<itemsFound.length ; i++) {
		  				var item = itemsFound[i];
		  				
		  				var itemOwner = item.get("owner");
		  				var currentCart = item.get("shoppingCart");
		  				if(itemOwner.id == currentCart.get("owner").id) {
		  					continue;
		  				}
		  				
		  				//查詢個人團購，只取自己的資料
		  				if(request.params.queryType != null && request.params.queryType == "personal") {
		  					if(itemOwner.id != request.user.id) {
		  						continue;
		  					}
		  				}
		  				
		  				
		  				var idx = ownerIdArray.indexOf(itemOwner.id);
		  				if(idx == -1) {
		  					ownerIdArray.push(itemOwner.id);
		  					
		  					var ownerObj = {};
		  					//ownerObj.contact = itemOwner.get("contact") + "," + itemOwner.get("phone");
		  					ownerObj.contact = itemOwner.get("contact") ;
		  					ownerObj.contactId = itemOwner.id;
		  					ownerObj.sumOfOwner = item.get("subTotal");
		  					ownerObj.shouldPay = sharedShippingFee + ownerObj.sumOfOwner;
		  					ownerObj.shoppingItems = [util.formattedItem(item, cartObj)];
		  					ownerObj.sharedShippingFee = sharedShippingFee;
		  					followerData.push(ownerObj);
		  				} else {
		  					var ownerObj = followerData[idx];
		  					var currentSum = ownerObj.sumOfOwner;
		  					ownerObj.sumOfOwner = currentSum + item.get("subTotal");
		  					ownerObj.shouldPay = sharedShippingFee + ownerObj.sumOfOwner;
		  					ownerObj.shoppingItems.push(util.formattedItem(item, cartObj));
		  					followerData[idx] = ownerObj;
		  				}
		  			}
		  			
		  			results.follower = followerData;
		  			
		  			return response.success(results);
		  		},
		  		function(err) {
		  			logger.send_error(logger.subject("getJoinCartSummary", "query shopping cart items"), err); 
					response.error(err);
		  		}
		  	);
			
			
	 	},
	 	error: function(error) {
	 		logger.send_error(logger.subject("getJoinCartSummary", "getJoinCartSummary error, cart:" + request.params.cartId), error);
			response.error(error);
		}
	});
});

//以店家為分類，顯示購買項目
Parse.Cloud.define("displayCartItemsByStore", function(request, response) {
	Parse.Cloud.run("getCartItems", { //先取得購物車所有項目
	 	cartId: request.params.cartId
	}, 
	{
		success: function(itemsFound){ //再依店家進行分類
			var storeIdArray = [];
			var results = []; // of JSStore
			var cartObj = null;
			for (var i=0 ; i<itemsFound.length ; i++) {
				var item = itemsFound[i];
				if (cartObj == null) {
					cartObj = item.get("shoppingCart");
				}
				var itemJSObj = util.formattedItem(item, cartObj);
				
				var subTotal = item.get("subTotal");
				var store = item.get("store");
				var idx = storeIdArray.indexOf(store.id);
				if (idx == -1) { //店家尚未存在陣列裡
					storeIdArray.push(store.id);
					var storeJSObj = util.initJSStore(store, item, itemJSObj);
	  				results.push(storeJSObj);
	  				
	  				/*	
					var obj = {};
					obj.storeName = store.get("storeName");
					obj.subTotalForStore = subTotal; //店家的餐費合計
					obj.itemsForStore = [itemObj];
					storeObjArray.push(obj);
					*/
				} else {
					var storeJSObj = results[idx];
  					storeJSObj = util.updateJSStore(storeJSObj, item, itemJSObj);
  					results[idx] = storeJSObj; //replace obj content
  					
  					/*
					var existedStore = storeObjArray[idx];
					existedStore.itemsForStore.push(itemObj);
					
					var currentSubTotal = existedStore.subTotalForStore;
					existedStore.subTotalForStore = currentSubTotal + subTotal;
					*/
				}
			}
  			response.success([results, cartObj]);
  		},
	 	error: function(error) {
	 		logger.send_error(logger.subject("displayCartItemsByStore", "get cart failed."), error);
			response.error(error);
		}
	});
});

//取得購物車所有項目
Parse.Cloud.define("getCartItems", function(request, response) {
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
    var cart = new HBShoppingCart();
	cart.id = request.params.cartId;
    
    var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.include("meal");
	query.include("store");
	query.include("owner");
	query.include("shoppingCart");
	query.include(["shoppingCart.owner"]);
	query.descending("addFrom");
	query.find().then(
  		function(itemsFound) {
  			response.success(itemsFound);
  		},
  		function(err) {
  			logger.send_error(logger.subject("getCartItems", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//更新user資訊
Parse.Cloud.define("updateUserContact", function(request, response) {
	Parse.Cloud.useMasterKey();
	var query = new Parse.Query(Parse.User);
	query.equalTo('objectId', request.params.userId);
	query.first()
		.then(function(userFound) {
			if (userFound) {
				userFound.set("contact", request.params.contact);
				userFound.save(null,{
					success: function(userSaved) {
						response.success(true);
					},
					error: function(err) {
						logger.send_error(logger.subject("updateUserContact", "save user contact") , err);
						response.error("save user contact:" + err);
					}	
				});
			}	
		});
});


// 團購車目前已點的店家
Parse.Cloud.define("storesInJoinCart", function(request, response) {
	var cart = createObjectById("HBShoppingCart", request.params.cartId);
	
	var query = new Parse.Query("HBShoppingItem");
	query.equalTo("shoppingCart", cart);
	query.include("store");
	query.include(["store.storeImage"]);
	query.find().then(
  		function(itemsFound) {
  			var storeIdArray = [];
  			var storeObjArray = [];
			for(var i=0 ; i<itemsFound.length ; i++) {
				var storeObj = itemsFound[i].get("store");
				
				if(storeIdArray.indexOf(storeObj.id) == -1) {
					storeIdArray.push(storeObj.id);
					storeObjArray.push(storeObj);
				}
			}
  			
  			response.success(storeObjArray);
  		},
  		function(err) {
  			logger.send_error(logger.subject("storesInJoinCart", "query shopping cart items"), err); 
			response.error(err);
  		}
  	);
});

//取得app點餐首頁最上層店家
Parse.Cloud.define("getAD", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.equalTo("online", true);
	query.equalTo("stickyTop", 1);
	query.include("storeImage");
	query.find({
    	success: function(results) {
    		response.success(results[0]);
    	},
    	error: function(err) {
			logger.send_error(logger.subject("getAD", "food store lookup failed."), error);
      	  	response.error(err);
    	}
  	});
});

//取得app點餐首頁最上層店家
Parse.Cloud.define("getStoreById", function(request, response) {
	var query = new Parse.Query("HBFoodStore");
	query.get(request.params.storeId, {
	  	success: function(storeFound) {
	  		response.success(storeFound);
	  	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("getStoreById", "find store error."), err);
			response.error(err);
	  	}
	});
});