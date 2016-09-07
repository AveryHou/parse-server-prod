// JavaScript source code

var logger = require("./mail_service.js");
var prop = require("./app_properties.js");

Parse.Cloud.define("hello", function (request, response) {

    var result = { type: "Fiat", model: "500", color: "white" };

    var array1 = [];
    for (var i = 0; i < 3; i++) {
        var object = createObjectById("HBShoppingCart", "lEZYB8Gyqd");
        array1.push(object);
    }

    var array2 = [];
    for (var i = 0; i < 2; i++) {
        var object = createObjectById("HBShoppingCart", "lEZYB8Gyqd");
        array2.push(object);
    }

    var array3 = [];

    array3.push(array1);
    array3.push(array2);

    response.success(array3);
});

var createObjectById = function (className, id) {
    return Parse.Object.extend(className).createWithoutData(id);
}

var createObjectArrayByIdArray = function (className, idArray) {
    var parseObjectArray = [];
    idArray.forEach(function (cartId, index, array) {
        parseObjectArray.push(createObjectById(className, cartId));
    });
    return parseObjectArray;
}

Parse.Cloud.define("getStoreOrderItems", function (request, response) {

    var mParams = {
        dateFrom:request.params.dateFrom,
        dateTo: request.params.dateTo,
        store: createObjectById("HBFoodStore", request.params.storeId),
        notContainedCarts: request.params.notContainedCartId
    }

    var createCartQuery = function () {
        var query = new Parse.Query("HBShoppingCart");
        query.greaterThanOrEqualTo("ETD", mParams.dateFrom);
        query.lessThan("ETD", mParams.dateTo);
        query.notContainedIn("objectId", mParams.notContainedCarts);
        return query;
    }

    var createItemQuery = function () {
        var query = new Parse.Query("HBShoppingItem");
        query.include("meal");
        query.include("shoppingCart");
        query.matchesQuery("shoppingCart", createCartQuery());
        query.equalTo("store", mParams.store);
        return query;
    }

    //main process
    var itemQuery = createItemQuery();
    itemQuery.find({
        success: function (items) {
            response.success(items);
        },
        error: function (ex) {
            response.error(ex);
        }
    });

});


Parse.Cloud.define("getStoreOrderCount", function (request, response) {

    var mParams = {
        dateFrom: request.params.dateFrom,
        dateTo: request.params.dateTo,
        store: createObjectById("HBFoodStore", request.params.storeId),
    }

    var createCartQuery = function () {
        var query = new Parse.Query("HBShoppingCart");
        query.greaterThanOrEqualTo("ETD", mParams.dateFrom);
        query.lessThan("ETD", mParams.dateTo);
        query.containedIn("status", ["ongoing", "onbid"]);
        return query;
    }

    //main process
    var cartQuery = createCartQuery();
    cartQuery.count({
        success: function (number) {
            response.success(number);
        },
        error: function (ex) {
            response.error(ex);
        }
    });

});


Parse.Cloud.define("searchStoreBills", function (request, response) {

    var mParams = {
        dateFrom: request.params.dateFrom,
        dateTo: request.params.dateTo,
        store: createObjectById("HBFoodStore", request.params.storeId),
    }

    var createCartQuery = function () {
        var query = new Parse.Query("HBShoppingCart");
        query.notEqualTo("paymentMethod","cashForStore");
        query.greaterThanOrEqualTo("completeDate", mParams.dateFrom);
        query.lessThan("completeDate", mParams.dateTo);
        query.equalTo("status","complete")
        return query;
    }

    //main process
    var cartQuery = createCartQuery();
    cartQuery.find({
        success: function (items) {
            response.success(items);
        },
        error: function (ex) {
            response.error(ex);
        }
    });

});

