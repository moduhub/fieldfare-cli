/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import inquirer from 'inquirer';
import arg from 'arg';
import chalk from 'chalk';
import { LocalHost, HostIdentifier, VersionChain, logger } from '@fieldfare/core';
import { init, terminate, setupEnvironment, getBootWebports } from '@fieldfare/node';
import {
    inputWebport,
    inputUUID
} from './menuCommon.js';

const title = chalk.bold.blue;

var env;

function hasSpecialChars(value) {
    const regex = /^[a-zA-Z0-9!@#\$%\^\&*\)\(+=._-]+$/g;
    return !(regex.test(value));
}

const inputHostID = {
    type: 'input',
    name: 'hostid',
    message: "Please enter a Host ID (leave blank to cancel or 'this' to use local host ID): ",
    validate(value) {
        if(value == ''
        || value == 'this') {
            return true;
        }

        if (HostIdentifier.isValid(value)) {
            return true;
        }

        return 'Please enter a valid Host Identifier in \'h:base64\' format';
    },
    filter(value) {
        if(value === 'this') {
            return LocalHost.getID();
        }
        return value;
    }
};


const inputServiceName = {
    type: 'input',
    name: 'serviceName',
    message: 'Enter service name: ',
    validate(value) {
        if(value.length == 0) {
            return 'Please enter some value';
        }
        if(value.length > 16) {
            return 'Name is too long! (max 16 chars)';
        }
        if(hasSpecialChars(value)) {
            return 'Name contains invalid chars';
        }
        return true;
    }
}

const inputServiceMethod = {
    type: 'input',
    name: 'methodName',
    message: 'Enter a new method name, leave blank to proceed to next step: '
};

const inputCollectionElementName = {
    type: 'input',
    name: 'elementName',
    message: 'Enter element name, leave blank to end: '
};

const inputCollectionElementType = {
    type: 'list',
    name: 'elementType',
    message: 'Choose new element type: ',
    choices: ['list', 'set', 'map', 'geofield']
};

const inputCollectionElementDegree = {
    type: 'input',
    name: 'degree',
    message: 'Enter the element degree (number of element per node): ',
    validate(value) {
        const intValue = parseInt(value);
        if(intValue < 1
        || intValue > 10) {
            return 'Please enter a number between 1 and 10';
        }
        return true;
    },
    filter(value) {
        return parseInt(value);
    }
};

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--host': String,
        '--uuid': String,
        '--address': String,
        '--port':String,
        '--file':String
    },
    {
        argv: rawArgs.slice(3),
    }
    );

    return {
        uuid: args['--uuid'] || null,
        host: args['--host'] || null,
        address: args['--address'] || null,
        port: args['--port'] || null,
        operation: rawArgs[2],
        variableName: rawArgs[3],
        file: args['--file'] || null
    };
}

async function selectHostMenu(hostArray) {
    const menu = {
      type: 'list',
      name: 'choice',
      message: 'Choose one host ID from the list: ',
      choices: [],
      filter(value) {
          if(value === 'Back') {
              return '';
          }
          return value;
      }
    };
    for (const hostIdentifier of hostArray) {
        menu.choices.push(hostIdentifier);
    }
    menu.choices.push('Back');
    const {choice} = await inquirer.prompt(menu);
    return choice;
}

async function adminsMenu() {
    const menu = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add new', 'Remove one', 'Back'],
    };
    console.log('__________ Environment Admins configuration __________');
    var adminArray = []
    const envAdmins = await env.localCopy.getElement('admins');
    if(envAdmins) {
        for await (const chunk of envAdmins) {
            const {id} = await chunk.expand(0);
            adminArray.push(id);
        }
    }
    if(adminArray.length > 0) {
        console.table(adminArray);
    } else {
        console.log('<no admins defined>');
        menu.choices = menu.choices.filter(value => value != 'Remove one');
    }
    const {action} = await inquirer.prompt(menu);
    switch (action) {
        case 'Add new': {
            const {hostid} = await inquirer.prompt(inputHostID);
            if(hostid !== '') {
                try {
                    await env.commit(
                        env.addAdmin(hostid)
                    );
                } catch (error) {
                    console.log(chalk.red("FAILED: " + error));
                }
            }
            adminsMenu();
        } break;

        case 'Remove one': {
            const hostid = await selectHostMenu(adminArray);
            if(hostid !== '') {
                try {
                    await env.commit(
                        env.removeAdmin(hostid)
                    );
                } catch (error) {
                    console.log(chalk.red("FAILED: " + error));
                }
            }
            adminsMenu();
        } break;

        default:
            mainMenu();
    }

}

