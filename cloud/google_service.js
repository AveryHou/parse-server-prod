var prop = require("./app_properties.js");
var logger = require("./mail_service.js");

 //key was created in google developer console
var googleKey = "AIzaSyAOC2vryr8Bfu27LaG3RaZ7WeFBd5JPhx0";


//使用 google api 將地址轉成經緯度
Parse.Cloud.define("findGeoPointByAddress", function(request, response) {
	
	Parse.Cloud.httpRequest({
        url: 'https://maps.googleapis.com/maps/api/geocode/json', //use geocoding to convert address to latitude/longitude
  		params: {
  			language: "zh-TW",
    			address : request.params.address,
    			key: googleKey, 
    			sensor:true
  		},
        success: function(httpResponse) {
        	var obj = JSON.parse(httpResponse.text);
        	var lat = obj.results[0].geometry.location.lat;
            var lng = obj.results[0].geometry.location.lng;
            
            var geoLocation = new Parse.GeoPoint({latitude: lat, longitude: lng});
            response.success(geoLocation);
        },
        error: function(httpResponse) {
            console.error('Request failed with response code ' + httpResponse.status);
            response.error('Request failed with response code ' + httpResponse.status);
        }
    });
});

//新增使用者常用送餐地點
//使用 google api 將地址轉成經緯度
Parse.Cloud.define("createUserAddressBook", function(request, response) {
	
	Parse.Cloud.httpRequest({
        url: 'https://maps.googleapis.com/maps/api/geocode/json', //use geocoding to convert address to latitude/longitude
  		params: {
  			language: "zh-TW",
    			address : request.params.address,
    			key: googleKey, 
    			sensor:true,
    			components:"country:TW"
  		},
        success: function(httpResponse) {
        	var obj = JSON.parse(httpResponse.text);
        	var lat = obj.results[0].geometry.location.lat;
            var lng = obj.results[0].geometry.location.lng;
            
            var geoLocation = new Parse.GeoPoint({latitude: lat, longitude: lng});
            
            //create new record
            var acl = new Parse.ACL();
			acl.setPublicReadAccess(true);
			
            var HBUserAddressBook = Parse.Object.extend("HBUserAddressBook");
			var addressBook = new HBUserAddressBook();
			addressBook.set("address", request.params.address);
			addressBook.set("addressNote", request.params.addressNote);
			addressBook.set("user", request.user);
			addressBook.set("geoLocation", geoLocation);
			addressBook.setACL(acl);
			addressBook.save(null,{
				success: function(addressCreated){
					response.success(addressCreated.id);
				},
				error: function(err) {
					response.error("createUserAddressBook failed." + err);
				}		
			});
        },
        error: function(httpResponse) {
            console.error('Request failed with response code ' + httpResponse.status);
            response.error('Request failed with response code ' + httpResponse.status);
        }
    });
});

//改回傳物件
Parse.Cloud.define("createUserAddressBook_new", function(request, response) {
	
	Parse.Cloud.httpRequest({
        url: 'https://maps.googleapis.com/maps/api/geocode/json', //use geocoding to convert address to latitude/longitude
  		params: {
  			language: "zh-TW",
    			address : request.params.address,
    			key: googleKey, 
    			sensor:true,
    			components:"country:TW"
  		},
        success: function(httpResponse) {
        	var obj = JSON.parse(httpResponse.text);
        	var lat = obj.results[0].geometry.location.lat;
            var lng = obj.results[0].geometry.location.lng;
            
            var geoLocation = new Parse.GeoPoint({latitude: lat, longitude: lng});
            
            //create new record
            var acl = new Parse.ACL();
			acl.setPublicReadAccess(true);
			
            var HBUserAddressBook = Parse.Object.extend("HBUserAddressBook");
			var addressBook = new HBUserAddressBook();
			addressBook.set("address", request.params.address);
			addressBook.set("addressNote", request.params.addressNote);
			addressBook.set("user", request.user);
			addressBook.set("geoLocation", geoLocation);
			addressBook.setACL(acl);
			addressBook.save(null,{
				success: function(addressCreated){
					response.success(addressCreated);
				},
				error: function(err) {
					response.error("createUserAddressBook failed." + err);
				}		
			});
        },
        error: function(httpResponse) {
            console.error('Request failed with response code ' + httpResponse.status);
            response.error('Request failed with response code ' + httpResponse.status);
        }
    });
});

