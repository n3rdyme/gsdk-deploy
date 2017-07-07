# gsdk-deploy

This tool provides an automated deployment in your Google Cloud project using a combination of 
Docker, Kubernetes, Cloud Endpoints, Global Load Balancer, etc. It's intended for high-availablity 
deployments across Google Cloud regions while providing the simplicity of Google AppEngine deployment.

## Configuration:

A configuration file (yaml/json) is required to provide a minimum amount of information needed to deploy your image.
Each build type/configuration is represented by a root object. That object describes the parameters required to deploy
the service. Environment expansion is available in the following forms: `$PLAIN`, `$(PLAIN)`, `${PLAIN}`; however, this
can make it more difficult to run locally. You should prefer specifying the values under one build name and include that
in the other builds via the `extends` entry.

#### deploy.yaml

    # =============================================================================
    # = Deployment configuration
    # =============================================================================
    "dev":
      "name": "$(SERVICE_NAME)-$(BRANCH)"
      "google-project": "$GCLOUD_PROJECT"
      "host": "$(SERVICE_NAME)-$(BRANCH).example.com"
      "api-config": ["./service.pb", "./api_config.yaml"]
      "env":
        - name: NODE_ENV
          value: "$BRANCH"
        - name: "ENDPOINT_NAME"
        - name: "ENDPOINT_VERSION"
      "replicas": 2
      "clusters":
        - "us-central1-a"
    "prod":
      "extends": "dev"
      "clusters":
        - "us-central1-a"
        - "us-east4-c"
        - "us-west1-c"
    # =============================================================================

### Required Configuration Properites:

  * `google-project` - The Google Cloud Project you will be deploying to.
  * `name` - The name of the Kubernetes service to use
  * `host` - The hostname you will direct
  * `api-config` - An array of file names that describes your api (open-api or grpc)
  * `clusters` - An array of Kubernetes cluster names to use. These should either already exist, or simply include 
        the desired regional zone name anywhere in the text. Missing clusters will be created.

### Common Configuration Properites:

  * `extends` - Copy all settings from another build configuration.
  * `port` - default = `8080` The port number your container service listens on, defined as `NODE_PORT` inside the container.
  * `env` - A list of `{name,value}` pairs to use for the docker image, alternatively specify only a name to copy from current environment.
  * `replicas` - The number of pods you want to run in each region, usually 2 or more.
  * `nodePort` - A port number in the range of 30000-32767 that should be unique to the service. One will be generated from the name if not specified.
  * `livenessProbe` - default = `"/_ah/health"` The path of your service's health check.
  * `readinessProbe` - default = `"/_ah/health?isReady=true"` The path of your service's ready check.

There are other options available that can be discovered by the following command:

    gsdk-deploy -branch=dev test-config

## Prerequisites:

  1. First things first, you need a Google account, and a Cloud Project.
  3. This tool was written on and for a linux machine, so if you have issues on other environments please 
     feel free submit a pull request to address your specific operating system.
  2. Since this service configuration assumes end-to-end SSL, you will **need a certifcate that matches the
     hostname** from the configuration file you will provide. You can always generate a self-signed certificate
     for testing via the following command:
     
    openssl req -x509 -nodes -days 1825 -newkey rsa:2048 \
        -subj /C=US/ST=Delaware/L=Dover/O=ops/OU=dev/CN=example.org \
        -keyout _path_ -out _path_

## Usage:

Basic command-line tool invocation:

    sudo npm install -g @vroomlabs/gsdk-deploy
    gsdk-deploy [command-name] -build=[build-name] (-arg=value ...)

Alternatively you can run as a local dev-package:

    npm install @vroomlabs/gsdk-deploy --save-dev
    ./node_modules/.bin/gsdk-deploy [command-name] -build=[build-name] (-arg=value ...)

#### Full Deploy Example

    gsdk-deploy full-deploy --build=dev --image=user/build

## Commands:
  * `test-config`   - Light check on configuration 
  * `full-deploy`   - Normal full deployment, create clusters, networks, etc
                  *optional (user/build) `-image=[local docker tag name]`
  * `list-images`   - Display the list of docker tags from related repo 
  * `kube-images`   - Display the images running in kube for each cluster
  * `kube-history`  - Display kube rollout history for each clusters
  * `kube-status`   - Display the current rollout status for each cluster
  * `kube-rollback` - Perform a kube rollback for each cluster
  * `deploy-api`    - Deploy only the Google Endpoints API configuration
  * `deploy-tag`    - Update to a specific docker image tag name in each cluster
                  *required `-tag=[docker tag name from repo]`
  * `deploy-image`  - Update to a specific docker image uri in each cluster
                  *required `-image=[full uri and tag]`
  * `remove-deployment` - Removes kubernetes deployment and load balancer


## Arguments:
 * `-branch=[name]`       - *REQUIRED*: name of config section from configuration file
 * `-config=[path]`       - Relative path to a yaml configuration file
 * `-image=[name]`        - default = `user/build`, specifies a docker image locally or remote
 * `-auth-env=[name]`     - The name of an environment variable with base64 json auth
 * `-auth-file=[path]`    - Relative path to json authentication file
 * `-artifacts=[path]`    - Relative path to an existing directory to store artifacts
 * `-log=[level]`         - Specifies log console level (warn,info,debug,verbose,silly) 

Arguments may be specified with one or two dash prefixes `-` following the name and either `:` or `=` to separate the value.

## Environment:
  - Most configuration values can be substituted at runtime via $(NAME)
  - `GCLOUD_COMMAND`, `DOCKER_COMMAND`, and `KUBECTL_COMMAND` will control the command-line to these commands.
    for example: export `GCLOUD_COMMAND=sudo /opt/gsdk/gcloud`
  - `AUTO_UPDATE_SDK` set to `true` to auto-upgrade gcloud sdk
  - The following variables are defined at runtime:
    - `BRANCH` - value of the -branch= argument
    - `ENDPOINT_NAME` - value of the endpoints api name
    - `ENDPOINT_VERSION` - value of the endpoints api version
    - `ARTIFACTS` - folder for build artifacts and log files
    - `BUILD_TIME` - full build timestamp in yyyy-MM-ddThh-mm-ss-sssZ
    - `SERVICE_NAME` - the name of the service from deploy.yaml
    - `GCLOUD_PROJECT` - the name of the google project from deploy.yaml
    - `HOSTNAME` - the host value from the deploy.yaml file
    - `NODE_PORT` - the configured or generated port for the kube service

## CircleCI

For those of you using CircleCI, here is a basic setup:

  1. Following the direction here https://circleci.com/docs/1.0/google-auth/ to create the `GCLOUD_SERVICE_KEY` environment variable.
  2. Create and commit a `deploy.yaml` configuration file in your root directory.
  3. Configure your build etc as follows:


    dependencies:
      pre:
      - "npm install -g @vroomlabs/gsdk-deploy"
    compile:
      override:
      - docker build -t user/build .
    deployment:
      develop:
        branch: [develop]
        commands:
        - "gsdk-deploy full-deploy -auth-env:GCLOUD_SERVICE_KEY_DEV -image:user/build -branch:dev"

