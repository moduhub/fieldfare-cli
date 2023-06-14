/**
 * Fieldfare: Backend framework for distributed networks
 *
 * Copyright 2021-2023 Adan Kvitschal
 * ISC LICENSE
 */

import {
    LocalService,
    ChunkingUtils,
    NVD,
    Utils,
    cryptoManager,
    logger
} from '@fieldfare/core';
import { NodeCryptoManager, LevelNVD } from '@fieldfare/node';

export async function init() {
    LevelNVD.init();
    await NodeCryptoManager.init();
}

export async function getLocalHostID() {
    const localKeypair = await cryptoManager.getLocalKeypair();
    if(localKeypair) {
        logger.debug('getLocalHostID, publicKey: ' + JSON.stringify(localKeypair.publicKey));
        const publicKeyJWK = await cryptoManager.exportPublicKey(localKeypair.publicKey);
        const hostID = await ChunkingUtils.generateIdentifierForObject(publicKeyJWK);
        return hostID;
    }
    return '<undefined>';
}

export async function getEnvironmentUUID() {
    var uuid = await NVD.load('envUUID');
    if(uuid === undefined) {
        uuid = '<undefined>';
    }
    return uuid;
}

export async function setEnvironmentUUID(uuid) {
    if(Utils.isUUID(uuid) === false) {
        throw Error('invalid UUID');
    }
    await NVD.save('envUUID', uuid);
}

export async function getServiceImplementations() {
    const implementationsJSON = await NVD.load('implementations');
    let implementations;
    if(implementationsJSON) {
        implementations = [];
        const filenames = JSON.parse(implementationsJSON);
        for(const filename of filenames) {
            const {uuid, implementation} = await import('file:' + filename);
            implementations.push({uuid, filename});
        }
    }
    return implementations;
}

export async function validateServiceImplementation(filepath) {
    const {uuid, implementation} = await import('file:' + filepath);
    LocalService.validateImplementation(uuid, implementation);
    return {uuid, implementation};
}

export async function addServiceImplementation(filepath) {
    const implementationsJSON = await NVD.load('implementations');
    var implementations;
    if(implementationsJSON === null
    || implementationsJSON === undefined) {
        implementations = [];
    } else {
        implementations = JSON.parse(implementationsJSON);
    }
    if(implementations.includes(filepath)) {
        throw Error('Implementation already defined');
    }
    implementations.push(filepath);
    await NVD.save('implementations', JSON.stringify(implementations));
}

export async function removeServiceImplementation(index) {
    const implementationsJSON = await NVD.load('implementations');
    var implementations;
    if(implementationsJSON === null
    || implementationsJSON === undefined) {
        implementations = [];
    } else {
        implementations = JSON.parse(implementationsJSON);
    }
    if(index < 0 || index >= implementations.length) {
        throw Error('Implementation index out of range');
    }
    implementations.splice(index, 1);
    await NVD.save('implementations', JSON.stringify(implementations));
}

export async function removeAllServiceImplementations() {
    await NVD.save('implementations', '[]');
}

export async function wipeServiceData(uuid) {
    await NVD.delete(uuid);
}	

export async function getBootWebports() {
    const webportsJSON = await NVD.load('bootWebports');
    if(webportsJSON) {
        return JSON.parse(webportsJSON);
    } else {
        return undefined;
    }
}

export async function addBootWebport(newWebportData) {
    const webportsJSON = await NVD.load('bootWebports');
    var webports;
    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = JSON.parse(webportsJSON);
    }
    if(webports.includes(newWebportData)) {
        throw Error('Webport already defined');
    }
    webports.push(newWebportData);
    await NVD.save('bootWebports', JSON.stringify(webports));
}

export async function removeBootWebport(index) {

    const webportsJSON = await NVD.load('bootWebports');

    var webports;

    if(webportsJSON === null
    || webportsJSON === undefined) {
        webports = [];
    } else {
        webports = webportsJSON;
    }

    webports.splice(index, 1);

    await NVD.save('bootWebports', JSON.stringify(webports));
}

export async function removeAllBootWebports() {

    await NVD.save('bootWebports', '[]');

}