//將團購車網址簡化
//google shorten url api
Parse.Cloud.define("shortenUrlForOrder", function(request, response) {
	Parse.Cloud.httpRequest({
		url: 'https://www.googleapis.com/urlshortener/v1/url?key=AIzaSyAOC2vryr8Bfu27LaG3RaZ7WeFBd5JPhx0', //use shorten url api
  		method: "POST",
	    headers: {
	        'Content-Type': 'application/json'
	    },
	    body : {
	    	longUrl: request.params.longUrl	
	    },
        success: function(httpResponse) {
        	var obj = JSON.parse(httpResponse.text);
        	//console.log("httpResponse.text:" + httpResponse.text);
        	response.success(obj.id);
        },
        error: function(httpResponse) {
            console.error('Request failed with response code ' + httpResponse.status + ",httpResponse:" + httpResponse.message);
            response.error('Request failed with response code ' + httpResponse.status + ",httpResponse:" + httpResponse.message);
        }
    });
});



//送餐地址與店家的距離
//google distance matrix api
//see https://developers.google.com/maps/documentation/distance-matrix/intro
Parse.Cloud.define("isDeliveryAddressInRange", function(request, response) {
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
    		var destinations = [];
    		for(var i=0 ; i<itemsFound.length ; i++) {
    			var oneItem = itemsFound[i];
    			var store = oneItem.get("store").id;
    			if (storeId.indexOf(store) == -1) {
    				storeId.push(store);
    				var point = oneItem.get("store").get("geoLocation");
    				destinations.push(point.latitude + "," + point.longitude);
    			}
    		}
    		var destinationsString = destinations.join("|");
    		console.log("destinationsString:" + destinationsString);
    		Parse.Cloud.httpRequest({
		        url: 'https://maps.googleapis.com/maps/api/distancematrix/json',
		  		params: {
		  			language: "zh-TW",
					origins: request.params.origin,	//送餐地
			    	//destinations: request.params.destinations, //店家地址
			    	destinations:destinationsString,
			    	avoid:"highways",
					key: googleKey
				},
		        success: function(httpResponse) {
		        	var obj = JSON.parse(httpResponse.text);
		        	var order = "訂單編號[" + request.params.cartId + "]";
		        	var canShip = "Yes";
		        	for(var i=0 ; i<obj.rows[0].elements.length ; i++) {
		        		var secondsToArrive = obj.rows[0].elements[i].duration.value; //seconds
		        		console.log("secondsToArrive:" + secondsToArrive);
		        		if(secondsToArrive > 30*60) { //店家與送餐地址大於 30 分鐘車程，不提供服務
		        			canShip = "No";
		        			logger.send_notify(prop.admin_mail(), prop.admin_mail(), order + " 送餐地址-過遠", httpResponse.text);
		        			break;
		        		}
		        	}
		        	
		        	if (canShip == "No") {
		        		logger.send_notify(prop.admin_mail(), prop.admin_mail(), "送餐地址過遠 " + order, httpResponse.text);
		        	}
		        	response.success(canShip);
		        },
		        error: function(httpResponse) {
		            console.error('Request failed with response code ' + httpResponse.status + "," + JSON.stringify(httpResponse));
		            response.error('Request failed with response code ' + httpResponse.status);
		        }
		    });
    		
    	},
    	error: function(error) {
			logger.send_error(logger.subject("getShippingFee", "query shoppingitem") , err);
      	  	response.error(error);
    	}
  	});
});

