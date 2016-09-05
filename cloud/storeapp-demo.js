/**************************************************
	店家版測試用api 
**************************************************/

//產生訂單
Parse.Cloud.define("createOrder", function(request, response) {
	var query = new Parse.Query("HBShoppingCart");
	query.get(request.params.cartId)
	.then(function (cartFound){
		if(request.params.reservation) {
			var today = new Date();
			today.setDate(today.getDate() + 1);
			cartFound.set("ETD", today);
			cartFound.set("ETA", today);
		} else {
			cartFound.set("ETD", new Date());
			cartFound.set("ETA", new Date());
		}
		return cartFound.save();
	})
	.then(
		function (cartSaved) {
			//create HBOrder
			var HBOrder = Parse.Object.extend("HBOrder");
			var order = new HBOrder();
			order.set("shoppingCart", cartSaved);
			return order.save();
	})
	.then(
		function (order) {
			response.success(order.id);
		},
		function (error) {
			response.error(error);
		}
	);
});

//開店通知
Parse.Cloud.define("storeOpenPush", function(req, response) {
	
  Parse.Cloud.httpRequest({
    method: "POST",
    url: "https://api.parse.com/1/jobs/storeBreakingNotify",
    headers: {
      "X-Parse-Application-Id": "UWZqpCsyFQWnyLTChFrK6t19NyLtmm7m0W2gP2ul",
      "X-Parse-Master-Key": "eYp0OiKm0jlxerSV1QvzaK2cytp2xEiqF3C7f89w",
      "Content-Type": "application/json"
    },
    body: {
      
    },
    success: function(httpResponse) {
	     response.success(true);
	    },
    error: function(error) {
      response.success(false);
    }
  });
	
});
//~~api