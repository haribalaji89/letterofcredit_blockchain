'use strict';
/*******************************************************************************
 * Copyright (c) 2015 IBM Corp.
 *
 * All rights reserved.
 *
 * This module provides wrappers for the operations on chaincode that this demo
 * needs to perform.
 *
 * Contributors:
 *   Dale Avery - Initial implementation
 *
 * Created by davery on 11/8/2016.
 *******************************************************************************/

// For logging
var TAG = 'chaincode_ops:';

var async = require('async');

/**
 * A helper object for interacting with the commercial paper chaincode.  Has functions for all of the query and invoke
 * functions that are present in the chaincode.
 * @param chain A configured hfc chain object.
 * @param chaincodeID The ID returned in the deploy request for this chaincode.
 * @constructor
 */
function CPChaincode(chain, chaincodeID) {
    if(!(chain && chaincodeID))
        throw new Error('Cannot create chaincode helper without both a chain object and the chaincode ID!');
    this.chain = chain;
    this.chaincodeID = chaincodeID;

    // Add an optional queue for processing chaincode related tasks.  Prevents "timer start called twice" errors from
    // the SDK by only processing one request at a time.
    this.queue = async.queue(function(task, callback) {
        task(callback);
    }, 1);
}
module.exports.CPChaincode = CPChaincode;

/**
 * Query the chaincode for the given account.
 * @param enrollID The user that the query should be submitted through.
 * @param company The name of the company we want the account info for.
 * @param cb A callback of the form: function(error, company_data)
 */
CPChaincode.prototype.login = function(enrollID, username, password, cb) {
    console.log(TAG, 'issue login request:', username);

    var loginRequest = {
        chaincodeID: this.chaincodeID,
        fcn: 'login',
        args: [username, password]
    };

    query(this.chain, enrollID, loginRequest, function(err, user) {
        cb(err, user);
    });
};


CPChaincode.prototype.createLC = function(enrollID, lc, cb) {
    console.log(TAG, 'creating a new LC');

    // LC information will be generated by the UI
    var createLCRequest = {
        chaincodeID: this.chaincodeID,
        fcn: 'createLC',
        args: [JSON.stringify(lc)]
    };

    invoke(this.chain, enrollID, createLCRequest, function(err, result) {
        if(err) {
            console.error(TAG, 'failed to create LC:', err);
            return cb(err);
        }

        console.log(TAG, 'Created LC successfully:', result.toString());
        cb(null, result);
    });
};


CPChaincode.prototype.uploadDocument = function(enrollID, shipmentId, fileName, docBase64Str, cb) {
    console.log(TAG, 'uploading document');

    // LC information will be generated by the UI
    var uploadDocRequest = {
        chaincodeID: this.chaincodeID,
        fcn: 'uploadDocument',
        args: [shipmentId, fileName, docBase64Str]
    };

    invoke(this.chain, enrollID, uploadDocRequest, function(err, result) {
        if(err) {
            console.error(TAG, 'failed to upload doc:', err);
            return cb(err);
        }

        console.log(TAG, 'Uploaded doc successfully:', fileName);
        cb(null, result);
    });
};

CPChaincode.prototype.fileView = function(enrollID, shipmentId, fileName, cb) {
    console.log(TAG, 'getting fileView');

    // Accounts will be named after the enrolled users
    var getFileview = {
        chaincodeID: this.chaincodeID,
        fcn: 'fileView',
        args: [shipmentId, fileName]
    };

    query(this.chain, enrollID, getFileview, function(err, papers) {

        if(err) {
            console.error(TAG, 'failed to getFileview:', err);
            return cb(err);
        }

        console.log(TAG, 'got Fileview');
        cb(null, papers);
    });
};

CPChaincode.prototype.uploadDocument = function(enrollID, shipmentId, fileName, docBase64Str, cb) {
    console.log(TAG, 'uploading document');

    // LC information will be generated by the UI
    var uploadDocRequest = {
        chaincodeID: this.chaincodeID,
        fcn: 'uploadDocument',
        args: [shipmentId, fileName, docBase64Str]
    };

    invoke(this.chain, enrollID, uploadDocRequest, function(err, result) {
        if(err) {
            console.error(TAG, 'failed to upload doc:', err);
            return cb(err);
        }

        console.log(TAG, 'Uploaded doc successfully:', result.toString());
        cb(null, result);
    });
};


