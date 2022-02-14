const express = require("express");
const cors = require("cors");
const { join } = require("path");
const morgan = require("morgan");
const helmet = require("helmet");
const app = express();
//Allow Express to decode body
const bodyParser = require('body-parser');
//Importing the Auth0 required OAuth library as well as the JSON containing the Auth0 authentication credentials
const { auth } = require("express-oauth2-jwt-bearer");
const { requiredScopes } = require('express-oauth2-jwt-bearer');
//Allow us to decode the JWT and get the user id
const jwt_decode = require('jwt-decode');
const authConfig = require("./auth_config.json");
const { token } = require("morgan");
// create the JWT middleware
const checkJwt = auth({
  audience: authConfig.audience,
  issuerBaseURL: `https://${authConfig.domain}`
});
//Check the scope
const checkOrderScope = requiredScopes("update:orders");

//Create the Auth0 Authentication Client
var AuthenticationClient = require('auth0').AuthenticationClient;
//Initialize the Authentication client
var auth0Client = new AuthenticationClient({
  domain: authConfig.domain,
  clientId: authConfig.appClientID,
  clientSecret: authConfig.appClientSecret,
  scope: 'read:users update:users_app_metadata'
});
let managementAPIToken = null;
//Grant management API scopes to the authentication client
auth0Client.clientCredentialsGrant(
  {
    audience: 'https://dev-q4iv.us.auth0.com/api/v2/',
    scope: 'read:users update:users_app_metadata',
  },
  function (err, response) {
    if (err) {
      console.log(err);
    }
    managementAPIToken = response.access_token;
  }
); 

//Initialize the Management Client
var ManagementClient = require('auth0').ManagementClient;
var auth0ManagementClient = new ManagementClient({
  domain: authConfig.domain,
  clientId: authConfig.appClientID,
  clientSecret: authConfig.appClientSecret,
  scope: 'read:users update:users_app_metadata'
});

app.use(morgan("dev"));
app.use(helmet());
app.use(express.static(join(__dirname, "public")));
app.use(bodyParser.json());
app.use(express.json());

//Error handler for the API
app.use(function(err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    return res.status(401).send({ msg: "Invalid token" });
  }

  next(err, req, res);
});

//Handles CORS
app.use(cors({ origin: "https://pizza42poc.herokuapp.com"}))


//Adding a new route to support the custom API in the POC tenant
app.get("/api/external", checkJwt, (req, res) => {
  res.send({
    msg: "Your access token was successfully validated!"
  });
});

//Adding a new route to place orders
app.post("/api/order", checkJwt, checkOrderScope, (req, res) => {
  
    var authHeader = req.headers['authorization'];
    var token = authHeader && authHeader.split(' ')[1];
    auth0Client.getProfile(token).then(function(userInfo) {
      var emailVerified = userInfo.email_verified;
      console.log("User Info Email Verified", emailVerified);
      if(emailVerified)
      {
        var orderHistory = userInfo["https://pizza42poc.herokuapp.com/orderhistory"];
        orderHistory.push(req.body.orderToPlace);
        var params = {id: userInfo.sub};
        console.log("Params", params);
        var metadata = {order_history: orderHistory};
        console.log("Metadata", metadata);
        auth0ManagementClient.updateAppMetadata(params, metadata);
        res.send({
          msg: "Your order was successfully placed!"
        });
      }
      else{
        res.send({
        msg: "Please verify your email before placing an order."
        }); 
      }
    });
});

app.get("/auth_config.json", (req, res) => {
  res.sendFile(join(__dirname, "auth_config.json"));
});

app.get("/*", (_, res) => {
  res.sendFile(join(__dirname, "index.html"));
});

process.on("SIGINT", function() {
  process.exit();
});

module.exports = app;
function newFunction(userProfile) {
  emailVerified = userProfile.email_verified;
}

