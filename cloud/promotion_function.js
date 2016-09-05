/***
 *
 **/
 
//app
Parse.Cloud.define("getAppPromotion", function(request, response) {
	Parse.Cloud.run("getPromotion", 
					{
					 	promoteType: "app"
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

//
Parse.Cloud.define("getStorePromotion", function(request, response) {
	Parse.Cloud.run("getPromotion", 
					{
					 	promoteType: "store",
					 	storeId: request.params.storeId
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

Parse.Cloud.define("getPromotion", function(request, response) {
	var query = new Parse.Query("HBPromotion");
	query.equalTo("promoteType", request.params.promoteType);
	if (request.params.storeId) {
		var FoodStore = Parse.Object.extend("HBFoodStore");
		var store = new FoodStore();
		store.id = request.params.storeId;
		query.equalTo("forStore", store);
	}
	query.include("thumbnail");
	query.include("fullImage");
	query.include("forStore");
	query.find({
    	success: function(results) {
    		response.success(results);
    	},
    	error: function(err) {
			console.error("promotion lookup failed" + err.code + "," + err.message);
      	  	response.error(err);
    	}
  	});
});


Parse.Cloud.define("getPromotionPic", function(request, response) {
	Parse.Cloud.httpRequest({
	    url: request.params.url,
	    method: 'GET',
	    success: function(httpResponse) {
	      var imageBuffer = httpResponse.buffer;
	      response.success(imageBuffer.toString('base64'));
	    },
	    error: function(httpResponse) {
	      response.error('Error getting image');
	    }
	  });
});