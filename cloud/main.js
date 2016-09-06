

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hello heroku');
});

//
Parse.Cloud.define("getFoodStore", function(request, response) {
	response.success ("food store")
});