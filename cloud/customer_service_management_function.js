// JavaScript source code

//var createObjectById = function (className, id) {
//    return Parse.Object.extend(className).createWithoutData(id);
//}

Parse.Cloud.define("updateBeeProfile", function (request, response) {
    Parse.Cloud.useMasterKey();

    var query = new Parse.Query(Parse.User);
    query.get(request.params.id, {
        success: function (bee) {
            bee.set('contact', request.params.contact);
            bee.set('licenseNo', request.params.licenseNo);
            bee.set('phone', request.params.phone);
            bee.set('email', request.params.email);
            bee.set('bankCode', request.params.bankCode);
            bee.set('bankAccount', request.params.bankAccount);
            bee.set('haveCar', request.params.haveCar);
            bee.set('delivering', request.params.delivering);
            bee.set('qualify', request.params.qualify);
            bee.set('applyBee', request.params.applyBee);
            bee.set('beeRemark', request.params.remark);
            bee.set('qualifyAt', request.params.qualifyAt);
            bee.save(null, {
                success: function (bee) {
                    response.success(true);
                    // Execute any logic that should take place after the object is saved.
                    //alert('New object created with objectId: ' + bee.id);
                },
                error: function (bee, error) {
                    response.error(error);
                    // Execute any logic that should take place if the save fails.
                    // error is a Parse.Error with an error code and message.
                    //alert('Failed to create new object, with error code: ' + error.message);
                }
            });

        }, error: function (error) {
            response.error(error);
        }
    });

});

//
Parse.Cloud.define("updateUserProfile", function (request, response) {
    Parse.Cloud.useMasterKey();

    var query = new Parse.Query(Parse.User);
    query.get(request.params.userId, {
        success: function (user) {
        	var secretPasswordToken = 'eebyrgnuh';
        	var min = 100000; 
        	var max = 999999;
			var num = Math.floor(Math.random() * (max - min + 1)) + min;
		
            user.set("bypass", request.params.bypass);
            if(request.params.bypass) {
            	user.setPassword(secretPasswordToken + num);
            }
            user.save(null, {
                success: function (bee) {
                	if(request.params.bypass) {
                		response.success(num);	
                	} else {
                		response.success("");	
                	}
                },
                error: function (bee, error) {
                    response.error(error);
                }
            });
        }, error: function (error) {
            response.error(error);
        }
    });

});

    Parse.Cloud.define("getUserInstallation", function (request, response) {
        console.log("getUserInstallation");
        Parse.Cloud.useMasterKey();

        var query = new Parse.Query(Parse.User);
        query.get(request.params.userId, {
            success: function (user) {

                var sessionQuery = new Parse.Query(Parse.Session);
                sessionQuery.equalTo("user", user);
                sessionQuery.descending("createdAt");
                sessionQuery.first({
                    success: function (session) {
                        if (session != null) {
                            var installationQuery = new Parse.Query(Parse.Installation);
                            installationQuery.equalTo("installationId", session.get("installationId"));
                            installationQuery.first({
                                success: function (install) {
                                    response.success(install);
                                },error: function (e) {
                                    response.error(e);
                                }
                            });

                        }else{
                            response.success(null);
                        }

                    },error:function(e){
                        response.error(e);
                    }

                });
            },error: function(e){
                response.error(e);
            }
        });
    });