/**
 * Query the chaincode for the full list of commercial papers.
 * @param enrollID The user that the query should be submitted through.
 * @param cb A callback of the form: function(error, commercial_papers)
 */
CPChaincode.prototype.getPapers = function(enrollID, cb) {
    console.log(TAG, 'getting commercial papers');

    // Accounts will be named after the enrolled users
    var getPapersRequest = {
        chaincodeID: this.chaincodeID,
        fcn: 'GetAllCPs',
        args: [enrollID]
    };

    query(this.chain, enrollID, getPapersRequest, function(err, papers) {

        if(err) {
            console.error(TAG, 'failed to getPapers:', err);
            return cb(err);
        }

        console.log(TAG, 'got papers');
        cb(null, papers.toString());
    });
};

/**
 * Helper function for invoking chaincode using the hfc SDK.
 * @param chain A hfc chain object representing our network.
 * @param enrollID The enrollID for the user we should use to submit the invoke request.
 * @param requestBody A valid hfc invoke request object.
 * @param cb A callback of the form: function(error, invoke_result)
 */
function invoke(chain, enrollID, requestBody, cb) {

    // Submit the invoke transaction as the given user
    console.log(TAG, 'Invoke transaction as:', enrollID);
    chain.getMember(enrollID, function (getMemberError, usr) {
        if (getMemberError) {
            console.error(TAG, 'failed to get ' + enrollID + ' member:', getMemberError.message);
            if (cb) cb(getMemberError);
        } else {
        	var txHash;
        	var eh = chain.getEventHub();
            console.log(TAG, 'successfully got member:', enrollID);

            console.log(TAG, 'invoke body:', JSON.stringify(requestBody));
            var invokeTx = usr.invoke(requestBody);

            // Print the invoke results
            invokeTx.on('completed', function (results) {
                // Invoke transaction submitted successfully
                console.log(TAG, 'Successfully completed invoke. Results:', results);
                cb(null, results);
            });
            invokeTx.on('submitted', function (results) {
                // Invoke transaction submitted successfully
                console.log(TAG, 'invoke submitted');
                txHash = results.uuid;
                cb(null, results);
            });
            invokeTx.on('error', function (err) {
                // Invoke transaction submission failed
                console.log(TAG, 'invoke failed. Error:', err);
                cb(err);
            });
            
          //Listen to custom events
            var regid = eh.registerChaincodeEvent(requestBody.chaincodeID, "invokeEvt", function(event) {
              console.log(util.format("Custom event received, payload: %j\n", event.payload.toString()));

              if(event.payload.toString().indexOf("Error") >= 0){
                let uuid = event.payload.toString().split(".")[1];
                if(uuid === txHash){ //resolve promise only when the current transaction has finished
                  eh.unregisterChaincodeEvent(regid);
                  cb(event.payload.toString());
                }
              } else {
                  let uuid = event.payload.toString().split(".")[1];
                  console.log("\nUUID " + uuid);
                  console.log("\ntxHash " + txHash);
                  if(uuid === txHash) { //resolve promise only when the current transaction has finished
                    eh.unregisterChaincodeEvent(regid);
                    cb(null, event.payload.toString());
                  }
              }
            });
        }
    });
}

/**
 * Helper function for querying chaincode using the hfc SDK.
 * @param chain A hfc chain object representing our network.
 * @param enrollID The enrollID for the user we should use to submit the query request.
 * @param requestBody A valid hfc query request object.
 * @param cb A callback of the form: function(error, queried_data)
 */
function query(chain, enrollID, requestBody, cb) {

    // Submit the invoke transaction as the given user
    console.log(TAG, 'querying chaincode as:', enrollID);
    chain.getMember(enrollID, function (getMemberError, usr) {
        if (getMemberError) {
            console.error(TAG, 'failed to get ' + enrollID + ' member:', getMemberError.message);
            if (cb) cb(getMemberError);
        } else {
            console.log(TAG, 'successfully got member:', enrollID);

            console.log(TAG, 'query body:', JSON.stringify(requestBody));
            var queryTx = usr.query(requestBody);

            queryTx.on('complete', function (results) {
                console.log(TAG, 'Successfully completed query. Results:', results);
                cb(null, results.result);
            });
            queryTx.on('error', function (err) {
                console.log(TAG, 'query failed. Error:', err);
                cb(err);
            });
        }
    });
}