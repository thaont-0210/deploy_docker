require('dotenv').config();
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const app = require('express')();
const express = require('express');
const path = require('path');
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const { Octokit } = require("@octokit/rest");
const authToken = process.env.GITHUB_AUTH_TOKEN;
var octokit = null;
const { dockerCommand } = require('docker-cli-js');


if (authToken) {
    octokit = new Octokit({
        auth: authToken
    });
}

const base_folder = process.env.BASE_FOLDER || '~/';
const port = process.env.NODE_PORT || 8080;
const gitRemote = process.env.GIT_REMOTE || 'origin';
var gitBranch = 'develop';

const batchDeployNumber = process.env.BATCH_DEPLOY_NUMBER || 0;
const batchDeploy = [];

if (batchDeployNumber > 0) {
    for (let i = 1; i <= batchDeployNumber; i++) {
        batchDeploy.push({
            name: process.env[`BATCH_DEPLOY_${i}_NAME`],
            folder: process.env[`BATCH_DEPLOY_${i}_FOLDER`],
            isRunNpm: process.env[`BATCH_DEPLOY_${i}_RUN_NPM`] === 'true' || false,
            dockerToRunNpm: process.env[`BATCH_DEPLOY_${i}_DOCKER_TO_RUN_NPM`] || null,
            repoOwner: process.env[`BATCH_DEPLOY_${i}_GITHUB_REPO_OWNER`] || null,
            current_branch: '',
            current_commit: '',
            deploy_branch: '',
            branches: [],
        });
    }
}

var running = false;
var logs = [];
var progress = 0;
var progressNumber = 1;

http.listen(port, function () {
    console.log('Server listening at ' + port);
});

app.use(express.static(__dirname + '/node_modules'));

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/index.html'));
});

app.get('/favicon.svg', function(req, res) {
    res.sendFile(path.join(__dirname + '/favicon.svg'));
});

io.on('connection', (socket) => {
    if (batchDeploy.length) {
        let countDone = 0;
        for (let i = 0; i < batchDeploy.length; i++) {
            getCurrentBranch(batchDeploy[i].folder, batchDeploy[i].name, i).then(currentBranch => {
                batchDeploy[i].current_branch = currentBranch;
                countDone++;
            });
            getCurrentCommit(batchDeploy[i].folder, batchDeploy[i].name, i).then(currentCommit => {
                batchDeploy[i].current_commit = currentCommit;
                countDone++;
            });

            repositoryBranches(batchDeploy[i].repoOwner, batchDeploy[i].folder).then(branches => {
                batchDeploy[i].branches = branches;
                countDone++;
            })
        }

        let a = setInterval(function () {
            if (countDone === batchDeploy.length * 3) {
                clearInterval(a);
                io.emit('current info', batchDeploy);
            }
        }, 500);
    }

    socket.on('get branches', function (a) {
        if (running) {
            io.emit('status', 'deploying');
            io.emit('show log', logs);
            io.emit('show progress', progress);
        } else {
            io.emit('status', 'Not deploy');
        }
    });

    socket.on('deploy', function (deployBranches) {
        if (running) {
            console.log('Dang chay cmnr, deploy cc a?');
            io.emit('status', 'deploying');
        } else {
            io.emit('status', 'deploying');
            deploy(deployBranches).then(a => {
                console.log('Deploy xong roi day!');
            });
        }
    });
});

async function deploy(deployBranches) {
    let deployed = false;
    if (batchDeploy.length && Object.keys(deployBranches).length) {
        progressNumber = Object.keys(deployBranches).length;
        for (let i = 0; i < batchDeploy.length; i++) {
            if (typeof deployBranches[batchDeploy[i].name] !== 'undefined') {
                gitBranch = deployBranches[batchDeploy[i].name];
                deployed = await run(batchDeploy[i].name, batchDeploy[i].folder, batchDeploy[i].isRunNpm, batchDeploy[i].dockerToRunNpm)
            }
        }
    }

    running = true;
    if (deployed) {
        progress = 100;
        showing('Deployed successfully!');
        io.emit('status', 'done');
    } else {
        showing('Failed to deploy!');
        io.emit('status', 'fail');
    }

    running = false;
    logs = [];
    progress = 0;
}