//計算各店家合理的取餐時間
Parse.Cloud.define("calculateETD", function(request, response) {

	// var apikey='AIzaSyDT_nh0aKxv4aZ263b5RGYCDRD-vjCozj0';
	var directionsUrl = 'https://maps.googleapis.com/maps/api/directions/json?';

	var findStoreInCarts = function(cart) {
		var HBStoreInCart = Parse.Object.extend("HBStoreInCart");
		var storeInCartQuery = new Parse.Query(HBStoreInCart);
		storeInCartQuery.include('store');
		storeInCartQuery.equalTo('cart', cart);
		return storeInCartQuery.find();
	}
	var findCustomerInCarts = function(cart) {
		var HBCustomerInCart = Parse.Object.extend("HBCustomerInCart");
		var customerInCartQuery = new Parse.Query(HBCustomerInCart);
		customerInCartQuery.equalTo('cart', cart);
		return customerInCartQuery.find();
	}
	var createHttpUrl = function(params) {
		var url = directionsUrl + apiKeyParam() + "&" + ortherParam() + "&";
		params.forEach(function(param, index, array) {
			url += param + "&";
		})
		return url;
	}
	var originParam = function(location) {
		return "origin=" + location.latitude + "," + location.longitude;
	}
	var destinationParam = function(location) {
		return "destination=" + location.latitude + "," + location.longitude;
	}
	var departureTimeParam = function(date) {
		return "departure_time=" + parseInt(date.getTime() / 1000);
	}
	var waypointsParam = function(locations) {
		var paramUrl = "waypoints=optimize:true|";

		for (var i = 0,
		    len = locations.length; i < len; i++) {
			paramUrl += locations[i].latitude + "," + locations[i].longitude;

			if (i < len - 1) {
				paramUrl += "|";
			}
		}

		return paramUrl;
	}
	var ortherParam = function() {
		return "avoid=tolls|highways|ferries&language=zh-TW";
	}
	var apiKeyParam = function() {
		return "key=" + googleKey;
	}
	var objectId = request.params.cartId;
	var HBShoppingCart = Parse.Object.extend("HBShoppingCart");
	var query = new Parse.Query(HBShoppingCart);
	query.get(objectId, {
		success : function(cart) {
			console.log("cartId: " + cart.id);

			Parse.Promise.when(findStoreInCarts(cart), findCustomerInCarts(cart)).then(function(storeInCarts, customerInCarts) {

				var eta = customerInCarts[0].get('ETA');
				if (storeInCarts.length == 1) {
					var customerLocation = customerInCarts[0].get('location');
					var storeLocation = storeInCarts[0].get("store").get("geoLocation");

					var url = createHttpUrl([originParam(storeLocation), destinationParam(customerLocation)]);
					console.log("google url:" + url);

					Parse.Cloud.httpRequest({
						url : url,
						success : function(directions) {
							var obj = JSON.parse(directions.text);
							//console.log("obj:" + JSON.stringify(obj));
							
							var leg = directions.data['routes'][0]['legs'][0];
							var duration = parseInt(leg['duration']['value']);
							
							console.log("duration:" + duration);
							var duration2 = obj.routes[0].legs[0].duration.value;
							console.log("duration2:" + duration2);
							
							var interval = parseInt(duration / (5 * 60)) + 2;
							var etd = new Date(eta.getTime() - interval * 5 * 60 * 1000);
							storeInCarts[0].set('ETD', etd);
							
							cart.set('ETD', etd);
							Parse.Promise.when(cart.save()).then(function() {
								storeInCarts[0].save({
									success : function(object) {
										console.log("save success!");
										response.success("success");
									},error : function(error) {
										response.error(error);
									}
								});
							});
							
						},
						error : function(error) {
							response.error(error);
						}
					});

				} else {
					console.log("多個店家");
					var promises = [];
					var requestUrl = [];
					var maxDistance = 0;
					var maxIndex = 0;
					//storeInCarts.forEach(function(storeInCart, index, array) {

						var urla = createHttpUrl([originParam(storeInCart.get("store").get("geoLocation")), destinationParam(customerInCarts[0].get('location'))]);
						console.log(index +". url:" + url);
						var promise = Parse.Cloud.httpRequest({
								url : urla,
								success : function(directions) {
									var obj = JSON.parse(directions.text);
									
									var currentDistance = obj.routes[0].legs[0].distance.value;
									console.log("currentDistance:" + currentDistance);
									if (currentDistance > maxDistance) {
										maxDistance = currentDistance;
										maxIndex = idx;
									}
								},
								error : function(error) {
									response.error(error);
								}
							});
							
						var urlb = createHttpUrl([originParam(storeInCart.get("store").get("geoLocation")), destinationParam(customerInCarts[1].get('location'))]);
						var promise = Parse.Cloud.httpRequest({
								url : urlb,
								success : function(directions) {
									var obj = JSON.parse(directions.text);
									
									var currentDistance = obj.routes[0].legs[0].distance.value;
									console.log("currentDistance:" + currentDistance);
									if (currentDistance > maxDistance) {
										maxDistance = currentDistance;
										maxIndex = idx;
									}
								},
								error : function(error) {
									response.error(error);
								}
							});
							
						var urlc = createHttpUrl([originParam(storeInCart.get("store").get("geoLocation")), destinationParam(customerInCarts[2].get('location'))]);
						var promise = Parse.Cloud.httpRequest({
								url : urlc,
								success : function(directions) {
									var obj = JSON.parse(directions.text);
									
									var currentDistance = obj.routes[0].legs[0].distance.value;
									console.log("currentDistance:" + currentDistance);
									if (currentDistance > maxDistance) {
										maxDistance = currentDistance;
										maxIndex = idx;
									}
								},
								error : function(error) {
									response.error(error);
								}
							});
							
						//var p = Parse.Cloud.httpRequest({
						//	url : url
						//});

						//promises.push(p);
					//});
					
					
					
					console.log("start Promises in Series");
					response.success("success");
					/*
					var maxDistance = 0;
					var maxIndex = 0;
					var promise = Parse.Promise.as();
				  	_.each(requestUrl, function(aUrl, idx) {
				  		console.log("A111:" + aUrl);
				  		
						promise = promise.then(function() {
								Parse.Cloud.httpRequest({
									url : aUrl,
									success : function(directions) {
										var obj = JSON.parse(directions.text);
										
										var currentDistance = obj.routes[0].legs[0].distance.value;
										console.log("currentDistance:" + currentDistance);
										if (currentDistance > maxDistance) {
											maxDistance = currentDistance;
											maxIndex = idx;
										}
									},
									error : function(error) {
										response.error(error);
									}
								}); 
							
							});
					    
					});
					
					console.log("BBBB");
					
					
					
					Parse.Promise.when(promise).then(function() {
					//Parse.Promise.when(promises).then(function() {
						//console.log("results=" + JSON.parse(results));
						
						var wayPoints = [];
						var wayPointsRefference = [];
						storeInCarts.forEach(function(storeInCart, index, array) {
							if (index !== maxIndex) {
								wayPoints.push(storeInCart.get("store").get("geoLocation"));
								wayPointsRefference.push(storeInCart);
							}
						});
						console.log("promises done3." + new Date());
						var url = createHttpUrl([originParam(storeInCarts[maxIndex].get("store").get("geoLocation")), destinationParam(customerInCarts[0].get('location')), waypointsParam(wayPoints)]);
						console.log("promises done4." + new Date());
						console.log("url B:" + url);

						Parse.Cloud.httpRequest({
							url : url,
							success : function(directions) {
								
								var legs = directions.data['routes'][0]['legs'];
								var waypointOrder = directions.data['routes'][0]['waypoint_order'];
								var etd = new Date(eta.getTime() - 5 * 60 * 1000);
								var saveStoreInCarts = [];

								for (var i = waypointOrder.length - 1,
								    legsIndex = legs.length - 1; i >= 0; i--, legsIndex--) {

									var duration = legs[legsIndex]['duration']['value'];
									var interval = parseInt(duration / (5 * 60)) + 1;
									etd = new Date(etd.getTime() - interval * 5 * 60 * 1000);

									var storeInCart = wayPointsRefference[waypointOrder[i]];
									storeInCart.set('ETD', etd);

									saveStoreInCarts.push(storeInCart);
								}

								var duration = legs[0]['duration']['value'];
								var interval = parseInt(duration / (5 * 60)) + 1;
								etd = new Date(etd.getTime() - interval * 5 * 60 * 1000);

								var storeInCart = storeInCarts[maxIndex];
								storeInCart.set('ETD', etd);

								saveStoreInCarts.push(storeInCart);
							
								cart.set('ETD', etd);
								Parse.Promise.when(cart.save()).then(function() {
									Parse.Object.saveAll(saveStoreInCarts, {
										success : function(list) {
											response.success("success");
										},
										error : function(error) {
											response.success("error");
										},
									});
								});


								// Parse.Object.saveAll(saveStoreInCarts, {
									// success : function(list) {
										// response.success("success");
									// },
									// error : function(error) {
										// response.success("error");
									// },
								// });

							},
							error : function(error) {
								response.error(error);
							}
						});

					});
					*/
				}

			});

		},
		error : function(error) {
			response.error(error);
		}
	});
});