async function selectServiceMenu(servicesArray) {
    const menu = {
      type: 'list',
      name: 'choice',
      message: 'Choose one service from the list: ',
      choices: [],
      filter(value) {
          if(value === 'Back') {
              return '';
          }
          const parts = value.split(': ');
          return parts[1].slice(0,-1);
      }
    };
    for await (const serviceDescriptor of servicesArray) {
        menu.choices.push(serviceDescriptor.name + ' (uuid: ' + serviceDescriptor.uuid + ')');
    }
    menu.choices.push('Back');
    console.log(title('__________ Service Providers configuration __________'));
    const {choice} = await inquirer.prompt(menu);
    return choice;
}

async function getServicesArray() {
    const servicesArray = [];
    const services = await env.localCopy.getElement('services');
    if(services) {
        for await (const [keyChunk, valueChunk] of services) {
            servicesArray.push(await valueChunk.expand());
        }
    }
    return servicesArray;
}

async function servicesMenu() {
    const menu = {
      type: 'list',
      name: 'action',
      message: 'Choose one action: ',
      choices: ['Add new', 'Remove one', 'Back'],
    };
    console.log(title('__________ Environment Services configuration __________'));
    const servicesArray = await getServicesArray();
    if(servicesArray.length > 0) {
        console.table(servicesArray);
    } else {
        console.log('<no services defined>');
        menu.choices = menu.choices.filter(value => value !== 'Remove one');
    }
    const {action} = await inquirer.prompt(menu);
    switch (action) {
        case 'Add new': {
            try {
                var {uuid} = await inquirer.prompt(inputUUID);
                const {serviceName} = await inquirer.prompt(inputServiceName);
                var definition = {
                    uuid: uuid,
                    name: serviceName,
                    methods: [],
                    collection: []
                };
                while (true) {
                    const {methodName} = await inquirer.prompt(inputServiceMethod);
                    if(methodName === '') break;
                    definition.methods.push(methodName);
                }
                while (true) {
                    const {elementName} = await inquirer.prompt(inputCollectionElementName);
                    if(elementName === '') break;
                    const {elementType} = await inquirer.prompt(inputCollectionElementType);
                    const {degree} = await inquirer.prompt(inputCollectionElementDegree);
                    definition.collection.push({
                        name: elementName,
                        descriptor: {
                            type: elementType,
                            degree: degree
                        }
                    });
                }
                console.log("Please review the data entered: ");
                console.log(JSON.stringify(definition, null, 4));
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Do you wish to confirm service inclusion?'
                });
                if(confirm) {
                    await env.commit(
                        env.addService(definition)
                    );
                }
            } catch (error) {
                console.log('Cannot add a new service: ' + error);
            }
            servicesMenu();
        } break;
        case 'Remove one': {
            const uuid = await selectServiceMenu(servicesArray);
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: 'Do you wish to confirm service exclusion?'
            });
            if(confirm) {
                try {
                    await env.commit(
                        env.removeService(uuid)
                    );
                } catch(error) {
                    console.log(chalk.bold.red('Service remove failed: ' + error));
                }
            }
            mainMenu();
        } break;
        default:
            mainMenu();
    }

}