async function repositoryBranches(owner = '', repo = '') {
    let branches = [];
    if (authToken) {
        let protect = false;
        let per_page = 100;

        let recursive = true;
        let page = 1;

        while (recursive) {
            let { data } = await octokit.repos.listBranches({
                owner,
                repo,
                protect,
                per_page,
                page,
            });

            let a = data.map(function (b) {
                return b.name;
            });

            branches = branches.concat(a);
            page++;
            recursive = a.length;
        }
    } else {
        branches = ['develop'];
    }

    return branches;
}

async function getCurrentCommit(folder = '', name = '') {
    const { stdout, stderr } = await exec(`cd ${base_folder}/${folder} && git log -1`);

    return stdout
}

async function getCurrentBranch(folder = '', name = '') {
    const { stdout, stderr } = await exec(`cd ${base_folder}/${folder} && git rev-parse --abbrev-ref HEAD`);

    return stdout.replace('\n', '')
}

async function run(name = '', folder = '', isRunNpm = false, dockerToRunNpm = null) {
    showing(`===== Deploying for ${name} =====`);
    showing('Fetch new code from Github');
    progress = 10 / progressNumber;
    let fetched = await executeZ(`cd  ${base_folder}/${folder} && /usr/bin/git fetch ${gitRemote} ${gitBranch}`);
    if (!fetched) {
        return false;
    }

    showing('Checkout to new branch');
    progress = 20 / progressNumber;
    let checkout = await executeZ(`cd ${base_folder}/${folder} && /usr/bin/git checkout -f && /usr/bin/git checkout ${gitBranch}`);
    if (!checkout) {
        return false;
    }

    showing('Pull new code from Github');
    progress = 30 / progressNumber;
    let pulled = await executeZ(`cd ${base_folder}/${folder} && /usr/bin/git pull ${gitRemote} ${gitBranch} && /usr/bin/git submodule update -i`);
    if (!pulled) {
        return false;
    }

    showing('Shutting down Docker');
    progress = 40 / progressNumber;
    let dockerDown = await executeZ(`cd ${base_folder}/${folder} && docker-compose down`);
    if (!dockerDown) {
        return false;
    }

    showing('Creating new Docker');
    progress = 80 / progressNumber;
    let dockerUp = await executeZ(`cd ${base_folder}/${folder} && docker-compose up -d`);
    if (!dockerUp) {
        return false;
    }

    if (isRunNpm) {
        showing('Installing npm');
        progress = 90 / progressNumber;
        // let installNpm = await executeZ(`cd ${base_folder}/${folder} && docker exec -i ${dockerToRunNpm} npm install`);
        // if (!installNpm) {
        //     return false;
        // }

        const options = {
            machineName: null,
            currentWorkingDirectory: `${base_folder}/${folder}`,
            echo: true,
        };

        let installNpm = await dockerCommand(`exec -i ${dockerToRunNpm} npm install`, options);
        if (!installNpm) {
            return false;
        }
    }

    showing(`Deployed ${name}`);
    progress = 100 /progressNumber;

    return true;
}

async function executeZ(cmd, showCmd = true) {
    if (showCmd) {
        showing('>>>>>> ' + cmd);
    }

    try {
        const { stdout, stderr } = await exec(cmd);
        if (showCmd) {
            showing(stdout);
        }
        // showing(stderr);
        console.log('Done!');

        return true;
    } catch (err) {
        console.error(err);
        if (showCmd) {
            showing(err.toString());
        }

        return false;
    }

    // TO DO log file
}


function showing(message = '') {
    console.log(message);
    logs.push(message);
    io.emit('show log', logs);
    io.emit('show progress', progress);
}
