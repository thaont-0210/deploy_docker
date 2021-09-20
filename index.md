# Multi dockers deployer
*Note* This improves from [Laravel deployer](https://thaont540.github.io/node_deploy/)

This small tool will help us deploy many of "services" in microservice to single server, which one of services is a docker.

Once time setup, forever using.

## Manual setup
### Install requirement
```
$ sudo apt-get install git
$ curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -
$ sudo apt-get install -y nodejs
$ npm install pm2 -g
```
### Setting
- Git clone from [Master branch](https://github.com/thaont-0210/deploy_docker/tree/batch_deploy_docker)
- Move to folder `deploy_docker`
- Config `.env` file
```
cp .env.example .env
```
*Note* Go to [Personal access tokens ](https://github.com/settings/tokens) to get token for `GITHUB_AUTH_TOKEN`
- Install package:
```
$ npm install
```
- Run in background:
```
$ pm2 start app.js
```

### Config env

```
NODE_PORT=8080 // ==> port which deploy server will run on
BASE_FOLDER=/var/www/ // ==> root folder contained all service repositories0
GIT_REMOTE=origin // ==> default fallback remote
GIT_BRANCH=develop // ==> default fallback branch
GITHUB_AUTH_TOKEN= // ==> Github personal access token above
```
- For example, we have `/var/www/repo_service_1`, `/var/www/repo_service_2`, ... so, base folder is `/var/www/`

```
BATCH_DEPLOY_NUMBER=3 // => total number repositories want to deploy

BATCH_DEPLOY_1_NAME=abc // ==> name for service 1
BATCH_DEPLOY_1_FOLDER=abc-folder // ==> repo_service_1 or repo_service_1 for above example
BATCH_DEPLOY_1_RUN_NPM=false // ==> run npm install after deploy or not
BATCH_DEPLOY_1_DOCKER_TO_RUN_NPM= // ==> docker name want to run npm install within
BATCH_DEPLOY_1_GITHUB_REPO_OWNER= // ==> repo owner
```
- For example, if value of `BATCH_DEPLOY_NUMBER` = 3. So, we need have env for `BATCH_DEPLOY_1_*`, `BATCH_DEPLOY_2_*`, `BATCH_DEPLOY_3_*`

## Auto setup

**Not running well, please use a manual setup.**

![](https://github.com/thaont-0210/deploy_docker/blob/batch_deploy_docker/bash.png?raw=true)
- Download bash file [install.sh](https://github.com/thaont-0210/deploy_docker/blob/batch_deploy_docker/install.sh) then move it to `/var/www/`
- Change to `deploy` user
```
$ sudo su - deploy
```
- Then run this file in `deploy` user
```
$ ./install.sh
```
### Bash file with su permission
- Download bash file [sudo_install.sh](https://github.com/thaont-0210/deploy_docker/blob/batch_deploy_docker/sudo_install.sh) then move it to `/var/www/`
- Then run with sudo:
```
$ sudo ./sudo_install.sh
```

## Nginx setup
- Use reverse proxy
```
#.....
location ^~/socket.io/ {
    proxy_pass http://localhost:8001; #node port
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_redirect off;

    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
}
location /deploy {
    proxy_pass http://localhost:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_redirect off;

    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
}
location ^~/nes.css/ {
    proxy_pass http://localhost:8001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_redirect off;

    proxy_buffers 8 32k;
    proxy_buffer_size 64k;

    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_set_header X-NginX-Proxy true;
    auth_basic "off";
}
#....
```

**!! Note !!** If your project used Laravel echo or something else like socketIO, this will get conflict.

## How to use
![](https://github.com/thaont-0210/deploy_docker/blob/batch_deploy_docker/demo.png?raw=true)
- Go to `https://yourdomain.com/` to start deploy
- Check on checkbox in section [Select repositories want to deploy] which repo you want to deploy
- Click [Click here to deploy] to start deploy

*Check:*
- Check pm2 at [pm2.keymetrics.io](https://pm2.keymetrics.io/)
- Get Github auth token [here](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line)