Parse.Cloud.define("replyNewOrderNotification", function (request, response) {

    var mParams = {
        cart: createObjectById("HBShoppingCart",request.params.cartId),
        store: createObjectById("HBFoodStore", request.params.storeId)
    }

    var createItemQuery = function () {
        var query = new Parse.Query("HBStoreInCart");
        query.equalTo("cart", mParams.cart);
        query.equalTo("store", mParams.store);
        query.include("store");
        return query;
    }

    var replyAllItems = function (items) {
        for (var i = 0, len = items.length; i < len; i++) {
            items[i].set("replied", true);
        }
    }

    //main process
    var itemQuery = createItemQuery();
    itemQuery.find({
        success: function (items) {
            replyAllItems(items);
			var storeCartObj = items[0];
			Parse.Object.saveAll(items, {
                success: function (list) {
                	var mailSubject = "[確認收到訂單][" + storeCartObj.get("store").get("storeName") + "][訂單編號-" + request.params.cartId + "]" ;
                    logger.send_notify(prop.mail_cc(), "", mailSubject, "訂單編號:" + request.params.cartId);
                    response.success(true);
                },
                error: function (error) {
                	logger.send_error(logger.subject("replyNewOrderNotification", "save cart item error."), err);
                    response.success(false);
                }
            });
        },
        error: function (ex) {
            response.error(ex);
        }
    });
});

//APP 
Parse.Cloud.define("replyStoreOpen", function (request, response) {

    var query = new Parse.Query("HBFoodStore");
    query.get(request.params.storeId, {
	  	success: function(storeFound) {
	  		if(request.params.isOpened) {
	  			storeFound.set("onhold", null);
	  		} else {
	  			storeFound.set("onhold", "breaking");
	  		}
	  		storeFound.save(null,{
				success: function(storeSaved){
					var msg = (request.params.isOpened)? "今日開店" : "注意!!! 今日不開店";
					logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[" + storeFound.get("storeName") + "]" + msg, request.params.storeId); 
					response.success(true);
			    },
				error: function(err) {
					logger.send_error(logger.subject("replyStoreOpen", "save store open status failed."), err); 
					response.error(err);
				}		
			});
	 	},
	  	error: function(object, err) {
			logger.send_error(logger.subject("replyStoreOpen", "store not found." + request.params.storeId), err);
			response.error(err);
	  	}
	});	
});

//設定尖峰
Parse.Cloud.define("replyBusyStatus", function (request, response) {
	var today = new Date();
	var currentDate = today.getFullYear() + "/" + (today.getMonth() + 1) + "/" + today.getDate();
	
	var HBFoodStore = Parse.Object.extend("HBFoodStore");
	var store = new HBFoodStore();
	store.id = request.params.storeId;
	
	var queryStore = new Parse.Query("HBFoodStore");
	queryStore.equalTo("objectId",  request.params.storeId);
	
	var query = new Parse.Query("HBRushHour");
	query.equalTo("storeId", store);
	query.equalTo("cancelled", false);
	query.greaterThan("createdAt", new Date(currentDate));
	query.include("storeId");
	
	if (request.params.isBusying) { //設尖峰
		query.find()
			.then(function(dataFound) {
				var HBRushHour = Parse.Object.extend("HBRushHour");
				rushHour = new HBRushHour();
		  		rushHour.set("storeId", store);
			  	
			  	var start = new Date(request.params.dateFrom);
			  	start.setHours(start.getHours() - 8);
			  	
			  	var end = new Date(request.params.dateTo);
			  	end.setHours(end.getHours() - 8);
			  	
		  		rushHour.set("startTime", start);
			  	rushHour.set("endTime", end);
			  	rushHour.set("setupDate", currentDate);
			  	rushHour.set("cancelled", false);
	  			return rushHour.save();
			})
			.then(function(rushHour) {
				queryStore.find();
			})
			.then(
				function(stores) {
					var body = stores[0].get("storeName");
					body += "<BR>:" + request.params.dateFrom;
					body += "<BR>:" + request.params.dateTo;
					logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[設定尖蜂]" +  stores[0].get("storeName") , body); 
					response.success(true);
				}, 
				function(error) {
					logger.send_error(logger.subject("replyBusyStatus", "update HBRushHour failed."), error); 
					response.error(error);
				}
			);
		
	} else { //取消尖峰
		query.find()
			.then(function(dataFound) {
				var rushHour = dataFound[0];
				rushHour.set("cancelled", true);
				return rushHour.save();
	  		})
			.then(function(rushHour) {
				var foodStore = rushHour.get("storeId");
	  			foodStore.set("onhold", null); //
	  			return foodStore.save();
			})
			.then(
				function(foodStore) {
					logger.send_notify(prop.admin_mail(), prop.mail_cc(), "[取消尖峰][" + foodStore.get("storeName") + "]", "store:" + request.params.storeId); 
					response.success(true);
				}, 
				function(error) {
					logger.send_error(logger.subject("replyBusyStatus", "save store onold failed."), error); 
					response.error(error);
				}
			);
	}
	
});


