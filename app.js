/*eslint-env node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');
var bodyParser = require('body-parser');
var request = require('request');
var cloudantDb = require('cloudant');
// create a new express server
var app = express();

//var port  = process.env.PORT || 3001;
// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//To Store URL of Cloudant VCAP Services as found under environment variables on from App Overview page
var cloudant_url;
//var services = JSON.parse(process.env.VCAP_SERVICES || "{}");
// Check if services are bound to your project
if(process.env.VCAP_SERVICES)
{
 var services = JSON.parse(process.env.VCAP_SERVICES);
	if(services['cloudantNoSQLDB']) //Check if cloudantNoSQLDB service is bound to your project
	{
		cloudant_url = services['cloudantNoSQLDB'][0]['credentials'];  //Get URL and other paramters
	//console.log("Name = " + services.cloudantNoSQLDB Dedicated[0].name);
	//	console.log("URL = " + services.cloudantNoSQLDB Dedicated[0].credentials.url);
      // console.log("username = " + services.cloudantNoSQLDB Dedicated[0].credentials.username);
	//console.log("password = " + services.cloudantNoSQLDB Dedicated[0].credentials.password);
	}
}

//Connect using cloudant npm and URL obtained from previous step
var cloudant = cloudantDb({url: cloudant_url.url});
//Edit this variable value to change name of database.
var dbname = 'user_database';
var db;

//Create database
cloudant.db.create(dbname, function(err, data) {
  	if(err) //If database already exists
	    console.log("Database exists. Error : ", err); //NOTE: A Database can be created through the GUI interface as well
  	else
	    console.log("Created database.");

  	//Use the database for further operations like create view, update doc., read doc., delete doc. etc, by assigning dbname to db.
  	db = cloudant.db.use(dbname);
    //Create a design document. It stores the structure of the database and contains the design and map of views too
    //A design doc. referred by _id = "_design/<any name your choose>"
    //A view is used to limit the amount of data returned
    //A design document is similar to inserting any other document, except _id starts with _design/.
    //Name of the view and database are the same. It can be changed if desired.
    //This view returns (i.e. emits) the id, revision number and new_city_name variable of all documents in the DB
  	db.insert(
	 {
		  	_id: "_design/user_database",
		    views: {
	  				  "user_database":
	  				   {
	      					"map": "function (doc) {\n  emit(doc._id, [doc._rev, doc.userId,doc.firstName,doc.lastName]);\n}"
	    			   }
      	   		   }
     },
	 function(err, data) {
	    	if(err)
	    			console.log("View already exsits. Error: ", err); //NOTE: A View can be created through the GUI interface as well
	    	else
	    		console.log("wearable_database view has been created");
	 });

});

app.get('/addUser/:userid', function(req, res){
	console.log("userid to be added : = " + req.params.userid);
	req.query.userId = req.params.userid.toUpperCase(); //convert to uppercase and trim white space before inserting
	req.query.userId = req.query.userId.trim();
	req.query.firstName="abc";
	req.query.lastName="def";
	console.log("query : = " + req.query.userId);
	//Search through the DB completely to check for duplicate name, before adding a new name
	var url = cloudant_url.url + "/user_database/_design/user_database/_view/user_database";
	var userId_present = 0; //flag variable for checking if name is already present before inserting
	var userId_string; //variable to store update for front end.

	//In this case, check if the ID is already present, else, insert a new document
	request({
			 url: url,
			 json: true
			}, function (error, response, body) {
		if (!error && response.statusCode === 200)
		{
			//Check if current input is present in the table, else add. If present then return with error message
			var user_data = body.rows;
			console.log("length of table: " + user_data.length);
			var loop_len = user_data.length;
			for(var i=0; i< loop_len; i++)
			{
				var doc = user_data[i];
				console.log("in Db : " + doc.value[1]);
				if(req.query.userId === doc.value[1])
				{
					userId_present = 1;
					break;
				}
			}
			if(userId_present === 0) //if city is not already in the list
			{
				db.insert(req.query, function(err, data){
					if (!err)
					{
						console.log("Added new name");
						userId_string="{\"message\":\"Success\"}";
						res.contentType('application/json'); //res.contentType and res.send is added inside every block as code returns immediately
						res.send(JSON.parse(userId_string));
					}
					else
					{
						console.log("Error inserting into DB " + err);
						userId_string="{\"message\":\"DB insert error\"}";
						res.contentType('application/json');
						res.send(JSON.parse(userId_string));

					}
				});
		    }
			else
			{
				console.log("UserId is already present");
				userId_string="{\"message\":\"UserId is already present\"}";
				res.contentType('application/json');
				res.send(JSON.parse(userId_string));
			}
		}
		else
		{
			console.log("No data from URL. Response : ");
			userId_string="{\"message\":\"DB read error\"}";
			res.contentType('application/json');
			res.send(JSON.parse(userId_string));
		}
	});
});


//To update the 'Read users' list
app.get('/getUser',function(req, res){
	console.log("getUser");
	var url = cloudant_url.url + "/user_database/_design/user_database/_view/user_database";
	request({
			 url: url, //'request' makes a call to API URL which in turn returns a JSON to the variable 'body'
			 json: true
			}, function (error, response, body) {
		if (!error && response.statusCode === 200)
		{
			var user_data = body.rows;  //body.rows contains an array of IDs, Revision numbers and Names from the view
			var list_of_users = '[';
			var users_array = [];

			for(var i=0; i< user_data.length; i++)
			{
				users_array.push(user_data[i].value[1]);
			}
			
			users_array.sort();
			for(var i=0; i<users_array.length; i++)
			{
				var name_JSON = '{\"userId\":\"' + users_array[i] + '\"}'; //create an array of names only
				if(i !== 0)
					list_of_users = list_of_users.concat(",");
				list_of_users = list_of_users.concat(name_JSON);
			}
			list_of_users = list_of_users.concat("]");
			res.contentType('application/json');
			console.log("Returning names");
			res.send(JSON.parse(list_of_users)); //return the list to front end for display
		}
		else
		{
			console.log("No data from URL");
			var msg_string="{\"message\":\"DB read error\"}"; //Send error message in case 'request' can't read database
			res.contentType('application/json');
			res.send(JSON.parse(msg_string));
		}
	});
});


app.get('/updateUser/:userid/:updateUserId',function(req, res){ 
	console.log("updateUser : " + req.params.userid);
	req.query.userId = req.params.userid.toUpperCase(); //convert to uppercase and trim white space before inserting
	req.query.userId = req.query.userId.trim();
	req.query.firstName="updateUser";
	req.query.lastName="updatelastname";
	req.query.updated_new_name=req.params.updateUserId.toUpperCase();
	req.query.updated_new_name = req.query.updated_new_name.trim();

	//Search through the DB completely to retrieve document ID and revision number
	var url = cloudant_url.url + "/user_database/_design/user_database/_view/user_database";
	var user_present = 0;
	request({
			 url: url, //url returns doc id, revision number and name for each document
			 json: true
			}, function (error, response, body) {
			if (!error && response.statusCode === 200)
			{
				var name_string;
				var user_data = body.rows;
				var id_to_remove; //for updating, document ID is essential.
				//Format remains the same as adding new user id, except that document ID needs to be added
				var rev_to_remove;
				var total_rows = user_data.length;
				for(var i=0; i< user_data.length; i++)
				{
					var doc = user_data[i];
					if(doc.value[1] === req.query.userId)
					{
						id_to_remove = doc.key;
						rev_to_remove = doc.value[0];
						
					}
					if(doc.value[1] === req.query.updated_new_name)
					{
						user_present = 1;
						break;
					}
				}
				//create a document object before updating, containing ID of the doc. that needs to be updated, revision number and new name
			    var string_to_update = "{\"userId\":\"" + req.query.updated_new_name + "\",\"_id\":\"" +id_to_remove+"\",\"_rev\":\"" + rev_to_remove + "\"}";
			    var update_obj = JSON.parse(string_to_update);
				//if update user is not equal to existing user and database isn't empty then update document, else print error message
				if(total_rows !== 0)
				{
					if(user_present === 0)
					{
						db.insert(update_obj, function(err, data)
						{
								if(!err)
								{
									console.log("Updated doc.");
									name_string="{\"updated\":\"updated\"}";
									res.contentType('application/json');//res.contentType and res.send is added inside every block as code returns immediately
									res.send(JSON.parse(name_string));
								}
								else
								{
									console.log("Couldn't update name " + err);
									name_string="{\"updated\":\"could not update\"}";
									res.contentType('application/json');
									res.send(JSON.parse(name_string));
								}
						});
					}
					else
					{
						console.log("Duplicate user");
						name_string="{\"updated\":\"No\"}";
						res.contentType('application/json');
						res.send(JSON.parse(name_string));
					}

				}
				else
				{
					console.log("DB is empty");
					var name_string="{\"updated\":\"empty database\"}";
					res.contentType('application/json');
					res.send(JSON.parse(name_string));
				}
			}
			else
			{
				console.log("No response from URL. Status : ");
				name_string="{\"updated\":\"DB read error\"}";
				res.contentType('application/json');
				res.send(JSON.parse(name_string));
			}
	});
});

app.get('/removeUser/:userid',function(req, res){ //to remove users
	console.log("removeUser : " );
	req.query.userId = req.params.userid.toUpperCase(); //convert to uppercase and trim white space before inserting
	req.query.userId = req.query.userId.trim();
	//Search through the DB completely to retrieve document ID and revision number
	var url = cloudant_url.url + "/user_database/_design/user_database/_view/user_database";
	request({
			 url: url, //url returns doc id, revision number and name for each document
			 json: true
			}, function (error, response, body) {
			if (!error && response.statusCode === 200)
			{
				var name_string;
				var user_data = body.rows;
				var id_to_remove;
				var rev_to_remove; //for removing, ID and revision number are essential.
				var total_rows = user_data.length;
				for(var i=0; i< user_data.length; i++)
				{
					var doc = user_data[i];
					if(doc.value[1] === req.query.userId)
					{
						id_to_remove = doc.key;
						rev_to_remove = doc.value[0];
						break;
					}
				}
				if(total_rows !== 0)
				{
				    db.destroy(id_to_remove, rev_to_remove, function(err)
				    {
						if(!err)
						{
							console.log("Removed name");
							name_string="{\"removed\":\"removed\"}";
							res.contentType('application/json');
							res.send(JSON.parse(name_string));
						}
						else
						{
							console.log("Couldn't remove name");
							console.log(err);
							name_string="{\"removed\":\"could not remove\"}";
							res.contentType('application/json');
							res.send(JSON.parse(name_string));
						}
					});

				}
				else
				{
					console.log("DB is empty");
					name_string="{\"removed\":\"empty database\"}";
					res.contentType('application/json');
					res.send(JSON.parse(name_string));
				}
			}
			else
			{
				console.log("No data from URL");
				console.log("Response is : " + response.statusCode);
				name_string="{\"removed\":\"DB read error\"}";
				res.contentType('application/json');
				res.send(JSON.parse(name_string));
			}
	});

});


// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
