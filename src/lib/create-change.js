const core = require('@actions/core');
const axios = require('axios');

async function createChange({
    instanceUrl,
    toolId,
    username,
    passwd,
    token,
    jobname,
    githubContextStr,
    changeRequestDetailsStr,
    deploymentGateStr
}) {

    console.log('Calling Change Control API to create change....');

    let changeRequestDetails;
    let deploymentGateDetails;
    let githubContext;
    let payload;
    let postendpoint = '';
    let response;
    let status = false;

    try {
        changeRequestDetails = JSON.parse(changeRequestDetailsStr);
    } catch (e) {
        console.log(`Error occured with message ${e}`);
        throw new Error("Failed parsing changeRequestDetails");
    }

    try {
        if (deploymentGateStr)
            deploymentGateDetails = JSON.parse(deploymentGateStr);
    } catch (e) {
        console.log(`Error occured with message ${e}`);
        throw new Error("Failed parsing deploymentGateDetails");
    }

    try {
        githubContext = JSON.parse(githubContextStr);
        console.log(`sarahTest message ${githubContextStr}`);
    } catch (e) {
        console.log(`Error occured with message ${e}`);
        throw new Error("Exception parsing github context");
    }

    try {
        payload = {
            'toolId': toolId,
            'stageName': jobname,
            'buildNumber': `${githubContext.run_id}`,
            'attemptNumber': `${githubContext.run_attempt}`,
            'sha': `${githubContext.sha}`,
            'action': 'customChange',
            'workflow': `${githubContext.workflow}`,
            'repository': `${githubContext.repository}`,
            'branchName': `${githubContext.ref_name}`,
            'changeRequestDetails': changeRequestDetails
        };
        if (deploymentGateStr) {
            payload.deploymentGateDetails = deploymentGateDetails;
        }
    } catch (err) {
        console.log(`Error occured with message ${err}`);
        throw new Error("Exception preparing payload");
    }

    if (token === '' && username === '' && passwd === '') {
        throw new Error('Either secret token or integration username, password is needed for integration user authentication');
    }
    else if (token !== '') {
        postendpoint = `${instanceUrl}/api/sn_devops/v2/devops/orchestration/changeControl?toolId=${toolId}&toolType=github_server`;
        const defaultHeadersForToken = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'sn_devops.DevOpsToken ' + `${toolId}:${token}`
        };
        httpHeaders = { headers: defaultHeadersForToken };
    }
    else if (username !== '' && passwd !== '') {
        postendpoint = `${instanceUrl}/api/sn_devops/v1/devops/orchestration/changeControl?toolId=${toolId}&toolType=github_server`;
        const tokenBasicAuth = `${username}:${passwd}`;
        const encodedTokenForBasicAuth = Buffer.from(tokenBasicAuth).toString('base64');

        const defaultHeadersForBasicAuth = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Basic ' + `${encodedTokenForBasicAuth}`
        };
        httpHeaders = { headers: defaultHeadersForBasicAuth };
    }
    else {
        throw new Error('For Basic Auth, Username and Password is mandatory for integration user authentication');
    }
    
    core.debug("[ServiceNow DevOps], Sending Request for Create Change, Request Header :" + JSON.stringify(httpHeaders) + ", Payload :" + JSON.stringify(payload) + "\n");
    try {
        response = await axios.post(postendpoint, JSON.stringify(payload), httpHeaders);
        status = true;
    } catch (err) {
        if (err.code === 'ECONNABORTED') {
            throw new Error(`change creation timeout after ${err.config.timeout}s`);
        }

        if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
            throw new Error('Invalid ServiceNow Instance URL. Please correct the URL and try again.');
        }

        if (err.message.includes('401')) {
            throw new Error('Invalid Credentials. Please correct the credentials and try again.');
        }

        if (err.message.includes('405')) {
            throw new Error('Response Code from ServiceNow is 405. Please correct ServiceNow logs for more details.');
        }

        if (!err.response) {
            throw new Error('No response from ServiceNow. Please check ServiceNow logs for more details.');
        }

        if (err.response.status == 500) {
            throw new Error('Response Code from ServiceNow is 500. Please check ServiceNow logs for more details.')
        }

        if (err.response.status == 400) {
            let errMsg = 'ServiceNow DevOps Change is not created. Please check ServiceNow logs for more details.';
            let responseData = err.response.data;
            if (responseData && responseData.error && responseData.error.message) {
                errMsg = responseData.error.message;
            } else if (responseData && responseData.result) {
                let result = responseData.result;
                if (result.details && result.details.errors) {
                    errMsg = 'ServiceNow DevOps Change is not created. ';
                    let errors = err.response.data.result.details.errors;
                    for (var index in errors) {
                        errMsg = errMsg + errors[index].message;
                    }
                    }
                else if (result.errorMessage) {
                    errMsg = result.errorMessage;
                }
            }

            throw new Error(errMsg);
        }
    }
    if (status) {
        var result = response.data.result;
        if (result && result.status == "Success") {
            if(result.message)
                console.log('\n     \x1b[1m\x1b[36m' + result.message + '\x1b[0m\x1b[0m');
            else
                console.log('\n     \x1b[1m\x1b[36m' + "The job is under change control. A callback request is created and polling has been started to retrieve the change info." + '\x1b[0m\x1b[0m');
        }
    }
}
module.exports = { createChange };