async function providersMenu(serviceUUID) {
    const menu = {
        type: 'list',
        name: 'action',
        message: 'Please select an action below: ',
        choices: ['Add', 'Remove', 'Back']
    }
    console.log(title('__________ Service <'+serviceUUID+'> Providers configuration __________'));
    var providersArray = [];
    const providers = await env.localCopy.getElement(serviceUUID+'.providers');
    if(providers) {
        for await(const providerChunk of providers) {
            const {id} = await providerChunk.expand(0);
            providersArray.push(id);
        }
    }
    if(providersArray.length > 0) {
        console.table(providersArray);
    } else {
        console.log('<No providers defined>');
        menu.choices = menu.choices.filter(value => value !== 'Remove');
    }
    const {action} = await inquirer.prompt(menu);
    switch(action) {
        case 'Add':{
            const { hostid } = await inquirer.prompt(inputHostID);
            if(hostid != '') {
                try {
                    await env.commit(
                        env.addProvider(serviceUUID, hostid)
                    );
                } catch(error) {
                    console.log(chalk.bgRed("Provider inclusion failed: " + error));
                }
            }
            providersMenu(serviceUUID);
        }break;
        case 'Remove': {
            const hostid = await selectHostMenu(providersArray);
            if(hostid != '') {
                try {
                    await env.commit(
                        env.removeProvider(serviceUUID, hostid)
                    );
                } catch(error) {
                    console.log(chalk.bgRed("Provider exclusion failed: " + error));
                }
            }
            providersMenu(serviceUUID);
        } break;
        default:
            mainMenu();
    }
}

async function selectWebportMenu(webports) {
    const menu = {
      type: 'list',
      name: 'choice',
      message: 'Choose one webport from the list: ',
      choices: [],
      filter(value) {
          if(value === 'Back') {
              return '';
          }
          return value;
      }
    };
    for await (const chunk of webports) {
        const webport = await chunk.expand();
        menu.choices.push({
            name: webport.hostid.substring(0,8) +
                '...@' +webport.protocol + '://' + webport.address +':'+webport.port,
            value: chunk
        });
    }
    menu.choices.push('Back');
    const {choice} = await inquirer.prompt(menu);
    return choice;
}

async function webportsMenu() {
    const menu = {
        type: 'list',
        name: 'action',
        message: 'Please select an action below: ',
        choices: ['Add', 'Remove', 'Back']
    }
    console.log(title('__________ Enviroment Webports configuration __________'));
    var list = [];
    const webports = await env.localCopy.getElement('webports');
    if(webports) {
        for await(const chunk of webports) {
            const webport = await chunk.expand();
            list.push(webport);
        }
    }
    if(list.length > 0) {
        console.table(list);
    } else {
        console.log('<No webports defined>');
        menu.choices = menu.choices.filter(value => value !== 'Remove');
    }
    const {action} = await inquirer.prompt(menu);
    switch(action) {
        case 'Add':{
            var newWebport = await inquirer.prompt(inputWebport);
            newWebport.hostid = LocalHost.getID();
            console.log("Review webport data: " + JSON.stringify(newWebport, null, 2));
            const {confirm} = await inquirer.prompt({
                type: 'confirm',
                name: 'confirm',
                message: 'Confirm Webport data inclusion?'
            });
            if(confirm) {
                try {
                    await env.commit(
                        env.addWebport(newWebport)
                    );
                } catch(error) {
                    console.log(chalk.bgRed('Webport inclusion failed: ' + error));
                }
            }
            webportsMenu();
        }break;
        case 'Remove': {
            const chunk = await selectWebportMenu(webports);
            if(chunk) {
                const webport = await chunk.expand();
                console.log("Review webport data: " + JSON.stringify(webport, null, 2));
                const {confirm} = await inquirer.prompt({
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Confirm Webport exclusion?'
                });
                if(confirm) {
                    try {
                        await env.commit(
                            env.removeWebport(chunk)
                        );
                    } catch(error) {
                        console.log(chalk.bgRed('Webport exclusion failed: ' + error));
                    }
                }
            }
            webportsMenu();
        } break;
        default:
            mainMenu();
    }
}

