/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import fs from 'fs';
import arg from 'arg';
import chalk from 'chalk';
import { LocalService, NVD, LocalHost, logger } from '@fieldfare/core';
import { init, terminate, setupEnvironment } from '@fieldfare/node';
import { dashboard } from './dashboard.js';

var env;

function parseArgumentsIntoOptions(rawArgs) {
    const args = arg(
    {
        '--dashboard': Boolean,
        '--daemon': Boolean
    },
    {
        argv: rawArgs.slice(2),
    }
    );

    var path = '';

    if(rawArgs[2] && rawArgs[2].search('--')) {
        path = rawArgs[2];
    }

    return {
        path:  path,
        dashboard: args['--dashboard'] || false,
        daemon: args['--daemon'] || false
    };
}

export async function main(args) {

    logger.log('info', "===== System started at " + Date.now());

    const options = parseArgumentsIntoOptions(args);

    try {
        await init();
        env = await setupEnvironment();
        // const envWebports = env.elements.get('webports');
        // if(await envWebports.isEmpty()) {
        //     const bootWebports = await getBootWebports();
        //     for(const webport of bootWebports) {
        //         try {
        //             await LocalHost.connectWebport(webport);
        //             break;
        //         } catch (error) {
        //             logger.error("Cannot reach " + webport.address + " at port " + webport.port + ' cause: ' + error);
        //         }
        //     }
        // }
    } catch (error) {
        logger.error('Fieldfare initialization failed: ' + error);
        console.log(error.stack);
        process.exit(0);
    }
    if(options.dashboard) {
        try {
            logger.disable();
            dashboard(env);
        } catch (error) {
            logger.error('Failed to start dashboard');
        }
    } else
    if(options.daemon) {
        logger.disable();
    }
    //Fetch service implementations from NVD
    const implementationFilesJSON = await NVD.load('implementations');
    if(implementationFilesJSON) {
        const implementationFiles = JSON.parse(implementationFilesJSON);
        if(!implementationFiles) {
            throw Error('Invalid implementation files list');
        }
        for (const filepath of implementationFiles) {
            logger.info("Loading service implementation from " + filepath);
            try {
                if(!fs.existsSync(filepath)) {
                    throw Error('Service directory not found');
                }
                const {uuid, implementation} = await import('file:' + filepath);
                LocalService.registerImplementation(uuid, implementation);
                logger.info("Service " + uuid + " successfully installed");
            } catch (error) {
                logger.error(chalk.red("Failed to setup service module at \'" + options.path + '\': ' + error.stack));
                terminate();
                process.exit(1);
            }
        }
    } else {
        logger.log('info', "No service implementations defined, running environment basics only");
    }
    logger.log('Joining environment ' + env.uuid);
    await LocalHost.join(env);
}
