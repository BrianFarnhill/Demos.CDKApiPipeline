var synthetics = require('Synthetics');
const log = require('SyntheticsLogger');

const apiCanary = async function () {

    // Handle validation for positive scenario
    const validateSuccessfull = async function (res) {
        return new Promise((resolve, reject) => {
            if (res.statusCode < 200 || res.statusCode > 299) {
                throw res.statusCode + ' ' + res.statusMessage;
            }

            let responseBody = '';
            res.on('data', (d) => {
                responseBody += d;
            });

            res.on('end', () => {
                // Add validation on 'responseBody' here if required.
                resolve();
            });
        });
    };

    // Handle validation for positive scenario
    const validateForbidden = async function (res) {
        return new Promise((resolve, reject) => {
            if (res.statusCode !== 403) {
                throw res.statusCode + ' ' + res.statusMessage;
            }

            let responseBody = '';
            res.on('data', (d) => {
                responseBody += d;
            });

            res.on('end', () => {
                resolve();
            });
        });
    };

    let commonProps = {
        hostname: process.env.CANARY_HOSTNAME,
        method: 'GET',
        protocol: 'https:',
        port: '443',
        region: process.env.AWS_REGION,
        body:  "",
        headers: {
            "User-Agent": synthetics.getCanaryUserAgentString(),
        },
    }
    let allConfig = {
        includeRequestHeaders: true,
        includeResponseHeaders: true,
        includeRequestBody: true,
        includeResponseBody: false,
        restrictedHeaders: ["authorization", "x-amz-security-token"],
        continueOnHttpStepFailure: true
    };

    await synthetics.executeHttpStep('Verify valid request allowed', {
        ...commonProps,
        path: '/prod',
    }, validateSuccessfull, allConfig);

    await synthetics.executeHttpStep('Verify WAF blocks path traversal attempt', {
        ...commonProps,
        path: '/prod?path=../../traversaldemo',
    }, validateForbidden, allConfig);
};

exports.handler = async () => {
    return await apiCanary();
};