async function mainMenu() {
    const menu = {
      type: 'list',
      name: 'submenu',
      message: 'Choose one module to configure: ',
      choices: ['Admins', 'Services', 'Providers', 'Webports', 'Exit'],
    };
    console.log(title('__________ Fieldfare Environment configuration __________'));
    if(env) {
        console.table({
            uuid: env.uuid,
            version: env.currentVersion
        })
    } else {
        console.log('<No Enviroment configured>');
    }
    const {submenu} = await inquirer.prompt(menu);
    switch (submenu) {
        case 'Admins':
            adminsMenu();
            break;
        case 'Services':
            servicesMenu();
            break;
        case 'Providers':
            const servicesArray = await getServicesArray();
            const serviceUUID = await selectServiceMenu(servicesArray);
            if(serviceUUID !== '') {
                providersMenu(serviceUUID);
            } else {
                mainMenu();
            }
            break;
        case 'Webports':
            webportsMenu();
            break;
        default:
            console.log("All done! Exit...");
            process.exit(0);
    }
}

async function show(name, options) {
    switch(name) {
        case 'admins': {
            const envAdmins = await env.localCopy.getElement('admins');
            if(!envAdmins) {
                console.log('<no admins defined>');
            } else {
                var count = 0;
                for await (const chunk of envAdmins) {
                    const hostIdentifier = HostIdentifier.fromChunkIdentifier(chunk.id);
                    console.log("[" + count++ +"]: " + hostIdentifier);
                }
            }
        } break;
        case 'changes': {
            const localChain = new VersionChain(env.currentVersion, LocalHost.getID(), 50);
            await localChain.prettyPrint();
        } break;
        case 'providers': {
            if(!options.uuid) {
                throw new Error('Missing service UUID');
            }
            const providers = await env.localCopy.getElement(options.uuid + '.providers');
            if(providers) {
                for await (const chunk of providers) {
                    const hostIdentifier = HostIdentifier.fromChunkIdentifier(chunk.id);
                    console.log(">> " + hostIdentifier);
                }
            }
        } break;
        case 'webports': {
            const webports = await env.localCopy.getElement('webports');
            if(webports) {
                for await (const chunk of webports) {
                    const webport = await chunk.expand();
                    console.log(JSON.stringify(webport));
                }
            }
        } break;
        default: {
            throw new Error('Invalid variable name: \"' + name + '\"');
        } break;
    }
}

export async function main(args) {
    const options = parseArgumentsIntoOptions(args);
    logger.disable();
    try {
        await init();
        env = await setupEnvironment();
        const envWebports = await env.localCopy.getElement('webports');
        if(!envWebports) {
            const bootWebports = await getBootWebports();
            for(const webport of bootWebports) {
                try {
                    await LocalHost.connectWebport(webport);
                    break;
                } catch (error) {
                    logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
                }
            }
        }
        //await LocalHost.join(env);
        await LocalHost.serveEnvironmentWebports(env);
    } catch (error) {
        console.error('Fieldfare initialization failed: ' + error.stack);
        process.exit(1);
    }

    switch(options.operation) {
        case undefined:
        case 'menu': {
            await mainMenu();
        } break;
        case 'show': {
            try {
                await show(options.variableName, options);
            } catch(error) {
                console.log(error);
            }
            terminate();
            process.exit(0);
        } break;
        case 'addAdmin': {
                console.log(">>addAdmin " + options.host
                    + 'to environment ' + envUUID);
                await env.commit(
                    env.addAdmin(options.host)
                );
                terminate();
                process.exit(0);
        } break;

        case 'sync': {
            try {
                await env.sync();
            } catch(error) {
                console.log(chalk.bold.red('Sync failed: ' + error));
            }
            terminate();
            process.exit(0);
        } break;

        default: {
            console.log('Unknown operation: ' + options.operation);
            terminate();
            process.exit(1);
        } break;
    }


}
