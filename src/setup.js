/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import inquirer from 'inquirer';
import inquirerFileTreeSelection from 'inquirer-file-tree-selection-prompt';
import path from 'path';
import chalk from 'chalk';
import * as actions from './setupFunctions.js';

import {
    inputWebport,
    inputUUID,
    inputIndexBetween
} from './menuCommon.js';
import { cryptoManager, logger, Utils } from '@fieldfare/core';
import arg from 'arg';

async function environmentMenu() {

    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Environment Implementation', 'Set Environment UUID', 'Back'],
    };
    console.log("__________ Environment Configuration __________");
    console.log("| Current Environment UUID: " + await actions.getEnvironmentUUID());
    console.log("| Environment class: " + (await actions.getEnvironmentClass()).name);
    console.log("____________________ ...");
    const answer = await inquirer.prompt(prompt);
    switch(answer.action) {
        case 'Environment Implementation': {
            inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
            const fileChoice = await inquirer.prompt([
                {
                  type: 'file-tree-selection',
                  name: 'file'
                }
              ]
            );
            const fullpath = path.normalize(fileChoice.file);
            try {
                await actions.validateEnvironmentImplementation(fullpath);
                await actions.setEnvironmentClassPath(fullpath);
            } catch (error) {
                console.log(chalk.red("Failed to set environment implementation: " + error.stack));
            }
            environmentMenu();
        } break;
        case 'Set Environment UUID': {
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop previous UUID?"
            });
            if(confirm) {
                const answer = await inquirer.prompt(inputUUID);
                if(answer.uuid !== '')  {
                    await actions.setEnvironmentUUID(answer.uuid);
                }
            }
            environmentMenu();
        } break;
        case 'Generate Random UUID': {
            environmentMenu();
        } break;
        default:
            mainMenu();
    }
}

async function implementationsMenu() {
    const prompt = {
        type: 'list',
        name: 'action',
        message: 'Choose one action: ',
        choices: [  'Add Implementation',
                    'Remove Implementation',
                    'Remove All',
                    'Wipe Service Data',
                    'Back'],
    };
    console.log("__________ Local Service Implementations __________");
    let implementations = await actions.getServiceImplementations();
    if(implementations && implementations.length > 0) {
        const truncatedImplentations = implementations.map(({uuid, filename}) => {
            if(filename.length > 24) {
                return {uuid, filename: '...' + filename.slice(filename.length-24)};
            } else {
                return {uuid, filename};
            }
        });
        console.table(truncatedImplentations);
    } else {
        implementations = [];
        console.log(" <No implementations registered>");
    }
    const answer = await inquirer.prompt(prompt);
    switch(answer.action) {
        case 'Add Implementation': {
            inquirer.registerPrompt('file-tree-selection', inquirerFileTreeSelection);
            const fileChoice = await inquirer.prompt([
                {
                  type: 'file-tree-selection',
                  name: 'file'
                }
            ]);
            const fullpath = path.normalize(fileChoice.file);
            try {
                const newImplentation = await actions.validateServiceImplementation(fullpath);
                console.log('new uuid: ' + newImplentation.uuid);
                for(const {uuid} of implementations) {
                    console.log('previous implentation uuid: ' + uuid);
                    if(newImplentation.uuid === uuid) {
                        throw Error('Implementation with UUID ' + uuid + ' already registered');
                    }
                }
                await actions.addServiceImplementation(fullpath);
            } catch (error) {
                console.log(chalk.red("Failed to add new implementation: " + error.stack));
            }
            implementationsMenu();
        } break;
        case 'Remove Implementation': {
            if(implementations && implementations.length > 0) {
                let index=0;
                if(implementations.length > 1) {
                    index = (await inquirer.prompt(inputIndexBetween(0, implementations.length-1))).index;
                }
                console.log('Index: ' + index);
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: "Are you sure you want to unregister the implementation from file "
                        + implementations[index].filename + "?"
                });
                if(confirm) {
                    await actions.removeServiceImplementation(index);
                }
            }
            implementationsMenu();
        } break;
        case 'Remove All': {
            if(implementations && implementations.length > 0) {
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: "Are you sure you want to unregister all service implementations?"
                });
                if(confirm) {
                    await actions.removeAllServiceImplementations();
                }
            }
            implementationsMenu();
        } break;
        case 'Wipe Service Data': {
            if(implementations && implementations.length > 0) {
                let index = 0;
                if(implementations.length > 1) {
                    index = (await inquirer.prompt(inputIndexBetween(0, implementations.length-1))).index;
                }
                console.log(index);
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: "Are you sure you want to wipe all LOCAL data assigned to collection " + implementations[index].uuid + "?"
                });
                if(confirm) {
                    await actions.wipeServiceData(implementations[index].uuid);
                }
            } else {
                console.log('No services implemented');
            }
            implementationsMenu();
        } break;
        default:
        case 'Back': {
            mainMenu();
        } break;
    }
}

async function localHostMenu() {
    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Generate Private Key', 'Import Private Key', 'Back'],
    };
    console.log("__________ Local Host Configuration __________");
    console.log("| Current Host ID: " + await actions.getLocalHostID());
    const answer = await inquirer.prompt(prompt);
    switch(answer.action) {
        case 'Generate Private Key': {
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop previous key pair?"
            });
            if(confirm) {
                await cryptoManager.generateLocalKeypair();
            }
            localHostMenu();
        } break;
        default:
            mainMenu();
    }
}

