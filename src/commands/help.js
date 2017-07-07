'use strict';
/******************************************************************************
 * MIT License
 * Copyright (c) 2017 https://github.com/vroomlabs
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Created by vroomlabs on 7/2/17.
 ******************************************************************************/

module.exports = async function help() {
    process.stdout.write(
`******************************************************************************
gsdk-deploy
******************************************************************************
Usage:
  gsdk-deploy [command-name] -build=[build-name] (-arg=value ...)

Commands:
  test-config   - Light check on configuration 
  full-deploy   - Normal full deployment, create clusters, networks, etc
                  *optional (user/build) -image=[local docker tag name]
  list-images   - Display the list of docker tags from related repo 
  kube-images   - Display the images running in kube for each cluster
  kube-history  - Display kube rollout history for each clusters
  kube-status   - Display the current rollout status for each cluster
  kube-rollback - Perform a kube rollback for each cluster
  deploy-api    - Deploy only the Google Endpoints API configuration
  deploy-tag    - Update to a specific docker image tag name in each cluster
                  *requires -tag=[docker tag name from repo]
  deploy-image  - Update to a specific docker image uri in each cluster
                  *requires -image=[full uri and tag]
  remove-deployment - Removes kubernetes deployment and load balancer

Arguments:
  -branch       - REQUIRED: name of config section from configuration file
  -config       - Relative path to a yaml configuration file
  -auth-env     - The name of an environment variable with base64 json auth
  -auth-file    - Relative path to json authentication file
  -artifacts    - Relative path to an existing directory to store artifacts
  -log          - Specifies log console level (warn,info,debug,verbose,silly) 

Environment:
  - Most configuration values can be substituted at runtime via $(NAME)
  - GCLOUD_COMMAND, DOCKER_COMMAND, and KUBECTL_COMMAND will control the  
    command-line to these commands.
    for example: export GCLOUD_COMMAND=sudo /opt/gsdk/gcloud
  - AUTO_UPDATE_SDK set to 'true' to auto-upgrade gcloud sdk
  - The following variables are defined at runtime:
    - BRANCH - value of the -branch= argument
    - ENDPOINT_NAME - value of the endpoints api name
    - ENDPOINT_VERSION - value of the endpoints api version
    - ARTIFACTS - folder for build artifacts and log files
    - BUILD_TIME - full build timestamp in yyyy-MM-ddThh-mm-ss-sssZ
    - SERVICE_NAME - the name of the service from deploy.yaml
    - GCLOUD_PROJECT - the name of the google project from deploy.yaml
    - HOSTNAME - the host value from the deploy.yaml file
    - NODE_PORT - the configured or generated port for the kube service
******************************************************************************
`);
};