async function bootWebportsMenu() {
    const prompt = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add Webport', 'Remove Webport', 'Remove All', 'Back'],
    };
    console.log("__________ Boot Webports Configuration __________");
    const webports = await actions.getBootWebports();
    if(webports) {
        console.table(webports);
    } else {
        console.log(" <No boot webports defined>");
    }
    const answer = await inquirer.prompt(prompt);
    switch(answer.action) {
        case 'Add Webport':
            const answers = await inquirer.prompt(inputWebport);
            console.log(JSON.stringify(answers));
            await actions.addBootWebport(answers);
            bootWebportsMenu();
            break;

        case 'Remove Webport': {
            if(webports && webports.length > 0) {
                var index = 0;
                if(webports.length > 1) {
                    index = await inquirer.prompt(inputIndexBetween(0, webports.length-1));
                }
                const webportToRemove = webports[index];
                console.table(webportToRemove);
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you with to drop this webport?'
                });
                if(confirm) {
                    await actions.removeBootWebport(index);
                }
            } else {
                console.log("Boot webports registry is empty");
            }
            bootWebportsMenu();
        } break;

        case 'Remove All': {
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: "Are you sure you want to drop all Boot Webports?"
            });
            if(confirm) {
                await actions.removeAllBootWebports();
            }
            bootWebportsMenu();
        } break;

        default:
            mainMenu();
    }
}

function mainMenu() {

    const menu = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Local Host', 'Environment', 'Service Implementations', 'Boot Webports', 'Exit'],
    };

    console.log('--- Fieldfare Host configuration ---');

    inquirer.prompt(menu).then((answers) => {
        switch (answers.submenu ) {
            case'Local Host':
                localHostMenu();
                break;

            case 'Environment':
                environmentMenu();
                break;

            case 'Service Implementations':
                implementationsMenu();
                break;

            case 'Boot Webports':
                bootWebportsMenu();
                break;

            default:
                console.log("All done! Exit...");
                process.exit(0);
        }
    });
}

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--envuuid': String,
        '--envclass': String,
        '--serviceclass': String,
        '--protocol':String,
        '--address':String,
        '--port':String,
        '--hostid':String,
        '-l':Boolean,
        '-a':Boolean,
        '-b':Boolean,
        '-n':Boolean,
        '-s':Boolean,
        '-v':Boolean
    },
    {
        argv: rawArgs.slice(2),
    }
    );

    return {
        envuuid: args['--envuuid'] || null,
        envclass: args['--envclass'] || null,
        serviceclass: args['--serviceclass'] || null,
        protocol: args['--protocol'] || null,
        address: args['--address'] || null,
        port: args['--port'] || null,
        hostid: args['--hostid'] || null,
        list: args['-l'] || false,
        new: args['-n'] || false,
        add: args['-a'] || false,
        set: args['-s'] || false,
        bootwebport: args['-b'] || false,
        verbose: args['-v'] || false
    };
}

export async function main(args) {
    logger.disable();
    await actions.init();
    if(args.length < 3) {
        mainMenu();
    } else {
        const options = parseArgumentsIntoOptions(args);
        // console.log(options);
        if(options.new) { // NEW
            await cryptoManager.generateLocalKeypair();
            if(options.verbose) console.log("New Host ID: " + await actions.getLocalHostID());
        } else if (options.list) { //LIST
            console.log("Current Host ID: " + await actions.getLocalHostID());
            console.log("Current Environment UUID: " + await actions.getEnvironmentUUID());
            console.log("Current Environment Class: " + (await actions.getEnvironmentClass()).name);
            if(options.verbose) {
                console.log("Local Service Implementations:");
                const implementations = await actions.getServiceImplementations();
                if(implementations && implementations.length > 0) {
                    for(const implementation of implementations) {
                        console.log(JSON.stringify(implementation, null, 2));
                    }
                } else {
                    console.log(" <No implementations registered>");
                }
                console.log("Boot Webports:");
                const webports = await actions.getBootWebports();
                if(webports) {
                    for(const webport of webports) {
                        console.table(JSON.stringify(webport, null, 2));
                    }
                } else {
                    console.log(" <No boot webports defined>");
                }
            }
        } else if(options.set) { //SET
            if(options.envuuid) {
                if(options.verbose) console.log("Setting new Environment UUID: " + options.envuuid);
                await actions.setEnvironmentUUID(options.envuuid);
            }
            if(options.envclass) {
                const fullpath = path.normalize(path.resolve(options.envclass));
                    try {
                        await actions.validateEnvironmentImplementation(fullpath);
                        if(options.verbose) console.log("Setting new Environment Class: " + fullpath);
                        await actions.setEnvironmentClassPath(fullpath);
                    } catch (error) {
                        console.log(chalk.red("Failed to set environment implementation: " + error.stack));
                    }
            }
        } else if(options.add) {
            if(options.serviceclass) {
                const fullpath = path.normalize(path.resolve(options.serviceclass));
                try {
                    const newImplentation = await actions.validateServiceImplementation(fullpath);
                    if(options.verbose) console.log('New service UUID: ' + newImplentation.uuid);
                    await actions.addServiceImplementation(fullpath);
                } catch (error) {
                    if(options.verbose) console.log(chalk.red("Failed to add new implementation: " + error.stack));
                }
            }
            if(options.bootwebport) {
                if(options.protocol && options.address && options.port) {
                    if(options.protocol === 'udp' || options.protocol === 'ws') {
                        if(Utils.isIPV4(options.address)) {
                            if(options.port > 0 && options.port < 65536) {
                                const webport = {protocol: options.protocol, address: options.address, port: options.port};
                                if(options.verbose) console.log('Adding new boot webport: ' + JSON.stringify(2, null, webport));
                                await actions.addBootWebport(webport);
                            } else {
                                console.log("Invalid port number");
                            }
                        } else {
                            console.log("Invalid IPv4 address");
                        }
                    } else {
                        console.log("Invalid protocol");
                    }

                } else {
                    console.log("Missing arguments: protocol, address or port");
                }
            }
        } else {
            console.log("Invalid arguments");
        }
    }
}
